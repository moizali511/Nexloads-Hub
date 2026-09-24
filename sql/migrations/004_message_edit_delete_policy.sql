-- Chat: delete = admin only; edit = sender or admin (unchanged logic, stricter delete)

create or replace function chat_delete_message(p_actor_id uuid, p_message_id uuid, p_reason text default null)
returns json language plpgsql security definer as $$
declare v_old chat_messages;
begin
  select * into v_old from chat_messages where id = p_message_id and deleted_at is null;
  if v_old.id is null then return json_build_object('success', false, 'error', 'not_found'); end if;

  if not exists (select 1 from employees where id = p_actor_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  update chat_messages set deleted_at = now(), deleted_by = p_actor_id where id = p_message_id;
  perform write_audit_log(p_actor_id, 'chat_message_delete', 'chat_message', p_message_id, to_jsonb(v_old), null, p_reason);
  return json_build_object('success', true);
end;
$$;

-- Legacy messages: edit own (employee) or admin edit any
alter table messages add column if not exists edited_at timestamptz;

create or replace function edit_my_message(p_employee_id uuid, p_message_id uuid, p_new_body text)
returns json language plpgsql security definer as $$
declare v_msg messages;
begin
  if trim(coalesce(p_new_body,'')) = '' then
    return json_build_object('success', false, 'error', 'empty_message');
  end if;
  select * into v_msg from messages where id = p_message_id and sender_employee_id = p_employee_id;
  if v_msg.id is null then
    return json_build_object('success', false, 'error', 'not_found_or_not_yours');
  end if;
  update messages set body = trim(p_new_body), edited_at = now() where id = p_message_id;
  return json_build_object('success', true);
end;
$$;

create or replace function admin_edit_message(p_admin_id uuid, p_message_id uuid, p_new_body text, p_reason text default null)
returns json language plpgsql security definer as $$
declare v_old messages;
begin
  if not exists (select 1 from employees where id = p_admin_id and role = 'admin' and active = true) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  select * into v_old from messages where id = p_message_id;
  if v_old.id is null then return json_build_object('success', false, 'error', 'not_found'); end if;
  update messages set body = trim(p_new_body), edited_at = now() where id = p_message_id;
  perform write_audit_log(p_admin_id, 'message_edit', 'message', p_message_id, to_jsonb(v_old), jsonb_build_object('body', trim(p_new_body)), p_reason);
  return json_build_object('success', true);
end;
$$;

grant execute on function edit_my_message(uuid, uuid, text) to anon;
grant execute on function admin_edit_message(uuid, uuid, text, text) to anon;
