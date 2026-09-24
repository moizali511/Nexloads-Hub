-- Nexloads Hub — incremental migration 001
-- Safe on existing databases: IF NOT EXISTS / CREATE OR REPLACE only.
-- Run in Supabase SQL Editor after your current schema is in place.

-- ---------------------------------------------------------------------------
-- Employment status (extends boolean active; login still respects active)
-- ---------------------------------------------------------------------------
alter table employees add column if not exists presence_status text not null default 'offline'
  check (presence_status in ('online', 'away', 'offline'));

alter table employees add column if not exists employment_status text not null default 'active'
  check (employment_status in ('active', 'inactive', 'on_leave', 'closed'));

update employees
set employment_status = case when active then 'active' else 'inactive' end
where employment_status = 'active' and active = false;

-- ---------------------------------------------------------------------------
-- Time log admin corrections
-- ---------------------------------------------------------------------------
alter table timelogs add column if not exists clock_out_forced boolean not null default false;
alter table timelogs add column if not exists forced_by uuid references employees(id) on delete set null;
alter table timelogs add column if not exists force_reason text;
alter table timelogs add column if not exists forced_at timestamptz;

-- ---------------------------------------------------------------------------
-- Audit log (admin-only read via RPC)
-- ---------------------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references employees(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created on audit_logs(created_at desc);
create index if not exists idx_audit_logs_actor on audit_logs(actor_id);
create index if not exists idx_audit_logs_entity on audit_logs(entity_type, entity_id);

alter table audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function compute_presence_state(p_last_seen_at timestamptz, p_presence_status text)
returns text
language sql
stable
as $$
  select case
    when p_last_seen_at is null then 'offline'
    when p_last_seen_at <= now() - interval '2 minutes' then 'offline'
    when coalesce(p_presence_status, 'offline') = 'away' then 'away'
    else 'online'
  end;
$$;

create or replace function write_audit_log(
  p_actor_id uuid,
  p_action text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_old_value jsonb default null,
  p_new_value jsonb default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
as $$
begin
  insert into audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value, reason)
  values (p_actor_id, p_action, p_entity_type, p_entity_id, p_old_value, p_new_value, nullif(trim(coalesce(p_reason, '')), ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- Heartbeat: optional away/online; stale last_seen => offline in queries
-- ---------------------------------------------------------------------------
drop function if exists heartbeat(uuid);
create or replace function heartbeat(p_employee_id uuid, p_presence_status text default 'online')
returns json
language plpgsql
security definer
as $$
declare
  v_status text;
begin
  v_status := lower(coalesce(p_presence_status, 'online'));
  if v_status not in ('online', 'away') then
    v_status := 'online';
  end if;

  update employees
  set last_seen_at = now(),
      presence_status = v_status
  where id = p_employee_id and active = true;

  if not found then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'presence_state', compute_presence_state(now(), v_status));
end;
$$;

-- ---------------------------------------------------------------------------
-- Login: block closed / inactive / on_leave
-- ---------------------------------------------------------------------------
create or replace function login_employee(p_email text, p_password text)
returns json
language plpgsql
security definer
as $$
declare
  emp employees;
begin
  select * into emp from employees
    where lower(email) = lower(p_email);

  if emp.id is null then
    return json_build_object('success', false, 'error', 'invalid_credentials');
  end if;

  if not emp.active or emp.employment_status in ('inactive', 'on_leave', 'closed') then
    return json_build_object('success', false, 'error', 'account_disabled');
  end if;

  if emp.password_hash != crypt(p_password, emp.password_hash) then
    return json_build_object('success', false, 'error', 'invalid_credentials');
  end if;

  update employees
  set last_login_at = now(),
      last_seen_at = now(),
      presence_status = 'online'
  where id = emp.id;

  return json_build_object(
    'success', true,
    'id', emp.id,
    'full_name', emp.full_name,
    'email', emp.email,
    'role', emp.role,
    'position', emp.position,
    'department', emp.department,
    'manager_id', emp.manager_id,
    'employment_status', emp.employment_status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin force clock-out
-- ---------------------------------------------------------------------------
create or replace function admin_force_clock_out(
  p_admin_id uuid,
  p_employee_id uuid,
  p_clock_out timestamptz,
  p_reason text
)
returns json
language plpgsql
security definer
as $$
declare
  open_log timelogs;
  v_clock_out timestamptz;
  v_emp employees;
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  if trim(coalesce(p_reason, '')) = '' then
    return json_build_object('success', false, 'error', 'reason_required');
  end if;

  select * into v_emp from employees where id = p_employee_id;
  if v_emp.id is null then
    return json_build_object('success', false, 'error', 'employee_not_found');
  end if;

  select * into open_log from timelogs
  where employee_id = p_employee_id and clock_out is null
  order by clock_in desc
  limit 1;

  if open_log.id is null then
    return json_build_object('success', false, 'error', 'not_clocked_in');
  end if;

  v_clock_out := coalesce(p_clock_out, now());
  if v_clock_out < open_log.clock_in then
    return json_build_object('success', false, 'error', 'clock_out_before_clock_in');
  end if;

  update timelogs
  set clock_out = v_clock_out,
      clock_out_forced = true,
      forced_by = p_admin_id,
      force_reason = trim(p_reason),
      forced_at = now()
  where id = open_log.id
  returning * into open_log;

  perform write_audit_log(
    p_admin_id,
    'force_clock_out',
    'timelog',
    open_log.id,
    jsonb_build_object('employee_id', p_employee_id, 'clock_in', open_log.clock_in, 'clock_out', null),
    jsonb_build_object('employee_id', p_employee_id, 'clock_in', open_log.clock_in, 'clock_out', open_log.clock_out, 'forced', true),
    p_reason
  );

  return json_build_object('success', true, 'timelog', row_to_json(open_log));
end;
$$;

create or replace function admin_set_employment_status(
  p_admin_id uuid,
  p_employee_id uuid,
  p_status text,
  p_reason text default null
)
returns json
language plpgsql
security definer
as $$
declare
  old_emp employees;
  new_active boolean;
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  if p_status not in ('active', 'inactive', 'on_leave', 'closed') then
    return json_build_object('success', false, 'error', 'invalid_status');
  end if;

  select * into old_emp from employees where id = p_employee_id;
  if old_emp.id is null then
    return json_build_object('success', false, 'error', 'not_found');
  end if;

  new_active := p_status = 'active';

  update employees
  set employment_status = p_status,
      active = new_active,
      presence_status = case when new_active then presence_status else 'offline' end
  where id = p_employee_id;

  perform write_audit_log(
    p_admin_id,
    'employment_status_change',
    'employee',
    p_employee_id,
    jsonb_build_object('employment_status', old_emp.employment_status, 'active', old_emp.active),
    jsonb_build_object('employment_status', p_status, 'active', new_active),
    p_reason
  );

  return json_build_object('success', true);
end;
$$;

create or replace function admin_get_audit_logs(p_admin_id uuid, p_limit int default 100, p_offset int default 0)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'logs', (
    select coalesce(json_agg(row_to_json(x)), '[]'::json)
    from (
      select
        al.id, al.action, al.entity_type, al.entity_id,
        al.old_value, al.new_value, al.reason, al.created_at,
        a.full_name as actor_name
      from audit_logs al
      left join employees a on a.id = al.actor_id
      order by al.created_at desc
      limit greatest(1, least(coalesce(p_limit, 100), 500))
      offset greatest(coalesce(p_offset, 0), 0)
    ) x
  ));
end;
$$;

-- Presence-enriched employee listings
create or replace function admin_list_employees(p_admin_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'employees', (
    select coalesce(json_agg(e order by created_at desc), '[]'::json)
    from (
      select id, full_name, email, role, position, department, manager_id,
             active, employment_status, base_salary, base_salary_currency, created_at,
             last_login_at, last_seen_at, presence_status,
             compute_presence_state(last_seen_at, presence_status) as presence_state,
             (last_seen_at is not null and last_seen_at > now() - interval '2 minutes') as is_online,
             exists (
               select 1 from timelogs tl
               where tl.employee_id = employees.id and tl.clock_out is null
             ) as is_clocked_in
      from employees
    ) e
  ));
end;
$$;

create or replace function admin_get_presence(p_admin_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'presence', (
    select coalesce(json_agg(p), '[]'::json)
    from (
      select id, last_login_at, last_seen_at, presence_status,
             compute_presence_state(last_seen_at, presence_status) as presence_state,
             (last_seen_at is not null and last_seen_at > now() - interval '2 minutes') as is_online,
             exists (
               select 1 from timelogs tl
               where tl.employee_id = employees.id and tl.clock_out is null
             ) as is_clocked_in
      from employees
    ) p
  ));
end;
$$;

create or replace function admin_get_all_timelogs(p_admin_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'timelogs', (
    select coalesce(json_agg(t order by clock_in desc), '[]'::json)
    from (
      select tl.id, tl.employee_id, tl.clock_in, tl.clock_out,
             tl.clock_out_forced, tl.force_reason, tl.forced_at,
             e.full_name, e.email,
             fb.full_name as forced_by_name
      from timelogs tl
      join employees e on e.id = tl.employee_id
      left join employees fb on fb.id = tl.forced_by
      order by tl.clock_in desc limit 200
    ) t
  ));
end;
$$;

create or replace function admin_get_open_timelogs(p_admin_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'timelogs', (
    select coalesce(json_agg(t order by clock_in desc), '[]'::json)
    from (
      select tl.id, tl.employee_id, tl.clock_in, e.full_name, e.email
      from timelogs tl
      join employees e on e.id = tl.employee_id
      where tl.clock_out is null
      order by tl.clock_in desc
    ) t
  ));
end;
$$;

create or replace function get_my_timelogs(p_employee_id uuid)
returns json
language sql
security definer
as $$
  select coalesce(json_agg(t order by clock_in desc), '[]'::json)
  from (
    select id, clock_in, clock_out, clock_out_forced, force_reason
    from timelogs where employee_id = p_employee_id
    order by clock_in desc limit 20
  ) t;
$$;

-- Audit admin message delete (non-breaking enhancement)
create or replace function admin_delete_message(p_admin_id uuid, p_message_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  old_msg messages;
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  select * into old_msg from messages where id = p_message_id;
  if old_msg.id is null then
    return json_build_object('success', false, 'error', 'not_found');
  end if;

  delete from messages where id = p_message_id;

  perform write_audit_log(
    p_admin_id,
    'message_delete',
    'message',
    p_message_id,
    to_jsonb(old_msg),
    null,
    null
  );

  return json_build_object('success', true);
end;
$$;

grant execute on function heartbeat(uuid, text) to anon;
grant execute on function admin_force_clock_out(uuid, uuid, timestamptz, text) to anon;
grant execute on function admin_set_employment_status(uuid, uuid, text, text) to anon;
grant execute on function admin_get_audit_logs(uuid, int, int) to anon;
grant execute on function admin_get_open_timelogs(uuid) to anon;
