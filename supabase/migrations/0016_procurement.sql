-- ============================================================
-- ระบบจัดซื้อจัดจ้างแจ้งซ่อม (โปรแกรม PR)
--
--   pr_asset_types        : ค่าเบื้องต้น ประเภททรัพย์สินที่จะซ่อม (ข้อ 1.1.6)
--   pr_material_types     : ค่าเบื้องต้น ประเภทวัสดุที่ขอซื้อ (ข้อ 1.3.8)
--   pr_doc_counters       : ตัวนับเลขที่เอกสารทุกชนิด แยกตามปี พ.ศ.
--   pr_repairs            : ใบขอซ่อม (หน้าจอ 1.1)
--   pr_repair_updates     : ใบ update งานซ่อม (หน้าจอ 1.2) — หนึ่งใบขอซ่อมมีได้หลายใบ
--   pr_purchases          : ใบขอจัดซื้อ (หน้าจอ 1.3)
--   pr_approvals          : ใบอนุมัติ (หน้าจอ 3.1) — อ้างใบขอซ่อมหรือใบขอซื้อก็ได้
--   pr_payments           : ใบเบิกจ่าย (หน้าจอ 4) — หนึ่งใบอ้างเอกสารต้นทางได้หลายใบ
--   pr_*_photos / files   : รูปและไฟล์แนบของแต่ละเอกสาร
--
-- หลักการ:
--   * บริษัท/สาขา/ประเภททรัพย์สิน/ผู้บันทึก ไม่พิมพ์ซ้ำ — อ้างด้วย FK (on delete set null)
--     ลบตัวแม่แล้วเอกสารยังอยู่ แต่ช่องอ้างอิงว่าง ประวัติงานซ่อมไม่หาย
--   * สถานะปัจจุบันอยู่บนใบขอซ่อม ส่วนการเปลี่ยนแต่ละครั้งเก็บเป็นแถวใน pr_repair_updates
--     (ใบขอซ่อมคือ "ตอนนี้เป็นยังไง" · ใบ update คือ "ใครเปลี่ยนอะไรเมื่อไหร่")
--   * ผลการอนุมัติเก็บเป็นใบอนุมัติหนึ่งแถว แล้วผลักผลขึ้นเอกสารต้นทาง (เขียนที่ชั้น db layer ตัวเดียว)
--   * เปิด RLS ทุกตารางและไม่มี policy ให้ anon — อ่าน/เขียนผ่าน service role ฝั่ง server เท่านั้น
-- รันต่อจาก 0015 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- ชนิดข้อมูลสถานะ ----------
do $$
begin
  -- 1.1.8 / 1.3.10 ความเร่งด่วนที่ต้องได้รับการแก้ไข
  if not exists (select 1 from pg_type where typname = 'pr_urgency') then
    create type pr_urgency as enum ('d1_2', 'd2_5', 'd5_plus');
  end if;

  -- 1.1.17 / 1.3.16 สถานะเอกสาร
  if not exists (select 1 from pg_type where typname = 'pr_doc_status') then
    create type pr_doc_status as enum ('active', 'cancelled');
  end if;

  -- 1.1.18 / 1.3.17 สถานะการเบิกเงิน
  -- ค่าเดียวกันทั้งสองฝั่ง ต่างกันแค่คำที่แสดง (ซ่อม = "รับเงินแล้ว" / ซื้อ = "จ่ายเงินแล้ว")
  -- ข้อความไทยอยู่ในชั้น TS (REPAIR_PAY_STATUS_LABEL / PURCHASE_PAY_STATUS_LABEL)
  if not exists (select 1 from pg_type where typname = 'pr_pay_status') then
    create type pr_pay_status as enum ('requested', 'approved', 'settled');
  end if;

  -- 1.1.19 (3 ค่า) / 1.2.4 (4 ค่า) สถานะงาน — เก็บ 4 ค่า ฟอร์มแจ้งซ่อมแสดงแค่ 3 ตามสเปก
  if not exists (select 1 from pg_type where typname = 'pr_job_status') then
    create type pr_job_status as enum ('wait_tech', 'contacted', 'in_progress', 'done');
  end if;

  -- 1.1.20 / 3.1.4 สถานะอนุมัติ (recheck = ให้ไปตรวจสอบราคาหรือหาผู้ขาย/ผู้ซ่อมรายใหม่มาเทียบ)
  if not exists (select 1 from pg_type where typname = 'pr_approve_status') then
    create type pr_approve_status as enum ('pending', 'approved', 'rejected', 'recheck');
  end if;

  -- 3.1.5 สาเหตุของการไม่อนุมัติ
  if not exists (select 1 from pg_type where typname = 'pr_reject_reason') then
    create type pr_reject_reason as enum ('price_high', 'use_old', 'find_new');
  end if;

  -- 1.1.16 แก้ไขโดยช่างภายในหรือช่างภายนอก
  if not exists (select 1 from pg_type where typname = 'pr_tech_kind') then
    create type pr_tech_kind as enum ('internal', 'external');
  end if;

  -- 4.5-4.6 ชนิดสิ่งที่แนบมากับใบเบิกจ่าย
  if not exists (select 1 from pg_type where typname = 'pr_payment_file_kind') then
    create type pr_payment_file_kind as enum ('photo', 'document');
  end if;
