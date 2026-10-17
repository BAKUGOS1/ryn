-- FutureFlow Phase 1. Apply to a dedicated development project first.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 80),
 slug text unique not null check(length(slug) between 3 and 40 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 owner_id uuid not null references auth.users(id),created_at timestamptz not null default now(),archived_at timestamptz
);
create table public.organization_members (
 organization_id uuid not null references public.organizations(id),user_id uuid not null references auth.users(id),
 email text not null,role text not null check(role in ('owner','admin','editor','viewer')),
 status text not null default 'active' check(status in ('active','suspended')),joined_at timestamptz not null default now(),
 primary key(organization_id,user_id)
);
create unique index one_owner_per_org on public.organization_members(organization_id) where role='owner';
create index member_lookup on public.organization_members(user_id,organization_id) where status='active';
create table public.organization_settings (
 organization_id uuid primary key references public.organizations(id),timezone text not null default 'Asia/Kolkata'
);
create table public.organization_invites (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 email text not null check(length(email)<=254 and email=lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 role text not null check(role in ('admin','editor','viewer')),token_hash text unique not null check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null default now()+interval '7 days',accepted_at timestamptz,revoked_at timestamptz,
 created_by uuid not null,created_at timestamptz not null default now(),
 foreign key(organization_id,created_by) references public.organization_members(organization_id,user_id)
);
create unique index pending_invite_email on public.organization_invites(organization_id,email) where accepted_at is null and revoked_at is null;
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 actor_id uuid not null references auth.users(id),action text not null,resource_id uuid,created_at timestamptz not null default now()
);
create index audit_org_recent on public.audit_logs(organization_id,created_at desc);
create table private.mutation_buckets(user_id uuid primary key references auth.users(id),window_start timestamptz not null default now(),count integer not null default 1);
alter table private.mutation_buckets enable row level security;

-- Auth schema lookup avoids user-editable metadata and binds invitations to confirmed email.
create function private.verified_user() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Unauthorized' using errcode='FF001';end if;
 return u;
end;$$;
create function private.member_role(p_org uuid) returns text language sql stable security definer set search_path='' as $$
 select m.role from public.organization_members m join public.organizations o on o.id=m.organization_id join auth.users u on u.id=m.user_id
 where m.organization_id=p_org and m.user_id=auth.uid() and m.status='active' and o.archived_at is null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
