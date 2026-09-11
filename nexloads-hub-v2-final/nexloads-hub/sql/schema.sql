-- ============================================================
-- NEXLOADS HUB — FINAL CONSOLIDATED SCHEMA (v2)
-- Run this ONCE, top to bottom, in a fresh Supabase SQL Editor.
-- This single file replaces schema.sql + migration_001..006 from
-- the old project. Do not run the old migration files against
-- this database — this file already contains their final state
-- plus the new Hub features (departments, performance tracking,
-- team hierarchy, monthly progress charts).
--
-- Pattern used everywhere (unchanged from before, kept because it
-- works and is well understood):
--   - RLS is enabled on every table, with ZERO policies.
--   - There is no Supabase Auth / auth.uid() anywhere.
--   - Every read/write goes through a SECURITY DEFINER RPC that
--     is handed an explicit id (p_admin_id / p_employee_id /
--     p_caller_id) and re-checks that id's role/ownership itself.
--   - anon is granted EXECUTE on every RPC below (never on tables).
-- Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- TABLES
-- ============================================================

-- Departments are a fixed, known set so the frontend can reliably
-- route each employee to the right dashboard tabs — this replaces
-- the old fragile "position ilike '%cold caller%'" text matching,
-- which is part of what caused inconsistent behaviour before.
-- `position` stays as a free-text display title (e.g. "Senior
-- Dispatcher"); `department` is what the app's logic keys off.
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique not null,
  password_hash text not null,
  role text not null default 'employee' check (role in ('admin','employee')),
  position text not null default 'Dispatcher',
  department text not null default 'dispatcher' check (department in (
    'dispatcher', 'cold_caller', 'social_media', 'designer', 'animator',
    'operations_manager', 'team_leader', 'other'
  )),
  manager_id uuid references employees(id) on delete set null,
  base_salary numeric(12,2) not null default 0,
  base_salary_currency text not null default 'PKR' check (base_salary_currency in ('USD','PKR')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_employees_manager on employees(manager_id);

create table if not exists timelogs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz
);

create table if not exists updates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

-- ---------- Dispatcher deals / invoices ----------
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  invoice_number text unique not null,
  customer_name text not null,
  truck_ref text not null,
  pickup_location text not null,
  drop_location text not null,
  pickup_date date,
  delivery_date date,
  load_amount numeric(12,2) not null check (load_amount >= 0),
  dispatch_fee_percent numeric(5,2) not null check (dispatch_fee_percent >= 0 and dispatch_fee_percent <= 100),
  fee_amount numeric(12,2) not null,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_deals_employee on deals(employee_id);
create index if not exists idx_deals_created on deals(created_at desc);

create table if not exists monthly_targets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  target_month date not null,
  target_amount numeric(12,2) not null default 0,
  unique (employee_id, target_month)
);

create sequence if not exists invoice_seq start 1001;

-- ---------- Cold caller: calls, fleets, trucks ----------
create table if not exists coldcaller_daily_stats (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  log_date date not null default current_date,
  calls_made int not null default 0 check (calls_made >= 0),
  confirmed_sales int not null default 0 check (confirmed_sales >= 0),
  daily_call_target int not null default 100,
  unique (employee_id, log_date)
);

create table if not exists fleets (
  id uuid primary key default gen_random_uuid(),
  cold_caller_id uuid not null references employees(id) on delete cascade,
  carrier_name text not null,
  country text not null default 'USA' check (country in ('USA','Canada')),
  agreement_signed_at timestamptz,
  is_disqualified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists trucks (
  id uuid primary key default gen_random_uuid(),
  fleet_id uuid not null references fleets(id) on delete cascade,
  truck_number text not null,
  activated_at timestamptz,
  first_load_completed_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_fleets_coldcaller on fleets(cold_caller_id);
create index if not exists idx_trucks_fleet on trucks(fleet_id);
create index if not exists idx_coldcaller_stats_emp_date on coldcaller_daily_stats(employee_id, log_date);

-- ---------- Messaging ----------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_admin_id uuid not null references employees(id) on delete cascade,
  recipient_employee_id uuid references employees(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_recipient on messages(recipient_employee_id);
create index if not exists idx_messages_created on messages(created_at desc);

-- ---------- Bonuses ----------
create table if not exists bonuses (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD' check (currency in ('USD','PKR')),
  reason text not null,
  awarded_by uuid not null references employees(id),
  awarded_at timestamptz not null default now()
);

create index if not exists idx_bonuses_employee on bonuses(employee_id);

-- ---------- Monthly payroll closing ----------
create table if not exists monthly_closings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  closed_month date not null,
  base_amount numeric(12,2) not null default 0,
  base_currency text not null default 'PKR' check (base_currency in ('USD','PKR')),
  commission_amount numeric(12,2) not null default 0,
  bonus_usd numeric(12,2) not null default 0,
  bonus_pkr numeric(12,2) not null default 0,
  total_usd numeric(12,2) not null default 0,
  total_pkr numeric(12,2) not null default 0,
  breakdown json,
  closed_by uuid not null references employees(id),
  closed_at timestamptz not null default now(),
  unique (employee_id, closed_month)
);

-- ---------- NEW: generic performance log for Hub roles ----------
-- Used by every department that doesn't already have its own dedicated
-- numbers table (dispatchers use `deals`, cold callers use
-- `trucks`/`fleets` — those two keep driving their own charts).
-- Social Media / Designer / Animator / Operations Manager / Team Leader
-- / Other log their day-to-day output here, one row per employee per
-- day per metric (upserted, so re-saving the same day just updates it).
create table if not exists performance_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  log_date date not null default current_date,
  metric_label text not null,
  metric_value numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, log_date, metric_label)
);

create index if not exists idx_perf_logs_employee_date on performance_logs(employee_id, log_date);