end
$$;

-- ---------- ค่าเบื้องต้น: ประเภททรัพย์สิน (1.1.6) และประเภทวัสดุ (1.3.8) ----------
create table if not exists public.pr_asset_types (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pr_material_types (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- ตัวนับเลขที่เอกสาร ----------
create table if not exists public.pr_doc_counters (
  prefix text primary key,
  seq    int  not null default 0
);

-- ออกเลขที่เอกสารถัดไปแบบกันชนกัน (นับต่อ prefix + ปี พ.ศ.)
--   pr_next_doc_no('RQ', 2569) -> 'RQ-2569-0001'   (ใบขอซ่อม)
--   RU = update งานซ่อม, PO = ใบขอซื้อ, AP = ใบอนุมัติ, PV = ใบเบิกจ่าย
create or replace function public.pr_next_doc_no(doc_prefix text, be_year int)
returns text
language plpgsql
as $fn$
declare
  key      text := doc_prefix || '-' || be_year::text;
  next_seq int;
begin
  insert into public.pr_doc_counters (prefix, seq)
  values (key, 1)
  on conflict (prefix) do update set seq = public.pr_doc_counters.seq + 1
  returning seq into next_seq;

  return key || '-' || lpad(next_seq::text, 4, '0');
end;
$fn$;

-- ---------- ใบขอซ่อม (หน้าจอ 1.1) ----------
create table if not exists public.pr_repairs (
  id                 uuid primary key default gen_random_uuid(),
  doc_no             text not null unique,                                            -- 1.1.1 เลขที่ใบขอซ่อม (ระบบรันให้)
  request_date       date not null,                                                   -- 1.1.2 วันที่
  company_id         uuid references public.companies (id)      on delete set null,   -- 1.1.3 บริษัทที่ขอซ่อม
  branch_id          uuid references public.branches (id)       on delete set null,   -- 1.1.4 สาขา
  item_name          text not null,                                                   -- 1.1.5 รายการที่ต้องซ่อม
  asset_type_id      uuid references public.pr_asset_types (id) on delete set null,   -- 1.1.6 ประเภททรัพย์สิน
  damage_detail      text,                                                            -- 1.1.7 อธิบายความเสียหาย
  urgency            pr_urgency        not null default 'd2_5',                       -- 1.1.8 ความเร่งด่วน
  created_by         uuid references public.employees (id)      on delete set null,   -- 1.1.9 ผู้บันทึกจัดทำ
  created_by_name    text,                                                            -- เก็บชื่อไว้ด้วย เผื่อบัญชีถูกลบภายหลัง
  requested_amount   numeric(12, 2) not null default 0,                               -- 1.1.11 จำนวนเงินที่ขอเบิก
  approved_amount    numeric(12, 2) not null default 0,                               -- 1.1.12 จำนวนเงินที่อนุมัติเบิก
  actual_amount      numeric(12, 2) not null default 0,                               -- 1.1.13 จำนวนเงินที่เบิกจริง
  tech_name          text,                                                            -- 1.1.14 ชื่อผู้ที่จะดำเนินการแก้ไข
  tech_phone         text,                                                            -- 1.1.15 เบอร์โทรผู้ดำเนินการแก้ไข
  tech_kind          pr_tech_kind      not null default 'external',                   -- 1.1.16 ช่างภายใน/ภายนอก
  doc_status         pr_doc_status     not null default 'active',                     -- 1.1.17 สถานะเอกสาร
  pay_status         pr_pay_status     not null default 'requested',                  -- 1.1.18 สถานะการเบิกเงิน
  job_status         pr_job_status     not null default 'wait_tech',                  -- 1.1.19 สถานะงาน
  approve_status     pr_approve_status not null default 'pending',                    -- 1.1.20 สถานะอนุมัติ
  reject_reason      pr_reject_reason,                                                -- 3.1.5 สาเหตุของการไม่อนุมัติ
  reject_note        text,                                                            -- 1.1.21 เหตุผลไม่อนุมัติ (อธิบายเพิ่ม)
  tech_visit_date    date,                                                            -- 1.1.22 วันที่ช่างจะเข้ามาแก้ไข
  expected_done_date date,                                                            -- 1.1.23 วันที่คาดว่าจะซ่อมเสร็จ
  fixed_date         date,                                                            -- 1.1.24 วันที่ได้รับการแก้ไขแล้ว
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_pr_repairs_date    on public.pr_repairs (request_date);
create index if not exists idx_pr_repairs_branch  on public.pr_repairs (branch_id);
create index if not exists idx_pr_repairs_company on public.pr_repairs (company_id);
create index if not exists idx_pr_repairs_job     on public.pr_repairs (job_status, doc_status);
create index if not exists idx_pr_repairs_approve on public.pr_repairs (approve_status);
create index if not exists idx_pr_repairs_urgency on public.pr_repairs (urgency);
create index if not exists idx_pr_repairs_asset   on public.pr_repairs (asset_type_id);

-- 1.1.10 รูปภาพ บันทึกได้ 10 รูป (จำกัดจำนวนที่ชั้น server action)
create table if not exists public.pr_repair_photos (
  id         uuid primary key default gen_random_uuid(),
  repair_id  uuid not null references public.pr_repairs (id) on delete cascade,
  path       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_pr_repair_photos on public.pr_repair_photos (repair_id, sort_order);

-- ---------- ใบ update งานซ่อม (หน้าจอ 1.2) ----------
create table if not exists public.pr_repair_updates (
  id                 uuid primary key default gen_random_uuid(),
  doc_no             text not null unique,                                             -- 1.2.1 เลขที่
  update_date        date not null,                                                    -- 1.2.2 วันที่
  repair_id          uuid not null references public.pr_repairs (id) on delete cascade, -- 1.2.3 อ้างอิงใบขอซ่อม
  job_status         pr_job_status,                                                    -- 1.2.4 บันทึกสถานะงาน (null = ไม่เปลี่ยน)
  detail             text,                                                             -- 1.2.5 รายละเอียดเพิ่มเติม
  expected_done_date date,                                                             -- 1.2.6 วันที่คาดว่าจะซ่อมเสร็จ
  requested_amount   numeric(12, 2),                                                   -- 1.2.7 จำนวนเงินที่ขออนุมัติซ่อม (null = ไม่เปลี่ยน)
  recorded_by        uuid references public.employees (id) on delete set null,          -- 1.2.8 ผู้บันทึก
  recorded_by_name   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_pr_repair_updates_repair on public.pr_repair_updates (repair_id);
create index if not exists idx_pr_repair_updates_date   on public.pr_repair_updates (update_date);

-- 1.2.9 รูปงานที่กำลังซ่อมหรือซ่อมเสร็จแล้ว
create table if not exists public.pr_repair_update_photos (
  id         uuid primary key default gen_random_uuid(),
  update_id  uuid not null references public.pr_repair_updates (id) on delete cascade,
  path       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_pr_repair_update_photos on public.pr_repair_update_photos (update_id, sort_order);

-- ---------- ใบขอจัดซื้อ (หน้าจอ 1.3) ----------
create table if not exists public.pr_purchases (
  id                uuid primary key default gen_random_uuid(),
  doc_no            text not null unique,                                               -- 1.3.1 เลขที่ใบขอจัดซื้อ
  request_date      date not null,                                                      -- 1.3.2 วันที่
  company_id        uuid references public.companies (id)         on delete set null,   -- 1.3.3 บริษัท
  branch_id         uuid references public.branches (id)          on delete set null,   -- 1.3.4 สาขา
  supplier_name     text,                                                               -- 1.3.5 ผู้ขายหรือ supplier
  supplier_phone    text,                                                               -- 1.3.6 เบอร์โทรผู้ขาย
  item_name         text not null,                                                      -- 1.3.7 รายการที่ขอซื้อ
  material_type_id  uuid references public.pr_material_types (id) on delete set null,   -- 1.3.8 ประเภทวัสดุ
  reason            text,                                                               -- 1.3.9 สาเหตุหรือความจำเป็นในการซื้อ
  urgency           pr_urgency        not null default 'd2_5',                          -- 1.3.10 ความเร่งด่วน
  created_by        uuid references public.employees (id)         on delete set null,   -- 1.3.11 ผู้บันทึกจัดทำ
  created_by_name   text,
  requested_amount  numeric(12, 2) not null default 0,                                  -- 1.3.13 จำนวนเงินที่ขอเบิก
  approved_amount   numeric(12, 2) not null default 0,                                  -- 1.3.14 จำนวนเงินที่อนุมัติเบิก
  actual_amount     numeric(12, 2) not null default 0,                                  -- 1.3.15 จำนวนเงินที่เบิกจริง
  doc_status        pr_doc_status     not null default 'active',                        -- 1.3.16 สถานะเอกสาร
  pay_status        pr_pay_status     not null default 'requested',                     -- 1.3.17 สถานะการเบิกเงิน
  approve_status    pr_approve_status not null default 'pending',                       -- 1.3.18 สถานะอนุมัติ
  reject_reason     pr_reject_reason,                                                   -- 3.1.5 สาเหตุของการไม่อนุมัติ
  reject_note       text,                                                               -- 1.3.19 เหตุผลไม่อนุมัติ
  received_date     date,                                                               -- 1.3.20 วันที่ได้รับวัสดุแล้ว
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_pr_purchases_date     on public.pr_purchases (request_date);
create index if not exists idx_pr_purchases_branch   on public.pr_purchases (branch_id);
create index if not exists idx_pr_purchases_company  on public.pr_purchases (company_id);
create index if not exists idx_pr_purchases_approve  on public.pr_purchases (approve_status, doc_status);
create index if not exists idx_pr_purchases_urgency  on public.pr_purchases (urgency);
create index if not exists idx_pr_purchases_material on public.pr_purchases (material_type_id);

-- 1.3.12 รูปภาพ บันทึกได้ 10 รูป
create table if not exists public.pr_purchase_photos (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.pr_purchases (id) on delete cascade,
  path        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_pr_purchase_photos on public.pr_purchase_photos (purchase_id, sort_order);

-- ---------- ใบอนุมัติ (หน้าจอ 3.1) ----------
create table if not exists public.pr_approvals (
  id              uuid primary key default gen_random_uuid(),
  doc_no          text not null unique,                                          -- 3.1.1 เลขที่ใบอนุมัติ
  approve_date    date not null,                                                 -- 3.1.2 วันที่
  approver_id     uuid references public.employees (id) on delete set null,      -- 3.1.3 ผู้อนุมัติ
  approver_name   text,
  decision        pr_approve_status not null,                                    -- 3.1.4 อนุมัติ / ไม่อนุมัติ / ให้หาราคาใหม่
  reject_reason   pr_reject_reason,                                              -- 3.1.5 สาเหตุของการไม่อนุมัติ
  approved_amount numeric(12, 2) not null default 0,
  note            text,
  repair_id       uuid references public.pr_repairs (id)   on delete cascade,    -- 3.1.6 อ้างอิงใบขอซ่อม
  purchase_id     uuid references public.pr_purchases (id) on delete cascade,    -- 3.1.6 และ/หรือใบขอจัดซื้อ
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint pr_approvals_target_required
    check (repair_id is not null or purchase_id is not null)
);

create index if not exists idx_pr_approvals_repair   on public.pr_approvals (repair_id);
create index if not exists idx_pr_approvals_purchase on public.pr_approvals (purchase_id);
create index if not exists idx_pr_approvals_date     on public.pr_approvals (approve_date);

-- ---------- ใบเบิกจ่าย (หน้าจอ 4) ----------
create table if not exists public.pr_payments (
  id              uuid primary key default gen_random_uuid(),
  doc_no          text not null unique,                                       -- 4.1 เลขที่เบิกจ่าย
  pay_date        date not null,                                              -- 4.2 วันที่ขอเบิกเงิน
  paid_amount     numeric(12, 2) not null default 0,                          -- 4.3 ยอดเงินที่จ่ายจริง
  note            text,
  company_id      uuid references public.companies (id) on delete set null,
  branch_id       uuid references public.branches (id)  on delete set null,
  created_by      uuid references public.employees (id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_pr_payments_date on public.pr_payments (pay_date);

-- 4.4 อ้างอิงใบขอซ่อมและใบขอซื้อที่อนุมัติแล้ว — หนึ่งใบจ่ายอ้างได้หลายใบ
create table if not exists public.pr_payment_items (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references public.pr_payments (id) on delete cascade,
  repair_id   uuid references public.pr_repairs (id)           on delete set null,
  purchase_id uuid references public.pr_purchases (id)         on delete set null,
  amount      numeric(12, 2) not null default 0,
  sort_order  int not null default 0,
  constraint pr_payment_items_target_required
    check (repair_id is not null or purchase_id is not null)
);

create index if not exists idx_pr_payment_items_pay      on public.pr_payment_items (payment_id, sort_order);
create index if not exists idx_pr_payment_items_repair   on public.pr_payment_items (repair_id);
create index if not exists idx_pr_payment_items_purchase on public.pr_payment_items (purchase_id);

-- 4.5 รูปภาพประกอบ / 4.6 แนบไฟล์ใบเสร็จ ใบรับสินค้า
create table if not exists public.pr_payment_files (
  id         uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.pr_payments (id) on delete cascade,
  kind       pr_payment_file_kind not null,
  path       text not null,
  filename   text not null,
  mime       text,
  size_bytes bigint,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_pr_payment_files on public.pr_payment_files (payment_id, kind, sort_order);

-- ---------- RLS + trigger updated_at ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'pr_asset_types', 'pr_material_types', 'pr_doc_counters',
    'pr_repairs', 'pr_repair_photos', 'pr_repair_updates', 'pr_repair_update_photos',
    'pr_purchases', 'pr_purchase_photos',
    'pr_approvals', 'pr_payments', 'pr_payment_items', 'pr_payment_files'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array array[
    'pr_asset_types', 'pr_material_types', 'pr_repairs', 'pr_repair_updates',
    'pr_purchases', 'pr_approvals', 'pr_payments'
  ]
  loop
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- ---------- View: ใบขอซ่อมพร้อมชื่อที่ join แล้ว ----------
drop view if exists public.v_pr_repairs;

create view public.v_pr_repairs as
select
  r.*,
  co.name as company_name,
  br.name as branch_name,
  at.code as asset_type_code,
  at.name as asset_type_name,
  e.full_name as created_by_full_name,
  (select count(*) from public.pr_repair_photos p  where p.repair_id = r.id) as photo_count,
  (select count(*) from public.pr_repair_updates u where u.repair_id = r.id) as update_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.repair_id = r.id), 0) as paid_total
from public.pr_repairs r
left join public.companies      co on co.id = r.company_id
left join public.branches       br on br.id = r.branch_id
left join public.pr_asset_types at on at.id = r.asset_type_id
left join public.employees      e  on e.id  = r.created_by;

revoke all on public.v_pr_repairs from anon, authenticated;

-- ---------- View: ใบขอจัดซื้อพร้อมชื่อที่ join แล้ว ----------
drop view if exists public.v_pr_purchases;

create view public.v_pr_purchases as
select
  p.*,
  co.name as company_name,
  br.name as branch_name,
  mt.code as material_type_code,
  mt.name as material_type_name,
  e.full_name as created_by_full_name,
  (select count(*) from public.pr_purchase_photos f where f.purchase_id = p.id) as photo_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.purchase_id = p.id), 0) as paid_total
from public.pr_purchases p
left join public.companies         co on co.id = p.company_id
left join public.branches          br on br.id = p.branch_id
left join public.pr_material_types mt on mt.id = p.material_type_id
left join public.employees         e  on e.id  = p.created_by;

revoke all on public.v_pr_purchases from anon, authenticated;

-- ---------- View: ใบ update งานซ่อม ----------
drop view if exists public.v_pr_repair_updates;

create view public.v_pr_repair_updates as
select
  u.*,
  r.doc_no    as repair_no,
  r.item_name as repair_item_name,
  br.name     as branch_name,
  e.full_name as recorded_by_full_name,
  (select count(*) from public.pr_repair_update_photos p where p.update_id = u.id) as photo_count
from public.pr_repair_updates u
join public.pr_repairs r on r.id = u.repair_id
left join public.branches br on br.id = r.branch_id
left join public.employees e on e.id = u.recorded_by;

revoke all on public.v_pr_repair_updates from anon, authenticated;

-- ---------- View: ใบอนุมัติ ----------
drop view if exists public.v_pr_approvals;

create view public.v_pr_approvals as
select
  a.*,
  r.doc_no    as repair_no,
  r.item_name as repair_item_name,
  p.doc_no    as purchase_no,
  p.item_name as purchase_item_name,
  e.full_name as approver_full_name
from public.pr_approvals a
left join public.pr_repairs   r on r.id = a.repair_id
left join public.pr_purchases p on p.id = a.purchase_id
left join public.employees    e on e.id = a.approver_id;

revoke all on public.v_pr_approvals from anon, authenticated;

-- ---------- View: ใบเบิกจ่าย ----------
drop view if exists public.v_pr_payments;

create view public.v_pr_payments as
select
  pay.*,
  co.name as company_name,
  br.name as branch_name,
  e.full_name as created_by_full_name,
  (select count(*) from public.pr_payment_items i where i.payment_id = pay.id) as item_count,
  (select count(*) from public.pr_payment_files f where f.payment_id = pay.id) as file_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.payment_id = pay.id), 0) as item_total
from public.pr_payments pay
left join public.companies co on co.id = pay.company_id
left join public.branches  br on br.id = pay.branch_id
left join public.employees e  on e.id  = pay.created_by;

revoke all on public.v_pr_payments from anon, authenticated;

-- ---------- View รวม: ใบขอซ่อม + ใบขอซื้อ ในคอลัมน์ชุดเดียวกัน ----------
-- หน้าจออนุมัติ (ข้อ 3) และหน้าจอสอบถาม (ข้อ 5) อ่านจาก view ตัวนี้ตัวเดียว
-- จะได้ไม่ต้องเขียน query สองชุดที่เพี้ยนกันภายหลัง
drop view if exists public.v_pr_docs;

create view public.v_pr_docs as
select
  'repair'::text     as kind,
  r.id,
  r.doc_no,
  r.request_date     as doc_date,
  r.company_id,
  co.name            as company_name,
  r.branch_id,
  br.name            as branch_name,
  r.item_name,
  at.name            as type_name,
  r.urgency,
  r.requested_amount,
  r.approved_amount,
  r.actual_amount,
  r.doc_status,
  r.pay_status,
  r.approve_status,
  r.reject_reason,
  r.reject_note,
  r.job_status,
  r.expected_done_date,
  r.fixed_date       as done_date,
  r.created_by,
  r.created_by_name,
  r.note,
  r.created_at
from public.pr_repairs r
left join public.companies      co on co.id = r.company_id
left join public.branches       br on br.id = r.branch_id
left join public.pr_asset_types at on at.id = r.asset_type_id
union all
select
  'purchase'::text   as kind,
  p.id,
  p.doc_no,
  p.request_date     as doc_date,
  p.company_id,
  co.name            as company_name,
  p.branch_id,
  br.name            as branch_name,
  p.item_name,
  mt.name            as type_name,
  p.urgency,
  p.requested_amount,
  p.approved_amount,
  p.actual_amount,
  p.doc_status,
  p.pay_status,
  p.approve_status,
  p.reject_reason,
  p.reject_note,
  null::pr_job_status as job_status,
  null::date          as expected_done_date,
  p.received_date     as done_date,
  p.created_by,
  p.created_by_name,
  p.note,
  p.created_at
from public.pr_purchases p
left join public.companies         co on co.id = p.company_id
left join public.branches          br on br.id = p.branch_id
left join public.pr_material_types mt on mt.id = p.material_type_id;

revoke all on public.v_pr_docs from anon, authenticated;

-- ---------- ข้อมูลตั้งต้น: ประเภททรัพย์สิน (1.1.6) ----------
insert into public.pr_asset_types (code, name, sort_order) values
  ('AS01', 'เครื่องใช้ไฟฟ้า',          10),
  ('AS02', 'เครื่องคอมพิวเตอร์',       20),
  ('AS03', 'เครื่องปรับอากาศ',         30),
  ('AS04', 'เครื่องใช้ในครัว',          40),
  ('AS05', 'เครื่องใช้ในคาเฟ่',         50),
  ('AS06', 'เครื่องมืออุปกรณ์ซ่อมรถ',   60),
  ('AS07', 'อุปกรณ์การตลาด',           70),
  ('AS08', 'เครื่องใช้สำนักงาน',        80),
  ('AS09', 'อาคาร',                    90),
  ('AS10', 'ต้นไม้',                  100),
  ('AS11', 'ประตูกระจกหน้าต่าง',      110),
  ('AS12', 'อื่นๆ',                   120)
on conflict (code) do update
  set name       = excluded.name,
      sort_order = excluded.sort_order;

-- ---------- ข้อมูลตั้งต้น: ประเภทวัสดุ (1.3.8) ----------
insert into public.pr_material_types (code, name, sort_order) values
  ('MT01', 'เครื่องใช้ไฟฟ้า',          10),
  ('MT02', 'เครื่องคอมพิวเตอร์',       20),
  ('MT03', 'เครื่องปรับอากาศ',         30),
  ('MT04', 'เครื่องใช้ในครัว',          40),
  ('MT05', 'เครื่องใช้ในคาเฟ่',         50),
  ('MT06', 'เครื่องมืออุปกรณ์ซ่อมรถ',   60),
  ('MT07', 'อุปกรณ์การตลาด',           70),
  ('MT08', 'เครื่องใช้สำนักงาน',        80),
  ('MT09', 'อุปกรณ์ก่อสร้าง',          90),
  ('MT10', 'อื่นๆ',                   100)
on conflict (code) do update
  set name       = excluded.name,
      sort_order = excluded.sort_order;

-- ---------- ลงทะเบียนโปรแกรมและเมนู ----------
insert into public.programs (code, name, description, path, icon, sort_order) values
  ('PR', 'ระบบจัดซื้อจัดจ้างแจ้งซ่อม',
         'แจ้งขอซ่อม ขอจัดซื้อ อนุมัติ บันทึกจ่ายเงิน พร้อมสอบถามและติดตามสถานะงาน',
         '/procurement', '🛠️', 50)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('PR_REPAIR',        '1.1 บันทึกแจ้งซ่อม',           '/procurement/repairs',                'entry',     10),
  ('PR_REPAIR_UPD',    '1.2 Update งานซ่อม',           '/procurement/updates',                'entry',     20),
  ('PR_PURCHASE',      '2.1 บันทึกขอจัดซื้อ',           '/procurement/purchases',              'entry',     30),
  ('PR_APPROVE',       '3.1 อนุมัติซ่อม/จัดซื้อ',        '/procurement/approvals',              'entry',     40),
  ('PR_PAYMENT',       '4.1 บันทึกประกอบการจ่ายเงิน',   '/procurement/payments',               'entry',     50),
  ('PR_SEARCH',        '5. สอบถามงานซ่อม/งานขอซื้อ',    '/procurement/search',                 'inquiry',   60),
  ('PR_DASH',          '6. Dashboard ติดตามงานซ่อม',    '/procurement/dashboard',              'dashboard', 70),
  ('PR_ASSET_TYPE',    'ตั้งค่า ประเภททรัพย์สิน',        '/procurement/setup/asset-types',      'setting',   80),
  ('PR_MATERIAL_TYPE', 'ตั้งค่า ประเภทวัสดุ',            '/procurement/setup/material-types',   'setting',   90)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'PR'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้นตามระดับ:
--   หน้าจอบันทึก (แจ้งซ่อม/update/ขอซื้อ) — ทุกระดับบันทึกและแก้ไขได้ ลบได้เฉพาะ admin
--   หน้าจออนุมัติ — เฉพาะ admin และผู้ช่วย admin (ระดับอื่นไม่เห็นเมนูนี้เลย)
--   หน้าจอจ่ายเงิน — admin/ผู้ช่วย admin บันทึกได้ ระดับอื่นดูอย่างเดียว
--   หน้าจอสอบถาม/dashboard — ทุกระดับดูอย่างเดียว
--   หน้าจอตั้งค่า — admin/ผู้ช่วย admin แก้ได้ ระดับอื่นดูอย่างเดียว
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  -- อ่าน: ทุกเมนูเปิดให้ทุกระดับ ยกเว้นหน้าอนุมัติที่จำกัดเฉพาะผู้ดูแล
  case when m.code = 'PR_APPROVE' then lvl.level in ('admin', 'assistant_admin') else true end,
  -- เพิ่ม
  case
    when m.code in ('PR_REPAIR', 'PR_REPAIR_UPD', 'PR_PURCHASE') then true
    when m.code in ('PR_APPROVE', 'PR_PAYMENT', 'PR_ASSET_TYPE', 'PR_MATERIAL_TYPE')
      then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  -- แก้ไข
  case
    when m.code in ('PR_REPAIR', 'PR_REPAIR_UPD', 'PR_PURCHASE') then true
    when m.code in ('PR_PAYMENT', 'PR_ASSET_TYPE', 'PR_MATERIAL_TYPE')
      then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  -- ลบ (เฉพาะ admin และเฉพาะเมนูที่มีข้อมูลให้ลบ)
  m.code in ('PR_REPAIR', 'PR_REPAIR_UPD', 'PR_PURCHASE', 'PR_PAYMENT',
             'PR_ASSET_TYPE', 'PR_MATERIAL_TYPE')
    and lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in (
  'PR_REPAIR', 'PR_REPAIR_UPD', 'PR_PURCHASE', 'PR_APPROVE', 'PR_PAYMENT',
  'PR_SEARCH', 'PR_DASH', 'PR_ASSET_TYPE', 'PR_MATERIAL_TYPE'
)
on conflict (level, menu_id) do nothing;

-- ให้สิทธิ์เข้าโปรแกรมกับผู้ดูแลระบบไว้ก่อน คนอื่นเพิ่มทีหลังที่ /core/program-users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'PR' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;
