-- =========================================================
-- 001 · Tài khoản (email + mật khẩu) và nhiều nhóm cho mỗi tài khoản
-- Chạy sau schema.sql. Chạy lại nhiều lần cũng không sao.
--
-- Thay cho đăng nhập ẩn danh + PIN: mỗi thành viên gắn với 1 tài khoản.
-- Thành viên cũ chưa có tài khoản nhận lại tên bằng PIN cũ (join_group).
-- =========================================================

-- Mỗi thành viên gắn với 1 tài khoản; 1 tài khoản vào được nhiều nhóm
alter table public.members add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists members_group_user_uniq on public.members (group_id, user_id);
create index if not exists members_user_idx on public.members (user_id);

-- ---------- Bỏ phần đăng nhập ẩn danh + PIN của schema.sql ----------
drop policy if exists groups_select on public.groups;
drop policy if exists members_select on public.members;
drop policy if exists members_update_self on public.members;
drop policy if exists txns_all on public.txns;
drop policy if exists payments_all on public.payments;
drop function if exists public.me();
drop function if exists public.enter_group(text, text, text, boolean);
drop function if exists public.leave_group();
drop function if exists public.change_my_pin(text, text);
drop function if exists public.create_group(text, text, text);
drop function if exists public.my_member_id();
drop function if exists public.my_group_id();
drop table if exists public.sessions;

-- ---------- Helpers ----------
create or replace function public.my_group_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select group_id from public.members where user_id = auth.uid()
$$;

-- Chỉ tài khoản thật (không phải ẩn danh)
create or replace function public.require_user() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_authenticated';
  end if;
  return auth.uid();
end $$;

-- ---------- Row Level Security ----------
create policy groups_select on public.groups for select to authenticated
  using (id in (select public.my_group_ids()));

create policy members_select on public.members for select to authenticated
  using (group_id in (select public.my_group_ids()));

-- Mỗi người chỉ sửa được profile của chính mình
create policy members_update_self on public.members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ...và chỉ những cột này (không tự nâng quyền admin, không đổi nhóm, không đổi tài khoản)
revoke update on public.members from anon, authenticated;
grant update (name, bank, acc, holder, qr_data) on public.members to authenticated;

create policy txns_all on public.txns for all to authenticated
  using (group_id in (select public.my_group_ids())) with check (group_id in (select public.my_group_ids()));

create policy payments_all on public.payments for all to authenticated
  using (group_id in (select public.my_group_ids())) with check (group_id in (select public.my_group_ids()));

-- member_secrets: không có policy → client không đọc/ghi trực tiếp được.

-- ---------- RPCs ----------
-- Các nhóm của tài khoản đang đăng nhập, nhóm vào sớm nhất đứng đầu
create or replace function public.my_groups() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'member_id', m.id, 'group_id', g.id, 'group_name', g.name,
    'invite_code', g.invite_code, 'is_admin', m.is_admin) order by m.joined_at), '[]'::json)
  from public.members m
  join public.groups g on g.id = m.group_id
  where m.user_id = auth.uid()
$$;

create or replace function public.create_group(p_group_name text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_user();
  gid uuid;
begin
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then raise exception 'invalid_name'; end if;
  insert into public.groups (name, invite_code)
    values (coalesce(nullif(btrim(p_group_name), ''), 'Nhà mình'), public.gen_invite_code()) returning id into gid;
  insert into public.members (group_id, name, is_admin, user_id) values (gid, p_name, true, uid);
  return gid;
end $$;

-- claimable = thành viên từ bản cũ, chưa gắn tài khoản, nhận lại được bằng PIN
create or replace function public.group_preview(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', g.name,
    'joined', exists (select 1 from public.members m where m.group_id = g.id and m.user_id = auth.uid()),
    'members', coalesce((select json_agg(json_build_object(
                           'name', m.name,
                           'claimable', m.user_id is null
                             and exists (select 1 from public.member_secrets s where s.member_id = m.id))
                         order by m.joined_at)
                         from public.members m where m.group_id = g.id), '[]'::json))
  from public.groups g where g.invite_code = upper(btrim(p_code))
$$;

-- Vào nhóm bằng mã: đã ở trong nhóm → ok; tên mới → tạo thành viên;
-- tên cũ chưa có tài khoản → kiểm tra PIN rồi gắn vào tài khoản này
create or replace function public.join_group(p_code text, p_name text, p_pin text default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.require_user();
  gid uuid; mid uuid; owner uuid; sec public.member_secrets;
begin
  select id into gid from public.groups where invite_code = upper(btrim(p_code));
  if gid is null then return json_build_object('status', 'group_not_found'); end if;

  if exists (select 1 from public.members where group_id = gid and user_id = uid) then
    return json_build_object('status', 'ok', 'group_id', gid);
  end if;

  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then raise exception 'invalid_name'; end if;

  select id, user_id into mid, owner from public.members where group_id = gid and lower(name) = lower(p_name);

  if mid is null then
    insert into public.members (group_id, name, user_id) values (gid, p_name, uid);
    return json_build_object('status', 'ok', 'group_id', gid);
  end if;

  select * into sec from public.member_secrets where member_id = mid for update;
  if owner is not null or sec.member_id is null then
    return json_build_object('status', 'name_taken');
  end if;
  if p_pin is null then return json_build_object('status', 'need_pin'); end if;
  if p_pin !~ '^\d{4}$' then raise exception 'invalid_pin'; end if;

  if sec.locked_until is not null and sec.locked_until > now() then
    return json_build_object('status', 'locked',
      'minutes', ceil(extract(epoch from (sec.locked_until - now())) / 60));
  end if;
  if crypt(p_pin, sec.pin_hash) <> sec.pin_hash then
    if sec.failed_attempts + 1 >= 5 then
      update public.member_secrets
        set failed_attempts = 0, locked_until = now() + interval '15 minutes'
        where member_id = mid;
      return json_build_object('status', 'locked', 'minutes', 15);
    end if;
    update public.member_secrets set failed_attempts = failed_attempts + 1 where member_id = mid;
    return json_build_object('status', 'wrong_pin', 'remaining', 5 - (sec.failed_attempts + 1));
  end if;

  update public.members set user_id = uid where id = mid;
  delete from public.member_secrets where member_id = mid;
  return json_build_object('status', 'ok', 'group_id', gid);
end $$;

-- Chủ nhóm đặt lại PIN cho thành viên cũ chưa gắn tài khoản
create or replace function public.reset_member_pin(p_member_id uuid, p_new_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (
    select 1 from public.members a
    join public.members t on t.group_id = a.group_id
    where a.user_id = auth.uid() and a.is_admin and t.id = p_member_id
  ) then
    raise exception 'not_admin';
  end if;
  if p_new_pin !~ '^\d{4}$' then raise exception 'invalid_pin'; end if;
  update public.member_secrets
    set pin_hash = crypt(p_new_pin, gen_salt('bf')), failed_attempts = 0, locked_until = null
    where member_id = p_member_id;
end $$;

-- ---------- Grants ----------
revoke all on function public.my_group_ids(), public.require_user(), public.gen_invite_code(),
  public.my_groups(), public.create_group(text, text), public.group_preview(text),
  public.join_group(text, text, text), public.reset_member_pin(uuid, text)
  from public, anon;
grant execute on function public.my_group_ids(), public.require_user(),
  public.my_groups(), public.create_group(text, text), public.group_preview(text),
  public.join_group(text, text, text), public.reset_member_pin(uuid, text)
  to authenticated;