-- ---------- Lock every table down; everything goes through RPCs ----------
alter table employees enable row level security;
alter table timelogs enable row level security;
alter table updates enable row level security;
alter table deals enable row level security;
alter table monthly_targets enable row level security;
alter table coldcaller_daily_stats enable row level security;
alter table fleets enable row level security;
alter table trucks enable row level security;
alter table messages enable row level security;
alter table bonuses enable row level security;
alter table monthly_closings enable row level security;
alter table performance_logs enable row level security;
-- (no policies created on purpose -> anon/authenticated have zero direct table access)

-- ---------- SEED: first admin account ----------
-- Replace the email + password below with your real admin login, then run once.
-- insert into employees (full_name, email, password_hash, role, department)
-- values ('Admin', 'admin@nexloads.com', crypt('ChangeThisPassword123', gen_salt('bf')), 'admin', 'other');

-- ============================================================
-- AUTH / SESSION RPCs
-- ============================================================

-- LOGIN — now also returns position + department + manager_id, which
-- the old login_employee never did. That gap meant the frontend's
-- session object never actually had a usable position value, so any
-- role-based tab logic keyed off it silently always fell through.
-- Fixed here for good.
create or replace function login_employee(p_email text, p_password text)
returns json
language plpgsql
security definer
as $$
declare
  emp employees;
begin
  select * into emp from employees
    where lower(email) = lower(p_email) and active = true;

  if emp.id is null then
    return json_build_object('success', false, 'error', 'invalid_credentials');
  end if;

  if emp.password_hash != crypt(p_password, emp.password_hash) then
    return json_build_object('success', false, 'error', 'invalid_credentials');
  end if;

  return json_build_object(
    'success', true,
    'id', emp.id,
    'full_name', emp.full_name,
    'email', emp.email,
    'role', emp.role,
    'position', emp.position,
    'department', emp.department,
    'manager_id', emp.manager_id
  );
end;
$$;

create or replace function clock_in(p_employee_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  open_log_count int;
  new_log timelogs;
begin
  select count(*) into open_log_count from timelogs
    where employee_id = p_employee_id and clock_out is null;

  if open_log_count > 0 then
    return json_build_object('success', false, 'error', 'already_clocked_in');
  end if;

  insert into timelogs (employee_id) values (p_employee_id) returning * into new_log;
  return json_build_object('success', true, 'id', new_log.id, 'clock_in', new_log.clock_in);
end;
$$;

create or replace function clock_out(p_employee_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  updated_log timelogs;
begin
  update timelogs set clock_out = now()
    where employee_id = p_employee_id and clock_out is null
    returning * into updated_log;

  if updated_log.id is null then
    return json_build_object('success', false, 'error', 'not_clocked_in');
  end if;

  return json_build_object('success', true, 'id', updated_log.id, 'clock_out', updated_log.clock_out);
end;
$$;

create or replace function get_my_timelogs(p_employee_id uuid)
returns json
language sql
security definer
as $$
  select coalesce(json_agg(t order by clock_in desc), '[]'::json)
  from (
    select id, clock_in, clock_out
    from timelogs where employee_id = p_employee_id
    order by clock_in desc limit 20
  ) t;
$$;

create or replace function post_update(p_employee_id uuid, p_message text)
returns json
language plpgsql
security definer
as $$
declare
  new_update updates;
begin
  if trim(p_message) = '' then
    return json_build_object('success', false, 'error', 'empty_message');
  end if;

  insert into updates (employee_id, message) values (p_employee_id, p_message)
    returning * into new_update;

  return json_build_object('success', true, 'id', new_update.id);
end;
$$;

create or replace function get_updates()
returns json
language sql
security definer
as $$
  select coalesce(json_agg(u order by created_at desc), '[]'::json)
  from (
    select up.id, up.message, up.created_at, e.full_name, e.role
    from updates up join employees e on e.id = up.employee_id
    order by up.created_at desc limit 50
  ) u;
$$;

-- ============================================================
-- ADMIN — EMPLOYEE MANAGEMENT
-- ============================================================

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
             active, base_salary, base_salary_currency, created_at
      from employees
    ) e
  ));
end;
$$;

