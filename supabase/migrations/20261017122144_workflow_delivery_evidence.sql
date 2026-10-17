begin;

-- Keep reached notification steps consistent with their terminal parent state.
-- Unreached branches have no operation field and must remain skipped.
create function private.sync_workflow_run_trace() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.state in ('succeeded', 'skipped', 'requires_review') then
    new.steps := private.notification_trace(new.steps, new.state);
  end if;
  return new;
end;
$$;
revoke all on function private.sync_workflow_run_trace() from public, anon, authenticated;
create trigger workflow_run_terminal_trace
before insert or update of state, steps on public.workflow_runs
for each row execute function private.sync_workflow_run_trace();

-- Recovery and outbox exhaustion must update evidence in the same transaction,
-- without waiting for a later event-dispatch tick or attempting another send.
create function private.sync_delivery_run() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state in ('succeeded', 'skipped', 'requires_review') then
    update public.workflow_runs
      set state = new.state
      where organization_id = new.organization_id and id = new.workflow_run_id;
    update public.monitor_runs
      set state = new.state,
          steps = jsonb_set(steps, '{notification}', to_jsonb(new.state))
      where organization_id = new.organization_id and id = new.run_id;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_delivery_run() from public, anon, authenticated;
create trigger delivery_terminal_evidence
  after update of state on public.monitor_deliveries
  for each row when (old.state is distinct from new.state)
  execute function private.sync_delivery_run();

-- An expired provider idempotency window is uncertain even if the recipient
-- subsequently leaves. Check the retry/window boundary before eligibility.
create or replace function private.claim_monitor_delivery(p_org uuid, p_job uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.monitor_deliveries; t uuid;
begin
  select * into d from public.monitor_deliveries
    where id = p_job and organization_id = p_org for update;
  if not found or d.state in ('succeeded', 'skipped', 'requires_review')
     or (d.state = 'sending' and d.lease_until > now()) then
    return null;
  end if;
  if d.attempts >= 5 or d.first_attempt_at < now() - interval '23 hours' then
    update public.monitor_deliveries
      set state = 'requires_review', error_category = 'retry_budget_or_window'
      where id = p_job and organization_id = p_org;
    return null;
  end if;
  if exists(select 1 from public.organizations where id = p_org and archived_at is not null)
     or not exists(
       select 1 from public.organization_members m join auth.users u on u.id = m.user_id
       where m.organization_id = p_org and m.user_id = d.recipient_id
         and m.status = 'active' and lower(u.email) = d.recipient_email
         and u.email_confirmed_at is not null and not coalesce(u.is_anonymous, false)
     ) then
    update public.monitor_deliveries
      set state = 'skipped', error_category = 'recipient_unavailable'
      where id = p_job and organization_id = p_org;
    return null;
  end if;
  t := gen_random_uuid();
  update public.monitor_deliveries
    set state = 'sending', lease_token = t, lease_until = now() + interval '1 minute',
        attempts = attempts + 1, first_attempt_at = coalesce(first_attempt_at, now())
    where id = p_job and organization_id = p_org returning * into d;
  return jsonb_build_object(
    'organization_id', p_org, 'job_id', p_job, 'token', t,
    'first_attempt_at', d.first_attempt_at, 'recipient', d.recipient_email,
    'subject', d.subject, 'text', d.body
  );
end;
$$;
revoke all on function private.claim_monitor_delivery(uuid, uuid) from public, anon, authenticated;

-- Reconcile historical terminal evidence without mutating published definitions.
update public.workflow_runs set steps = private.notification_trace(steps, state)
  where state in ('succeeded', 'skipped', 'requires_review');
update public.workflow_runs r set state = d.state
  from public.monitor_deliveries d
  where d.organization_id = r.organization_id and d.workflow_run_id = r.id
    and d.state in ('succeeded', 'skipped', 'requires_review') and r.state = 'queued';
update public.monitor_runs r
  set state = d.state, steps = jsonb_set(r.steps, '{notification}', to_jsonb(d.state))
  from public.monitor_deliveries d
  where d.organization_id = r.organization_id and d.run_id = r.id
    and d.state in ('succeeded', 'skipped', 'requires_review');

commit;
