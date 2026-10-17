begin;
create table public.workflows(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null check(length(name) between 2 and 80),draft jsonb not null,revision integer not null default 1,state text not null default 'draft' check(state in ('draft','active','paused','archived')),generation integer not null default 0,active_version_id uuid,created_by uuid not null,created_at timestamptz not null default now(),unique(organization_id,id),foreign key(organization_id,created_by) references public.organization_members(organization_id,user_id));
create table public.workflow_versions(id uuid primary key default gen_random_uuid(),organization_id uuid not null,workflow_id uuid not null,version integer not null,definition jsonb not null,recipient_id uuid,recipient_email text,created_at timestamptz not null default now(),unique(organization_id,workflow_id,id),unique(organization_id,workflow_id,version),foreign key(organization_id,workflow_id) references public.workflows(organization_id,id),foreign key(organization_id,recipient_id) references public.organization_members(organization_id,user_id));
alter table public.workflows add foreign key(organization_id,id,active_version_id) references public.workflow_versions(organization_id,workflow_id,id);
create table public.webhook_sources(id uuid primary key,organization_id uuid not null,workflow_id uuid not null,revision integer not null default 1,created_at timestamptz not null default now(),unique(organization_id,id),unique(organization_id,workflow_id),foreign key(organization_id,workflow_id) references public.workflows(organization_id,id));
create table private.webhook_secrets(source_id uuid primary key,organization_id uuid not null,ciphertext jsonb not null,foreign key(organization_id,source_id) references public.webhook_sources(organization_id,id));
create table private.webhook_rate(source_id uuid primary key references public.webhook_sources(id),window_start timestamptz not null default now(),quantity integer not null default 1);
create table public.deadline_schedules(id uuid primary key default gen_random_uuid(),organization_id uuid not null,workflow_id uuid not null,version_id uuid not null,due_at timestamptz not null,dispatched_at timestamptz,unique(organization_id,workflow_id,version_id),foreign key(organization_id,workflow_id,version_id) references public.workflow_versions(organization_id,workflow_id,id));
create table public.incoming_events(id uuid primary key default gen_random_uuid(),organization_id uuid not null,workflow_id uuid not null,version_id uuid not null,source_id uuid,occurrence_key text not null check(length(occurrence_key) between 1 and 150),body_hash text,fields jsonb not null default '{}',generation integer not null,state text not null default 'queued' check(state in ('queued','running','completed','filtered','skipped','requires_review')),attempts integer not null default 0,token uuid,lease_until timestamptz,created_at timestamptz not null default now(),completed_at timestamptz,unique(organization_id,id),unique(organization_id,workflow_id,occurrence_key),foreign key(organization_id,workflow_id,version_id) references public.workflow_versions(organization_id,workflow_id,id),foreign key(organization_id,source_id) references public.webhook_sources(organization_id,id));
create table public.workflow_runs(id uuid primary key default gen_random_uuid(),organization_id uuid not null,workflow_id uuid not null,version_id uuid not null,event_id uuid not null,state text not null check(state in ('queued','succeeded','skipped','requires_review')),steps jsonb not null,created_at timestamptz not null default now(),unique(organization_id,id),unique(organization_id,event_id),foreign key(organization_id,workflow_id,version_id) references public.workflow_versions(organization_id,workflow_id,id),foreign key(organization_id,event_id) references public.incoming_events(organization_id,id));
create table private.event_outbox(id uuid primary key default gen_random_uuid(),organization_id uuid not null,event_id uuid not null,state text not null default 'pending' check(state in ('pending','publishing','published','requires_review')),attempts integer not null default 0,token uuid,lease_until timestamptz,next_attempt_at timestamptz not null default now(),published_at timestamptz,unique(organization_id,event_id),foreign key(organization_id,event_id) references public.incoming_events(organization_id,id));
alter table public.monitor_deliveries alter column run_id drop not null;
alter table public.monitor_deliveries add column workflow_run_id uuid,add foreign key(organization_id,workflow_run_id) references public.workflow_runs(organization_id,id),add constraint delivery_single_parent check((run_id is null)<>(workflow_run_id is null)),add unique(organization_id,workflow_run_id);
alter table public.monitor_usage drop constraint monitor_usage_metric_check;
alter table public.monitor_usage add constraint monitor_usage_metric_check check(metric in ('probe','run','notification','intake'));
create index event_recent on public.incoming_events(organization_id,created_at desc);
create index workflow_run_recent on public.workflow_runs(organization_id,created_at desc);
create index deadlines_due on public.deadline_schedules(due_at) where dispatched_at is null;
create index event_outbox_due on private.event_outbox(next_attempt_at) where state in ('pending','publishing');
create trigger workflow_version_immutable before update or delete on public.workflow_versions for each row execute function private.reject_immutable_change();

