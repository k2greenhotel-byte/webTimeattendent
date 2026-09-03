-- ============================================================
-- ประวัติลูกค้า (โปรแกรม CUST)
--
--   thai_geo   : ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ ทั่วประเทศ — ใช้เติมที่อยู่ให้อัตโนมัติ
--                (ข้อมูลจริงเติมด้วย `npm run db:geo` ไม่ใส่ในไฟล์ migration เพราะมี 7,436 แถว)
--   customers  : ประวัติลูกค้า — รหัส ชื่อ เบอร์โทร ที่อยู่ รูป บัตรประชาชน วันเกิด Facebook Line
--
-- ที่อยู่แยกเป็นสองส่วนตามที่ผู้ใช้ขอ:
--   address_detail = ส่วนที่ผู้ใช้พิมพ์เอง (บ้านเลขที่ หมู่ ซอย ถนน)
--   geo_code       = ตำบล/อำเภอ/จังหวัด ที่ระบบดึงให้จากรหัสไปรษณีย์หรือชื่อตำบล (ไม่พิมพ์ซ้ำ)
-- รันต่อจาก 0012 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- ตำบล/อำเภอ/จังหวัด ----------
create table if not exists public.thai_geo (
  subdistrict_code int  primary key,
  subdistrict_name text not null,
  district_code    int  not null,
  district_name    text not null,
  province_code    int  not null,
  province_name    text not null,
  postal_code      text not null
);

create index if not exists idx_geo_postal on public.thai_geo (postal_code);
create index if not exists idx_geo_subdistrict on public.thai_geo (subdistrict_name);
create index if not exists idx_geo_province on public.thai_geo (province_name);

alter table public.thai_geo enable row level security;

-- ---------- ประวัติลูกค้า ----------
create table if not exists public.customers (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,                 -- รหัสลูกค้า (ระบบออกให้ C000001 แก้เองได้)
  full_name      text not null,                        -- ชื่อลูกค้า
  phone          text,                                 -- เบอร์โทร (เก็บเป็นตัวเลขล้วน)
  address_detail text,                                 -- ที่อยู่ที่ผู้ใช้กรอกเอง
  geo_code       int references public.thai_geo (subdistrict_code) on delete set null,
  postal_code    text,                                 -- เก็บไว้ด้วยเผื่อตำบลถูกยุบ/เปลี่ยนภายหลัง
  photo_path     text,                                 -- รูปถ่ายใน storage (โฟลเดอร์ cust/)
  national_id    text,                                 -- เลขบัตรประชาชน 13 หลัก
  birth_date     date,
  facebook_url   text,
  line_url       text,
  note           text,
  branch_id      uuid references public.branches (id) on delete set null,
  company_id     uuid references public.companies (id) on delete set null,
  is_active      boolean not null default true,
  created_by     uuid references public.employees (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_customers_name on public.customers (full_name);
create index if not exists idx_customers_phone on public.customers (phone);
create index if not exists idx_customers_branch on public.customers (branch_id);

-- เลขบัตรประชาชนห้ามซ้ำ (เฉพาะแถวที่กรอกมา) กันบันทึกลูกค้าคนเดิมซ้ำสองรอบ
create unique index if not exists idx_customers_national_id
  on public.customers (national_id) where national_id is not null;

alter table public.customers enable row level security;

drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------- View: ลูกค้าพร้อมที่อยู่ที่ประกอบแล้ว ----------
drop view if exists public.v_customers;

create view public.v_customers as
select
  c.*,
  g.subdistrict_name,
  g.district_name,
  g.province_name,
  b.name as branch_name
from public.customers c
left join public.thai_geo g on g.subdistrict_code = c.geo_code
left join public.branches b on b.id = c.branch_id;

revoke all on public.v_customers from anon, authenticated;

-- ---------- ลงทะเบียนโปรแกรมและเมนู ----------
insert into public.programs (code, name, description, path, icon, sort_order) values
  ('CUST', 'ประวัติลูกค้า', 'ทะเบียนลูกค้า ที่อยู่ รูปถ่าย และช่องทางติดต่อ', '/customers', '🧑', 30)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('CUST_LIST', 'ค้นหา/ดูประวัติลูกค้า', '/customers',     'inquiry', 10),
  ('CUST_FORM', 'บันทึกประวัติลูกค้า',   '/customers/new', 'entry',   20)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'CUST'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้นตามระดับ: ทุกระดับเปิดดูได้ · บันทึก/แก้ไขได้ทุกระดับ · ลบเฉพาะ admin
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  true,
  true,
  true,
  lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('CUST_LIST', 'CUST_FORM')
on conflict (level, menu_id) do nothing;

-- ให้สิทธิ์เข้าโปรแกรมกับผู้ดูแลระบบไว้ก่อน คนอื่นเพิ่มทีหลังที่ /core/program-users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'CUST' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;
