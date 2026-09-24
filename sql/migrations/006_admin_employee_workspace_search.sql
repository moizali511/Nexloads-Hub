-- Admin employee intelligence + restrict employee search to admins

create or replace function admin_get_employee_workspace(p_admin_id uuid, p_employee_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_emp employees;
  v_today date := current_date;
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  select * into v_emp from employees where id = p_employee_id;
  if v_emp.id is null then
    return json_build_object('success', false, 'error', 'not_found');
  end if;

  return json_build_object(
    'success', true,
    'employee', json_build_object(
      'id', v_emp.id,
      'full_name', v_emp.full_name,
      'email', v_emp.email,
      'role', v_emp.role,
      'position', v_emp.position,
      'department', v_emp.department,
      'access_role', v_emp.access_role,
      'active', v_emp.active,
      'employment_status', v_emp.employment_status,
      'base_salary', v_emp.base_salary,
      'base_salary_currency', v_emp.base_salary_currency,
      'manager_id', v_emp.manager_id,
      'created_at', v_emp.created_at
    ),
    'presence', json_build_object(
      'is_clocked_in', exists(select 1 from timelogs tl where tl.employee_id = p_employee_id and tl.clock_out is null),
      'presence_state', compute_presence_state(v_emp.last_seen_at, v_emp.presence_status),
      'last_login_at', v_emp.last_login_at,
      'last_seen_at', v_emp.last_seen_at
    ),
    'tasks', json_build_object(
      'open', (select count(*) from tasks t where t.assigned_to = p_employee_id and t.status in ('todo','in_progress')),
      'overdue', (select count(*) from tasks t where t.assigned_to = p_employee_id and t.status in ('todo','in_progress') and t.due_date < v_today),
      'due_today_total', (select count(*) from tasks t where t.assigned_to = p_employee_id and t.due_date = v_today),
      'due_today_pending', (select count(*) from tasks t where t.assigned_to = p_employee_id and t.due_date = v_today and t.status in ('todo','in_progress')),
      'completed_today', (select count(*) from tasks t where t.assigned_to = p_employee_id and t.due_date = v_today and t.status = 'completed'),
      'daily_complete', case
        when (select count(*) from tasks t where t.assigned_to = p_employee_id and t.due_date = v_today) = 0 then 'no_tasks_today'
        when (select count(*) from tasks t where t.assigned_to = p_employee_id and t.due_date = v_today and t.status in ('todo','in_progress')) = 0 then 'yes'
        else 'no'
      end,
      'due_today_list', (
        select coalesce(json_agg(json_build_object(
          'id', t.id, 'title', t.title, 'status', t.status, 'priority', t.priority, 'due_date', t.due_date
        ) order by t.priority desc, t.title), '[]'::json)
        from tasks t
        where t.assigned_to = p_employee_id
          and (t.due_date = v_today or (t.status in ('todo','in_progress') and t.due_date < v_today))
        limit 40
      )
    ),
    'follow_ups', json_build_object(
      'open', (select count(*) from follow_ups fu where fu.assigned_to = p_employee_id and fu.status = 'open'),
      'overdue', (select count(*) from follow_ups fu where fu.assigned_to = p_employee_id and fu.status = 'open' and fu.due_at < now()),
      'due_today', (select count(*) from follow_ups fu where fu.assigned_to = p_employee_id and fu.status = 'open' and fu.due_at::date = v_today)
    ),
    'sales', json_build_object(
      'leads_total', (select count(*) from leads l where l.assigned_cold_caller_id = p_employee_id),
      'leads_active', (select count(*) from leads l where l.assigned_cold_caller_id = p_employee_id and l.status not in ('converted','lost','not_interested')),
      'calls_today', (select count(*) from calls c where c.employee_id = p_employee_id and c.created_at::date = v_today)
    ),
    'operations', json_build_object(
      'loads_active', (select count(*) from loads ld where ld.dispatcher_id = p_employee_id and ld.status not in ('completed','cancelled')),
      'clients_active', (select count(*) from clients cl where cl.assigned_dispatcher_id = p_employee_id and cl.status = 'active')
    ),
    'recent_activity', (
      select coalesce(json_agg(row_to_json(a)), '[]'::json)
      from (
        select ae.event_type, ae.summary, ae.created_at
        from activity_events ae
        where ae.actor_id = p_employee_id
        order by ae.created_at desc
        limit 20
      ) a
    )
  );
end;
$$;

create or replace function crm_global_search(p_caller_id uuid, p_query text, p_limit int default 30)
returns json language plpgsql security definer as $$
declare q text;
declare v_is_admin boolean;
begin
  if not assert_active_employee(p_caller_id) then return json_build_object('success', false, 'error', 'not_authorized'); end if;
  q := trim(coalesce(p_query,''));
  if q = '' then return json_build_object('success', true, 'results', '[]'::json); end if;

  select exists(select 1 from employees where id = p_caller_id and role = 'admin' and active = true) into v_is_admin;

  return json_build_object('success', true, 'results', (
    select coalesce(json_agg(r), '[]'::json) from (
      select 'employee' as type, id, full_name as title, email as subtitle from employees
        where v_is_admin and (full_name ilike '%'||q||'%' or email ilike '%'||q||'%')
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

grant execute on function admin_get_employee_workspace(uuid, uuid) to anon;
