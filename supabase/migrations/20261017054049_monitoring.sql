begin;
create table public.monitors(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null check(length(trim(name)) between 2 and 80),state text not null default 'paused' check(state in ('active','paused')),created_by uuid not null,created_at timestamptz not null default now(),next_run_at timestamptz not null default now(),generation integer not null default 0,active_version_id uuid,failures integer not null default 0 check(failures>=0),unique(organization_id,id),foreign key(organization_id,created_by) references public.organization_members(organization_id,user_id));
create table public.monitor_versions(id uuid primary key default gen_random_uuid(),organization_id uuid not null,monitor_id uuid not null,version integer not null check(version>0),definition jsonb not null,recipient_email text not null,created_at timestamptz not null default now(),unique(organization_id,monitor_id,id),unique(organization_id,monitor_id,version),foreign key(organization_id,monitor_id) references public.monitors(organization_id,id));
alter table public.monitors add foreign key(organization_id,id,active_version_id) references public.monitor_versions(organization_id,monitor_id,id);
create table public.probe_jobs(id uuid primary key default gen_random_uuid(),organization_id uuid not null,monitor_id uuid not null,version_id uuid not null,scheduled_at timestamptz not null,generation integer not null default 0,state text not null default 'queued' check(state in ('queued','running','completed','skipped','requires_review')),attempts integer not null default 0,lease_token uuid,lease_until timestamptz,evidence jsonb,completed_at timestamptz,unique(organization_id,id),unique(organization_id,monitor_id,scheduled_at),foreign key(organization_id,monitor_id,version_id) references public.monitor_versions(organization_id,monitor_id,id));
create unique index one_inflight_probe on public.probe_jobs(organization_id,monitor_id) where state in ('queued','running');
create table public.monitor_runs(id uuid primary key default gen_random_uuid(),organization_id uuid not null,monitor_id uuid not null,version_id uuid not null,probe_id uuid not null,transition text not null check(transition in ('down','recovery')),state text not null default 'queued' check(state in ('queued','succeeded','skipped','requires_review')),steps jsonb not null,created_at timestamptz not null default now(),unique(organization_id,id),unique(organization_id,probe_id),foreign key(organization_id,monitor_id,version_id) references public.monitor_versions(organization_id,monitor_id,id),foreign key(organization_id,probe_id) references public.probe_jobs(organization_id,id));
create table public.monitor_incidents(id uuid primary key default gen_random_uuid(),organization_id uuid not null,monitor_id uuid not null,opened_run_id uuid not null,resolved_run_id uuid,opened_at timestamptz not null default now(),resolved_at timestamptz,unique(organization_id,id),foreign key(organization_id,monitor_id) references public.monitors(organization_id,id),foreign key(organization_id,opened_run_id) references public.monitor_runs(organization_id,id),foreign key(organization_id,resolved_run_id) references public.monitor_runs(organization_id,id));
create unique index one_open_incident on public.monitor_incidents(organization_id,monitor_id) where resolved_at is null;
create table public.monitor_deliveries(id uuid primary key default gen_random_uuid(),organization_id uuid not null,run_id uuid not null,recipient_id uuid not null,recipient_email text not null,subject text not null,body text not null,state text not null default 'queued' check(state in ('queued','sending','succeeded','skipped','requires_review')),attempts integer not null default 0,first_attempt_at timestamptz,lease_token uuid,lease_until timestamptz,provider_id text,error_category text,unique(organization_id,id),unique(organization_id,run_id),foreign key(organization_id,run_id) references public.monitor_runs(organization_id,id),foreign key(organization_id,recipient_id) references public.organization_members(organization_id,user_id));
create table public.monitor_usage(organization_id uuid not null references public.organizations(id),metric text not null check(metric in ('probe','run','notification')),period date not null,quantity integer not null default 0,primary key(organization_id,metric,period));
create table public.monitor_usage_ledger(organization_id uuid not null references public.organizations(id),metric text not null,unit_id uuid not null,period date not null,created_at timestamptz not null default now(),primary key(organization_id,metric,unit_id));
create table private.monitor_host_leases(host text primary key,last_started_at timestamptz not null);
create table private.monitor_outbox(id uuid primary key default gen_random_uuid(),organization_id uuid not null,probe_id uuid,delivery_id uuid,attempts integer not null default 0,token uuid,lease_until timestamptz,next_attempt_at timestamptz not null default now(),published_at timestamptz,state text not null default 'pending' check(state in ('pending','publishing','published','requires_review')),check((probe_id is null)<>(delivery_id is null)),foreign key(organization_id,probe_id) references public.probe_jobs(organization_id,id),foreign key(organization_id,delivery_id) references public.monitor_deliveries(organization_id,id));
create index monitors_due on public.monitors(next_run_at) where state='active';
create index probe_history on public.probe_jobs(organization_id,scheduled_at desc);
create index monitor_run_recent on public.monitor_runs(organization_id,created_at desc);
create index monitor_outbox_due on private.monitor_outbox(next_attempt_at) where state in ('pending','publishing');
alter table private.monitor_outbox enable row level security;
alter table private.monitor_host_leases enable row level security;

