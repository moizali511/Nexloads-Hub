-- Nexloads Hub — migration 003: team chat, admin message moderation
-- Run after 002.

create table if not exists chat_rooms (
  id uuid primary key default gen_random_uuid(),
  room_type text not null check (room_type in ('channel','group','dm')),
  name text not null,
  description text,
  avatar_url text,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table chat_rooms enable row level security;

create table if not exists chat_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references chat_rooms(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (room_id, employee_id)
);
create index if not exists idx_chat_members_emp on chat_room_members(employee_id);
alter table chat_room_members enable row level security;

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references chat_rooms(id) on delete cascade,
  sender_id uuid not null references employees(id) on delete cascade,
  body text not null,
  attachment_url text,
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_messages_room on chat_messages(room_id, created_at desc);
alter table chat_messages enable row level security;

create table if not exists chat_message_reads (
  message_id uuid not null references chat_messages(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, employee_id)
);
alter table chat_message_reads enable row level security;

-- Seed default channels (idempotent by name)
insert into chat_rooms (room_type, name, description)
select 'channel', v.name, v.description
from (values
  ('General', 'Company-wide announcements'),
  ('Dispatch', 'Dispatch operations'),
  ('Cold Callers', 'Sales floor'),
  ('Management', 'Leadership'),
  ('Operations', 'Operations team')
) as v(name, description)
where not exists (select 1 from chat_rooms cr where cr.room_type = 'channel' and cr.name = v.name);

create or replace function chat_ensure_member(p_room_id uuid, p_employee_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from chat_room_members where room_id = p_room_id and employee_id = p_employee_id
  ) or exists (
    select 1 from chat_rooms r
    join employees e on e.id = p_employee_id
    where r.id = p_room_id and r.room_type = 'channel'
  );
$$;

create or replace function chat_list_rooms(p_employee_id uuid)
returns json language plpgsql security definer as $$
begin
  if not assert_active_employee(p_employee_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  insert into chat_room_members (room_id, employee_id)
  select r.id, p_employee_id from chat_rooms r
  where r.room_type = 'channel'
  on conflict do nothing;

  return json_build_object('success', true, 'rooms', (
    select coalesce(json_agg(x order by x.name), '[]'::json)
    from (
      select r.*,
        (select count(*) from chat_messages m where m.room_id = r.id and m.deleted_at is null) as message_count,
        (select count(*) from chat_messages m
          where m.room_id = r.id and m.deleted_at is null and m.sender_id <> p_employee_id
            and not exists (select 1 from chat_message_reads mr where mr.message_id = m.id and mr.employee_id = p_employee_id)
        ) as unread_count
      from chat_rooms r
      where r.room_type = 'channel'
         or exists (select 1 from chat_room_members m where m.room_id = r.id and m.employee_id = p_employee_id)
    ) x
  ));
end;
$$;

create or replace function chat_create_group(
  p_admin_id uuid, p_name text, p_description text, p_member_ids uuid[]
) returns json language plpgsql security definer as $$
declare v_room chat_rooms; m uuid;
begin
  if not is_privileged(p_admin_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  insert into chat_rooms (room_type, name, description, created_by)
  values ('group', trim(p_name), p_description, p_admin_id) returning * into v_room;
  insert into chat_room_members (room_id, employee_id) values (v_room.id, p_admin_id);
  if p_member_ids is not null then
    foreach m in array p_member_ids loop
      insert into chat_room_members (room_id, employee_id) values (v_room.id, m) on conflict do nothing;
    end loop;
  end if;
  perform write_audit_log(p_admin_id, 'chat_group_create', 'chat_room', v_room.id, null, to_jsonb(v_room), null);
  return json_build_object('success', true, 'room', row_to_json(v_room));
end;
$$;

create or replace function chat_get_or_create_dm(p_employee_id uuid, p_other_id uuid)
returns json language plpgsql security definer as $$
declare v_room chat_rooms;
begin
  if not assert_active_employee(p_employee_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  select r.* into v_room from chat_rooms r
  join chat_room_members a on a.room_id = r.id and a.employee_id = p_employee_id
  join chat_room_members b on b.room_id = r.id and b.employee_id = p_other_id
  where r.room_type = 'dm' limit 1;
  if v_room.id is null then
    insert into chat_rooms (room_type, name, created_by)
    values ('dm', 'DM', p_employee_id) returning * into v_room;
    insert into chat_room_members (room_id, employee_id) values (v_room.id, p_employee_id), (v_room.id, p_other_id);
  end if;
  return json_build_object('success', true, 'room', row_to_json(v_room));
end;
$$;

create or replace function chat_list_messages(p_employee_id uuid, p_room_id uuid, p_limit int default 80)
returns json language plpgsql security definer as $$
begin
  if not chat_ensure_member(p_room_id, p_employee_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  return json_build_object('success', true, 'messages', (
    select coalesce(json_agg(m order by m.created_at desc), '[]'::json)
    from (
      select cm.*, e.full_name as sender_name
      from chat_messages cm
      join employees e on e.id = cm.sender_id
      where cm.room_id = p_room_id and cm.deleted_at is null
      order by cm.created_at desc
      limit greatest(1, least(coalesce(p_limit,80), 200))
    ) m
  ));
end;
$$;

create or replace function chat_send_message(p_employee_id uuid, p_room_id uuid, p_body text, p_attachment_url text default null)
returns json language plpgsql security definer as $$
declare v_msg chat_messages;
begin
  if not assert_active_employee(p_employee_id) or not chat_ensure_member(p_room_id, p_employee_id) then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;
  if trim(coalesce(p_body,'')) = '' and p_attachment_url is null then
    return json_build_object('success', false, 'error', 'empty_message');
  end if;
  insert into chat_messages (room_id, sender_id, body, attachment_url)
  values (p_room_id, p_employee_id, coalesce(trim(p_body),''), p_attachment_url)
  returning * into v_msg;

  insert into notifications (recipient_id, type, title, body, entity_type, entity_id)
  select m.employee_id, 'chat_message', 'New message', left(coalesce(trim(p_body), 'Attachment'), 120), 'chat_room', p_room_id
  from chat_room_members m
  where m.room_id = p_room_id and m.employee_id <> p_employee_id;

  return json_build_object('success', true, 'message', row_to_json(v_msg));
end;
$$;

create or replace function chat_edit_message(p_actor_id uuid, p_message_id uuid, p_new_body text, p_reason text default null)
returns json language plpgsql security definer as $$
declare v_old chat_messages; v_is_admin boolean;
begin
  select * into v_old from chat_messages where id = p_message_id and deleted_at is null;
  if v_old.id is null then return json_build_object('success', false, 'error', 'not_found'); end if;

  select exists(select 1 from employees where id = p_actor_id and role = 'admin') into v_is_admin;
  if not v_is_admin and v_old.sender_id <> p_actor_id then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  update chat_messages set body = trim(p_new_body), edited_at = now() where id = p_message_id returning * into v_old;

  perform write_audit_log(
    p_actor_id, 'chat_message_edit', 'chat_message', p_message_id,
    jsonb_build_object('body', (select body from chat_messages where id = p_message_id)),
    jsonb_build_object('body', p_new_body), p_reason
  );

  return json_build_object('success', true, 'message', row_to_json(v_old));
end;
$$;

create or replace function chat_delete_message(p_actor_id uuid, p_message_id uuid, p_reason text default null)
returns json language plpgsql security definer as $$
declare v_old chat_messages; v_is_admin boolean;
begin
  select * into v_old from chat_messages where id = p_message_id and deleted_at is null;
  if v_old.id is null then return json_build_object('success', false, 'error', 'not_found'); end if;

  select exists(select 1 from employees where id = p_actor_id and role = 'admin') into v_is_admin;
  if not v_is_admin and v_old.sender_id <> p_actor_id then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  update chat_messages set deleted_at = now(), deleted_by = p_actor_id where id = p_message_id;

  perform write_audit_log(p_actor_id, 'chat_message_delete', 'chat_message', p_message_id, to_jsonb(v_old), null, p_reason);

  return json_build_object('success', true);
end;
$$;

grant execute on function chat_list_rooms(uuid) to anon;
grant execute on function chat_create_group(uuid, text, text, uuid[]) to anon;
grant execute on function chat_get_or_create_dm(uuid, uuid) to anon;
grant execute on function chat_list_messages(uuid, uuid, int) to anon;
grant execute on function chat_send_message(uuid, uuid, text, text) to anon;
grant execute on function chat_edit_message(uuid, uuid, text, text) to anon;
grant execute on function chat_delete_message(uuid, uuid, text) to anon;
