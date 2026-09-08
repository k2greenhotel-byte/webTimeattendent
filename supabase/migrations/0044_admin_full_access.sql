-- ============================================================
-- ระดับผู้ดูแลระบบ (admin) เข้าได้ทุกโปรแกรม ทุกบริษัท ทุกสาขา ทุกเมนู อ่าน/เพิ่ม/แก้ไข/ลบ — เสมอ
--
-- เดิม: สิทธิ์เมนูของ admin ผ่านหมดอยู่แล้ว (v_user_permissions) แต่ยังมี 2 ช่องโหว่
--   1. has_program_access ดูจากแถว user_programs อย่างเดียว → โปรแกรมที่เพิ่มใหม่ทีหลัง
--      admin จะไม่โผล่ในเมนู 5 / หน้ากำหนดสิทธิ์ จนกว่าจะมีคนไปติ๊กให้
--   2. ธง all_companies / all_branches ของ admin แก้ทับได้จากหน้าผู้ใช้ → เลือกบริษัทตอนล็อกอินไม่ครบ
-- แก้ให้เป็นกฎถาวร: view ให้ admin ผ่านทุกชั้น + trigger คอยเติมแถวให้ admin อัตโนมัติ
-- รันซ้ำได้ (idempotent)
-- ============================================================

-- ---------- 1. view: admin เข้าได้ทุกโปรแกรมแม้ไม่มีแถวใน user_programs ----------
drop view if exists public.v_user_permissions;

create view public.v_user_permissions as
select
  e.id                     as user_id,
  e.access_level,
  p.code                   as program_code,
  p.name                   as program_name,
  m.id                     as menu_id,
  m.code                   as menu_code,
  m.name                   as menu_name,
  m.kind                   as menu_kind,
  m.path                   as menu_path,
  (e.access_level = 'admin')
    or (up.user_id is not null and coalesce(u.can_read,   l.can_read,   false)) as can_read,
  (e.access_level = 'admin')
    or (up.user_id is not null and coalesce(u.can_write,  l.can_write,  false)) as can_write,
  (e.access_level = 'admin')
    or (up.user_id is not null and coalesce(u.can_edit,   l.can_edit,   false)) as can_edit,
  (e.access_level = 'admin')
    or (up.user_id is not null and coalesce(u.can_delete, l.can_delete, false)) as can_delete,
  (u.user_id is not null)  as is_override,
  (e.access_level = 'admin') or (up.user_id is not null) as has_program_access
from public.employees e
cross join public.program_menus m
join public.programs p on p.id = m.program_id
left join public.user_programs          up on up.user_id = e.id and up.program_id = p.id
left join public.user_menu_permissions  u  on u.user_id  = e.id and u.menu_id = m.id
left join public.level_menu_permissions l  on l.level = e.access_level and l.menu_id = m.id;

revoke all on public.v_user_permissions from anon, authenticated;

-- ---------- 2. backfill: admin ทุกคนตอนนี้ ----------
update public.employees
   set all_companies = true, all_branches = true
 where access_level = 'admin'
   and (all_companies is distinct from true or all_branches is distinct from true);

insert into public.user_programs (user_id, program_id)
select e.id, p.id
  from public.employees e
 cross join public.programs p
 where e.access_level = 'admin'
on conflict do nothing;

-- ---------- 3. trigger: โปรแกรมใหม่ → admin ได้ทันที ----------
create or replace function public.core_grant_program_to_admins()
returns trigger language plpgsql as $$
begin
  insert into public.user_programs (user_id, program_id)
  select e.id, new.id from public.employees e where e.access_level = 'admin'
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_programs_grant_admins on public.programs;
create trigger trg_programs_grant_admins
  after insert on public.programs
  for each row execute function public.core_grant_program_to_admins();

-- ---------- 4. trigger: ตั้งใครเป็น admin → ทุกบริษัท ทุกสาขา ทุกโปรแกรม ----------
create or replace function public.core_admin_full_scope()
returns trigger language plpgsql as $$
begin
  if new.access_level = 'admin' then
    new.all_companies := true;
    new.all_branches  := true;
  end if;
  return new;
end $$;

drop trigger if exists trg_employees_admin_scope on public.employees;
create trigger trg_employees_admin_scope
  before insert or update of access_level, all_companies, all_branches on public.employees
  for each row execute function public.core_admin_full_scope();

create or replace function public.core_admin_grant_programs()
returns trigger language plpgsql as $$
begin
  if new.access_level = 'admin' then
    insert into public.user_programs (user_id, program_id)
    select new.id, p.id from public.programs p
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_employees_admin_programs on public.employees;
create trigger trg_employees_admin_programs
  after insert or update of access_level on public.employees
  for each row execute function public.core_admin_grant_programs();