create function private.monitor_reserve(p_org uuid,p_metric text,p_unit uuid,p_limit integer) returns boolean language plpgsql security definer set search_path='' as $$
declare p date:=date_trunc('month',now() at time zone 'UTC')::date;n integer;begin
 if exists(select 1 from public.monitor_usage_ledger where organization_id=p_org and metric=p_metric and unit_id=p_unit) then return true;end if;
 insert into public.monitor_usage(organization_id,metric,period) values(p_org,p_metric,p) on conflict do nothing;
 select quantity into n from public.monitor_usage where organization_id=p_org and metric=p_metric and period=p for update;
 if exists(select 1 from public.monitor_usage_ledger where organization_id=p_org and metric=p_metric and unit_id=p_unit) then return true;end if;
 if n>=p_limit then return false;end if;
 insert into public.monitor_usage_ledger values(p_org,p_metric,p_unit,p,now());
 update public.monitor_usage set quantity=quantity+1 where organization_id=p_org and metric=p_metric and period=p;
 return true;
end;$$;
create function private.create_monitor(p_org uuid,p_name text,p_url text,p_interval integer,p_recipient uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_role(p_org,array['owner','admin','editor']);m uuid;v uuid;e text;begin
 perform private.rate_limit();
 if p_url !~ '^https://[^/?#@:]+/[^?#]*$' or length(p_url)>2048 or p_interval not between 15 and 1440 then raise exception 'Invalid monitor' using errcode='23514';end if;
 if (select count(*) from public.monitors where organization_id=p_org)>=3 then raise exception 'Monitor limit' using errcode='FF005';end if;
 select lower(a.email) into e from auth.users a join public.organization_members m on m.user_id=a.id where m.organization_id=p_org and m.user_id=p_recipient and m.status='active' and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false);
 if e is null then raise exception 'Recipient must be a verified active member' using errcode='FF001';end if;
 insert into public.monitors(organization_id,name,created_by) values(p_org,trim(p_name),u) returning id into m;
 insert into public.monitor_versions(organization_id,monitor_id,version,definition,recipient_email) values(p_org,m,1,jsonb_build_object('schemaVersion',1,'url',p_url,'intervalMinutes',p_interval,'recipientId',p_recipient),e) returning id into v;
 update public.monitors set active_version_id=v where id=m;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,u,'monitor.created',m);
 return m;
end;$$;
create function private.set_monitor_state(p_org uuid,p_monitor uuid,p_state text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_role(p_org,array['owner','admin','editor']);begin
 perform private.rate_limit();
 update public.monitors set state=p_state,generation=case when p_state='paused' then generation+1 else generation end,next_run_at=greatest(next_run_at,now()),failures=case when p_state='paused' then 0 else failures end where organization_id=p_org and id=p_monitor;
 if not found then raise exception 'Monitor unavailable' using errcode='FF001';end if;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,u,'monitor.'||p_state,p_monitor);
