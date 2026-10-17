-- Ryn branding for future notifications. Existing receipts and published versions stay unchanged.
-- Function signatures, security properties and grants are preserved.

create or replace function private.finish_probe(p_org uuid,p_job uuid,p_token uuid,p_evidence jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.probe_jobs;m public.monitors;v public.monitor_versions;inc uuid;r uuid;d uuid;transition text;outcome text;begin
 if p_evidence is null or p_evidence->>'outcome' is null or p_evidence->>'durationMs' is null or jsonb_typeof(p_evidence)<>'object' or not (p_evidence->>'outcome'=any(array['healthy','unhealthy','timeout','network','blocked'])) or (p_evidence->>'durationMs')::integer not between 0 and 15000 then raise exception 'Invalid evidence' using errcode='23514';end if;
 select * into j from public.probe_jobs where id=p_job and organization_id=p_org for update;
 if not found or j.state<>'running' or j.lease_token<>p_token or j.lease_until<=now() then return null;end if;
 select * into m from public.monitors where id=j.monitor_id and organization_id=p_org for update;
 if m.state<>'active' or m.generation<>j.generation or m.active_version_id<>j.version_id or exists(select 1 from public.organizations where id=p_org and archived_at is not null) then update public.probe_jobs set state='skipped',evidence=p_evidence,completed_at=now() where id=p_job;return null;end if;
 update public.probe_jobs set state='completed',evidence=p_evidence,completed_at=now() where id=p_job;
 outcome:=p_evidence->>'outcome';if outcome='blocked' then return null;end if;
 select id into inc from public.monitor_incidents where organization_id=p_org and monitor_id=m.id and resolved_at is null;
 if outcome='healthy' then update public.monitors set failures=0 where id=m.id;if inc is not null then transition:='recovery';end if;
 else update public.monitors set failures=least(failures+1,1000000) where id=m.id;if m.failures+1>=2 and inc is null then transition:='down';end if;end if;
 if transition is null then return null;end if;
 r:=gen_random_uuid();
 -- Recovery always resolves an existing incident; if a run quota is exhausted, suppress notification only.
 if not private.monitor_reserve(p_org,'run',r,300) then
  if transition='recovery' then
   insert into public.monitor_runs(id,organization_id,monitor_id,version_id,probe_id,transition,state,steps) values(r,p_org,m.id,j.version_id,p_job,transition,'skipped',jsonb_build_object('probe',p_evidence,'incident','recovery','notification','run_quota'));
   update public.monitor_incidents set resolved_at=now(),resolved_run_id=r where id=inc;
  end if;
  return null;
 end if;
 select * into v from public.monitor_versions where id=j.version_id and organization_id=p_org;
 insert into public.monitor_runs(id,organization_id,monitor_id,version_id,probe_id,transition,steps) values(r,p_org,m.id,j.version_id,p_job,transition,jsonb_build_object('probe',p_evidence,'condition',jsonb_build_object('failures',case when outcome='healthy' then 0 else m.failures+1 end,'threshold',2),'incident',transition,'notification','queued'));
 if transition='down' then insert into public.monitor_incidents(organization_id,monitor_id,opened_run_id) values(p_org,m.id,r) returning id into inc;else update public.monitor_incidents set resolved_run_id=r,resolved_at=now() where id=inc;end if;
 d:=gen_random_uuid();
 if not private.monitor_reserve(p_org,'notification',d,100) then update public.monitor_runs set state='skipped',steps=jsonb_set(steps,'{notification}','"quota"') where id=r;return jsonb_build_object('run_id',r);end if;
 insert into public.monitor_deliveries(id,organization_id,run_id,recipient_id,recipient_email,subject,body) values(d,p_org,r,(v.definition->>'recipientId')::uuid,v.recipient_email,case when transition='down' then 'Incident: ' else 'Recovered: ' end||m.name,'Ryn monitor "'||m.name||'": '||transition||'. Inspect the workspace run history for probe evidence.');
 insert into private.monitor_outbox(organization_id,delivery_id) values(p_org,d);
 return jsonb_build_object('run_id',r,'delivery_id',d);
end;$$;

create or replace function private.finish_workflow_event(p_org uuid,p_event uuid,p_token uuid,p_qualified boolean,p_audit boolean,p_recipient uuid,p_trace jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.incoming_events;w public.workflows;v public.workflow_versions;r uuid;d uuid;begin
 select * into e from public.incoming_events where id=p_event and organization_id=p_org for update;
 if not found or e.state<>'running' or e.token<>p_token or e.lease_until<=now() then return null;end if;
 select * into w from public.workflows where id=e.workflow_id and organization_id=p_org for update;
 if w.state<>'active' or w.generation<>e.generation or exists(select 1 from public.organizations where id=p_org and archived_at is not null) then update public.incoming_events set state='skipped',completed_at=now() where id=p_event;return null;end if;
 if jsonb_typeof(p_trace) is distinct from 'array' or jsonb_array_length(p_trace)>20 or octet_length(p_trace::text)>10000 then raise exception 'Invalid trace' using errcode='23514';end if;
 if not p_qualified then update public.incoming_events set state='filtered',completed_at=now() where id=p_event;return null;end if;
 select * into v from public.workflow_versions where id=e.version_id and organization_id=p_org;
 if p_recipient is not null and p_recipient is distinct from v.recipient_id then raise exception 'Recipient mismatch' using errcode='FF001';end if;
 r:=gen_random_uuid();if not private.monitor_reserve(p_org,'run',r,300) then update public.incoming_events set state='skipped',completed_at=now() where id=p_event;return null;end if;
 insert into public.workflow_runs(id,organization_id,workflow_id,version_id,event_id,state,steps) values(r,p_org,w.id,e.version_id,p_event,'queued',p_trace);
 if p_audit then insert into public.audit_logs(organization_id,actor_id,action,resource_id) select p_org,w.created_by,'workflow.audit_record',r from jsonb_array_elements(p_trace) step where step->>'operation'='audit_record' and step->>'status'='recorded';end if;
 if p_recipient is not null then
  d:=gen_random_uuid();if private.monitor_reserve(p_org,'notification',d,100) then
   insert into public.monitor_deliveries(id,organization_id,workflow_run_id,recipient_id,recipient_email,subject,body) values(d,p_org,r,p_recipient,v.recipient_email,'Ryn: '||(v.definition->>'name'),'Workflow "'||(v.definition->>'name')||'" matched its published conditions. Open the workspace run history for evidence.');insert into private.monitor_outbox(organization_id,delivery_id) values(p_org,d);
  else update public.workflow_runs set state='skipped' where id=r;end if;
 else update public.workflow_runs set state='succeeded' where id=r;end if;
 update public.incoming_events set state='completed',completed_at=now() where id=p_event;return jsonb_build_object('run_id',r);
end;$$;