$$;
create function private.require_role(p_org uuid,p_roles text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid;begin
 u:=private.verified_user();
 -- Serialize permission checks with membership changes and archiving for this tenant.
 perform 1 from public.organizations where id=p_org for update;
 if not coalesce(private.member_role(p_org)=any(p_roles),false) then raise exception 'Forbidden' using errcode='FF001';end if;
 return u;
end;$$;
create function private.rate_limit() returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.verified_user();n integer;begin
 insert into private.mutation_buckets(user_id) values(u) on conflict(user_id) do update set
 count=case when mutation_buckets.window_start<now()-interval '1 minute' then 1 else mutation_buckets.count+1 end,
 window_start=case when mutation_buckets.window_start<now()-interval '1 minute' then now() else mutation_buckets.window_start end returning count into n;
 if n>30 then raise exception 'Rate limit' using errcode='FF004';end if;
end;$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_settings enable row level security;
alter table public.organization_invites enable row level security;
alter table public.audit_logs enable row level security;
create policy organization_read on public.organizations for select to authenticated using(private.member_role(id) is not null);
create policy member_read on public.organization_members for select to authenticated using(private.member_role(organization_id) is not null);
create policy settings_read on public.organization_settings for select to authenticated using(private.member_role(organization_id) is not null);
create policy invite_read on public.organization_invites for select to authenticated using(private.member_role(organization_id) in ('owner','admin'));
create policy audit_read on public.audit_logs for select to authenticated using(private.member_role(organization_id) in ('owner','admin'));
-- No client INSERT/UPDATE/DELETE policies. All mutations use explicitly guarded RPCs.
revoke all on public.organizations,public.organization_members,public.organization_settings,public.organization_invites,public.audit_logs from anon,authenticated;
grant select on public.organizations,public.organization_members,public.organization_settings,public.audit_logs to authenticated;
grant select(id,organization_id,email,role,expires_at,accepted_at,revoked_at,created_by,created_at) on public.organization_invites to authenticated;

create function private.create_organization(p_name text,p_slug text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.verified_user();o uuid;begin
 perform private.rate_limit();
 -- User bucket serializes creation to enforce the per-user bound under concurrency.
 if (select count(*) from public.organizations where owner_id=u and archived_at is null)>=5 then raise exception 'Organization limit' using errcode='FF005';end if;
 insert into public.organizations(name,slug,owner_id) values(trim(p_name),p_slug,u) returning id into o;
 insert into public.organization_members(organization_id,user_id,email,role) select o,u,lower(email),'owner' from auth.users where id=u;
 insert into public.organization_settings(organization_id) values(o);
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(o,u,'workspace.created',o);
 return o;
end;$$;
create function private.update_organization(p_org uuid,p_name text,p_timezone text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_role(p_org,array['owner','admin']);begin
 perform private.rate_limit();
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Timezone invalid' using errcode='23514';end if;
 update public.organizations set name=trim(p_name) where id=p_org;
 update public.organization_settings set timezone=p_timezone where organization_id=p_org;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,u,'workspace.updated',p_org);
end;$$;
create function private.archive_organization(p_org uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_role(p_org,array['owner']);begin
 perform private.rate_limit();
 update public.organizations set archived_at=now() where id=p_org;
 update public.organization_invites set revoked_at=now() where organization_id=p_org and accepted_at is null and revoked_at is null;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,u,'workspace.archived',p_org);
end;$$;
create function private.create_invitation(p_org uuid,p_email text,p_role text,p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_role(p_org,array['owner','admin']);i uuid;begin
 perform private.rate_limit();
 if p_role='admin' and private.member_role(p_org)<>'owner' then raise exception 'Only owner can grant admin' using errcode='FF001';end if;
 if exists(select 1 from public.organization_members where organization_id=p_org and email=lower(p_email)) then raise exception 'Already a member' using errcode='FF003';end if;
 update public.organization_invites set revoked_at=now() where organization_id=p_org and expires_at<=now() and revoked_at is null and accepted_at is null;
 if (select count(*) from public.organization_invites where organization_id=p_org and revoked_at is null and accepted_at is null)>=20 then raise exception 'Invite limit' using errcode='FF005';end if;
 insert into public.organization_invites(organization_id,email,role,token_hash,created_by) values(p_org,lower(p_email),p_role,p_hash,u) returning id into i;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,u,'invitation.created',i);
 return i;
end;$$;
create function private.accept_invitation(p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.verified_user();i public.organization_invites;org uuid;begin
 -- Consistent tenant -> invite -> rate bucket lock order avoids revoke/accept deadlocks.
 select organization_id into org from public.organization_invites where token_hash=p_hash;
 if org is null then raise exception 'Invalid invitation' using errcode='FF002';end if;
 perform 1 from public.organizations where id=org and archived_at is null for update;
 if not found then raise exception 'Invalid invitation' using errcode='FF002';end if;
 select * into i from public.organization_invites where token_hash=p_hash for update;
 perform private.rate_limit();
 if i.accepted_at is not null or i.revoked_at is not null or i.expires_at<=now() or i.email<>(select lower(email) from auth.users where id=u) then raise exception 'Invalid invitation' using errcode='FF002';end if;
 -- Do not honor invitations issued by a now suspended/demoted inviter.
 if not exists(select 1 from public.organization_members where organization_id=org and user_id=i.created_by and status='active' and (role='owner' or (role='admin' and i.role<>'admin'))) then raise exception 'Invalid invitation' using errcode='FF002';end if;
 if exists(select 1 from public.organization_members where organization_id=org and user_id=u) then raise exception 'Already a member' using errcode='FF003';end if;
 if (select count(*) from public.organization_members where organization_id=org and status='active')>=20 then raise exception 'Seat limit' using errcode='FF005';end if;
 insert into public.organization_members(organization_id,user_id,email,role) values(org,u,i.email,i.role);
 update public.organization_invites set accepted_at=now() where id=i.id;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(org,u,'invitation.accepted',i.id);
 return org;
end;$$;
create function private.revoke_invitation(p_org uuid,p_invite uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_role(p_org,array['owner','admin']);begin
 perform private.rate_limit();
 update public.organization_invites set revoked_at=now() where id=p_invite and organization_id=p_org and accepted_at is null and revoked_at is null;
 if not found then raise exception 'Not pending' using errcode='FF003';end if;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,u,'invitation.revoked',p_invite);
end;$$;
create function private.update_member(p_org uuid,p_user uuid,p_role text,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_role(p_org,array['owner','admin']);r text;old_status text;begin
 perform private.rate_limit();
 select role,status into r,old_status from public.organization_members where organization_id=p_org and user_id=p_user for update;
 if r is null or r='owner' or p_user=u or p_role='owner' then raise exception 'Protected membership' using errcode='FF001';end if;
 if private.member_role(p_org)='admin' and (r='admin' or p_role='admin') then raise exception 'Only owner can manage admins' using errcode='FF001';end if;
 if old_status='suspended' and p_status='active' and (select count(*) from public.organization_members where organization_id=p_org and status='active')>=20 then raise exception 'Seat limit' using errcode='FF005';end if;
 update public.organization_members set role=p_role,status=p_status where organization_id=p_org and user_id=p_user;
 insert into public.audit_logs(organization_id,actor_id,action,resource_id) values(p_org,u,'member.updated',p_user);
end;$$;

-- Public RPC entrypoints are invoker wrappers. Private functions authorize all callers.
create function public.create_organization(p_name text,p_slug text) returns uuid language sql security invoker set search_path='' as $$select private.create_organization(p_name,p_slug)$$;
create function public.update_organization(p_org uuid,p_name text,p_timezone text) returns void language sql security invoker set search_path='' as $$select private.update_organization(p_org,p_name,p_timezone)$$;
create function public.archive_organization(p_org uuid) returns void language sql security invoker set search_path='' as $$select private.archive_organization(p_org)$$;
create function public.create_invitation(p_org uuid,p_email text,p_role text,p_hash text) returns uuid language sql security invoker set search_path='' as $$select private.create_invitation(p_org,p_email,p_role,p_hash)$$;
create function public.accept_invitation(p_hash text) returns uuid language sql security invoker set search_path='' as $$select private.accept_invitation(p_hash)$$;
create function public.revoke_invitation(p_org uuid,p_invite uuid) returns void language sql security invoker set search_path='' as $$select private.revoke_invitation(p_org,p_invite)$$;
create function public.update_member(p_org uuid,p_user uuid,p_role text,p_status text) returns void language sql security invoker set search_path='' as $$select private.update_member(p_org,p_user,p_role,p_status)$$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.member_role(uuid),private.create_organization(text,text),private.update_organization(uuid,text,text),private.archive_organization(uuid),private.create_invitation(uuid,text,text,text),private.accept_invitation(text),private.revoke_invitation(uuid,uuid),private.update_member(uuid,uuid,text,text) to authenticated;
revoke all on function public.create_organization(text,text),public.update_organization(uuid,text,text),public.archive_organization(uuid),public.create_invitation(uuid,text,text,text),public.accept_invitation(text),public.revoke_invitation(uuid,uuid),public.update_member(uuid,uuid,text,text) from public,anon;
grant execute on function public.create_organization(text,text),public.update_organization(uuid,text,text),public.archive_organization(uuid),public.create_invitation(uuid,text,text,text),public.accept_invitation(text),public.revoke_invitation(uuid,uuid),public.update_member(uuid,uuid,text,text) to authenticated;
commit;
