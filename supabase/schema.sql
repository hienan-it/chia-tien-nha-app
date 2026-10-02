-- =========================================================
-- Chia tiền nhà — Supabase schema
-- Chạy toàn bộ file này trong Supabase Dashboard → SQL Editor
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables ----------
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.groups(id) on delete cascade,
  name      text not null check (char_length(name) between 1 and 30),
  is_admin  boolean not null default false,
  bank      text not null default '' check (char_length(bank) <= 60),
  acc       text not null default '' check (char_length(acc) <= 30),
  holder    text not null default '' check (char_length(holder) <= 60),
  qr_data   text not null default ''
            check (qr_data = '' or (qr_data like 'data:image/%' and char_length(qr_data) < 300000)),
  joined_at timestamptz not null default now()
);
create unique index if not exists members_group_name_uniq on public.members (group_id, lower(name));

-- PIN tách riêng, client không bao giờ đọc được bảng này
create table if not exists public.member_secrets (
  member_id       uuid primary key references public.members(id) on delete cascade,
  pin_hash        text not null,
  failed_attempts int  not null default 0,
  locked_until    timestamptz
);

-- Mỗi thiết bị (anonymous user) gắn với 1 thành viên
create table if not exists public.sessions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.txns (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 80),
  amount     bigint not null check (amount > 0),
  payer      uuid not null references public.members(id),
  split      uuid[] not null check (cardinality(split) > 0),
  cat        text not null default 'other',
  date       date not null default current_date,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists txns_group_idx on public.txns (group_id, date desc);

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  from_member uuid not null references public.members(id),
  to_member   uuid not null references public.members(id),
  amount      bigint not null check (amount > 0),
  date        date not null default current_date,
  created_by  uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (from_member <> to_member)
);
create index if not exists payments_group_idx on public.payments (group_id, date desc);

-- ---------- Helpers ----------
create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select member_id from public.sessions where user_id = auth.uid()
$$;

create or replace function public.my_group_id() returns uuid
language sql stable security definer set search_path = public as $$
  select m.group_id from public.sessions s
  join public.members m on m.id = s.member_id
  where s.user_id = auth.uid()
$$;

create or replace function public.gen_invite_code() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  return code;
end $$;

-- ---------- Validation triggers ----------
create or replace function public.validate_txn() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.members where id = new.payer and group_id = new.group_id) then
    raise exception 'invalid_member';
  end if;
  if exists (
    select 1 from unnest(new.split) as s(mid)
    where not exists (select 1 from public.members where id = s.mid and group_id = new.group_id)
  ) then
    raise exception 'invalid_member';
  end if;
  return new;
end $$;
drop trigger if exists txns_validate on public.txns;
create trigger txns_validate before insert or update on public.txns
  for each row execute function public.validate_txn();

create or replace function public.validate_payment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.members
      where group_id = new.group_id and id in (new.from_member, new.to_member)) <> 2 then
    raise exception 'invalid_member';
  end if;
  return new;
end $$;
drop trigger if exists payments_validate on public.payments;
create trigger payments_validate before insert or update on public.payments
  for each row execute function public.validate_payment();

-- ---------- Row Level Security ----------
alter table public.groups         enable row level security;
alter table public.members        enable row level security;
alter table public.member_secrets enable row level security;
alter table public.sessions       enable row level security;
alter table public.txns           enable row level security;
alter table public.payments       enable row level security;

drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated
  using (id = public.my_group_id());

drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (group_id = public.my_group_id());

-- Mỗi người chỉ sửa được profile của chính mình
drop policy if exists members_update_self on public.members;
create policy members_update_self on public.members for update to authenticated
  using (id = public.my_member_id()) with check (id = public.my_member_id());

-- ...và chỉ những cột này (không tự nâng quyền admin, không đổi nhóm)
revoke update on public.members from anon, authenticated;
grant update (name, bank, acc, holder, qr_data) on public.members to authenticated;

drop policy if exists txns_all on public.txns;
create policy txns_all on public.txns for all to authenticated
  using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());

drop policy if exists payments_all on public.payments;
create policy payments_all on public.payments for all to authenticated
  using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());

-- member_secrets và sessions: không có policy → client không đọc/ghi trực tiếp được.

-- ---------- RPCs ----------
create or replace function public.me() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'member_id', m.id, 'group_id', g.id, 'group_name', g.name,
    'invite_code', g.invite_code, 'is_admin', m.is_admin)
  from public.sessions s
  join public.members m on m.id = s.member_id
  join public.groups g on g.id = m.group_id
  where s.user_id = auth.uid()
$$;

