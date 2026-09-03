-- ============================================================
-- ระบบงานขายและการตลาด → 1. ระบบจองรถ (โปรแกรม BOOK)
--
--   bk_doc_counters   : ตัวนับเลขที่เอกสาร (ใบจอง / ใบ update) แยกตามปี พ.ศ.
--   bk_bookings       : ใบจองรถ (หน้าจอ 1.1)
--   bk_booking_files  : เอกสารแนบของใบจอง — รับเงิน 2 แบบ / คืนเงิน 3 แบบ (ข้อ 1.1.20-1.1.21)
--   bk_updates        : ใบ update สถานะใบจอง (หน้าจอ 1.2) — หนึ่งใบจองมีได้หลายใบ update
--   bk_update_files   : เอกสารแนบที่ผูกกับใบ update (ข้อ 1.2.8-1.2.9)
--
-- หลักการ:
--   * ข้อมูลลูกค้า/ยี่ห้อ/รุ่น/แบบ/สี ไม่พิมพ์ซ้ำ — อ้างด้วย FK ไปตารางข้อมูลเบื้องต้น (customers, mc_*)
--     ลบตัวแม่แล้วใบจองยังอยู่ แต่ช่องอ้างอิงจะว่าง (on delete set null) ประวัติการขายไม่หาย
--   * สถานะปัจจุบันอยู่บนใบจอง ส่วนการเปลี่ยนแต่ละครั้งเก็บเป็นแถวใน bk_updates
--     (ใบจองคือ "ตอนนี้เป็นยังไง" · ใบ update คือ "ใครเปลี่ยนอะไรเมื่อไหร่")
--   * ข้อ 1.2.13 บังคับที่ชั้นฐานข้อมูลด้วย trigger: บันทึกเลขที่สัญญาขาย หรือบันทึกคืนเงินลูกค้าแล้ว
--     สถานะเอกสารจะกลายเป็น "ปิดงาน" อัตโนมัติ ไม่ว่าจะแก้จากหน้าจอไหน
--   * เปิด RLS ทุกตารางและไม่มี policy ให้ anon — อ่าน/เขียนผ่าน service role ฝั่ง server เท่านั้น
-- รันต่อจาก 0014 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- ชนิดข้อมูลสถานะ (ตามตัวเลือกที่ผู้ใช้ระบุมา) ----------
do $$
begin
  -- 1.1.11 ประเภทการซื้อ
  if not exists (select 1 from pg_type where typname = 'bk_purchase_type') then
    create type bk_purchase_type as enum ('cash', 'installment');
  end if;

  -- 1.1.13 สถานะรถ
  if not exists (select 1 from pg_type where typname = 'bk_vehicle_status') then
    create type bk_vehicle_status as enum ('in_stock', 'need_order', 'ordered');
  end if;

  -- 1.1.16 สถานะสัญญา
  if not exists (select 1 from pg_type where typname = 'bk_contract_status') then
    create type bk_contract_status as enum ('pending', 'approved', 'rejected');
  end if;

  -- 1.1.17 สถานะเอกสาร
  if not exists (select 1 from pg_type where typname = 'bk_doc_status') then
    create type bk_doc_status as enum ('active', 'cancelled', 'closed');
  end if;

  -- 1.1.18 สถานะการจอง
  if not exists (select 1 from pg_type where typname = 'bk_booking_status') then
    create type bk_booking_status as enum ('wait_contract', 'wait_delivery', 'delivered', 'cancelled');
  end if;

  -- 1.1.19 สาเหตุของการยกเลิก
  if not exists (select 1 from pg_type where typname = 'bk_cancel_reason') then
    create type bk_cancel_reason as enum ('got_other', 'contract_rejected', 'changed_mind');
  end if;

  -- 1.1.20-1.1.21 ชนิดเอกสารแนบ (รับเงิน 2 แบบ / คืนเงิน 3 แบบ)
  if not exists (select 1 from pg_type where typname = 'bk_file_kind') then
    create type bk_file_kind as enum (
      'receipt_photo',           -- รูปใบเสร็จรับเงิน
      'transfer_slip',           -- สลิปโอนเงิน
      'refund_contract_reject',  -- เอกสารสัญญาไม่ผ่าน
      'refund_slip',             -- สลิปโอนเงินคืน
      'refund_line_chat'         -- รูป Chat Line คำขอคืนเงิน
    );
  end if;