-- A second validation boundary for direct Data API callers. No arbitrary expressions or code.
create function private.validate_workflow(p_def jsonb) returns void language plpgsql set search_path='' as $$
declare candidate_node jsonb;candidate_edge jsonb;ids text[]:='{}';root_count integer;visited_count integer;trigger_type text;begin
 if p_def is null or not(p_def ?& array['schemaVersion','name','trigger','nodes','edges']) or jsonb_typeof(p_def)<>'object' or (p_def->'schemaVersion') is distinct from '1'::jsonb or octet_length(p_def::text)>8192 or jsonb_typeof(p_def->'nodes') is distinct from 'array' or jsonb_typeof(p_def->'edges') is distinct from 'array' or jsonb_typeof(p_def->'name') is distinct from 'string' or length(btrim(p_def->>'name')) not between 2 and 80 or jsonb_array_length(p_def->'nodes') not between 1 and 20 or jsonb_array_length(p_def->'edges')>40 or (p_def-array['schemaVersion','name','trigger','nodes','edges'])<>'{}' then raise exception 'Invalid workflow schema' using errcode='23514';end if;
 trigger_type:=p_def#>>'{trigger,type}';if jsonb_typeof(p_def#>'{trigger,config}') is distinct from 'object' or trigger_type not in ('webhook.signed','deadline.once') or trigger_type is null or ((p_def->'trigger')-array['type','config'])<>'{}' then raise exception 'Invalid trigger' using errcode='23514';end if;
 if trigger_type='webhook.signed' and p_def#>'{trigger,config}'<>'{}' then raise exception 'Invalid webhook config' using errcode='23514';end if;
 if trigger_type='deadline.once' then
  if not(p_def#>'{trigger,config}' ?& array['at','timezone','leadMinutes']) or ((p_def#>'{trigger,config}')-array['at','timezone','leadMinutes'])<>'{}' or jsonb_typeof(p_def#>'{trigger,config,at}') is distinct from 'string' or jsonb_typeof(p_def#>'{trigger,config,timezone}') is distinct from 'string' or jsonb_typeof(p_def#>'{trigger,config,leadMinutes}') is distinct from 'number' or (p_def#>>'{trigger,config,leadMinutes}')::numeric not between 0 and 43200 or (p_def#>>'{trigger,config,leadMinutes}')::numeric<>trunc((p_def#>>'{trigger,config,leadMinutes}')::numeric) or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_def#>>'{trigger,config,timezone}') or (p_def#>>'{trigger,config,at}') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Invalid deadline' using errcode='23514';end if;
  if to_char((p_def#>>'{trigger,config,at}')::timestamptz at time zone (p_def#>>'{trigger,config,timezone}'),'YYYY-MM-DD"T"HH24:MI:SS')<>substring(p_def#>>'{trigger,config,at}',1,19) then raise exception 'Timezone offset mismatch' using errcode='23514';end if;
 end if;
 for candidate_node in select value from jsonb_array_elements(p_def->'nodes') loop
  if not(candidate_node ?& array['id','type','config']) or (candidate_node-array['id','type','config'])<>'{}' or candidate_node->>'id' is null or candidate_node->>'id' !~ '^[a-z][a-z0-9_]{0,39}$' or candidate_node->>'id'=any(ids) or jsonb_typeof(candidate_node->'config') is distinct from 'object' then raise exception 'Invalid node' using errcode='23514';end if;ids:=array_append(ids,candidate_node->>'id');
  if candidate_node->>'type'='condition' then
   if not(candidate_node->'config' ?& array['path','operator','value']) or ((candidate_node->'config')-array['path','operator','value'])<>'{}' or candidate_node#>>'{config,path}' is null or candidate_node#>>'{config,path}' !~ '^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){0,4}$' or candidate_node#>>'{config,path}' ~ '(^|\.)(__proto__|constructor|prototype)(\.|$)' or jsonb_typeof(candidate_node#>'{config,operator}') is distinct from 'string' or length(candidate_node#>>'{config,path}')>100 or length(candidate_node#>>'{config,value}')>500 or candidate_node#>>'{config,operator}' not in ('eq','gt','lt','is_null') or jsonb_typeof(candidate_node#>'{config,value}') not in ('string','number','boolean','null') then raise exception 'Invalid condition' using errcode='23514';end if;
  elsif candidate_node->>'type'='action' then
   if candidate_node#>>'{config,operation}'='send_notification' and candidate_node#>>'{config,provider}'='email' then
    if not(candidate_node->'config' ?& array['provider','operation','recipientId']) or candidate_node#>>'{config,recipientId}' is null or ((candidate_node->'config')-array['provider','operation','recipientId'])<>'{}' then raise exception 'Invalid action' using errcode='23514';end if;perform (candidate_node#>>'{config,recipientId}')::uuid;
   elsif candidate_node#>>'{config,operation}'='audit_record' and candidate_node#>>'{config,provider}'='internal' then
    if ((candidate_node->'config')-array['provider','operation'])<>'{}' then raise exception 'Invalid action' using errcode='23514';end if;
   else raise exception 'Unsupported action' using errcode='23514';end if;
  else raise exception 'Unsupported node' using errcode='23514';end if;
 end loop;
 if (select count(*) from jsonb_array_elements(p_def->'nodes') n where n->>'type'='action')=0 or (select count(*) from jsonb_array_elements(p_def->'nodes') n where n#>>'{config,operation}'='send_notification')>1 then raise exception 'Invalid action count' using errcode='23514';end if;
 for candidate_edge in select value from jsonb_array_elements(p_def->'edges') loop
  if not(candidate_edge ?& array['from','to','when']) or (candidate_edge-array['from','to','when'])<>'{}' or jsonb_typeof(candidate_edge->'from') is distinct from 'string' or jsonb_typeof(candidate_edge->'to') is distinct from 'string' or jsonb_typeof(candidate_edge->'when') is distinct from 'string' or not(candidate_edge->>'from'=any(ids)) or not(candidate_edge->>'to'=any(ids)) or candidate_edge->>'when' not in ('true','false','success') then raise exception 'Invalid edge' using errcode='23514';end if;
  if exists(select 1 from jsonb_array_elements(p_def->'nodes') n where n->>'id'=candidate_edge->>'from' and ((n->>'type'='action' and candidate_edge->>'when'<>'success') or (n->>'type'='condition' and candidate_edge->>'when'='success'))) then raise exception 'Invalid edge branch' using errcode='23514';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_def->'edges') e group by e->>'to' having count(*)>1) then raise exception 'Joins unsupported' using errcode='23514';end if;
 select count(*) into root_count from unnest(ids) id where not exists(select 1 from jsonb_array_elements(p_def->'edges') e where e->>'to'=id);
 if root_count<>1 then raise exception 'Invalid graph entry' using errcode='23514';end if;
 with recursive walk(id,depth) as(select id,0 from unnest(ids) id where not exists(select 1 from jsonb_array_elements(p_def->'edges') e where e->>'to'=id) union all select e->>'to',w.depth+1 from walk w cross join jsonb_array_elements(p_def->'edges') e where e->>'from'=w.id and w.depth<20) select count(distinct id) into visited_count from walk;
 if visited_count<>array_length(ids,1) then raise exception 'Unreachable graph or cycle' using errcode='23514';end if;
end;$$;
create function private.create_workflow(p_org uuid,p_definition jsonb,p_source uuid,p_secret jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_role(p_org,array['owner','admin','editor']);w uuid;begin
 perform private.rate_limit();perform private.validate_workflow(p_definition);
 if (select count(*) from public.workflows where organization_id=p_org and state<>'archived')>=3 then raise exception 'Workflow limit' using errcode='FF005';end if;
 if p_definition#>>'{trigger,type}'='webhook.signed' and (p_source is null or p_secret is null or not(p_secret ?& array['keyId','iv','tag','ciphertext']) or octet_length(p_secret::text)>1024 or private.member_role(p_org) not in ('owner','admin')) then raise exception 'Webhook setup requires admin' using errcode='FF001';end if;
 insert into public.workflows(organization_id,name,draft,created_by) values(p_org,p_definition->>'name',p_definition,u) returning id into w;
 if p_definition#>>'{trigger,type}'='webhook.signed' then insert into public.webhook_sources(id,organization_id,workflow_id) values(p_source,p_org,w);insert into private.webhook_secrets values(p_source,p_org,p_secret);end if;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,u,'workflow.created',w);return w;
end;$$;
create function private.save_workflow(p_org uuid,p_workflow uuid,p_revision integer,p_definition jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_role(p_org,array['owner','admin','editor']);w public.workflows;begin
 perform private.rate_limit();perform private.validate_workflow(p_definition);select * into w from public.workflows where id=p_workflow and organization_id=p_org for update;
 if not found or w.state='archived' then raise exception 'Workflow unavailable' using errcode='FF001';end if;
 if w.revision<>p_revision then raise exception 'Draft changed' using errcode='FF003';end if;
 if w.draft#>>'{trigger,type}'<>p_definition#>>'{trigger,type}' then raise exception 'Trigger type is immutable' using errcode='23514';end if;
 update public.workflows set draft=p_definition,name=p_definition->>'name',revision=revision+1 where id=p_workflow;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,u,'workflow.draft_saved',p_workflow);return w.revision+1;
end;$$;
create function private.publish_workflow(p_org uuid,p_workflow uuid,p_revision integer) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_role(p_org,array['owner','admin','editor']);w public.workflows;v uuid;n integer;recipient uuid;email text;due timestamptz;begin
 perform private.rate_limit();select * into w from public.workflows where id=p_workflow and organization_id=p_org for update;
 if not found or w.state='archived' then raise exception 'Workflow unavailable' using errcode='FF001';end if;
 if w.revision<>p_revision then raise exception 'Draft changed' using errcode='FF003';end if;perform private.validate_workflow(w.draft);
 select (node#>>'{config,recipientId}')::uuid into recipient from jsonb_array_elements(w.draft->'nodes') node where node#>>'{config,operation}'='send_notification';
 if recipient is not null then select lower(a.email) into email from public.organization_members m join auth.users a on a.id=m.user_id where m.organization_id=p_org and m.user_id=recipient and m.status='active' and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false);if email is null then raise exception 'Recipient unavailable' using errcode='FF001';end if;end if;
 if w.draft#>>'{trigger,type}'='deadline.once' then due:=(w.draft#>>'{trigger,config,at}')::timestamptz-make_interval(mins=>(w.draft#>>'{trigger,config,leadMinutes}')::integer);if due<=now() or due>now()+interval '366 days' then raise exception 'Reminder must be future, within a year' using errcode='23514';end if;end if;
 select coalesce(max(version),0)+1 into n from public.workflow_versions where workflow_id=p_workflow and organization_id=p_org;
 insert into public.workflow_versions(organization_id,workflow_id,version,definition,recipient_id,recipient_email) values(p_org,p_workflow,n,w.draft,recipient,email) returning id into v;
 update public.workflows set active_version_id=v,state='active',revision=revision+1 where id=p_workflow;
 if due is not null then insert into public.deadline_schedules(organization_id,workflow_id,version_id,due_at) values(p_org,p_workflow,v,due);end if;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,u,'workflow.published',v);return v;
end;$$;
create function private.set_workflow_state(p_org uuid,p_workflow uuid,p_state text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_role(p_org,array['owner','admin','editor']);begin
 perform private.rate_limit();if p_state not in ('active','paused','archived') then raise exception 'Invalid state' using errcode='23514';end if;
 update public.workflows set state=p_state,generation=generation+case when p_state in ('paused','archived') then 1 else 0 end,revision=revision+1 where id=p_workflow and organization_id=p_org and state<>'archived' and (active_version_id is not null or p_state='archived');
 if not found then raise exception 'Workflow unavailable' using errcode='FF001';end if;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,u,'workflow.'||p_state,p_workflow);
end;$$;
create function private.rotate_webhook(p_org uuid,p_workflow uuid,p_secret jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_role(p_org,array['owner','admin']);s uuid;begin
 perform private.rate_limit();select id into s from public.webhook_sources where organization_id=p_org and workflow_id=p_workflow for update;
 if s is null or p_secret is null or not(p_secret ?& array['keyId','iv','tag','ciphertext']) or octet_length(p_secret::text)>1024 then raise exception 'Source unavailable' using errcode='FF001';end if;
 update private.webhook_secrets set ciphertext=p_secret where source_id=s and organization_id=p_org;update public.webhook_sources set revision=revision+1 where id=s;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,u,'webhook.rotated',s);
end;$$;
create function private.lookup_webhook(p_source uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s record;n integer;begin
 select src.id,src.organization_id,src.revision,w.active_version_id,v.definition,secret.ciphertext into s from public.webhook_sources src join public.workflows w on w.id=src.workflow_id and w.organization_id=src.organization_id join public.workflow_versions v on v.id=w.active_version_id and v.organization_id=w.organization_id join public.organizations o on o.id=w.organization_id join private.webhook_secrets secret on secret.source_id=src.id and secret.organization_id=src.organization_id where src.id=p_source and w.state='active' and o.archived_at is null;
 if not found then return null;end if;
 insert into private.webhook_rate(source_id) values(p_source) on conflict(source_id) do update set quantity=case when webhook_rate.window_start<now()-interval '1 minute' then 1 else webhook_rate.quantity+1 end,window_start=case when webhook_rate.window_start<now()-interval '1 minute' then now() else webhook_rate.window_start end returning quantity into n;
 if n>60 then return null;end if;
 return jsonb_build_object('source_id',s.id,'organization_id',s.organization_id,'version_id',s.active_version_id,'revision',s.revision,'definition',s.definition,'secret',s.ciphertext);
end;$$;
create function private.accept_webhook(p_source uuid,p_revision integer,p_version uuid,p_event_key text,p_body_hash text,p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.webhook_sources;w public.workflows;e public.incoming_events;i uuid;begin
 select * into s from public.webhook_sources where id=p_source for update;if not found then return '{"status":"unavailable"}';end if;
 select * into w from public.workflows where id=s.workflow_id and organization_id=s.organization_id for update;
 if w.state<>'active' or s.revision<>p_revision or w.active_version_id<>p_version or exists(select 1 from public.organizations where id=w.organization_id and archived_at is not null) then return '{"status":"unavailable"}';end if;
 if p_event_key !~ '^[a-zA-Z0-9_-]{1,100}$' or p_body_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_fields)<>'object' or octet_length(p_fields::text)>32768 then raise exception 'Invalid event' using errcode='23514';end if;
 select * into e from public.incoming_events where organization_id=w.organization_id and workflow_id=w.id and occurrence_key='webhook:'||p_event_key;
 if found then return jsonb_build_object('status',case when e.body_hash=p_body_hash then 'duplicate' else 'conflict' end);end if;
 i:=gen_random_uuid();if not private.monitor_reserve(w.organization_id,'intake',i,1000) then return '{"status":"quota"}';end if;
 insert into public.incoming_events(id,organization_id,workflow_id,version_id,source_id,occurrence_key,body_hash,fields,generation) values(i,w.organization_id,w.id,p_version,p_source,'webhook:'||p_event_key,p_body_hash,p_fields,w.generation);
 insert into private.event_outbox(organization_id,event_id) values(w.organization_id,i);return '{"status":"accepted"}';
end;$$;
create function private.dispatch_deadlines() returns integer language plpgsql security definer set search_path='' as $$
declare rec record;i uuid;n integer:=0;begin
 for rec in select d.*,w.generation from public.deadline_schedules d join public.workflows w on w.id=d.workflow_id and w.organization_id=d.organization_id join public.organizations o on o.id=d.organization_id where d.dispatched_at is null and d.due_at<=now() and w.state='active' and w.active_version_id=d.version_id and o.archived_at is null order by d.due_at for update of d skip locked limit 50 loop
  i:=gen_random_uuid();insert into public.incoming_events(id,organization_id,workflow_id,version_id,occurrence_key,fields,generation) values(i,rec.organization_id,rec.workflow_id,rec.version_id,'deadline:'||rec.id,'{}',rec.generation) on conflict do nothing;
  if found then insert into private.event_outbox(organization_id,event_id) values(rec.organization_id,i);end if;
  update public.deadline_schedules set dispatched_at=now() where id=rec.id;n:=n+1;
 end loop;return n;
end;$$;
create function private.claim_event_outbox() returns jsonb language plpgsql security definer set search_path='' as $$
declare rec record;t uuid;items jsonb:='[]';begin
 update public.incoming_events set state='requires_review' where id in(select id from public.incoming_events where state in ('queued','running') and attempts>=5 and coalesce(lease_until,'-infinity')<now() limit 100);
 update private.event_outbox o set state='pending',next_attempt_at=now() where o.id in(select x.id from private.event_outbox x join public.incoming_events e on e.id=x.event_id and e.organization_id=x.organization_id where x.state='published' and x.published_at<now()-interval '5 minutes' and e.state in ('queued','running') and coalesce(e.lease_until,'-infinity')<now() limit 100);
 update public.workflow_runs r set state='requires_review' where r.state='queued' and exists(select 1 from public.monitor_deliveries d where d.organization_id=r.organization_id and d.workflow_run_id=r.id and d.state='requires_review');
 for rec in select * from private.event_outbox where (state='pending' and next_attempt_at<=now()) or (state='publishing' and lease_until<now()) order by next_attempt_at for update skip locked limit 50 loop
  if rec.attempts>=12 then update private.event_outbox set state='requires_review' where id=rec.id;update public.incoming_events set state='requires_review' where id=rec.event_id and organization_id=rec.organization_id and state in ('queued','running');continue;end if;
  t:=gen_random_uuid();update private.event_outbox set state='publishing',token=t,lease_until=now()+interval '2 minutes',attempts=attempts+1 where id=rec.id;
  items:=items||jsonb_build_array(jsonb_build_object('id',rec.id,'organization_id',rec.organization_id,'job_id',rec.event_id,'kind','event','token',t,'attempt',rec.attempts+1));
 end loop;return items;
end;$$;
create function private.finish_event_outbox(p_id uuid,p_token uuid,p_ok boolean) returns void language plpgsql security definer set search_path='' as $$begin
 update private.event_outbox set state=case when p_ok then 'published' else 'pending' end,published_at=case when p_ok then now() else null end,next_attempt_at=now()+interval '1 minute' where id=p_id and token=p_token and state='publishing' and lease_until>now();
end;$$;
create function private.claim_workflow_event(p_org uuid,p_event uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.incoming_events;w public.workflows;v public.workflow_versions;t uuid;begin
 select * into e from public.incoming_events where id=p_event and organization_id=p_org for update;
 if not found or e.state in ('completed','filtered','skipped','requires_review') or (e.state='running' and e.lease_until>now()) then return null;end if;
 select * into w from public.workflows where id=e.workflow_id and organization_id=p_org;
 if w.state<>'active' or w.generation<>e.generation or exists(select 1 from public.organizations where id=p_org and archived_at is not null) then update public.incoming_events set state='skipped',completed_at=now() where id=p_event;return null;end if;
 if e.attempts>=5 then update public.incoming_events set state='requires_review' where id=p_event;return null;end if;
 select * into v from public.workflow_versions where id=e.version_id and organization_id=p_org;t:=gen_random_uuid();update public.incoming_events set state='running',token=t,lease_until=now()+interval '1 minute',attempts=attempts+1 where id=p_event;
 return jsonb_build_object('organization_id',p_org,'event_id',p_event,'token',t,'definition',v.definition,'fields',e.fields);
end;$$;
create function private.finish_workflow_event(p_org uuid,p_event uuid,p_token uuid,p_qualified boolean,p_audit boolean,p_recipient uuid,p_trace jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if p_audit then insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,w.created_by,'workflow.audit_record',r);end if;
 if p_recipient is not null then
  d:=gen_random_uuid();if private.monitor_reserve(p_org,'notification',d,100) then
   insert into public.monitor_deliveries(id,organization_id,workflow_run_id,recipient_id,recipient_email,subject,body) values(d,p_org,r,p_recipient,v.recipient_email,'FutureFlow: '||(v.definition->>'name'),'Workflow "'||(v.definition->>'name')||'" matched its published conditions. Open the workspace run history for evidence.');insert into private.monitor_outbox(organization_id,delivery_id) values(p_org,d);
  else update public.workflow_runs set state='skipped' where id=r;end if;
 else update public.workflow_runs set state='succeeded' where id=r;end if;
 update public.incoming_events set state='completed',completed_at=now() where id=p_event;return jsonb_build_object('run_id',r);
end;$$;

create or replace function private.claim_monitor_delivery(p_org uuid,p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.monitor_deliveries;t uuid;begin
 select * into d from public.monitor_deliveries where id=p_job and organization_id=p_org for update;
 if not found or d.state in ('succeeded','skipped','requires_review') or (d.state='sending' and d.lease_until>now()) then return null;end if;
 if exists(select 1 from public.organizations where id=p_org and archived_at is not null) or not exists(select 1 from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=p_org and m.user_id=d.recipient_id and m.status='active' and lower(u.email)=d.recipient_email and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)) then update public.monitor_deliveries set state='skipped' where id=p_job;update public.monitor_runs set state='skipped',steps=jsonb_set(steps,'{notification}','"recipient_unavailable"') where id=d.run_id and organization_id=p_org;update public.workflow_runs set state=case when d.attempts>=5 or d.first_attempt_at<now()-interval '23 hours' then 'requires_review' else 'skipped' end where id=d.workflow_run_id and organization_id=p_org;return null;end if;
 if d.attempts>=5 or d.first_attempt_at<now()-interval '23 hours' then update public.monitor_deliveries set state='requires_review' where id=p_job;update public.monitor_runs set state='requires_review' where id=d.run_id and organization_id=p_org;update public.workflow_runs set state=case when d.attempts>=5 or d.first_attempt_at<now()-interval '23 hours' then 'requires_review' else 'skipped' end where id=d.workflow_run_id and organization_id=p_org;return null;end if;
 t:=gen_random_uuid();update public.monitor_deliveries set state='sending',lease_token=t,lease_until=now()+interval '1 minute',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()) where id=p_job returning * into d;
 return jsonb_build_object('organization_id',p_org,'job_id',p_job,'token',t,'first_attempt_at',d.first_attempt_at,'recipient',d.recipient_email,'subject',d.subject,'text',d.body);
end;$$;
create or replace function private.finish_monitor_delivery(p_org uuid,p_job uuid,p_token uuid,p_result text,p_provider_id text,p_error text) returns void language plpgsql security definer set search_path='' as $$
declare d public.monitor_deliveries;s text;begin
 if p_result not in ('succeeded','retry','requires_review') or length(coalesce(p_provider_id,''))>200 or length(coalesce(p_error,''))>80 then raise exception 'Invalid result' using errcode='23514';end if;
 select * into d from public.monitor_deliveries where id=p_job and organization_id=p_org for update;
 if not found or d.state<>'sending' or d.lease_token<>p_token or d.lease_until<=now() then return;end if;
 s:=case when p_result='retry' and d.attempts<5 then 'queued' when p_result='retry' then 'requires_review' else p_result end;
 update public.monitor_deliveries set state=s,provider_id=p_provider_id,error_category=p_error,lease_until=null where id=p_job;
 if s in ('succeeded','requires_review') then update public.workflow_runs set state=s where id=d.workflow_run_id and organization_id=p_org;update public.monitor_runs set state=s,steps=jsonb_set(steps,'{notification}',to_jsonb(s)) where id=d.run_id and organization_id=p_org;end if;
end;$$;

alter table public.workflows enable row level security;
revoke all on public.workflows from anon,authenticated;
grant select on public.workflows to authenticated;
create policy tenant_read on public.workflows for select to authenticated using(private.member_role(organization_id) is not null);
alter table public.workflow_versions enable row level security;
revoke all on public.workflow_versions from anon,authenticated;
grant select on public.workflow_versions to authenticated;
create policy tenant_read on public.workflow_versions for select to authenticated using(private.member_role(organization_id) is not null);
alter table public.webhook_sources enable row level security;
revoke all on public.webhook_sources from anon,authenticated;
grant select on public.webhook_sources to authenticated;
create policy tenant_read on public.webhook_sources for select to authenticated using(private.member_role(organization_id) is not null);
alter table public.deadline_schedules enable row level security;
revoke all on public.deadline_schedules from anon,authenticated;
grant select on public.deadline_schedules to authenticated;
create policy tenant_read on public.deadline_schedules for select to authenticated using(private.member_role(organization_id) is not null);
alter table public.incoming_events enable row level security;
revoke all on public.incoming_events from anon,authenticated;
grant select on public.incoming_events to authenticated;
create policy tenant_read on public.incoming_events for select to authenticated using(private.member_role(organization_id) is not null);
alter table public.workflow_runs enable row level security;
revoke all on public.workflow_runs from anon,authenticated;
grant select on public.workflow_runs to authenticated;
create policy tenant_read on public.workflow_runs for select to authenticated using(private.member_role(organization_id) is not null);
alter table private.webhook_secrets enable row level security;
revoke all on private.webhook_secrets from public,anon,authenticated;
alter table private.webhook_rate enable row level security;
revoke all on private.webhook_rate from public,anon,authenticated;
alter table private.event_outbox enable row level security;
revoke all on private.event_outbox from public,anon,authenticated;
create function public.create_workflow(p_org uuid,p_definition jsonb,p_source uuid,p_secret jsonb) returns uuid language sql security invoker set search_path='' as $$select private.create_workflow(p_org,p_definition,p_source,p_secret)$$;
revoke all on function public.create_workflow(uuid,jsonb,uuid,jsonb),private.create_workflow(uuid,jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_workflow(uuid,jsonb,uuid,jsonb),private.create_workflow(uuid,jsonb,uuid,jsonb) to authenticated;
create function public.save_workflow(p_org uuid,p_workflow uuid,p_revision integer,p_definition jsonb) returns integer language sql security invoker set search_path='' as $$select private.save_workflow(p_org,p_workflow,p_revision,p_definition)$$;
revoke all on function public.save_workflow(uuid,uuid,integer,jsonb),private.save_workflow(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_workflow(uuid,uuid,integer,jsonb),private.save_workflow(uuid,uuid,integer,jsonb) to authenticated;
create function public.publish_workflow(p_org uuid,p_workflow uuid,p_revision integer) returns uuid language sql security invoker set search_path='' as $$select private.publish_workflow(p_org,p_workflow,p_revision)$$;
revoke all on function public.publish_workflow(uuid,uuid,integer),private.publish_workflow(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.publish_workflow(uuid,uuid,integer),private.publish_workflow(uuid,uuid,integer) to authenticated;
create function public.set_workflow_state(p_org uuid,p_workflow uuid,p_state text) returns void language sql security invoker set search_path='' as $$select private.set_workflow_state(p_org,p_workflow,p_state)$$;
revoke all on function public.set_workflow_state(uuid,uuid,text),private.set_workflow_state(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.set_workflow_state(uuid,uuid,text),private.set_workflow_state(uuid,uuid,text) to authenticated;
create function public.rotate_webhook(p_org uuid,p_workflow uuid,p_secret jsonb) returns void language sql security invoker set search_path='' as $$select private.rotate_webhook(p_org,p_workflow,p_secret)$$;
revoke all on function public.rotate_webhook(uuid,uuid,jsonb),private.rotate_webhook(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.rotate_webhook(uuid,uuid,jsonb),private.rotate_webhook(uuid,uuid,jsonb) to authenticated;
create function public.lookup_webhook(p_source uuid) returns jsonb language sql security invoker set search_path='' as $$select private.lookup_webhook(p_source)$$;
revoke all on function public.lookup_webhook(uuid),private.lookup_webhook(uuid) from public,anon,authenticated;
grant execute on function public.lookup_webhook(uuid),private.lookup_webhook(uuid) to service_role;
create function public.accept_webhook(p_source uuid,p_revision integer,p_version uuid,p_event_key text,p_body_hash text,p_fields jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.accept_webhook(p_source,p_revision,p_version,p_event_key,p_body_hash,p_fields)$$;
revoke all on function public.accept_webhook(uuid,integer,uuid,text,text,jsonb),private.accept_webhook(uuid,integer,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.accept_webhook(uuid,integer,uuid,text,text,jsonb),private.accept_webhook(uuid,integer,uuid,text,text,jsonb) to service_role;
create function public.dispatch_deadlines() returns integer language sql security invoker set search_path='' as $$select private.dispatch_deadlines()$$;
revoke all on function public.dispatch_deadlines(),private.dispatch_deadlines() from public,anon,authenticated;
grant execute on function public.dispatch_deadlines(),private.dispatch_deadlines() to service_role;
create function public.claim_event_outbox() returns jsonb language sql security invoker set search_path='' as $$select private.claim_event_outbox()$$;
revoke all on function public.claim_event_outbox(),private.claim_event_outbox() from public,anon,authenticated;
grant execute on function public.claim_event_outbox(),private.claim_event_outbox() to service_role;
create function public.finish_event_outbox(p_id uuid,p_token uuid,p_ok boolean) returns void language sql security invoker set search_path='' as $$select private.finish_event_outbox(p_id,p_token,p_ok)$$;
revoke all on function public.finish_event_outbox(uuid,uuid,boolean),private.finish_event_outbox(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_event_outbox(uuid,uuid,boolean),private.finish_event_outbox(uuid,uuid,boolean) to service_role;
create function public.claim_workflow_event(p_org uuid,p_event uuid) returns jsonb language sql security invoker set search_path='' as $$select private.claim_workflow_event(p_org,p_event)$$;
revoke all on function public.claim_workflow_event(uuid,uuid),private.claim_workflow_event(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_workflow_event(uuid,uuid),private.claim_workflow_event(uuid,uuid) to service_role;
create function public.finish_workflow_event(p_org uuid,p_event uuid,p_token uuid,p_qualified boolean,p_audit boolean,p_recipient uuid,p_trace jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.finish_workflow_event(p_org,p_event,p_token,p_qualified,p_audit,p_recipient,p_trace)$$;
revoke all on function public.finish_workflow_event(uuid,uuid,uuid,boolean,boolean,uuid,jsonb),private.finish_workflow_event(uuid,uuid,uuid,boolean,boolean,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finish_workflow_event(uuid,uuid,uuid,boolean,boolean,uuid,jsonb),private.finish_workflow_event(uuid,uuid,uuid,boolean,boolean,uuid,jsonb) to service_role;
revoke all on function private.validate_workflow(jsonb) from public,anon,authenticated;
-- Delivery recovery also runs when website probing is disabled.
create function private.recover_notification_deliveries() returns void language plpgsql security definer set search_path='' as $$begin
 update public.monitor_deliveries set state='requires_review',error_category='retry_budget_or_window' where id in(select id from public.monitor_deliveries where state in ('queued','sending') and (attempts>=5 or first_attempt_at<now()-interval '23 hours') and coalesce(lease_until,'-infinity')<now() limit 100);
 update private.monitor_outbox set state='pending',next_attempt_at=now() where id in(select o.id from private.monitor_outbox o join public.monitor_deliveries d on d.id=o.delivery_id and d.organization_id=o.organization_id where o.state='published' and o.published_at<now()-interval '5 minutes' and d.state in ('queued','sending') and coalesce(d.lease_until,'-infinity')<now() limit 100);
 update public.workflow_runs set state='requires_review' where id in(select r.id from public.workflow_runs r join public.monitor_deliveries d on d.organization_id=r.organization_id and d.workflow_run_id=r.id where r.state='queued' and d.state='requires_review' limit 100);
end;$$;
create function public.recover_notification_deliveries() returns void language sql security invoker set search_path='' as $$select private.recover_notification_deliveries()$$;
revoke all on function public.recover_notification_deliveries(),private.recover_notification_deliveries() from public,anon,authenticated;
grant execute on function public.recover_notification_deliveries(),private.recover_notification_deliveries() to service_role;
commit;
