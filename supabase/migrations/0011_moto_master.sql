-- ============================================================
-- ระบบข้อมูลเบื้องต้น (master data) สำหรับธุรกิจรถจักรยานยนต์
--
--   mc_brands            : 1. ยี่ห้อรถ
--   mc_models            : 2. รุ่นรถ (อ้างยี่ห้อได้)
--   mc_variants          : 3. แบบรถ (อ้างรุ่น)
--   mc_colors            : 4. สีรถ
--   mc_vendors           : 5. บริษัทรถ / เจ้าหนี้ที่ติดต่อ
--   mc_finance_companies : 6. บริษัทไฟแนนซ์
--   mc_income_types      : 7. รายการรับชำระเงิน
--   mc_expense_types     : 8. รายการค่าใช้จ่าย
--   mc_contact_channels  : 9. ช่องทางการติดต่อ
--   mc_sales_jobs        : 10. งานด้านการขาย
--
-- หลักการ:
--   * ทุกตารางหน้าตาเหมือนกัน (รหัส / ชื่อ / ใช้งาน) เพื่อให้ใช้หน้าจอและ db layer ชุดเดียวกันได้
--   * ยี่ห้อ → รุ่น → แบบ ผูกกันด้วย FK แบบไม่บังคับ (on delete set null)
--     ลบตัวแม่แล้วลูกยังอยู่ แต่ช่องอ้างอิงจะว่าง ข้อมูลเก่าไม่หาย
--   * เปิด RLS ทุกตารางและไม่มี policy ให้ anon — อ่าน/เขียนผ่าน service role ฝั่ง server เท่านั้น
-- รันต่อจาก 0010 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- ตารางข้อมูลหลัก ----------

create table if not exists public.mc_brands (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_models (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  brand_id   uuid references public.mc_brands (id) on delete set null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_variants (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  model_id   uuid references public.mc_models (id) on delete set null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_colors (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_vendors (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_finance_companies (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_income_types (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_expense_types (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_contact_channels (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_sales_jobs (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mc_models_brand   on public.mc_models (brand_id);
create index if not exists idx_mc_variants_model on public.mc_variants (model_id);

-- ---------- RLS + trigger updated_at ให้ครบทุกตาราง ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'mc_brands', 'mc_models', 'mc_variants', 'mc_colors', 'mc_vendors',
    'mc_finance_companies', 'mc_income_types', 'mc_expense_types',
    'mc_contact_channels', 'mc_sales_jobs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- ---------- ข้อมูลตั้งต้นเท่าที่ระบุมา (ตารางอื่นเว้นว่างให้กรอกเอง) ----------

insert into public.mc_brands (code, name) values
  ('BR01', 'Yamaha'),
  ('BR02', 'Honda'),
  ('BR03', 'Lambretta'),
  ('BR04', 'Zontes'),
  ('BR05', 'GPX'),
  ('BR06', 'Yadea'),
  ('BR07', 'EM'),
  ('BR08', 'Lion')
on conflict (code) do nothing;

insert into public.mc_contact_channels (code, name) values
  ('CH01', 'Facebook'),
  ('CH02', 'TikTok'),
  ('CH03', 'โทรศัพท์ (Call)'),
  ('CH04', 'Line')
on conflict (code) do nothing;

insert into public.mc_sales_jobs (code, name) values
  ('SJ01', 'แจกใบปลิว'),
  ('SJ02', 'Live สด'),
  ('SJ03', 'โพสต์ Facebook'),
  ('SJ04', 'โพสต์ TikTok')
on conflict (code) do nothing;

-- ---------- ขึ้นทะเบียนโปรแกรมและเมนูในระบบส่วนกลาง ----------

insert into public.programs (code, name, description, path, icon, sort_order) values
  ('MC', 'ข้อมูลเบื้องต้นธุรกิจรถจักรยานยนต์',
         'ยี่ห้อ รุ่น แบบ สี บริษัทรถ ไฟแนนซ์ รายการรับ-จ่ายเงิน ช่องทางติดต่อ และงานขาย',
         '/moto', '🏍', 30)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('MC_BRAND',    '1. ยี่ห้อรถ',            '/moto/setup/brands',    'setting', 10),
  ('MC_MODEL',    '2. รุ่นรถ',              '/moto/setup/models',    'setting', 20),
  ('MC_VARIANT',  '3. แบบรถ',               '/moto/setup/variants',  'setting', 30),
  ('MC_COLOR',    '4. สีรถ',                '/moto/setup/colors',    'setting', 40),
  ('MC_VENDOR',   '5. บริษัทรถ / เจ้าหนี้', '/moto/setup/vendors',   'setting', 50),
  ('MC_FINANCE',  '6. บริษัทไฟแนนซ์',       '/moto/setup/finance',   'setting', 60),
  ('MC_INCOME',   '7. รายการรับชำระเงิน',   '/moto/setup/income',    'setting', 70),
  ('MC_EXPENSE',  '8. รายการค่าใช้จ่าย',    '/moto/setup/expense',   'setting', 80),
  ('MC_CHANNEL',  '9. ช่องทางการติดต่อ',    '/moto/setup/channels',  'setting', 90),
  ('MC_SALESJOB', '10. งานด้านการขาย',      '/moto/setup/salesjobs', 'setting', 100)
) as m(code, name, path, kind, sort_order)
cross join public.programs p
where p.code = 'MC'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้นตามระดับ: admin/ผู้ช่วย admin แก้ไขได้ ระดับอื่นดูอย่างเดียว ลบได้เฉพาะ admin
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  true,
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level = 'admin'
from public.program_menus m
join public.programs p on p.id = m.program_id and p.code = 'MC'
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
on conflict (level, menu_id) do nothing;

-- เปิดให้ผู้ดูแลระบบเข้าใช้ก่อน คนอื่นให้แอดมินเพิ่มเองที่หน้า /core/users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'MC' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;