create or replace function public.create_group(p_group_name text, p_name text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  gid uuid; mid uuid; code text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_pin !~ '^\d{4}$' then raise exception 'invalid_pin'; end if;
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then raise exception 'invalid_name'; end if;

  code := public.gen_invite_code();
  insert into public.groups (name, invite_code)
    values (coalesce(nullif(btrim(p_group_name), ''), 'Nhà mình'), code) returning id into gid;
  insert into public.members (group_id, name, is_admin) values (gid, p_name, true) returning id into mid;
  insert into public.member_secrets (member_id, pin_hash) values (mid, crypt(p_pin, gen_salt('bf')));
  insert into public.sessions (user_id, member_id) values (uid, mid)
    on conflict (user_id) do update set member_id = excluded.member_id, created_at = now();
  return json_build_object('status', 'ok', 'invite_code', code);
end $$;

create or replace function public.group_preview(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', g.name,
    'members', coalesce((select json_agg(m.name order by m.joined_at)
                         from public.members m where m.group_id = g.id), '[]'::json))
  from public.groups g where g.invite_code = upper(btrim(p_code))
$$;

-- Nhập tên + PIN: tên đã có → kiểm tra PIN; tên mới → tạo thành viên (khi p_create = true)
create or replace function public.enter_group(p_code text, p_name text, p_pin text, p_create boolean default false)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  gid uuid; mid uuid; sec public.member_secrets;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_pin !~ '^\d{4}$' then raise exception 'invalid_pin'; end if;
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then raise exception 'invalid_name'; end if;

  select id into gid from public.groups where invite_code = upper(btrim(p_code));
  if gid is null then return json_build_object('status', 'group_not_found'); end if;

  select id into mid from public.members where group_id = gid and lower(name) = lower(p_name);

  if mid is null then
    if not p_create then return json_build_object('status', 'new_name'); end if;
    insert into public.members (group_id, name) values (gid, p_name) returning id into mid;
    insert into public.member_secrets (member_id, pin_hash) values (mid, crypt(p_pin, gen_salt('bf')));
  else
    select * into sec from public.member_secrets where member_id = mid for update;
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
    update public.member_secrets set failed_attempts = 0, locked_until = null where member_id = mid;
  end if;

  insert into public.sessions (user_id, member_id) values (uid, mid)
    on conflict (user_id) do update set member_id = excluded.member_id, created_at = now();
  return json_build_object('status', 'ok');
end $$;

create or replace function public.leave_group() returns void
language sql security definer set search_path = public as $$
  delete from public.sessions where user_id = auth.uid()
$$;

create or replace function public.change_my_pin(p_old text, p_new text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare mid uuid := public.my_member_id(); h text;
begin
  if mid is null then raise exception 'not_authenticated'; end if;
  if p_new !~ '^\d{4}$' then raise exception 'invalid_pin'; end if;
  select pin_hash into h from public.member_secrets where member_id = mid;
  if crypt(p_old, h) <> h then return json_build_object('status', 'wrong_pin'); end if;
  update public.member_secrets
    set pin_hash = crypt(p_new, gen_salt('bf')), failed_attempts = 0, locked_until = null
    where member_id = mid;
  return json_build_object('status', 'ok');
end $$;

-- Người tạo nhóm reset PIN cho thành viên quên PIN
create or replace function public.reset_member_pin(p_member_id uuid, p_new_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.members where id = public.my_member_id() and is_admin) then
    raise exception 'not_admin';
  end if;
  if not exists (select 1 from public.members where id = p_member_id and group_id = public.my_group_id()) then
    raise exception 'invalid_member';
  end if;
  if p_new_pin !~ '^\d{4}$' then raise exception 'invalid_pin'; end if;
  update public.member_secrets
    set pin_hash = crypt(p_new_pin, gen_salt('bf')), failed_attempts = 0, locked_until = null
    where member_id = p_member_id;
end $$;

-- ---------- Grants ----------
revoke all on function public.my_member_id(), public.my_group_id(), public.gen_invite_code(),
  public.me(), public.create_group(text, text, text), public.group_preview(text),
  public.enter_group(text, text, text, boolean), public.leave_group(),
  public.change_my_pin(text, text), public.reset_member_pin(uuid, text)
  from public, anon;
grant execute on function public.my_member_id(), public.my_group_id(),
  public.me(), public.create_group(text, text, text), public.group_preview(text),
  public.enter_group(text, text, text, boolean), public.leave_group(),
  public.change_my_pin(text, text), public.reset_member_pin(uuid, text)
  to authenticated;

-- ---------- Realtime ----------
do $$
begin
  begin alter publication supabase_realtime add table public.txns;     exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.payments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.members;  exception when duplicate_object then null; end;
end $$;
