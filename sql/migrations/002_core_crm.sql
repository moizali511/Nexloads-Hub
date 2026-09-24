-- Nexloads Hub — migration 002: core CRM entities (leads → revenue workflow)
-- Run after 001. Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE).

-- ---------------------------------------------------------------------------
-- Access role (permissions; login role admin/employee unchanged)
-- ---------------------------------------------------------------------------
alter table employees add column if not exists access_role text not null default 'employee'
  check (access_role in ('admin','manager','team_leader','cold_caller','dispatcher','finance','employee'));

alter table employees add column if not exists joining_date date;
alter table employees add column if not exists phone text;
alter table employees add column if not exists profile_notes text;

update employees set access_role = 'admin' where role = 'admin' and access_role = 'employee';
update employees set access_role = department
  where role = 'employee' and department in ('cold_caller','dispatcher','team_leader','operations_manager')
  and access_role = 'employee';
update employees set access_role = 'manager' where department = 'operations_manager' and access_role = 'employee';

-- ---------------------------------------------------------------------------
-- Activity timeline (polymorphic)
-- ---------------------------------------------------------------------------
create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  summary text not null,
  actor_id uuid references employees(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_entity on activity_events(entity_type, entity_id, created_at desc);
alter table activity_events enable row level security;

create or replace function log_activity(
  p_entity_type text, p_entity_id uuid, p_event_type text, p_summary text,
  p_actor_id uuid default null, p_metadata jsonb default null
) returns void language sql security definer as $$
  insert into activity_events (entity_type, entity_id, event_type, summary, actor_id, metadata)
  values (p_entity_type, p_entity_id, p_event_type, p_summary, p_actor_id, p_metadata);
$$;

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  phone text,
  email text,
  location text,
  lead_source text,
  equipment text,
  truck_count int default 0,
  mc text,
  dot text,
  preferred_lanes text,
  notes text,
  assigned_cold_caller_id uuid references employees(id) on delete set null,
  status text not null default 'new' check (status in (
    'new','contacted','interested','follow_up','documents_pending',
    'onboarding','converted','not_interested','lost'
  )),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  converted_client_id uuid,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_assigned on leads(assigned_cold_caller_id);
create index if not exists idx_leads_follow_up on leads(next_follow_up_at);
alter table leads enable row level security;

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  owner_name text not null,
  company text,
  phone text,
  email text,
  mc text,
  dot text,
  equipment text,
  truck_count int default 0,
  preferred_lanes text,
  home_location text,
  dispatch_percent numeric(5,2) not null default 5 check (dispatch_percent >= 0 and dispatch_percent <= 100),
  start_date date,
  assigned_dispatcher_id uuid references employees(id) on delete set null,
  status text not null default 'onboarding' check (status in ('onboarding','active','paused','inactive','closed')),
  notes text,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clients_status on clients(status);
create index if not exists idx_clients_dispatcher on clients(assigned_dispatcher_id);
alter table clients enable row level security;

alter table leads add column if not exists converted_client_id uuid references clients(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Brokers, drivers, operational trucks (not cold-caller fleets/trucks)
-- ---------------------------------------------------------------------------
create table if not exists brokers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  phone text,
  email text,
  mc text,
  address text,
  lanes text,
  notes text,
  created_at timestamptz not null default now()
);
alter table brokers enable row level security;

create table if not exists client_trucks (
  id uuid primary key default gen_random_uuid(),
  truck_number text not null,
  client_id uuid references clients(id) on delete set null,
  driver_id uuid,
  equipment text,
  trailer text,
  current_location text,
  home_location text,
  status text not null default 'available' check (status in (
    'available','dispatched','loaded','in_transit','delivered','out_of_service'
  )),
  preferred_lanes text,
  dispatcher_id uuid references employees(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table client_trucks enable row level security;

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  cdl_info text,
  truck_id uuid references client_trucks(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  current_location text,
  home_location text,
  status text not null default 'available' check (status in (
    'available','dispatched','on_load','off_duty','inactive'
  )),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table drivers enable row level security;

alter table client_trucks drop constraint if exists client_trucks_driver_id_fkey;
alter table client_trucks add constraint client_trucks_driver_id_fkey
  foreign key (driver_id) references drivers(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Loads / dispatch
-- ---------------------------------------------------------------------------
create table if not exists loads (
  id uuid primary key default gen_random_uuid(),
  load_number text unique not null,
  broker_id uuid references brokers(id) on delete set null,
  broker_contact text,
  pickup_location text not null,
  delivery_location text not null,
  pickup_at timestamptz,
  delivery_at timestamptz,
  equipment text,
  loaded_miles numeric(10,2) default 0,
  deadhead_miles numeric(10,2) default 0,
  rate numeric(12,2) not null default 0,
  rpm numeric(10,4),
  driver_id uuid references drivers(id) on delete set null,
  truck_id uuid references client_trucks(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  dispatcher_id uuid references employees(id) on delete set null,
  notes text,
  status text not null default 'searching' check (status in (
    'searching','found','negotiating','booked','picked_up',
    'in_transit','delivered','completed','cancelled'
  )),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid')),
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create sequence if not exists load_number_seq start 5001;
create index if not exists idx_loads_status on loads(status);
create index if not exists idx_loads_pickup on loads(pickup_at);
create index if not exists idx_loads_dispatcher on loads(dispatcher_id);
alter table loads enable row level security;

-- ---------------------------------------------------------------------------
-- Calls, follow-ups, tasks, documents, notifications
-- ---------------------------------------------------------------------------
create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('inbound','outbound')),
  status text not null default 'connected' check (status in ('connected','missed','voicemail','busy')),
  duration_seconds int default 0,
  employee_id uuid not null references employees(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  result text,
  notes text,
  follow_up_at timestamptz,
  recording_url text,
  provider text,
  external_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_calls_employee on calls(employee_id, created_at desc);
alter table calls enable row level security;

create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references employees(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  created_by uuid references employees(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_follow_ups_due on follow_ups(due_at) where status = 'open';
alter table follow_ups enable row level security;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references employees(id) on delete set null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_date date,
  status text not null default 'todo' check (status in ('todo','in_progress','completed','cancelled')),
  related_lead_id uuid references leads(id) on delete set null,
  related_client_id uuid references clients(id) on delete set null,
  related_load_id uuid references loads(id) on delete set null,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table tasks enable row level security;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  file_name text not null,
  file_url text,
  storage_path text,
  status text not null default 'pending' check (status in ('pending','received','verified','expired')),
  expiry_date date,
  uploaded_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_documents_entity on documents(entity_type, entity_id);
alter table documents enable row level security;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references employees(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_recipient on notifications(recipient_id, read_at);
alter table notifications enable row level security;

-- ---------------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------------
create or replace function effective_access_role(p_employee_id uuid)
returns text language sql stable security definer as $$
  select case
    when e.role = 'admin' then 'admin'
    when e.access_role is not null and e.access_role <> 'employee' then e.access_role
    when e.department = 'cold_caller' then 'cold_caller'
    when e.department = 'dispatcher' then 'dispatcher'
    when e.department = 'team_leader' then 'team_leader'
    when e.department = 'operations_manager' then 'manager'
    else coalesce(e.access_role, 'employee')
  end
  from employees e where e.id = p_employee_id;
$$;

create or replace function is_privileged(p_employee_id uuid)
returns boolean language sql stable security definer as $$
  select effective_access_role(p_employee_id) in ('admin','manager','team_leader');
$$;

create or replace function assert_active_employee(p_employee_id uuid)
returns boolean language plpgsql security definer as $$
begin
  if not exists (
    select 1 from employees where id = p_employee_id and active = true
      and employment_status in ('active')
  ) then
    return false;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leads RPCs
-- ---------------------------------------------------------------------------
create or replace function crm_list_leads(
  p_caller_id uuid, p_status text default null, p_search text default null,
  p_assigned_to uuid default null, p_limit int default 50, p_offset int default 0
) returns json language plpgsql security definer as $$
declare v_role text;
begin
  if not assert_active_employee(p_caller_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  v_role := effective_access_role(p_caller_id);

  return json_build_object('success', true, 'leads', (
    select coalesce(json_agg(x order by x.created_at desc), '[]'::json)
    from (
      select l.*, e.full_name as assigned_name
      from leads l
      left join employees e on e.id = l.assigned_cold_caller_id
      where (p_status is null or l.status = p_status)
        and (p_search is null or trim(p_search) = '' or
          l.name ilike '%'||trim(p_search)||'%' or coalesce(l.company,'') ilike '%'||trim(p_search)||'%'
          or coalesce(l.phone,'') ilike '%'||trim(p_search)||'%')
        and (
          is_privileged(p_caller_id)
          or l.assigned_cold_caller_id = p_caller_id
          or (p_assigned_to is not null and l.assigned_cold_caller_id = p_assigned_to and p_assigned_to = p_caller_id)
        )
        and (not v_role = 'cold_caller' or l.assigned_cold_caller_id = p_caller_id or l.assigned_cold_caller_id is null and is_privileged(p_caller_id))
      order by l.created_at desc
      limit greatest(1, least(coalesce(p_limit,50), 200))
      offset greatest(coalesce(p_offset,0), 0)
    ) x
  ));
end;
$$;

create or replace function crm_upsert_lead(p_caller_id uuid, p_payload jsonb)
returns json language plpgsql security definer as $$
declare v_lead leads;
declare v_id uuid;
begin
  if not assert_active_employee(p_caller_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  v_id := (p_payload->>'id')::uuid;

  if v_id is null then
    if not is_privileged(p_caller_id) and effective_access_role(p_caller_id) <> 'cold_caller' then
      return json_build_object('success', false, 'error', 'not_authorized');
    end if;
    insert into leads (
      name, company, phone, email, location, lead_source, equipment, truck_count, mc, dot,
      preferred_lanes, notes, assigned_cold_caller_id, status, priority, next_follow_up_at, created_by
    ) values (
      coalesce(p_payload->>'name',''), p_payload->>'company', p_payload->>'phone', p_payload->>'email',
      p_payload->>'location', p_payload->>'lead_source', p_payload->>'equipment',
      coalesce((p_payload->>'truck_count')::int, 0), p_payload->>'mc', p_payload->>'dot',
      p_payload->>'preferred_lanes', p_payload->>'notes',
      coalesce((p_payload->>'assigned_cold_caller_id')::uuid, p_caller_id),
      coalesce(p_payload->>'status','new'), coalesce(p_payload->>'priority','normal'),
      (p_payload->>'next_follow_up_at')::timestamptz, p_caller_id
    ) returning * into v_lead;
    perform log_activity('lead', v_lead.id, 'created', 'Lead created', p_caller_id, null);
    if v_lead.assigned_cold_caller_id is not null then
      insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
      values (v_lead.assigned_cold_caller_id, 'lead_assigned', 'New lead assigned', v_lead.name, 'lead', v_lead.id);
    end if;
  else
    update leads set
      name = coalesce(p_payload->>'name', name),
      company = coalesce(p_payload->>'company', company),
      phone = coalesce(p_payload->>'phone', phone),
      email = coalesce(p_payload->>'email', email),
      location = coalesce(p_payload->>'location', location),
      lead_source = coalesce(p_payload->>'lead_source', lead_source),
      equipment = coalesce(p_payload->>'equipment', equipment),
      truck_count = coalesce((p_payload->>'truck_count')::int, truck_count),
      mc = coalesce(p_payload->>'mc', mc),
      dot = coalesce(p_payload->>'dot', dot),
      preferred_lanes = coalesce(p_payload->>'preferred_lanes', preferred_lanes),
      notes = coalesce(p_payload->>'notes', notes),
      assigned_cold_caller_id = coalesce((p_payload->>'assigned_cold_caller_id')::uuid, assigned_cold_caller_id),
      status = coalesce(p_payload->>'status', status),
      priority = coalesce(p_payload->>'priority', priority),
      next_follow_up_at = coalesce((p_payload->>'next_follow_up_at')::timestamptz, next_follow_up_at),
      updated_at = now()
    where id = v_id
      and (is_privileged(p_caller_id) or assigned_cold_caller_id = p_caller_id)
    returning * into v_lead;
    if v_lead.id is null then
      return json_build_object('success', false, 'error', 'not_found');
    end if;
    perform log_activity('lead', v_lead.id, 'updated', 'Lead updated', p_caller_id, p_payload);
  end if;

  return json_build_object('success', true, 'lead', row_to_json(v_lead));
end;
$$;

create or replace function crm_convert_lead_to_client(p_caller_id uuid, p_lead_id uuid, p_dispatcher_id uuid default null)
returns json language plpgsql security definer as $$
declare v_lead leads;
declare v_client clients;
begin
  if not is_privileged(p_caller_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  select * into v_lead from leads where id = p_lead_id;
  if v_lead.id is null then return json_build_object('success', false, 'error', 'not_found'); end if;

  insert into clients (
    lead_id, owner_name, company, phone, email, mc, dot, equipment, truck_count,
    preferred_lanes, home_location, assigned_dispatcher_id, status, notes, created_by
  ) values (
    v_lead.id, v_lead.name, v_lead.company, v_lead.phone, v_lead.email, v_lead.mc, v_lead.dot,
    v_lead.equipment, v_lead.truck_count, v_lead.preferred_lanes, v_lead.location,
    p_dispatcher_id, 'onboarding', v_lead.notes, p_caller_id
  ) returning * into v_client;

  update leads set status = 'converted', converted_client_id = v_client.id, updated_at = now()
  where id = p_lead_id;

  perform log_activity('lead', p_lead_id, 'converted', 'Converted to client', p_caller_id, jsonb_build_object('client_id', v_client.id));
  perform log_activity('client', v_client.id, 'created', 'Created from lead', p_caller_id, jsonb_build_object('lead_id', p_lead_id));

  return json_build_object('success', true, 'client', row_to_json(v_client));
end;
$$;

-- Clients list/upsert (abbreviated pattern)
create or replace function crm_list_clients(p_caller_id uuid, p_status text default null, p_search text default null, p_limit int default 50)
returns json language plpgsql security definer as $$
begin
  if not assert_active_employee(p_caller_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  return json_build_object('success', true, 'clients', (
    select coalesce(json_agg(c order by c.created_at desc), '[]'::json)
    from (
      select cl.*, d.full_name as dispatcher_name
      from clients cl
      left join employees d on d.id = cl.assigned_dispatcher_id
      where (p_status is null or cl.status = p_status)
        and (p_search is null or trim(p_search) = '' or cl.owner_name ilike '%'||trim(p_search)||'%' or coalesce(cl.company,'') ilike '%'||trim(p_search)||'%')
        and (
          is_privileged(p_caller_id)
          or effective_access_role(p_caller_id) = 'dispatcher' and cl.assigned_dispatcher_id = p_caller_id
          or effective_access_role(p_caller_id) = 'finance'
        )
      order by cl.created_at desc limit greatest(1, least(coalesce(p_limit,50), 200))
    ) c
  ));
end;
$$;

create or replace function crm_upsert_client(p_caller_id uuid, p_payload jsonb)
returns json language plpgsql security definer as $$
declare v_client clients;
declare v_id uuid;
begin
  if not assert_active_employee(p_caller_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  if not (is_privileged(p_caller_id) or effective_access_role(p_caller_id) in ('dispatcher','finance')) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  v_id := (p_payload->>'id')::uuid;
  if v_id is null then
    insert into clients (
      owner_name, company, phone, email, mc, dot, equipment, truck_count, preferred_lanes,
      home_location, dispatch_percent, start_date, assigned_dispatcher_id, status, notes, created_by
    ) values (
      coalesce(p_payload->>'owner_name',''), p_payload->>'company', p_payload->>'phone', p_payload->>'email',
      p_payload->>'mc', p_payload->>'dot', p_payload->>'equipment', coalesce((p_payload->>'truck_count')::int,0),
      p_payload->>'preferred_lanes', p_payload->>'home_location',
      coalesce((p_payload->>'dispatch_percent')::numeric, 5),
      (p_payload->>'start_date')::date,
      (p_payload->>'assigned_dispatcher_id')::uuid,
      coalesce(p_payload->>'status','onboarding'), p_payload->>'notes', p_caller_id
    ) returning * into v_client;
    perform log_activity('client', v_client.id, 'created', 'Client created', p_caller_id, null);
  else
    update clients set
      owner_name = coalesce(p_payload->>'owner_name', owner_name),
      company = coalesce(p_payload->>'company', company),
      phone = coalesce(p_payload->>'phone', phone),
      email = coalesce(p_payload->>'email', email),
      mc = coalesce(p_payload->>'mc', mc),
      dot = coalesce(p_payload->>'dot', dot),
      equipment = coalesce(p_payload->>'equipment', equipment),
      truck_count = coalesce((p_payload->>'truck_count')::int, truck_count),
      preferred_lanes = coalesce(p_payload->>'preferred_lanes', preferred_lanes),
      home_location = coalesce(p_payload->>'home_location', home_location),
      dispatch_percent = coalesce((p_payload->>'dispatch_percent')::numeric, dispatch_percent),
      start_date = coalesce((p_payload->>'start_date')::date, start_date),
      assigned_dispatcher_id = coalesce((p_payload->>'assigned_dispatcher_id')::uuid, assigned_dispatcher_id),
      status = coalesce(p_payload->>'status', status),
      notes = coalesce(p_payload->>'notes', notes),
      updated_at = now()
    where id = v_id returning * into v_client;
  end if;
  return json_build_object('success', true, 'client', row_to_json(v_client));
end;
$$;

-- Loads
create or replace function crm_list_loads(p_caller_id uuid, p_status text default null, p_filter text default null, p_limit int default 50)
returns json language plpgsql security definer as $$
declare v_start timestamptz; v_end timestamptz;
begin
  if not assert_active_employee(p_caller_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  v_start := date_trunc('day', now());
  v_end := v_start + interval '1 day';

  return json_build_object('success', true, 'loads', (
    select coalesce(json_agg(l order by l.created_at desc), '[]'::json)
    from (
      select ld.*, c.owner_name as client_name, e.full_name as dispatcher_name
      from loads ld
      left join clients c on c.id = ld.client_id
      left join employees e on e.id = ld.dispatcher_id
      where (p_status is null or ld.status = p_status)
        and (
          p_filter is null
          or (p_filter = 'today_pickup' and ld.pickup_at >= v_start and ld.pickup_at < v_end)
          or (p_filter = 'today_delivery' and ld.delivery_at >= v_start and ld.delivery_at < v_end)
          or (p_filter = 'active' and ld.status not in ('completed','cancelled'))
        )
        and (
          is_privileged(p_caller_id)
          or effective_access_role(p_caller_id) = 'dispatcher' and ld.dispatcher_id = p_caller_id
          or effective_access_role(p_caller_id) = 'finance'
        )
      order by ld.created_at desc limit greatest(1, least(coalesce(p_limit,50), 200))
    ) l
  ));
end;
$$;

create or replace function crm_upsert_load(p_caller_id uuid, p_payload jsonb)
returns json language plpgsql security definer as $$
declare v_load loads;
declare v_id uuid;
declare v_miles numeric;
declare v_num text;
begin
  if not (is_privileged(p_caller_id) or effective_access_role(p_caller_id) = 'dispatcher') then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  v_id := (p_payload->>'id')::uuid;
  if v_id is null then
    v_num := coalesce(p_payload->>'load_number', 'NL-' || to_char(now(), 'YYYY') || '-' || nextval('load_number_seq'));
    v_miles := coalesce((p_payload->>'loaded_miles')::numeric, 0) + coalesce((p_payload->>'deadhead_miles')::numeric, 0);
    insert into loads (
      load_number, broker_id, broker_contact, pickup_location, delivery_location,
      pickup_at, delivery_at, equipment, loaded_miles, deadhead_miles, rate,
      rpm, driver_id, truck_id, client_id, dispatcher_id, notes, status, created_by
    ) values (
      v_num, (p_payload->>'broker_id')::uuid, p_payload->>'broker_contact',
      coalesce(p_payload->>'pickup_location',''), coalesce(p_payload->>'delivery_location',''),
      (p_payload->>'pickup_at')::timestamptz, (p_payload->>'delivery_at')::timestamptz,
      p_payload->>'equipment',
      coalesce((p_payload->>'loaded_miles')::numeric,0), coalesce((p_payload->>'deadhead_miles')::numeric,0),
      coalesce((p_payload->>'rate')::numeric,0),
      case when v_miles > 0 then round(coalesce((p_payload->>'rate')::numeric,0) / v_miles, 4) else null end,
      (p_payload->>'driver_id')::uuid, (p_payload->>'truck_id')::uuid,
      (p_payload->>'client_id')::uuid,
      coalesce((p_payload->>'dispatcher_id')::uuid, p_caller_id),
      p_payload->>'notes', coalesce(p_payload->>'status','searching'), p_caller_id
    ) returning * into v_load;
    perform log_activity('load', v_load.id, 'created', 'Load created', p_caller_id, null);
  else
    update loads set
      status = coalesce(p_payload->>'status', status),
      rate = coalesce((p_payload->>'rate')::numeric, rate),
      payment_status = coalesce(p_payload->>'payment_status', payment_status),
      notes = coalesce(p_payload->>'notes', notes),
      pickup_at = coalesce((p_payload->>'pickup_at')::timestamptz, pickup_at),
      delivery_at = coalesce((p_payload->>'delivery_at')::timestamptz, delivery_at),
      updated_at = now()
    where id = v_id returning * into v_load;
    perform log_activity('load', v_load.id, 'updated', 'Load updated', p_caller_id, p_payload);
  end if;
  return json_build_object('success', true, 'load', row_to_json(v_load));
end;
$$;

-- Brokers, trucks, drivers — list + upsert (compact)
create or replace function crm_list_brokers(p_caller_id uuid, p_search text default null)
returns json language sql security definer as $$
  select case when assert_active_employee(p_caller_id) then json_build_object('success', true, 'brokers', (
    select coalesce(json_agg(b order by company_name), '[]'::json)
    from (
      select * from brokers
      where p_search is null or trim(p_search) = '' or company_name ilike '%'||trim(p_search)||'%'
      limit 200
    ) b
  )) else json_build_object('success', false, 'error', 'not_authorized') end;
$$;

create or replace function crm_upsert_broker(p_caller_id uuid, p_payload jsonb)
returns json language plpgsql security definer as $$
declare v_b brokers; v_id uuid;
begin
  if not (is_privileged(p_caller_id) or effective_access_role(p_caller_id) = 'dispatcher') then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  v_id := (p_payload->>'id')::uuid;
  if v_id is null then
    insert into brokers (company_name, contact_name, phone, email, mc, address, lanes, notes)
    values (
      coalesce(p_payload->>'company_name',''), p_payload->>'contact_name', p_payload->>'phone',
      p_payload->>'email', p_payload->>'mc', p_payload->>'address', p_payload->>'lanes', p_payload->>'notes'
    ) returning * into v_b;
  else
    update brokers set company_name = coalesce(p_payload->>'company_name', company_name),
      contact_name = coalesce(p_payload->>'contact_name', contact_name),
      phone = coalesce(p_payload->>'phone', phone), email = coalesce(p_payload->>'email', email),
      mc = coalesce(p_payload->>'mc', mc), address = coalesce(p_payload->>'address', address),
      lanes = coalesce(p_payload->>'lanes', lanes), notes = coalesce(p_payload->>'notes', notes)
    where id = v_id returning * into v_b;
  end if;
  return json_build_object('success', true, 'broker', row_to_json(v_b));
end;
$$;

create or replace function crm_list_client_trucks(p_caller_id uuid, p_client_id uuid default null)
returns json language sql security definer as $$
  select case when assert_active_employee(p_caller_id) then json_build_object('success', true, 'trucks', (
    select coalesce(json_agg(t order by created_at desc), '[]'::json)
    from client_trucks t
    where (p_client_id is null or t.client_id = p_client_id)
    limit 200
  )) else json_build_object('success', false, 'error', 'not_authorized') end;
$$;

create or replace function crm_upsert_client_truck(p_caller_id uuid, p_payload jsonb)
returns json language plpgsql security definer as $$
declare v_t client_trucks; v_id uuid;
begin
  if not (is_privileged(p_caller_id) or effective_access_role(p_caller_id) = 'dispatcher') then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  v_id := (p_payload->>'id')::uuid;
  if v_id is null then
    insert into client_trucks (
      truck_number, client_id, driver_id, equipment, trailer, current_location, home_location,
      status, preferred_lanes, dispatcher_id, notes
    ) values (
      coalesce(p_payload->>'truck_number',''), (p_payload->>'client_id')::uuid,
      (p_payload->>'driver_id')::uuid, p_payload->>'equipment', p_payload->>'trailer',
      p_payload->>'current_location', p_payload->>'home_location',
      coalesce(p_payload->>'status','available'), p_payload->>'preferred_lanes',
      (p_payload->>'dispatcher_id')::uuid, p_payload->>'notes'
    ) returning * into v_t;
  else
    update client_trucks set
      truck_number = coalesce(p_payload->>'truck_number', truck_number),
      status = coalesce(p_payload->>'status', status),
      current_location = coalesce(p_payload->>'current_location', current_location),
      notes = coalesce(p_payload->>'notes', notes),
      updated_at = now()
    where id = v_id returning * into v_t;
  end if;
  return json_build_object('success', true, 'truck', row_to_json(v_t));
end;
$$;

create or replace function crm_list_drivers(p_caller_id uuid, p_client_id uuid default null)
returns json language sql security definer as $$
  select case when assert_active_employee(p_caller_id) then json_build_object('success', true, 'drivers', (
    select coalesce(json_agg(d order by created_at desc), '[]'::json)
    from drivers d where (p_client_id is null or d.client_id = p_client_id) limit 200
  )) else json_build_object('success', false, 'error', 'not_authorized') end;
$$;

create or replace function crm_upsert_driver(p_caller_id uuid, p_payload jsonb)
returns json language plpgsql security definer as $$
declare v_d drivers; v_id uuid;
begin
  if not (is_privileged(p_caller_id) or effective_access_role(p_caller_id) = 'dispatcher') then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  v_id := (p_payload->>'id')::uuid;
  if v_id is null then
    insert into drivers (full_name, phone, email, cdl_info, truck_id, client_id, current_location, home_location, status, notes)
    values (
      coalesce(p_payload->>'full_name',''), p_payload->>'phone', p_payload->>'email', p_payload->>'cdl_info',
      (p_payload->>'truck_id')::uuid, (p_payload->>'client_id')::uuid,
      p_payload->>'current_location', p_payload->>'home_location',
      coalesce(p_payload->>'status','available'), p_payload->>'notes'
    ) returning * into v_d;
  else
    update drivers set
      full_name = coalesce(p_payload->>'full_name', full_name),
      status = coalesce(p_payload->>'status', status),
      phone = coalesce(p_payload->>'phone', phone),
      notes = coalesce(p_payload->>'notes', notes),
      updated_at = now()
    where id = v_id returning * into v_d;
  end if;
  return json_build_object('success', true, 'driver', row_to_json(v_d));
end;
$$;

-- Calls & follow-ups
create or replace function crm_log_call(p_caller_id uuid, p_payload jsonb)
returns json language plpgsql security definer as $$
declare v_c calls;
begin
  if not assert_active_employee(p_caller_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  insert into calls (
    direction, status, duration_seconds, employee_id, lead_id, client_id, result, notes, follow_up_at, recording_url
  ) values (
    coalesce(p_payload->>'direction','outbound'), coalesce(p_payload->>'status','connected'),
    coalesce((p_payload->>'duration_seconds')::int, 0), p_caller_id,
    (p_payload->>'lead_id')::uuid, (p_payload->>'client_id')::uuid,
    p_payload->>'result', p_payload->>'notes', (p_payload->>'follow_up_at')::timestamptz,
    p_payload->>'recording_url'
  ) returning * into v_c;

  if (p_payload->>'lead_id') is not null then
    update leads set last_contacted_at = now(), updated_at = now() where id = (p_payload->>'lead_id')::uuid;
    perform log_activity('lead', (p_payload->>'lead_id')::uuid, 'call', 'Call logged', p_caller_id, jsonb_build_object('call_id', v_c.id));
  end if;
  return json_build_object('success', true, 'call', row_to_json(v_c));
end;
$$;

create or replace function crm_list_calls(p_caller_id uuid, p_limit int default 50)
returns json language sql security definer as $$
  select case when assert_active_employee(p_caller_id) then json_build_object('success', true, 'calls', (
    select coalesce(json_agg(c order by created_at desc), '[]'::json)
    from (
      select ca.*, e.full_name as employee_name from calls ca
      join employees e on e.id = ca.employee_id
      where is_privileged(p_caller_id) or ca.employee_id = p_caller_id
      order by ca.created_at desc limit greatest(1, least(coalesce(p_limit,50), 200))
    ) c
  )) else json_build_object('success', false, 'error', 'not_authorized') end;
$$;

create or replace function crm_list_follow_ups(p_caller_id uuid, p_bucket text default null)
returns json language plpgsql security definer as $$
begin
  if not assert_active_employee(p_caller_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  return json_build_object('success', true, 'follow_ups', (
    select coalesce(json_agg(f order by f.due_at), '[]'::json)
    from (
      select fu.*, e.full_name as assigned_name
      from follow_ups fu
      left join employees e on e.id = fu.assigned_to
      where fu.status = 'open'
        and (is_privileged(p_caller_id) or fu.assigned_to = p_caller_id)
        and (
          p_bucket is null
          or (p_bucket = 'due_today' and fu.due_at::date = current_date)
          or (p_bucket = 'overdue' and fu.due_at < now())
          or (p_bucket = 'upcoming' and fu.due_at > now() and fu.due_at::date > current_date)
        )
      order by fu.due_at limit 200
    ) f
  ));
end;
$$;

create or replace function crm_upsert_follow_up(p_caller_id uuid, p_payload jsonb)
returns json language plpgsql security definer as $$
declare v_f follow_ups; v_id uuid;
begin
  if not assert_active_employee(p_caller_id) then return json_build_object('success', false, 'error', 'not_authorized'); end if;
  v_id := (p_payload->>'id')::uuid;
  if v_id is null then
    insert into follow_ups (title, notes, due_at, priority, assigned_to, lead_id, client_id, created_by)
    values (
      coalesce(p_payload->>'title','Follow-up'), p_payload->>'notes',
      coalesce((p_payload->>'due_at')::timestamptz, now() + interval '1 day'),
      coalesce(p_payload->>'priority','normal'),
      coalesce((p_payload->>'assigned_to')::uuid, p_caller_id),
      (p_payload->>'lead_id')::uuid, (p_payload->>'client_id')::uuid, p_caller_id
    ) returning * into v_f;
    if v_f.assigned_to is not null then
      insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
      values (v_f.assigned_to, 'follow_up_assigned', 'Follow-up assigned', v_f.title, 'follow_up', v_f.id);
    end if;
  else
    update follow_ups set
      status = coalesce(p_payload->>'status', status),
      due_at = coalesce((p_payload->>'due_at')::timestamptz, due_at),
      notes = coalesce(p_payload->>'notes', notes),
      completed_at = case when coalesce(p_payload->>'status', status) = 'completed' then now() else completed_at end
    where id = v_id and (is_privileged(p_caller_id) or assigned_to = p_caller_id)
    returning * into v_f;
  end if;
  return json_build_object('success', true, 'follow_up', row_to_json(v_f));
end;
$$;

-- Tasks, documents, activity, notifications
create or replace function crm_list_tasks(p_caller_id uuid)
returns json language sql security definer as $$
  select case when assert_active_employee(p_caller_id) then json_build_object('success', true, 'tasks', (
    select coalesce(json_agg(t order by due_date nulls last), '[]'::json)
    from tasks t
    where is_privileged(p_caller_id) or t.assigned_to = p_caller_id
    limit 200
  )) else json_build_object('success', false, 'error', 'not_authorized') end;
$$;

create or replace function crm_upsert_task(p_caller_id uuid, p_payload jsonb)
returns json language plpgsql security definer as $$
declare v_t tasks; v_id uuid;
begin
  if not assert_active_employee(p_caller_id) then return json_build_object('success', false, 'error', 'not_authorized'); end if;
  v_id := (p_payload->>'id')::uuid;
  if v_id is null then
    insert into tasks (title, description, assigned_to, priority, due_date, status, related_lead_id, related_client_id, related_load_id, created_by)
    values (
      coalesce(p_payload->>'title','Task'), p_payload->>'description',
      coalesce((p_payload->>'assigned_to')::uuid, p_caller_id),
      coalesce(p_payload->>'priority','normal'), (p_payload->>'due_date')::date,
      coalesce(p_payload->>'status','todo'),
      (p_payload->>'related_lead_id')::uuid, (p_payload->>'related_client_id')::uuid, (p_payload->>'related_load_id')::uuid,
      p_caller_id
    ) returning * into v_t;
  else
    update tasks set
      status = coalesce(p_payload->>'status', status),
      title = coalesce(p_payload->>'title', title),
      description = coalesce(p_payload->>'description', description),
      updated_at = now()
    where id = v_id returning * into v_t;
  end if;
  return json_build_object('success', true, 'task', row_to_json(v_t));
end;
$$;

create or replace function crm_list_documents(p_caller_id uuid, p_entity_type text, p_entity_id uuid)
returns json language sql security definer as $$
  select case when assert_active_employee(p_caller_id) then json_build_object('success', true, 'documents', (
    select coalesce(json_agg(d order by created_at desc), '[]'::json)
    from documents d where d.entity_type = p_entity_type and d.entity_id = p_entity_id
  )) else json_build_object('success', false, 'error', 'not_authorized') end;
$$;

create or replace function crm_add_document(p_caller_id uuid, p_payload jsonb)
returns json language plpgsql security definer as $$
declare v_d documents;
begin
  if not assert_active_employee(p_caller_id) then return json_build_object('success', false, 'error', 'not_authorized'); end if;
  insert into documents (entity_type, entity_id, file_name, file_url, storage_path, status, expiry_date, uploaded_by)
  values (
    p_payload->>'entity_type', (p_payload->>'entity_id')::uuid,
    coalesce(p_payload->>'file_name','document'), p_payload->>'file_url', p_payload->>'storage_path',
    coalesce(p_payload->>'status','pending'), (p_payload->>'expiry_date')::date, p_caller_id
  ) returning * into v_d;
  return json_build_object('success', true, 'document', row_to_json(v_d));
end;
$$;

create or replace function crm_get_activity(p_caller_id uuid, p_entity_type text, p_entity_id uuid)
returns json language sql security definer as $$
  select case when assert_active_employee(p_caller_id) then json_build_object('success', true, 'events', (
    select coalesce(json_agg(a order by created_at desc), '[]'::json)
    from (
      select ae.*, e.full_name as actor_name
      from activity_events ae
      left join employees e on e.id = ae.actor_id
      where ae.entity_type = p_entity_type and ae.entity_id = p_entity_id
      order by ae.created_at desc limit 100
    ) a
  )) else json_build_object('success', false, 'error', 'not_authorized') end;
$$;

create or replace function crm_list_notifications(p_caller_id uuid, p_unread_only boolean default true)
returns json language sql security definer as $$
  select case when assert_active_employee(p_caller_id) then json_build_object('success', true, 'notifications', (
    select coalesce(json_agg(n order by created_at desc), '[]'::json)
    from (
      select * from notifications
      where recipient_id = p_caller_id and (not p_unread_only or read_at is null)
      order by created_at desc limit 100
    ) n
  )) else json_build_object('success', false, 'error', 'not_authorized') end;
$$;

create or replace function crm_mark_notifications_read(p_caller_id uuid, p_ids uuid[] default null)
returns json language plpgsql security definer as $$
begin
  if not assert_active_employee(p_caller_id) then return json_build_object('success', false, 'error', 'not_authorized'); end if;
  if p_ids is null then
    update notifications set read_at = now() where recipient_id = p_caller_id and read_at is null;
  else
    update notifications set read_at = now() where recipient_id = p_caller_id and id = any(p_ids);
  end if;
  return json_build_object('success', true);
end;
$$;

-- Global search
create or replace function crm_global_search(p_caller_id uuid, p_query text, p_limit int default 30)
returns json language plpgsql security definer as $$
declare q text;
begin
  if not assert_active_employee(p_caller_id) then return json_build_object('success', false, 'error', 'not_authorized'); end if;
  q := trim(coalesce(p_query,''));
  if q = '' then return json_build_object('success', true, 'results', '[]'::json); end if;

  return json_build_object('success', true, 'results', (
    select coalesce(json_agg(r), '[]'::json) from (
      select 'employee' as type, id, full_name as title, email as subtitle from employees
        where full_name ilike '%'||q||'%' or email ilike '%'||q||'%'
      union all
      select 'lead', id, name, coalesce(company,'') from leads
        where name ilike '%'||q||'%' or coalesce(company,'') ilike '%'||q||'%'
      union all
      select 'client', id, owner_name, coalesce(company,'') from clients
        where owner_name ilike '%'||q||'%' or coalesce(company,'') ilike '%'||q||'%'
      union all
      select 'load', id, load_number, status from loads where load_number ilike '%'||q||'%'
      union all
      select 'broker', id, company_name, coalesce(contact_name,'') from brokers where company_name ilike '%'||q||'%'
      limit greatest(1, least(coalesce(p_limit,30), 100))
    ) r
  ));
end;
$$;

-- Admin dashboard stats with date range
create or replace function admin_dashboard_stats(p_admin_id uuid, p_start date, p_end date)
returns json language plpgsql security definer as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  return json_build_object(
    'success', true,
    'employees', json_build_object(
      'total', (select count(*) from employees),
      'active', (select count(*) from employees where active and employment_status = 'active'),
      'clocked_in', (select count(distinct employee_id) from timelogs where clock_out is null),
      'online', (select count(*) from employees where compute_presence_state(last_seen_at, presence_status) = 'online'),
      'away', (select count(*) from employees where compute_presence_state(last_seen_at, presence_status) = 'away')
    ),
    'sales', json_build_object(
      'new_leads', (select count(*) from leads where status = 'new' and created_at::date between p_start and p_end),
      'contacted', (select count(*) from leads where status = 'contacted' and updated_at::date between p_start and p_end),
      'interested', (select count(*) from leads where status = 'interested'),
      'converted', (select count(*) from leads where status = 'converted' and updated_at::date between p_start and p_end),
      'lost', (select count(*) from leads where status in ('lost','not_interested') and updated_at::date between p_start and p_end)
    ),
    'operations', json_build_object(
      'active_clients', (select count(*) from clients where status = 'active'),
      'active_trucks', (select count(*) from client_trucks where status not in ('out_of_service')),
      'active_drivers', (select count(*) from drivers where status not in ('inactive','off_duty')),
      'loads_in_progress', (select count(*) from loads where status not in ('completed','cancelled')),
      'loads_completed', (select count(*) from loads where status = 'completed' and updated_at::date between p_start and p_end)
    ),
    'finance', json_build_object(
      'load_revenue', (select coalesce(sum(rate),0) from loads where created_at::date between p_start and p_end),
      'dispatch_fees', (
        select coalesce(sum(rate * c.dispatch_percent / 100.0), 0)
        from loads l join clients c on c.id = l.client_id
        where l.created_at::date between p_start and p_end
      ),
      'pending_payments', (select count(*) from loads where payment_status = 'pending'),
      'paid_payments', (select count(*) from loads where payment_status = 'paid' and updated_at::date between p_start and p_end),
      'deal_fees', (select coalesce(sum(fee_amount),0) from deals where created_at::date between p_start and p_end)
    )
  );
end;
$$;

-- Employee archive / offboarding
create or replace function admin_archive_employee(p_admin_id uuid, p_employee_id uuid, p_reason text)
returns json language plpgsql security definer as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  update employees set employment_status = 'closed', active = false, presence_status = 'offline'
  where id = p_employee_id;
  perform write_audit_log(p_admin_id, 'employee_archive', 'employee', p_employee_id, null, jsonb_build_object('status','closed'), p_reason);
  return json_build_object('success', true);
end;
$$;

create or replace function admin_update_access_role(p_admin_id uuid, p_employee_id uuid, p_access_role text)
returns json language plpgsql security definer as $$
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  if p_access_role not in ('admin','manager','team_leader','cold_caller','dispatcher','finance','employee') then
    return json_build_object('success', false, 'error', 'invalid_role');
  end if;
  update employees set access_role = p_access_role where id = p_employee_id;
  perform write_audit_log(p_admin_id, 'access_role_change', 'employee', p_employee_id, null, jsonb_build_object('access_role', p_access_role), null);
  return json_build_object('success', true);
end;
$$;

-- Grants
grant execute on function crm_list_leads(uuid, text, text, uuid, int, int) to anon;
grant execute on function crm_upsert_lead(uuid, jsonb) to anon;
grant execute on function crm_convert_lead_to_client(uuid, uuid, uuid) to anon;
grant execute on function crm_list_clients(uuid, text, text, int) to anon;
grant execute on function crm_upsert_client(uuid, jsonb) to anon;
grant execute on function crm_list_loads(uuid, text, text, int) to anon;
grant execute on function crm_upsert_load(uuid, jsonb) to anon;
grant execute on function crm_list_brokers(uuid, text) to anon;
grant execute on function crm_upsert_broker(uuid, jsonb) to anon;
grant execute on function crm_list_client_trucks(uuid, uuid) to anon;
grant execute on function crm_upsert_client_truck(uuid, jsonb) to anon;
grant execute on function crm_list_drivers(uuid, uuid) to anon;
grant execute on function crm_upsert_driver(uuid, jsonb) to anon;
grant execute on function crm_log_call(uuid, jsonb) to anon;
grant execute on function crm_list_calls(uuid, int) to anon;
grant execute on function crm_list_follow_ups(uuid, text) to anon;
grant execute on function crm_upsert_follow_up(uuid, jsonb) to anon;
grant execute on function crm_list_tasks(uuid) to anon;
grant execute on function crm_upsert_task(uuid, jsonb) to anon;
grant execute on function crm_list_documents(uuid, text, uuid) to anon;
grant execute on function crm_add_document(uuid, jsonb) to anon;
grant execute on function crm_get_activity(uuid, text, uuid) to anon;
grant execute on function crm_list_notifications(uuid, boolean) to anon;
grant execute on function crm_mark_notifications_read(uuid, uuid[]) to anon;
grant execute on function crm_global_search(uuid, text, int) to anon;
grant execute on function admin_dashboard_stats(uuid, date, date) to anon;
grant execute on function admin_archive_employee(uuid, uuid, text) to anon;
grant execute on function admin_update_access_role(uuid, uuid, text) to anon;