end
$$;

-- ---------- ตัวนับเลขที่เอกสาร ----------
create table if not exists public.bk_doc_counters (
  prefix text primary key,
  seq    int  not null default 0
);

alter table public.bk_doc_counters enable row level security;

-- ออกเลขที่เอกสารถัดไปแบบกันชนกัน (นับต่อ prefix + ปี พ.ศ.)
--   bk_next_doc_no('BK',  2569) → 'BK-2569-0001'   (ใบจอง)
--   bk_next_doc_no('BKU', 2569) → 'BKU-2569-0001'  (ใบ update)
create or replace function public.bk_next_doc_no(doc_prefix text, be_year int)
returns text
language plpgsql
as $fn$
declare
  key      text := doc_prefix || '-' || be_year::text;
  next_seq int;
begin
  insert into public.bk_doc_counters (prefix, seq)
  values (key, 1)
  on conflict (prefix) do update set seq = public.bk_doc_counters.seq + 1
  returning seq into next_seq;

  return key || '-' || lpad(next_seq::text, 4, '0');
end;
$fn$;

-- ---------- ใบจองรถ (หน้าจอ 1.1) ----------
create table if not exists public.bk_bookings (
  id                uuid primary key default gen_random_uuid(),
  doc_no            text not null unique,                                          -- 1.1.1 เลขที่ใบจอง (ระบบรันให้)
  branch_id         uuid references public.branches (id) on delete set null,       -- 1.1.2 สาขาที่รับจอง
  ref_no            text,                                                          -- 1.1.3 เลขที่อ้างอิง (คีย์เอง)
  booking_date      date not null,                                                 -- 1.1.4 วันที่
  customer_id       uuid references public.customers (id) on delete set null,      -- 1.1.5 ชื่อลูกค้า
  customer_phone    text,                                                          -- 1.1.6 เบอร์โทร (ดึงมาจากลูกค้า แก้ได้)
  brand_id          uuid references public.mc_brands (id) on delete set null,      -- 1.1.7 ยี่ห้อรถ
  model_id          uuid references public.mc_models (id) on delete set null,      -- 1.1.8 รุ่นรถ
  variant_id        uuid references public.mc_variants (id) on delete set null,    -- 1.1.9 แบบรถ
  color_id          uuid references public.mc_colors (id) on delete set null,      -- 1.1.10 สี
  purchase_type     bk_purchase_type   not null default 'installment',             -- 1.1.11 ประเภทการซื้อ
  pickup_date       date,                                                          -- 1.1.12 วันที่นัดรับรถ
  vehicle_status    bk_vehicle_status  not null default 'in_stock',                -- 1.1.13 สถานะรถ
  deposit_amount    numeric(12, 2) not null default 0,                             -- 1.1.14 จำนวนเงินที่มัดจำ
  receipt_no        text,                                                          -- 1.1.15 เลขที่ใบเสร็จรับเงิน (คีย์เอง)
  contract_status   bk_contract_status not null default 'pending',                 -- 1.1.16 สถานะสัญญา
  doc_status        bk_doc_status      not null default 'active',                  -- 1.1.17 สถานะเอกสาร
  booking_status    bk_booking_status  not null default 'wait_contract',           -- 1.1.18 สถานะการจอง
  cancel_reason     bk_cancel_reason,                                              -- 1.1.19 สาเหตุของการยกเลิก
  sale_contract_no  text,                                                          -- 1.2.11 เลขที่สัญญาขาย
  sale_date         date,                                                          -- 1.2.12 วันที่ขาย
  refunded          boolean not null default false,                                -- 1.2.13 บันทึกคืนเงินลูกค้าแล้ว
  note              text,
  company_id        uuid references public.companies (id) on delete set null,
  created_by        uuid references public.employees (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_bk_bookings_date     on public.bk_bookings (booking_date);
create index if not exists idx_bk_bookings_pickup   on public.bk_bookings (pickup_date);
create index if not exists idx_bk_bookings_customer on public.bk_bookings (customer_id);
create index if not exists idx_bk_bookings_brand    on public.bk_bookings (brand_id, model_id, variant_id);
create index if not exists idx_bk_bookings_status   on public.bk_bookings (booking_status, doc_status);
create index if not exists idx_bk_bookings_branch   on public.bk_bookings (branch_id);

-- ---------- ใบ update สถานะใบจอง (หน้าจอ 1.2) ----------
create table if not exists public.bk_updates (
  id               uuid primary key default gen_random_uuid(),
  doc_no           text not null unique,                                              -- 1.2.1 เลขที่ update
  update_date      date not null,                                                     -- 1.2.2 วันที่
  booking_id       uuid not null references public.bk_bookings (id) on delete cascade, -- 1.2.3 อ้างอิงใบจอง
  vehicle_status   bk_vehicle_status,                                                 -- 1.2.4 บันทึกสถานะรถ (null = ไม่เปลี่ยน)
  contract_status  bk_contract_status,                                                -- 1.2.5 บันทึกสถานะสัญญา
  booking_status   bk_booking_status,                                                 -- 1.2.6 บันทึกสถานะการจอง
  cancel_reason    bk_cancel_reason,                                                  -- 1.2.7 บันทึกสาเหตุของการยกเลิก
  recorded_by      uuid references public.employees (id) on delete set null,          -- 1.2.10 ชื่อผู้บันทึก
  recorded_by_name text,                                                              -- เก็บชื่อไว้ด้วย เผื่อบัญชีถูกลบภายหลัง
  sale_contract_no text,                                                              -- 1.2.11 เลขที่สัญญาขาย
  sale_date        date,                                                              -- 1.2.12 วันที่ขาย
  refunded         boolean not null default false,                                    -- 1.2.13 บันทึกคืนเงินลูกค้า
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_bk_updates_booking on public.bk_updates (booking_id);
create index if not exists idx_bk_updates_date    on public.bk_updates (update_date);

-- ---------- เอกสารแนบ ----------
create table if not exists public.bk_booking_files (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bk_bookings (id) on delete cascade,
  kind       bk_file_kind not null,
  path       text not null,
  filename   text not null,
  mime       text,
  size_bytes bigint,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_bk_booking_files on public.bk_booking_files (booking_id, kind, sort_order);

create table if not exists public.bk_update_files (
  id         uuid primary key default gen_random_uuid(),
  update_id  uuid not null references public.bk_updates (id) on delete cascade,
  kind       bk_file_kind not null,
  path       text not null,
  filename   text not null,
  mime       text,
  size_bytes bigint,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_bk_update_files on public.bk_update_files (update_id, kind, sort_order);

-- ---------- RLS + trigger updated_at ----------
do $$
declare
  t text;
begin
  foreach t in array array['bk_bookings', 'bk_updates', 'bk_booking_files', 'bk_update_files']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array array['bk_bookings', 'bk_updates']
  loop
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- ข้อ 1.2.13 — ปิดสถานะใบจองอัตโนมัติ
-- บันทึกเลขที่สัญญาขาย (ขายจบ) หรือบันทึกคืนเงินลูกค้า (จบอีกทาง) = ถือว่าปิดงาน
-- เขียนไว้ที่ชั้นฐานข้อมูลเพื่อให้ได้ผลเหมือนกันทุกทางที่แก้ข้อมูล
create or replace function public.bk_close_when_settled()
returns trigger
language plpgsql
as $fn$
begin
  if coalesce(new.sale_contract_no, '') <> '' or new.refunded then
    new.doc_status := 'closed';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_bk_bookings_close on public.bk_bookings;
create trigger trg_bk_bookings_close before insert or update on public.bk_bookings
  for each row execute function public.bk_close_when_settled();

-- ---------- View: ใบจองพร้อมชื่อที่ join แล้ว (หน้าจอสอบถาม/รายงานใช้ตัวนี้ตัวเดียว) ----------
drop view if exists public.v_bk_bookings;

create view public.v_bk_bookings as
select
  b.*,
  c.code       as customer_code,
  c.full_name  as customer_name,
  br.name      as branch_name,
  bd.name      as brand_name,
  md.name      as model_name,
  vr.name      as variant_name,
  cl.name      as color_name,
  (select count(*) from public.bk_booking_files f where f.booking_id = b.id) as file_count,
  (select count(*) from public.bk_updates u where u.booking_id = b.id)       as update_count
from public.bk_bookings b
left join public.customers   c  on c.id  = b.customer_id
left join public.branches    br on br.id = b.branch_id
left join public.mc_brands   bd on bd.id = b.brand_id
left join public.mc_models   md on md.id = b.model_id
left join public.mc_variants vr on vr.id = b.variant_id
left join public.mc_colors   cl on cl.id = b.color_id;

revoke all on public.v_bk_bookings from anon, authenticated;

-- ---------- View: ใบ update พร้อมเลขที่ใบจองและชื่อลูกค้า ----------
drop view if exists public.v_bk_updates;

create view public.v_bk_updates as
select
  u.*,
  b.doc_no    as booking_no,
  b.ref_no    as booking_ref_no,
  c.full_name as customer_name,
  e.full_name as recorded_by_full_name,
  (select count(*) from public.bk_update_files f where f.update_id = u.id) as file_count
from public.bk_updates u
join public.bk_bookings b on b.id = u.booking_id
left join public.customers c on c.id = b.customer_id
left join public.employees e on e.id = u.recorded_by;

revoke all on public.v_bk_updates from anon, authenticated;

-- ---------- ลงทะเบียนโปรแกรมและเมนู ----------
insert into public.programs (code, name, description, path, icon, sort_order) values
  ('BOOK', 'ระบบจองรถ',
           'รับจองรถ ติดตามสถานะสัญญา/สถานะรถ นัดรับรถ และ dashboard งานขาย',
           '/booking', '📝', 40)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('BOOK_ENTRY',  '1.1 รับจองรถ',           '/booking/bookings',  'entry',     10),
  ('BOOK_UPDATE', '1.2 Update สถานะใบจอง',  '/booking/updates',   'entry',     20),
  ('BOOK_SEARCH', '1.3 สอบถามใบจอง',        '/booking/search',    'inquiry',   30),
  ('BOOK_DASH',   '1.4 Dashboard ใบจอง',    '/booking/dashboard', 'dashboard', 40)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'BOOK'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้นตามระดับ:
--   หน้าจอบันทึก (รับจอง/update) — ทุกระดับบันทึกและแก้ไขได้ ลบได้เฉพาะ admin
--   หน้าจอสอบถาม/dashboard — ทุกระดับดูได้อย่างเดียว
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  true,
  m.code in ('BOOK_ENTRY', 'BOOK_UPDATE'),
  m.code in ('BOOK_ENTRY', 'BOOK_UPDATE'),
  m.code in ('BOOK_ENTRY', 'BOOK_UPDATE') and lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('BOOK_ENTRY', 'BOOK_UPDATE', 'BOOK_SEARCH', 'BOOK_DASH')
on conflict (level, menu_id) do nothing;

-- ให้สิทธิ์เข้าโปรแกรมกับผู้ดูแลระบบไว้ก่อน คนอื่นเพิ่มทีหลังที่ /core/program-users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'BOOK' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;
