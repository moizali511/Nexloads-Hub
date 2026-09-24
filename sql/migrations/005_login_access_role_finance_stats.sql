-- Return access_role on login; allow manager/finance to read dashboard stats

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
    'employment_status', emp.employment_status,
    'access_role', emp.access_role
  );
end;
$$;

create or replace function admin_dashboard_stats(p_admin_id uuid, p_start date, p_end date)
returns json
language plpgsql
security definer
as $$
declare
  v_role text;
begin
  v_role := effective_access_role(p_admin_id);
  if not exists (
    select 1 from employees where id = p_admin_id and active = true
      and (role = 'admin' or v_role in ('manager', 'finance'))
  ) then
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
      select id, full_name, email, role, position, department, manager_id, access_role,
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
