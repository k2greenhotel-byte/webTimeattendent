-- ============================================================
-- ระบบส่วนกลางขององค์กร (core system)
--
--   companies              : บริษัท (หลายบริษัท)
--   branches               : เพิ่ม company_id ผูกสาขาเข้ากับบริษัท
--   employees              : เพิ่ม username / ระดับการทำงาน / ขอบเขตทุกบริษัท-ทุกสาขา
--   user_companies         : บริษัทที่ผู้ใช้แต่ละคนเข้าทำงานได้
--   user_branches          : สาขาที่ผู้ใช้แต่ละคนเข้าทำงานได้
--   programs               : ทะเบียนโปรแกรมในองค์กร (รหัส/ชื่อ/สถานะ)
--   program_menus          : เมนู/หน้าจอของแต่ละโปรแกรม (บันทึก/สอบถาม/รายงาน/dashboard/ตั้งค่า)
--   user_programs          : โปรแกรมที่ผู้ใช้เข้าใช้งานได้
--   user_menu_permissions  : สิทธิ์ อ่าน/เพิ่ม/แก้ไข/ลบ รายเมนู เฉพาะราย (override)
--   level_menu_permissions : สิทธิ์เริ่มต้นตามกลุ่มระดับการทำงาน (ใช้เมื่อไม่มี override)
--
-- หลักการ: สิทธิ์จริง = override รายคน ถ้าไม่มี → ค่าเริ่มต้นของระดับ ถ้าไม่มีอีก → ไม่มีสิทธิ์
--          ระดับ admin ได้ทุกสิทธิ์เสมอ (กันตัวเองล็อกออกจากระบบ)
-- รันต่อจาก 0008 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- ENUM ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'access_level') then
    create type access_level as enum ('admin', 'assistant_admin', 'supervisor', 'user');
  end if;
  if not exists (select 1 from pg_type where typname = 'menu_kind') then
    create type menu_kind as enum ('entry', 'inquiry', 'report', 'dashboard', 'setting');
  end if;
end
$$;

-- ---------- บริษัท ----------
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  address    text,
  tax_id     text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies enable row level security;

drop trigger if exists trg_companies_updated on public.companies;
create trigger trg_companies_updated before update on public.companies
  for each row execute function public.set_updated_at();

-- บริษัทตั้งต้น: ใช้ชื่อองค์กรที่เคยตั้งไว้ใน work_settings
insert into public.companies (code, name)
select 'MAIN', coalesce(nullif(trim(org_name), ''), 'บริษัทของฉัน')
from public.work_settings
where id = 1
on conflict (code) do nothing;

insert into public.companies (code, name)
select 'MAIN', 'บริษัทของฉัน'
where not exists (select 1 from public.companies)
on conflict (code) do nothing;

-- ---------- สาขาอยู่ใต้บริษัท ----------
alter table public.branches
  add column if not exists company_id uuid references public.companies (id) on delete set null;

create index if not exists idx_branches_company on public.branches (company_id);

update public.branches
set company_id = (select id from public.companies where code = 'MAIN')
where company_id is null;

-- ---------- ผู้ใช้งาน (ใช้ตาราง employees เป็นบัญชีเข้าระบบ ไม่แยกอีกตาราง) ----------
alter table public.employees add column if not exists username      text;
alter table public.employees add column if not exists all_companies boolean not null default false;
alter table public.employees add column if not exists all_branches  boolean not null default false;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'access_level'
  ) then
    alter table public.employees add column access_level access_level not null default 'user';
  end if;
end
$$;

-- User ID ห้ามซ้ำ (เทียบแบบไม่สนตัวพิมพ์เล็ก-ใหญ่)
create unique index if not exists idx_employees_username_unique
  on public.employees (lower(username)) where username is not null;

-- ตั้ง User ID ตั้งต้นจากรหัสพนักงาน ให้คนที่ยังไม่มี
update public.employees e
set username = lower(e.emp_code)
where e.username is null
  and not exists (
    select 1 from public.employees x
    where x.id <> e.id and lower(x.username) = lower(e.emp_code)
  );

-- แอดมินเดิม (role = admin) ให้เป็นระดับ admin และเข้าได้ทุกบริษัท/ทุกสาขา
update public.employees
set access_level = 'admin', all_companies = true, all_branches = true
where role = 'admin' and access_level = 'user';

comment on column public.employees.username      is 'User ID สำหรับอ้างอิงในระบบส่วนกลาง (ล็อกอินจริงใช้เบอร์มือถือ)';
comment on column public.employees.access_level  is 'กลุ่มระดับการทำงาน: admin / assistant_admin / supervisor / user';
comment on column public.employees.all_companies is 'true = เข้าถึงได้ทุกบริษัท (ไม่ต้องระบุใน user_companies)';
comment on column public.employees.all_branches  is 'true = เข้าถึงได้ทุกสาขา (ไม่ต้องระบุใน user_branches)';