end;$$;

-- Workers use only these reviewed functions, never arbitrary tenant table writes.
create function private.dispatch_monitors() returns integer language plpgsql security definer set search_path='' as $$
declare rec record;j uuid;n integer:=0;begin
 -- Reconcile exhausted/crashed probes and expired provider idempotency windows.
 update public.probe_jobs set state='requires_review' where state in ('queued','running') and attempts>=5 and coalesce(lease_until,'-infinity')<now();
 update public.monitor_deliveries set state='requires_review',error_category='retry_budget_or_window' where state in ('queued','sending') and (attempts>=5 or first_attempt_at<now()-interval '23 hours') and coalesce(lease_until,'-infinity')<now();
 update public.monitor_runs r set state='requires_review' where r.state='queued' and exists(select 1 from public.monitor_deliveries d where d.organization_id=r.organization_id and d.run_id=r.id and d.state='requires_review');
 -- Lost transports / expired workers get another delivery envelope; DB jobs retain identity.
 update private.monitor_outbox o set state='pending',next_attempt_at=now() where o.state='published' and o.published_at<now()-interval '5 minutes' and (
 exists(select 1 from public.probe_jobs j where j.id=o.probe_id and j.organization_id=o.organization_id and j.state in ('queued','running') and coalesce(j.lease_until,'-infinity')<now()) or
 exists(select 1 from public.monitor_deliveries d where d.id=o.delivery_id and d.organization_id=o.organization_id and d.state in ('queued','sending') and coalesce(d.lease_until,'-infinity')<now()));
 for rec in select m.*,v.definition from public.monitors m join public.monitor_versions v on v.id=m.active_version_id and v.organization_id=m.organization_id join public.organizations o on o.id=m.organization_id where m.state='active' and o.archived_at is null and m.next_run_at<=now() and not exists(select 1 from public.probe_jobs j where j.organization_id=m.organization_id and j.monitor_id=m.id and j.state in ('queued','running')) order by m.next_run_at for update of m skip locked limit 50 loop
  insert into public.probe_jobs(organization_id,monitor_id,version_id,scheduled_at,generation) values(rec.organization_id,rec.id,rec.active_version_id,rec.next_run_at,rec.generation) returning id into j;
  insert into private.monitor_outbox(organization_id,probe_id) values(rec.organization_id,j);
  update public.monitors set next_run_at=now()+make_interval(mins=>(rec.definition->>'intervalMinutes')::integer) where id=rec.id;
  n:=n+1;
 end loop;return n;
end;$$;
create function private.claim_monitor_outbox() returns jsonb language plpgsql security definer set search_path='' as $$
declare o record;items jsonb:='[]';t uuid;begin
 for o in select * from private.monitor_outbox where (state='pending' and next_attempt_at<=now()) or (state='publishing' and lease_until<now()) order by next_attempt_at for update skip locked limit 50 loop
  if o.attempts>=12 then
   update private.monitor_outbox set state='requires_review' where id=o.id;
   update public.probe_jobs set state='requires_review' where id=o.probe_id and organization_id=o.organization_id and state in ('queued','running');
   update public.monitor_deliveries set state='requires_review',error_category='outbox_retry_budget' where id=o.delivery_id and organization_id=o.organization_id and state in ('queued','sending');
   update public.monitor_runs r set state='requires_review' where r.organization_id=o.organization_id and r.state='queued' and exists(select 1 from public.monitor_deliveries d where d.id=o.delivery_id and d.organization_id=o.organization_id and d.run_id=r.id);
   continue;
  end if;
  t:=gen_random_uuid();update private.monitor_outbox set state='publishing',token=t,lease_until=now()+interval '2 minutes',attempts=attempts+1 where id=o.id;
  items:=items||jsonb_build_array(jsonb_build_object('id',o.id,'organization_id',o.organization_id,'job_id',coalesce(o.probe_id,o.delivery_id),'kind',case when o.probe_id is not null then 'probe' else 'delivery' end,'token',t,'attempt',o.attempts+1));
 end loop;return items;