create or replace function admin_add_employee(
  p_admin_id uuid, p_full_name text, p_email text, p_password text,
  p_role text default 'employee', p_position text default 'Dispatcher',
  p_base_salary numeric default 0, p_base_salary_currency text default 'PKR',
  p_department text default 'dispatcher', p_manager_id uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  new_emp employees;
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  if trim(coalesce(p_full_name,'')) = '' then
    return json_build_object('success', false, 'error', 'name_required');
  end if;
  if trim(coalesce(p_email,'')) = '' then
    return json_build_object('success', false, 'error', 'email_required');
  end if;
  if p_password is null or length(p_password) < 4 then
    return json_build_object('success', false, 'error', 'password_too_short');
  end if;
  if exists (select 1 from employees where lower(email) = lower(p_email)) then
    return json_build_object('success', false, 'error', 'email_taken');
  end if;
  if p_base_salary_currency not in ('USD','PKR') then
    return json_build_object('success', false, 'error', 'invalid_currency');
  end if;
  if coalesce(p_department, 'dispatcher') not in (
    'dispatcher','cold_caller','social_media','designer','animator',
    'operations_manager','team_leader','other'
  ) then
    return json_build_object('success', false, 'error', 'invalid_department');
  end if;
  if p_manager_id is not null and not exists (select 1 from employees where id = p_manager_id) then
    return json_build_object('success', false, 'error', 'manager_not_found');
  end if;

  insert into employees (
    full_name, email, password_hash, role, position, department,
    manager_id, base_salary, base_salary_currency
  )
    values (
      trim(p_full_name), trim(p_email), crypt(p_password, gen_salt('bf')), coalesce(p_role, 'employee'),
      coalesce(nullif(trim(p_position), ''), 'Dispatcher'),
      coalesce(p_department, 'dispatcher'),
      p_manager_id,
      coalesce(p_base_salary, 0), coalesce(p_base_salary_currency, 'PKR')
    )
    returning * into new_emp;

  return json_build_object('success', true, 'id', new_emp.id);
end;
$$;

create or replace function admin_set_employee_active(p_admin_id uuid, p_employee_id uuid, p_active boolean)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  update employees set active = p_active where id = p_employee_id;
  return json_build_object('success', true);
end;
$$;

create or replace function admin_update_employee_base_salary(
  p_admin_id uuid, p_employee_id uuid, p_base_salary numeric, p_base_salary_currency text
)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  if p_base_salary_currency not in ('USD','PKR') then
    return json_build_object('success', false, 'error', 'invalid_currency');
  end if;

  update employees set base_salary = p_base_salary, base_salary_currency = p_base_salary_currency
    where id = p_employee_id;

  return json_build_object('success', true);
end;
$$;

-- NEW: edit an existing employee's job title / department / manager
-- (previously there was no way to change these after creation at all)
create or replace function admin_update_employee_role_info(
  p_admin_id uuid, p_employee_id uuid, p_position text, p_department text, p_manager_id uuid
)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  if coalesce(p_department, 'dispatcher') not in (
    'dispatcher','cold_caller','social_media','designer','animator',
    'operations_manager','team_leader','other'
  ) then
    return json_build_object('success', false, 'error', 'invalid_department');
  end if;
  if p_manager_id is not null and p_manager_id = p_employee_id then
    return json_build_object('success', false, 'error', 'cannot_report_to_self');
  end if;
  if p_manager_id is not null and not exists (select 1 from employees where id = p_manager_id) then
    return json_build_object('success', false, 'error', 'manager_not_found');
  end if;

  update employees
    set position = coalesce(nullif(trim(p_position), ''), position),
        department = coalesce(p_department, department),
        manager_id = p_manager_id
    where id = p_employee_id;

  return json_build_object('success', true);
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
      select tl.id, tl.clock_in, tl.clock_out, e.full_name, e.email
      from timelogs tl join employees e on e.id = tl.employee_id
      order by tl.clock_in desc limit 200
    ) t
  ));
end;
$$;

create or replace function change_admin_password(
  p_admin_id uuid, p_current_password text, p_new_password text
)
returns json
language plpgsql
security definer
as $$
declare
  emp employees;
begin
  select * into emp from employees where id = p_admin_id and role = 'admin' and active = true;

  if emp.id is null then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  if emp.password_hash != crypt(p_current_password, emp.password_hash) then
    return json_build_object('success', false, 'error', 'wrong_current_password');
  end if;

  if length(p_new_password) < 8 then
    return json_build_object('success', false, 'error', 'password_too_short');
  end if;

  update employees set password_hash = crypt(p_new_password, gen_salt('bf')) where id = p_admin_id;
  return json_build_object('success', true);
end;
$$;