-- ---------- ขอบเขตบริษัท / สาขา ของผู้ใช้ ----------
create table if not exists public.user_companies (
  user_id    uuid not null references public.employees (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table if not exists public.user_branches (
  user_id    uuid not null references public.employees (id) on delete cascade,
  branch_id  uuid not null references public.branches (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);

alter table public.user_companies enable row level security;
alter table public.user_branches  enable row level security;

-- พนักงานที่มีสาขาประจำอยู่แล้ว ให้เข้าสาขาตัวเองได้เป็นค่าเริ่มต้น
insert into public.user_branches (user_id, branch_id)
select e.id, e.branch_id
from public.employees e
where e.branch_id is not null and not e.all_branches
on conflict do nothing;

insert into public.user_companies (user_id, company_id)
select distinct e.id, b.company_id
from public.employees e
join public.branches b on b.id = e.branch_id
where b.company_id is not null and not e.all_companies
on conflict do nothing;

-- ---------- ทะเบียนโปรแกรมในองค์กร ----------
create table if not exists public.programs (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  path        text,
  icon        text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.program_menus (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  code       text not null unique,
  name       text not null,
  path       text,
  kind       menu_kind not null default 'entry',
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_menus_program on public.program_menus (program_id, sort_order);

alter table public.programs      enable row level security;
alter table public.program_menus enable row level security;

drop trigger if exists trg_programs_updated on public.programs;
create trigger trg_programs_updated before update on public.programs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_menus_updated on public.program_menus;
create trigger trg_menus_updated before update on public.program_menus
  for each row execute function public.set_updated_at();

-- ---------- สิทธิ์ ----------
create table if not exists public.user_programs (
  user_id    uuid not null references public.employees (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, program_id)
);

create table if not exists public.user_menu_permissions (
  user_id    uuid not null references public.employees (id) on delete cascade,
  menu_id    uuid not null references public.program_menus (id) on delete cascade,
  can_read   boolean not null default false,
  can_write  boolean not null default false,
  can_edit   boolean not null default false,
  can_delete boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, menu_id)
);

create table if not exists public.level_menu_permissions (
  level      access_level not null,
  menu_id    uuid not null references public.program_menus (id) on delete cascade,
  can_read   boolean not null default false,
  can_write  boolean not null default false,
  can_edit   boolean not null default false,
  can_delete boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (level, menu_id)
);

alter table public.user_programs          enable row level security;
alter table public.user_menu_permissions  enable row level security;
alter table public.level_menu_permissions enable row level security;

-- ---------- ข้อมูลตั้งต้น: โปรแกรมและเมนูที่มีอยู่จริงในระบบ ----------
insert into public.programs (code, name, description, path, icon, sort_order) values
  ('ATT',  'ระบบลงเวลาเข้า-ออกงาน', 'ลงเวลาด้วยรูปถ่าย และรายงานการทำงาน',          '/punch',     '⏱',  10),
  ('MKT',  'ระบบกิจกรรมการตลาด',    'บันทึกกิจกรรมและคุมการเบิกเงินส่งเสริมการขาย', '/marketing', '📣', 20),
  ('CORE', 'ระบบส่วนกลาง',          'บริษัท สาขา ผู้ใช้งาน สิทธิ์ และทะเบียนโปรแกรม', '/core',      '🏢', 90)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('ATT',  'ATT_PUNCH',       'บันทึกลงเวลา',             '/punch',                  'entry',     10),
  ('ATT',  'ATT_ME',          'ประวัติการลงเวลาของฉัน',   '/me',                     'inquiry',   20),
  ('ATT',  'ATT_ADMIN',       'ภาพรวมหลังบ้านลงเวลา',     '/admin',                  'dashboard', 30),
  ('ATT',  'ATT_REP_DAILY',   'รายงานรายวัน',             '/admin/reports/daily',    'report',    40),
  ('ATT',  'ATT_REP_MONTHLY', 'รายงานรายเดือน',           '/admin/reports/monthly',  'report',    50),
  ('ATT',  'ATT_REP_EMP',     'รายงานรายบุคคล',           '/admin/reports/employee', 'report',    60),
  ('ATT',  'ATT_EMPLOYEES',   'จัดการพนักงาน',            '/admin/employees',        'entry',     70),
  ('ATT',  'ATT_HOLIDAYS',    'วันหยุดประจำปี',           '/admin/holidays',         'entry',     80),
  ('ATT',  'ATT_SETUP',       'ตั้งค่าข้อมูลหลักลงเวลา',  '/admin/setup',            'setting',   90),
  ('MKT',  'MKT_ACTIVITY',    'บันทึกกิจกรรม',            '/marketing/activities',   'entry',     10),
  ('MKT',  'MKT_SUBMIT',      'ส่งเรื่องเบิกเงิน',        '/marketing/submit',       'entry',     20),
  ('MKT',  'MKT_RECEIVE',     'รับเงิน',                  '/marketing/receive',      'entry',     30),
  ('MKT',  'MKT_SETUP',       'ค่าเริ่มต้นการตลาด',       '/marketing/setup',        'setting',   40),
  ('MKT',  'MKT_SEARCH',      'สอบถามข้อมูลการตลาด',      '/marketing/search',       'inquiry',   50),
  ('MKT',  'MKT_DASH',        'Dashboard การตลาด',        '/marketing/dashboard',    'dashboard', 60),
  ('MKT',  'MKT_MEMO',        'Memo โครงการ',             '/marketing/memos',        'entry',     70),
  ('MKT',  'MKT_MEMO_STATUS', 'เปลี่ยนสถานะ Memo',        '/marketing/memos/status', 'entry',     80),
  ('CORE', 'CORE_COMPANY',    'ตั้งค่าบริษัท',            '/core/companies',         'setting',   10),
  ('CORE', 'CORE_BRANCH',     'ตั้งค่าสาขา',              '/core/branches',          'setting',   20),
  ('CORE', 'CORE_USER',       'กำหนดผู้ใช้งาน',           '/core/users',             'entry',     30),
  ('CORE', 'CORE_PERM',       'กำหนดสิทธิ์ผู้ใช้งาน',     '/core/users',             'setting',   40),
  ('CORE', 'CORE_LEVEL',      'สิทธิ์ตามระดับการทำงาน',   '/core/levels',            'setting',   50),
  ('CORE', 'CORE_PROGRAM',    'ทะเบียนโปรแกรม',           '/core/programs',          'setting',   60)
) as m(program_code, code, name, path, kind, sort_order)
join public.programs p on p.code = m.program_code
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- ---------- สิทธิ์เริ่มต้นตามระดับการทำงาน ----------
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  -- อ่าน: ทุกระดับอ่านได้ ยกเว้นระดับ user ที่ไม่ให้แตะระบบส่วนกลาง
  case when lvl.level = 'user' then p.code <> 'CORE' else true end,
  -- เพิ่ม: admin/ผู้ช่วย ได้ทุกเมนู ระดับอื่นได้เฉพาะหน้าจอบันทึกที่ไม่ใช่ระบบส่วนกลาง
  case
    when lvl.level in ('admin', 'assistant_admin') then true
    else p.code <> 'CORE' and m.kind = 'entry'
  end,
  -- แก้ไข: เกณฑ์เดียวกับเพิ่ม
  case
    when lvl.level in ('admin', 'assistant_admin') then true
    else p.code <> 'CORE' and m.kind = 'entry'
  end,
  -- ลบ: เฉพาะระดับ admin
  lvl.level = 'admin'
from public.program_menus m
join public.programs p on p.id = m.program_id
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
on conflict (level, menu_id) do nothing;

-- ผู้ใช้เดิม: เข้าโปรแกรมลงเวลา + การตลาดได้ ส่วนระบบส่วนกลางเฉพาะ admin/ผู้ช่วย admin
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code in ('ATT', 'MKT')
   or (p.code = 'CORE' and e.access_level in ('admin', 'assistant_admin'))
on conflict do nothing;

-- ---------- View: สิทธิ์ที่มีผลจริงของผู้ใช้แต่ละคน ----------
drop view if exists public.v_user_permissions;

create view public.v_user_permissions as
select
  e.id                    as user_id,
  e.access_level,
  p.code                  as program_code,
  p.name                  as program_name,
  m.id                    as menu_id,
  m.code                  as menu_code,
  m.name                  as menu_name,
  m.kind                  as menu_kind,
  m.path                  as menu_path,
  (e.access_level = 'admin') or coalesce(u.can_read,   l.can_read,   false) as can_read,
  (e.access_level = 'admin') or coalesce(u.can_write,  l.can_write,  false) as can_write,
  (e.access_level = 'admin') or coalesce(u.can_edit,   l.can_edit,   false) as can_edit,
  (e.access_level = 'admin') or coalesce(u.can_delete, l.can_delete, false) as can_delete,
  (u.user_id is not null)  as is_override
from public.employees e
cross join public.program_menus m
join public.programs p on p.id = m.program_id
left join public.user_menu_permissions  u on u.user_id = e.id and u.menu_id = m.id
left join public.level_menu_permissions l on l.level = e.access_level and l.menu_id = m.id;

revoke all on public.v_user_permissions from anon, authenticated;