end;$$;
create function private.finish_monitor_outbox(p_id uuid,p_token uuid,p_ok boolean) returns void language plpgsql security definer set search_path='' as $$begin
 update private.monitor_outbox set state=case when p_ok then 'published' else 'pending' end,published_at=case when p_ok then now() else null end,next_attempt_at=now()+interval '1 minute' where id=p_id and token=p_token and state='publishing' and lease_until>now();
end;$$;
create function private.claim_probe(p_org uuid,p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.probe_jobs;m public.monitors;v public.monitor_versions;t uuid;v_host text;begin
 -- Job ID is never authority for a different tenant.
 select * into j from public.probe_jobs where id=p_job and organization_id=p_org for update;
 if not found or j.state in ('completed','skipped','requires_review') or (j.state='running' and j.lease_until>now()) then return null;end if;
 select * into m from public.monitors where id=j.monitor_id and organization_id=p_org for update;
 if m.state<>'active' or m.generation<>j.generation or m.active_version_id<>j.version_id or exists(select 1 from public.organizations where id=p_org and archived_at is not null) then update public.probe_jobs set state='skipped' where id=p_job;return null;end if;
 if j.attempts>=5 then update public.probe_jobs set state='requires_review' where id=p_job;return null;end if;
 select * into v from public.monitor_versions where id=j.version_id and organization_id=p_org;
 v_host:=split_part(split_part(v.definition->>'url','://',2),'/',1);
 insert into private.monitor_host_leases values(v_host,now()-interval '2 seconds') on conflict do nothing;
 perform 1 from private.monitor_host_leases where monitor_host_leases.host=v_host and last_started_at<=now()-interval '1 second' for update;
 if not found then return null;end if;
 if not private.monitor_reserve(p_org,'probe',p_job,3000) then update public.probe_jobs set state='skipped',evidence='{"outcome":"quota"}'::jsonb where id=p_job;return null;end if;
 update private.monitor_host_leases set last_started_at=now() where monitor_host_leases.host=v_host;
 t:=gen_random_uuid();update public.probe_jobs set state='running',lease_token=t,lease_until=now()+interval '1 minute',attempts=attempts+1 where id=p_job;
 return jsonb_build_object('organization_id',p_org,'job_id',p_job,'token',t,'definition',v.definition,'monitor_name',m.name);
end;$$;
create function private.finish_probe(p_org uuid,p_job uuid,p_token uuid,p_evidence jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 insert into public.monitor_deliveries(id,organization_id,run_id,recipient_id,recipient_email,subject,body) values(d,p_org,r,(v.definition->>'recipientId')::uuid,v.recipient_email,case when transition='down' then 'Incident: ' else 'Recovered: ' end||m.name,'FutureFlow monitor "'||m.name||'": '||transition||'. Inspect the workspace run history for probe evidence.');
 insert into private.monitor_outbox(organization_id,delivery_id) values(p_org,d);
 return jsonb_build_object('run_id',r,'delivery_id',d);
end;$$;
create function private.claim_monitor_delivery(p_org uuid,p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.monitor_deliveries;t uuid;begin
 select * into d from public.monitor_deliveries where id=p_job and organization_id=p_org for update;
 if not found or d.state in ('succeeded','skipped','requires_review') or (d.state='sending' and d.lease_until>now()) then return null;end if;
 if exists(select 1 from public.organizations where id=p_org and archived_at is not null) or not exists(select 1 from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=p_org and m.user_id=d.recipient_id and m.status='active' and lower(u.email)=d.recipient_email and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)) then update public.monitor_deliveries set state='skipped' where id=p_job;update public.monitor_runs set state='skipped',steps=jsonb_set(steps,'{notification}','"recipient_unavailable"') where id=d.run_id and organization_id=p_org;return null;end if;
 if d.attempts>=5 or d.first_attempt_at<now()-interval '23 hours' then update public.monitor_deliveries set state='requires_review' where id=p_job;update public.monitor_runs set state='requires_review' where id=d.run_id and organization_id=p_org;return null;end if;
 t:=gen_random_uuid();update public.monitor_deliveries set state='sending',lease_token=t,lease_until=now()+interval '1 minute',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()) where id=p_job returning * into d;
 return jsonb_build_object('organization_id',p_org,'job_id',p_job,'token',t,'first_attempt_at',d.first_attempt_at,'recipient',d.recipient_email,'subject',d.subject,'text',d.body);
end;$$;
create function private.finish_monitor_delivery(p_org uuid,p_job uuid,p_token uuid,p_result text,p_provider_id text,p_error text) returns void language plpgsql security definer set search_path='' as $$
declare d public.monitor_deliveries;s text;begin
 if p_result not in ('succeeded','retry','requires_review') or length(coalesce(p_provider_id,''))>200 or length(coalesce(p_error,''))>80 then raise exception 'Invalid result' using errcode='23514';end if;
 select * into d from public.monitor_deliveries where id=p_job and organization_id=p_org for update;
 if not found or d.state<>'sending' or d.lease_token<>p_token or d.lease_until<=now() then return;end if;
 s:=case when p_result='retry' and d.attempts<5 then 'queued' when p_result='retry' then 'requires_review' else p_result end;
 update public.monitor_deliveries set state=s,provider_id=p_provider_id,error_category=p_error,lease_until=null where id=p_job;
 if s in ('succeeded','requires_review') then update public.monitor_runs set state=s,steps=jsonb_set(steps,'{notification}',to_jsonb(s)) where id=d.run_id and organization_id=p_org;end if;
end;$$;
alter table public.monitors enable row level security;
revoke all on public.monitors from anon,authenticated;
grant select on public.monitors to authenticated;
create policy tenant_read on public.monitors for select to authenticated using(private.member_role(organization_id) is not null);
alter table public.monitor_versions enable row level security;
revoke all on public.monitor_versions from anon,authenticated;
grant select on public.monitor_versions to authenticated;
create policy tenant_read on public.monitor_versions for select to authenticated using(private.member_role(organization_id) is not null);
alter table public.probe_jobs enable row level security;
revoke all on public.probe_jobs from anon,authenticated;
grant select on public.probe_jobs to authenticated;
create policy tenant_read on public.probe_jobs for select to authenticated using(private.member_role(organization_id) is not null);
alter table public.monitor_runs enable row level security;
revoke all on public.monitor_runs from anon,authenticated;
grant select on public.monitor_runs to authenticated;
create policy tenant_read on public.monitor_runs for select to authenticated using(private.member_role(organization_id) is not null);
alter table public.monitor_incidents enable row level security;
revoke all on public.monitor_incidents from anon,authenticated;
grant select on public.monitor_incidents to authenticated;
create policy tenant_read on public.monitor_incidents for select to authenticated using(private.member_role(organization_id) is not null);
alter table public.monitor_deliveries enable row level security;
revoke all on public.monitor_deliveries from anon,authenticated;
grant select on public.monitor_deliveries to authenticated;
create policy tenant_read on public.monitor_deliveries for select to authenticated using(private.member_role(organization_id) is not null);
alter table public.monitor_usage enable row level security;
revoke all on public.monitor_usage from anon,authenticated;
grant select on public.monitor_usage to authenticated;
create policy tenant_read on public.monitor_usage for select to authenticated using(private.member_role(organization_id) is not null);
alter table public.monitor_usage_ledger enable row level security;
revoke all on public.monitor_usage_ledger from anon,authenticated;
grant select on public.monitor_usage_ledger to authenticated;
create policy tenant_read on public.monitor_usage_ledger for select to authenticated using(private.member_role(organization_id) is not null);
create function private.reject_immutable_change() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Immutable record' using errcode='23514';end;$$;
create trigger version_immutable before update or delete on public.monitor_versions for each row execute function private.reject_immutable_change();
create trigger ledger_immutable before update or delete on public.monitor_usage_ledger for each row execute function private.reject_immutable_change();
create function public.create_monitor(p_org uuid,p_name text,p_url text,p_interval integer,p_recipient uuid) returns uuid language sql security invoker set search_path='' as $$select private.create_monitor(p_org,p_name,p_url,p_interval,p_recipient)$$;
revoke all on function public.create_monitor(uuid,text,text,integer,uuid),private.create_monitor(uuid,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.create_monitor(uuid,text,text,integer,uuid),private.create_monitor(uuid,text,text,integer,uuid) to authenticated;
create function public.set_monitor_state(p_org uuid,p_monitor uuid,p_state text) returns void language sql security invoker set search_path='' as $$select private.set_monitor_state(p_org,p_monitor,p_state)$$;
revoke all on function public.set_monitor_state(uuid,uuid,text),private.set_monitor_state(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.set_monitor_state(uuid,uuid,text),private.set_monitor_state(uuid,uuid,text) to authenticated;
create function public.dispatch_monitors() returns integer language sql security invoker set search_path='' as $$select private.dispatch_monitors()$$;
revoke all on function public.dispatch_monitors(),private.dispatch_monitors() from public,anon,authenticated;
grant execute on function public.dispatch_monitors(),private.dispatch_monitors() to service_role;
create function public.claim_monitor_outbox() returns jsonb language sql security invoker set search_path='' as $$select private.claim_monitor_outbox()$$;
revoke all on function public.claim_monitor_outbox(),private.claim_monitor_outbox() from public,anon,authenticated;
grant execute on function public.claim_monitor_outbox(),private.claim_monitor_outbox() to service_role;
create function public.finish_monitor_outbox(p_id uuid,p_token uuid,p_ok boolean) returns void language sql security invoker set search_path='' as $$select private.finish_monitor_outbox(p_id,p_token,p_ok)$$;
revoke all on function public.finish_monitor_outbox(uuid,uuid,boolean),private.finish_monitor_outbox(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_monitor_outbox(uuid,uuid,boolean),private.finish_monitor_outbox(uuid,uuid,boolean) to service_role;
create function public.claim_probe(p_org uuid,p_job uuid) returns jsonb language sql security invoker set search_path='' as $$select private.claim_probe(p_org,p_job)$$;
revoke all on function public.claim_probe(uuid,uuid),private.claim_probe(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_probe(uuid,uuid),private.claim_probe(uuid,uuid) to service_role;
create function public.finish_probe(p_org uuid,p_job uuid,p_token uuid,p_evidence jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.finish_probe(p_org,p_job,p_token,p_evidence)$$;
revoke all on function public.finish_probe(uuid,uuid,uuid,jsonb),private.finish_probe(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finish_probe(uuid,uuid,uuid,jsonb),private.finish_probe(uuid,uuid,uuid,jsonb) to service_role;
create function public.claim_monitor_delivery(p_org uuid,p_job uuid) returns jsonb language sql security invoker set search_path='' as $$select private.claim_monitor_delivery(p_org,p_job)$$;
revoke all on function public.claim_monitor_delivery(uuid,uuid),private.claim_monitor_delivery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_monitor_delivery(uuid,uuid),private.claim_monitor_delivery(uuid,uuid) to service_role;
create function public.finish_monitor_delivery(p_org uuid,p_job uuid,p_token uuid,p_result text,p_provider_id text,p_error text) returns void language sql security invoker set search_path='' as $$select private.finish_monitor_delivery(p_org,p_job,p_token,p_result,p_provider_id,p_error)$$;
revoke all on function public.finish_monitor_delivery(uuid,uuid,uuid,text,text,text),private.finish_monitor_delivery(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_monitor_delivery(uuid,uuid,uuid,text,text,text),private.finish_monitor_delivery(uuid,uuid,uuid,text,text,text) to service_role;
revoke all on function private.monitor_reserve(uuid,text,uuid,integer),private.reject_immutable_change() from public,anon,authenticated;
grant usage on schema private to service_role;
commit;