create or replace function admin_delete_employee_permanently(p_admin_id uuid, p_employee_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  if p_admin_id = p_employee_id then
    return json_build_object('success', false, 'error', 'cannot_delete_self');
  end if;

  update employees set manager_id = null where manager_id = p_employee_id;
  delete from employees where id = p_employee_id;
  if not found then
    return json_build_object('success', false, 'error', 'not_found');
  end if;

  return json_build_object('success', true);
end;
$$;

-- ============================================================
-- DISPATCHER — DEALS & INVOICES
-- ============================================================

create or replace function add_deal(
  p_employee_id uuid,
  p_customer_name text,
  p_truck_ref text,
  p_pickup_location text,
  p_drop_location text,
  p_pickup_date date,
  p_delivery_date date,
  p_load_amount numeric,
  p_dispatch_fee_percent numeric,
  p_notes text default null
)
returns json
language plpgsql
security definer
as $$
declare
  new_deal deals;
  v_invoice text;
  v_fee numeric;
begin
  if not exists (select 1 from employees where id = p_employee_id and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  if p_load_amount is null or p_load_amount < 0 then
    return json_build_object('success', false, 'error', 'invalid_load_amount');
  end if;
  if p_dispatch_fee_percent is null or p_dispatch_fee_percent < 0 or p_dispatch_fee_percent > 100 then
    return json_build_object('success', false, 'error', 'invalid_fee_percent');
  end if;

  v_fee := round(p_load_amount * p_dispatch_fee_percent / 100.0, 2);
  v_invoice := 'NLH-' || to_char(now(), 'YYYY') || '-' || nextval('invoice_seq');

  insert into deals (
    employee_id, invoice_number, customer_name, truck_ref,
    pickup_location, drop_location, pickup_date, delivery_date,
    load_amount, dispatch_fee_percent, fee_amount, notes
  ) values (
    p_employee_id, v_invoice, p_customer_name, p_truck_ref,
    p_pickup_location, p_drop_location, p_pickup_date, p_delivery_date,
    p_load_amount, p_dispatch_fee_percent, v_fee, p_notes
  ) returning * into new_deal;

  return json_build_object('success', true, 'deal', row_to_json(new_deal));
end;
$$;

create or replace function set_deal_payment_status(
  p_employee_id uuid, p_deal_id uuid, p_status text
)
returns json
language plpgsql
security definer
as $$
begin
  if p_status not in ('pending','paid') then
    return json_build_object('success', false, 'error', 'invalid_status');
  end if;

  update deals set payment_status = p_status
    where id = p_deal_id and employee_id = p_employee_id;

  if not found then
    return json_build_object('success', false, 'error', 'not_found_or_not_yours');
  end if;

  return json_build_object('success', true);
end;
$$;

create or replace function get_my_deals(p_employee_id uuid)
returns json
language sql
security definer
as $$
  select coalesce(json_agg(d order by created_at desc), '[]'::json)
  from (select * from deals where employee_id = p_employee_id) d;
$$;

create or replace function get_my_sales_summary(p_employee_id uuid, p_month date)
returns json
language plpgsql
security definer
as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_total numeric;
  v_fee_total numeric;
  v_count int;
  v_target numeric;
begin
  select coalesce(sum(load_amount),0), coalesce(sum(fee_amount),0), count(*)
    into v_total, v_fee_total, v_count
  from deals
  where employee_id = p_employee_id
    and created_at::date between v_start and v_end;

  select target_amount into v_target from monthly_targets
    where employee_id = p_employee_id and target_month = v_start;

  return json_build_object(
    'success', true,
    'total_load_amount', v_total,
    'total_fee_amount', v_fee_total,
    'deal_count', v_count,
    'target_amount', coalesce(v_target, 0)
  );
end;
$$;

create or replace function admin_get_all_deals(p_admin_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'deals', (
    select coalesce(json_agg(d order by created_at desc), '[]'::json)
    from (
      select dl.*, e.full_name, e.email
      from deals dl join employees e on e.id = dl.employee_id
    ) d
  ));
end;
$$;

create or replace function admin_set_monthly_target(
  p_admin_id uuid, p_employee_id uuid, p_month date, p_target_amount numeric
)
returns json
language plpgsql
security definer
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  insert into monthly_targets (employee_id, target_month, target_amount)
    values (p_employee_id, v_month, p_target_amount)
  on conflict (employee_id, target_month)
    do update set target_amount = excluded.target_amount;

  return json_build_object('success', true);
end;
$$;

create or replace function admin_get_sales_summary(p_admin_id uuid, p_month date)
returns json
language plpgsql
security definer
as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'summary', (
    select coalesce(json_agg(s order by total_load_amount desc), '[]'::json)
    from (
      select
        e.id as employee_id,
        e.full_name,
        e.position,
        coalesce(sum(dl.load_amount), 0) as total_load_amount,
        coalesce(sum(dl.fee_amount), 0) as total_fee_amount,
        count(dl.id) as deal_count,
        coalesce(mt.target_amount, 0) as target_amount
      from employees e
      left join deals dl on dl.employee_id = e.id
        and dl.created_at::date between v_start and v_end
      left join monthly_targets mt on mt.employee_id = e.id and mt.target_month = v_start
      where e.department = 'dispatcher'
      group by e.id, e.full_name, e.position, mt.target_amount
    ) s
  ));
end;
$$;

-- ============================================================
-- COLD CALLER — CALLS, FLEETS, TRUCKS, COMMISSION
-- ============================================================

create or replace function log_coldcaller_activity(
  p_employee_id uuid, p_log_date date, p_calls_made int, p_confirmed_sales int
)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_employee_id and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  insert into coldcaller_daily_stats (employee_id, log_date, calls_made, confirmed_sales)
    values (p_employee_id, p_log_date, p_calls_made, p_confirmed_sales)
  on conflict (employee_id, log_date)
    do update set calls_made = excluded.calls_made, confirmed_sales = excluded.confirmed_sales;

  return json_build_object('success', true);
end;
$$;

create or replace function get_my_coldcaller_activity(p_employee_id uuid, p_month date)
returns json
language sql
security definer
as $$
  select coalesce(json_agg(s order by log_date desc), '[]'::json)
  from (
    select * from coldcaller_daily_stats
    where employee_id = p_employee_id
      and log_date between date_trunc('month', p_month)::date
                        and (date_trunc('month', p_month) + interval '1 month - 1 day')::date
  ) s;
$$;

create or replace function add_fleet(
  p_cold_caller_id uuid, p_carrier_name text, p_country text, p_agreement_signed_at timestamptz
)
returns json
language plpgsql
security definer
as $$
declare
  new_fleet fleets;
begin
  if not exists (select 1 from employees where id = p_cold_caller_id and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  if p_country not in ('USA','Canada') then
    return json_build_object('success', false, 'error', 'invalid_country');
  end if;

  insert into fleets (cold_caller_id, carrier_name, country, agreement_signed_at)
    values (p_cold_caller_id, p_carrier_name, p_country, p_agreement_signed_at)
    returning * into new_fleet;

  return json_build_object('success', true, 'fleet', row_to_json(new_fleet));
end;
$$;

create or replace function add_truck(
  p_cold_caller_id uuid, p_fleet_id uuid, p_truck_number text, p_activated_at timestamptz
)
returns json
language plpgsql
security definer
as $$
declare
  new_truck trucks;
begin
  if not exists (select 1 from fleets where id = p_fleet_id and cold_caller_id = p_cold_caller_id) then
    return json_build_object('success', false, 'error', 'fleet_not_found_or_not_yours');
  end if;

  insert into trucks (fleet_id, truck_number, activated_at)
    values (p_fleet_id, p_truck_number, p_activated_at)
    returning * into new_truck;

  return json_build_object('success', true, 'truck', row_to_json(new_truck));
end;
$$;

create or replace function mark_truck_first_load(p_cold_caller_id uuid, p_truck_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  update trucks t set first_load_completed_at = now()
    from fleets f
    where t.fleet_id = f.id and t.id = p_truck_id and f.cold_caller_id = p_cold_caller_id;

  if not found then
    return json_build_object('success', false, 'error', 'not_found_or_not_yours');
  end if;
  return json_build_object('success', true);
end;
$$;

create or replace function get_my_fleets(p_cold_caller_id uuid)
returns json
language sql
security definer
as $$
  select coalesce(json_agg(
    json_build_object(
      'fleet', row_to_json(f),
      'trucks', (select coalesce(json_agg(t order by t.created_at desc), '[]'::json) from trucks t where t.fleet_id = f.id)
    ) order by f.created_at desc
  ), '[]'::json)
  from fleets f where f.cold_caller_id = p_cold_caller_id;
$$;

create or replace function calculate_coldcaller_commission(
  p_caller_id uuid,
  p_cold_caller_id uuid,
  p_month date
)
returns json
language plpgsql
security definer
as $$
declare
  v_is_admin boolean;
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_truck_count int := 0;
  v_canada_truck_count int := 0;
  v_tier_commission numeric := 0;
  v_fleet_bonus numeric := 0;
  v_canada_bonus numeric := 0;
  v_perf_bonus numeric := 0;
  v_remaining int;
  v_perf_level text;
  r record;
begin
  select exists(select 1 from employees where id = p_caller_id and role = 'admin' and active = true)
    into v_is_admin;

  if not v_is_admin and p_caller_id <> p_cold_caller_id then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  select count(*),
         count(*) filter (where f.country = 'Canada')
    into v_truck_count, v_canada_truck_count
  from trucks t
  join fleets f on f.id = t.fleet_id
  where f.cold_caller_id = p_cold_caller_id
    and f.is_disqualified = false
    and f.agreement_signed_at is not null
    and t.activated_at is not null
    and t.first_load_completed_at is not null
    and (t.deactivated_at is null or t.deactivated_at >= t.activated_at + interval '7 days')
    and t.activated_at::date between v_month_start and v_month_end;

  v_remaining := v_truck_count;
  if v_remaining > 0 then v_tier_commission := v_tier_commission + least(v_remaining,5) * 30; v_remaining := v_remaining - least(v_remaining,5); end if;
  if v_remaining > 0 then v_tier_commission := v_tier_commission + least(v_remaining,5) * 45; v_remaining := v_remaining - least(v_remaining,5); end if;
  if v_remaining > 0 then v_tier_commission := v_tier_commission + least(v_remaining,10) * 60; v_remaining := v_remaining - least(v_remaining,10); end if;
  if v_remaining > 0 then v_tier_commission := v_tier_commission + v_remaining * 80; end if;

  for r in
    select f.id, count(t.id) as truck_ct
    from fleets f
    join trucks t on t.fleet_id = f.id
    where f.cold_caller_id = p_cold_caller_id
      and f.is_disqualified = false
      and f.agreement_signed_at is not null
      and t.activated_at is not null
      and t.first_load_completed_at is not null
      and (t.deactivated_at is null or t.deactivated_at >= t.activated_at + interval '7 days')
      and t.activated_at::date between v_month_start and v_month_end
    group by f.id
  loop
    if r.truck_ct >= 10 then v_fleet_bonus := v_fleet_bonus + 250;
    elsif r.truck_ct >= 5 then v_fleet_bonus := v_fleet_bonus + 100;
    end if;
  end loop;

  v_canada_bonus := v_canada_truck_count * 10;

  if v_truck_count >= 30 then v_perf_bonus := 500;
  elsif v_truck_count >= 20 then v_perf_bonus := 200;
  elsif v_truck_count >= 10 then v_perf_bonus := 100;
  end if;

  v_perf_level := case
    when v_truck_count >= 20 then 'Strong Performance'
    when v_truck_count >= 10 then 'Good / Profitable'
    when v_truck_count >= 5 then 'Minimum / Acceptable'
    else 'Below Minimum'
  end;

  return json_build_object(
    'success', true,
    'base_salary_pkr', 25000,
    'activated_trucks_count', v_truck_count,
    'tier_commission_usd', v_tier_commission,
    'fleet_bonus_usd', v_fleet_bonus,
    'canada_bonus_usd', v_canada_bonus,
    'performance_bonus_usd', v_perf_bonus,
    'total_commission_usd', v_tier_commission + v_fleet_bonus + v_canada_bonus + v_perf_bonus,
    'performance_level', v_perf_level
  );
end;
$$;

create or replace function admin_get_all_coldcaller_activity(p_admin_id uuid, p_month date)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'activity', (
    select coalesce(json_agg(s order by s.log_date desc), '[]'::json)
    from (
      select cs.*, e.full_name
      from coldcaller_daily_stats cs
      join employees e on e.id = cs.employee_id
      where cs.log_date between date_trunc('month', p_month)::date
                            and (date_trunc('month', p_month) + interval '1 month - 1 day')::date
    ) s
  ));
end;
$$;

create or replace function admin_set_fleet_disqualified(p_admin_id uuid, p_fleet_id uuid, p_disqualified boolean)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  update fleets set is_disqualified = p_disqualified where id = p_fleet_id;
  return json_build_object('success', true);
end;
$$;

-- ============================================================
-- MESSAGING
-- ============================================================

create or replace function admin_send_message(
  p_admin_id uuid, p_recipient_employee_id uuid, p_body text
)
returns json
language plpgsql
security definer
as $$
declare
  new_msg messages;
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  if trim(coalesce(p_body,'')) = '' then
    return json_build_object('success', false, 'error', 'empty_message');
  end if;
  if p_recipient_employee_id is not null
     and not exists (select 1 from employees where id = p_recipient_employee_id) then
    return json_build_object('success', false, 'error', 'recipient_not_found');
  end if;

  insert into messages (sender_admin_id, recipient_employee_id, body)
    values (p_admin_id, p_recipient_employee_id, trim(p_body))
    returning * into new_msg;

  return json_build_object('success', true, 'id', new_msg.id);
end;
$$;

create or replace function admin_delete_message(p_admin_id uuid, p_message_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  delete from messages where id = p_message_id;
  if not found then
    return json_build_object('success', false, 'error', 'not_found');
  end if;
  return json_build_object('success', true);
end;
$$;

create or replace function admin_get_all_messages(p_admin_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'messages', (
    select coalesce(json_agg(m order by m.created_at desc), '[]'::json)
    from (
      select
        msg.id, msg.body, msg.created_at, msg.recipient_employee_id,
        s.full_name as sender_name,
        r.full_name as recipient_name, r.email as recipient_email
      from messages msg
      join employees s on s.id = msg.sender_admin_id
      left join employees r on r.id = msg.recipient_employee_id
    ) m
  ));
end;
$$;

create or replace function admin_clear_all_messages(p_admin_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  delete from messages;
  return json_build_object('success', true);
end;
$$;

create or replace function get_my_messages(p_employee_id uuid)
returns json
language sql
security definer
as $$
  select coalesce(json_agg(m order by m.created_at desc), '[]'::json)
  from (
    select
      msg.id, msg.body, msg.created_at,
      (msg.recipient_employee_id is not null) as is_direct,
      s.full_name as sender_name
    from messages msg
    join employees s on s.id = msg.sender_admin_id
    join employees me on me.id = p_employee_id
    where (msg.recipient_employee_id is null and msg.created_at >= me.created_at)
       or msg.recipient_employee_id = p_employee_id
  ) m;
$$;

-- ============================================================
-- BONUSES & PAYROLL CLOSING
-- ============================================================

create or replace function admin_add_bonus(
  p_admin_id uuid, p_employee_id uuid, p_amount numeric, p_currency text, p_reason text
)
returns json
language plpgsql
security definer
as $$
declare
  new_bonus bonuses;
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  if p_currency not in ('USD','PKR') then
    return json_build_object('success', false, 'error', 'invalid_currency');
  end if;
  if trim(coalesce(p_reason,'')) = '' then
    return json_build_object('success', false, 'error', 'reason_required');
  end if;

  insert into bonuses (employee_id, amount, currency, reason, awarded_by)
    values (p_employee_id, p_amount, p_currency, trim(p_reason), p_admin_id)
    returning * into new_bonus;

  return json_build_object('success', true, 'bonus', row_to_json(new_bonus));
end;
$$;

create or replace function admin_get_all_bonuses(p_admin_id uuid, p_month date)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'bonuses', (
    select coalesce(json_agg(b order by b.awarded_at desc), '[]'::json)
    from (
      select bo.*, e.full_name as employee_name, a.full_name as awarded_by_name
      from bonuses bo
      join employees e on e.id = bo.employee_id
      join employees a on a.id = bo.awarded_by
      where bo.awarded_at::date between date_trunc('month', p_month)::date
                                    and (date_trunc('month', p_month) + interval '1 month - 1 day')::date
    ) b
  ));
end;
$$;

create or replace function get_my_bonuses(p_employee_id uuid, p_month date)
returns json
language sql
security definer
as $$
  select coalesce(json_agg(b order by b.awarded_at desc), '[]'::json)
  from (
    select amount, currency, reason, awarded_at
    from bonuses
    where employee_id = p_employee_id
      and awarded_at::date between date_trunc('month', p_month)::date
                                and (date_trunc('month', p_month) + interval '1 month - 1 day')::date
  ) b;
$$;

create or replace function admin_close_month(p_admin_id uuid, p_employee_id uuid, p_month date)
returns json
language plpgsql
security definer
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_department text;
  v_base_salary numeric;
  v_base_currency text;
  v_commission numeric := 0;
  v_breakdown json;
  v_bonus_usd numeric := 0;
  v_bonus_pkr numeric := 0;
  v_total_usd numeric;
  v_total_pkr numeric;
  v_record monthly_closings;
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  select department, base_salary, base_salary_currency
    into v_department, v_base_salary, v_base_currency
  from employees where id = p_employee_id;

  if v_department = 'cold_caller' then
    select (r.data->>'total_commission_usd')::numeric, r.data
      into v_commission, v_breakdown
    from (
      select row_to_json(c) as data
      from calculate_coldcaller_commission(p_admin_id, p_employee_id, v_month) c
    ) r;
  elsif v_department = 'dispatcher' then
    select coalesce(sum(fee_amount), 0)
      into v_commission
    from deals
    where employee_id = p_employee_id
      and created_at::date between v_month and (v_month + interval '1 month - 1 day')::date;
    v_breakdown := json_build_object('total_fee_amount', v_commission);
  else
    -- other Hub roles: no commission/fee component, just base salary + bonuses
    select coalesce(sum(metric_value), 0)
      into v_commission
    from performance_logs
    where employee_id = p_employee_id and metric_value = 0 -- always 0: no cash value from raw activity counts
      and log_date between v_month and (v_month + interval '1 month - 1 day')::date;
    v_commission := 0;
    v_breakdown := json_build_object('note', 'salary-only role, no commission component');
  end if;

  select coalesce(sum(amount) filter (where currency = 'USD'), 0),
         coalesce(sum(amount) filter (where currency = 'PKR'), 0)
    into v_bonus_usd, v_bonus_pkr
  from bonuses
  where employee_id = p_employee_id
    and awarded_at::date between v_month and (v_month + interval '1 month - 1 day')::date;

  v_total_usd := v_commission + v_bonus_usd + (case when v_base_currency = 'USD' then v_base_salary else 0 end);
  v_total_pkr := v_bonus_pkr + (case when v_base_currency = 'PKR' then v_base_salary else 0 end);

  insert into monthly_closings (
    employee_id, closed_month, base_amount, base_currency, commission_amount,
    bonus_usd, bonus_pkr, total_usd, total_pkr, breakdown, closed_by
  ) values (
    p_employee_id, v_month, coalesce(v_base_salary,0), coalesce(v_base_currency,'PKR'), coalesce(v_commission,0),
    v_bonus_usd, v_bonus_pkr, v_total_usd, v_total_pkr, v_breakdown, p_admin_id
  )
  on conflict (employee_id, closed_month) do update set
    base_amount = excluded.base_amount, base_currency = excluded.base_currency,
    commission_amount = excluded.commission_amount, bonus_usd = excluded.bonus_usd,
    bonus_pkr = excluded.bonus_pkr, total_usd = excluded.total_usd, total_pkr = excluded.total_pkr,
    breakdown = excluded.breakdown, closed_by = excluded.closed_by, closed_at = now()
  returning * into v_record;

  return json_build_object('success', true, 'closing', row_to_json(v_record));
end;
$$;

create or replace function admin_get_closings(p_admin_id uuid, p_month date)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'closings', (
    select coalesce(json_agg(c order by c.total_usd desc), '[]'::json)
    from (
      select mc.*, e.full_name as employee_name, e.position
      from monthly_closings mc
      join employees e on e.id = mc.employee_id
      where mc.closed_month = date_trunc('month', p_month)::date
    ) c
  ));
end;
$$;

create or replace function get_my_closings(p_employee_id uuid)
returns json
language sql
security definer
as $$
  select coalesce(json_agg(c order by c.closed_month desc), '[]'::json)
  from (
    select closed_month, base_amount, base_currency, commission_amount,
           bonus_usd, bonus_pkr, total_usd, total_pkr, closed_at
    from monthly_closings where employee_id = p_employee_id
  ) c;
$$;

-- ============================================================
-- NEW — HUB-WIDE PERFORMANCE TRACKING
-- (Social Media / Designer / Animator / Operations Manager /
--  Team Leader / Other log their output here; dispatchers and
--  cold callers keep using their own dedicated numbers.)
-- ============================================================

create or replace function log_performance(
  p_employee_id uuid, p_log_date date, p_metric_label text, p_metric_value numeric, p_notes text default null
)
returns json
language plpgsql
security definer
as $$
declare
  new_log performance_logs;
begin
  if not exists (select 1 from employees where id = p_employee_id and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  if trim(coalesce(p_metric_label,'')) = '' then
    return json_build_object('success', false, 'error', 'metric_label_required');
  end if;

  insert into performance_logs (employee_id, log_date, metric_label, metric_value, notes)
    values (p_employee_id, p_log_date, trim(p_metric_label), coalesce(p_metric_value, 0), nullif(trim(coalesce(p_notes,'')), ''))
  on conflict (employee_id, log_date, metric_label)
    do update set metric_value = excluded.metric_value, notes = excluded.notes, updated_at = now()
    returning * into new_log;

  return json_build_object('success', true, 'log', row_to_json(new_log));
end;
$$;

create or replace function get_my_performance_logs(p_employee_id uuid, p_month date)
returns json
language sql
security definer
as $$
  select coalesce(json_agg(l order by log_date desc), '[]'::json)
  from (
    select * from performance_logs
    where employee_id = p_employee_id
      and log_date between date_trunc('month', p_month)::date
                        and (date_trunc('month', p_month) + interval '1 month - 1 day')::date
  ) l;
$$;

create or replace function admin_get_all_performance_logs(p_admin_id uuid, p_month date)
returns json
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'logs', (
    select coalesce(json_agg(l order by l.log_date desc), '[]'::json)
    from (
      select pl.*, e.full_name, e.department, e.position
      from performance_logs pl
      join employees e on e.id = pl.employee_id
      where pl.log_date between date_trunc('month', p_month)::date
                             and (date_trunc('month', p_month) + interval '1 month - 1 day')::date
    ) l
  ));
end;
$$;

-- ---------- Monthly progress series (feeds the Overview graph) ----------
-- Returns the last p_months (default 6, current month included) worth of
-- values for one employee, using whichever number actually represents
-- their department's output:
--   dispatcher           -> dispatch fee earned that month ($)
--   cold_caller          -> trucks activated that month (qualifying)
--   everything else      -> sum of their performance_logs that month
-- Callable by: the employee themself, any admin, or that employee's
-- direct manager (manager_id).
create or replace function get_monthly_progress_series(
  p_caller_id uuid, p_employee_id uuid, p_months int default 6
)
returns json
language plpgsql
security definer
as $$
declare
  v_is_admin boolean;
  v_is_manager boolean;
  v_department text;
  v_label text;
  v_result json;
begin
  select exists(select 1 from employees where id = p_caller_id and role = 'admin' and active = true) into v_is_admin;
  select exists(select 1 from employees where id = p_employee_id and manager_id = p_caller_id) into v_is_manager;

  if not v_is_admin and not v_is_manager and p_caller_id <> p_employee_id then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  select department into v_department from employees where id = p_employee_id;
  if v_department is null then
    return json_build_object('success', false, 'error', 'employee_not_found');
  end if;

  v_label := case v_department
    when 'dispatcher' then 'Dispatch Fee Earned ($)'
    when 'cold_caller' then 'Trucks Activated'
    when 'social_media' then 'Posts Published'
    when 'designer' then 'Designs Completed'
    when 'animator' then 'Videos/Animations Delivered'
    when 'operations_manager' then 'Tasks Managed'
    when 'team_leader' then 'Team Tasks Reviewed'
    else 'Tasks Completed'
  end;

  with months as (
    select generate_series(
      date_trunc('month', current_date) - ((coalesce(p_months,6) - 1) || ' months')::interval,
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  )
  select json_agg(
    json_build_object(
      'month', to_char(m.month_start, 'YYYY-MM'),
      'value', case
        when v_department = 'dispatcher' then (
          select coalesce(sum(fee_amount), 0) from deals
          where employee_id = p_employee_id
            and created_at::date between m.month_start and (m.month_start + interval '1 month - 1 day')::date
        )
        when v_department = 'cold_caller' then (
          select count(*) from trucks t join fleets f on f.id = t.fleet_id
          where f.cold_caller_id = p_employee_id and f.is_disqualified = false
            and t.activated_at::date between m.month_start and (m.month_start + interval '1 month - 1 day')::date
        )
        else (
          select coalesce(sum(metric_value), 0) from performance_logs
          where employee_id = p_employee_id
            and log_date between m.month_start and (m.month_start + interval '1 month - 1 day')::date
        )
      end
    ) order by m.month_start
  ) into v_result
  from months m;

  return json_build_object('success', true, 'department', v_department, 'metric_label', v_label, 'series', coalesce(v_result, '[]'::json));
end;
$$;

-- ---------- Team overview (for Team Leader / Operations Manager) ----------
-- Shows this month's number for every direct report, using the same
-- per-department logic as above but for the current month only.
create or replace function get_my_team_overview(p_manager_id uuid, p_month date)
returns json
language plpgsql
security definer
as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
begin
  if not exists (select 1 from employees where id = p_manager_id and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object('success', true, 'team', (
    select coalesce(json_agg(t), '[]'::json)
    from (
      select
        e.id, e.full_name, e.position, e.department,
        case e.department
          when 'dispatcher' then 'Dispatch Fee Earned ($)'
          when 'cold_caller' then 'Trucks Activated'
          when 'social_media' then 'Posts Published'
          when 'designer' then 'Designs Completed'
          when 'animator' then 'Videos/Animations Delivered'
          when 'operations_manager' then 'Tasks Managed'
          when 'team_leader' then 'Team Tasks Reviewed'
          else 'Tasks Completed'
        end as metric_label,
        case
          when e.department = 'dispatcher' then (
            select coalesce(sum(fee_amount), 0) from deals
            where employee_id = e.id and created_at::date between v_start and v_end
          )
          when e.department = 'cold_caller' then (
            select count(*) from trucks t join fleets f on f.id = t.fleet_id
            where f.cold_caller_id = e.id and f.is_disqualified = false
              and t.activated_at::date between v_start and v_end
          )
          else (
            select coalesce(sum(metric_value), 0) from performance_logs
            where employee_id = e.id and log_date between v_start and v_end
          )
        end as month_value
      from employees e
      where e.manager_id = p_manager_id
      order by e.full_name
    ) t
  ));
end;
$$;

-- ============================================================
-- PERMISSIONS — anon must be able to EXECUTE every RPC above
-- (each RPC enforces its own authorization internally)
-- ============================================================
grant execute on function login_employee(text, text) to anon;
grant execute on function clock_in(uuid) to anon;
grant execute on function clock_out(uuid) to anon;
grant execute on function get_my_timelogs(uuid) to anon;
grant execute on function post_update(uuid, text) to anon;
grant execute on function get_updates() to anon;

grant execute on function admin_list_employees(uuid) to anon;
grant execute on function admin_add_employee(uuid, text, text, text, text, text, numeric, text, text, uuid) to anon;
grant execute on function admin_set_employee_active(uuid, uuid, boolean) to anon;
grant execute on function admin_update_employee_base_salary(uuid, uuid, numeric, text) to anon;
grant execute on function admin_update_employee_role_info(uuid, uuid, text, text, uuid) to anon;
grant execute on function admin_get_all_timelogs(uuid) to anon;
grant execute on function change_admin_password(uuid, text, text) to anon;
grant execute on function admin_delete_employee_permanently(uuid, uuid) to anon;

grant execute on function add_deal(uuid, text, text, text, text, date, date, numeric, numeric, text) to anon;
grant execute on function set_deal_payment_status(uuid, uuid, text) to anon;
grant execute on function get_my_deals(uuid) to anon;
grant execute on function get_my_sales_summary(uuid, date) to anon;
grant execute on function admin_get_all_deals(uuid) to anon;
grant execute on function admin_set_monthly_target(uuid, uuid, date, numeric) to anon;
grant execute on function admin_get_sales_summary(uuid, date) to anon;

grant execute on function log_coldcaller_activity(uuid, date, int, int) to anon;
grant execute on function get_my_coldcaller_activity(uuid, date) to anon;
grant execute on function add_fleet(uuid, text, text, timestamptz) to anon;
grant execute on function add_truck(uuid, uuid, text, timestamptz) to anon;
grant execute on function mark_truck_first_load(uuid, uuid) to anon;
grant execute on function get_my_fleets(uuid) to anon;
grant execute on function calculate_coldcaller_commission(uuid, uuid, date) to anon;
grant execute on function admin_get_all_coldcaller_activity(uuid, date) to anon;
grant execute on function admin_set_fleet_disqualified(uuid, uuid, boolean) to anon;

grant execute on function admin_send_message(uuid, uuid, text) to anon;
grant execute on function admin_delete_message(uuid, uuid) to anon;
grant execute on function admin_get_all_messages(uuid) to anon;
grant execute on function admin_clear_all_messages(uuid) to anon;
grant execute on function get_my_messages(uuid) to anon;

grant execute on function admin_add_bonus(uuid, uuid, numeric, text, text) to anon;
grant execute on function admin_get_all_bonuses(uuid, date) to anon;
grant execute on function get_my_bonuses(uuid, date) to anon;
grant execute on function admin_close_month(uuid, uuid, date) to anon;
grant execute on function admin_get_closings(uuid, date) to anon;
grant execute on function get_my_closings(uuid) to anon;

grant execute on function log_performance(uuid, date, text, numeric, text) to anon;
grant execute on function get_my_performance_logs(uuid, date) to anon;
grant execute on function admin_get_all_performance_logs(uuid, date) to anon;
grant execute on function get_monthly_progress_series(uuid, uuid, int) to anon;
grant execute on function get_my_team_overview(uuid, date) to anon;

-- ============================================================
-- Done. This is the ONLY sql file you need to run on the new,
-- fresh Supabase project. Do not also run the old migration
-- files against this database.
-- ============================================================
