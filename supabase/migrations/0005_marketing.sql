-- ============================================================
-- ระบบบันทึกกิจกรรมการตลาด + คุมการเบิกเงินค่าส่งเสริมการขายกับบริษัทรถ
--
--   mkt_staff           : พนักงานการตลาด (ผู้บันทึก / ผู้ส่งเบิก / ผู้รับเงิน)
--   mkt_companies       : บริษัทที่ขอเบิก
--   mkt_activity_types  : ประเภทกิจกรรม
--   mkt_activities      : ใบกิจกรรม (หน้าจอ 1) — เป็นแกนกลางของทั้งระบบ
--   mkt_activity_photos : รูปกิจกรรม สูงสุด 10 รูปต่อใบ
--   mkt_submissions     : บันทึกส่งเรื่องเบิกเงิน (หน้าจอ 2) — 1 ใบต่อ 1 กิจกรรม
--   mkt_receipts        : บันทึกรับเงิน (หน้าจอ 3) — 1 ใบต่อ 1 กิจกรรม
--
-- หลักการ:
--   * จำนวนเงินที่ได้รับโอนเก็บที่ mkt_receipts ที่เดียว ใบกิจกรรมไม่เก็บซ้ำ
--   * flow_status ของใบกิจกรรมมีผู้เขียนคนเดียวคือ db layer ฝั่ง server
--     (คำนวณจากฟังก์ชัน computeFlowStatus ใน src/lib/marketing.ts)
--   * เปิด RLS ทุกตารางและไม่สร้าง policy ให้ anon — เขียน/อ่านผ่าน service role เท่านั้น
-- ============================================================

do $$ begin
  create type mkt_active_status as enum ('active', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mkt_flow_status as enum ('draft', 'submitted', 'received');
exception when duplicate_object then null; end $$;

-- ---------- ข้อมูลหลัก (หน้าจอ 4) ----------

create table if not exists public.mkt_staff (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.mkt_companies (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.mkt_activity_types (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- เลขที่เอกสารแบบรันนิ่ง (MK-2569-0001) ----------

create table if not exists public.mkt_doc_counters (
  prefix text primary key,
  seq    int  not null default 0
);

create or replace function public.mkt_next_doc_no(be_year int)
returns text
language plpgsql
as $fn$
declare
  next_seq int;
begin
  insert into public.mkt_doc_counters (prefix, seq)
  values (be_year::text, 1)
  on conflict (prefix) do update set seq = public.mkt_doc_counters.seq + 1
  returning seq into next_seq;

  return 'MK-' || be_year::text || '-' || lpad(next_seq::text, 4, '0');
end;
$fn$;

-- ---------- ใบกิจกรรม (หน้าจอ 1) ----------

create table if not exists public.mkt_activities (
  id                  uuid primary key default gen_random_uuid(),
  doc_no              text not null unique,
  activity_date       date not null,
  title               text not null,
  activity_type_id    uuid references public.mkt_activity_types(id) on delete set null,
  company_id          uuid references public.mkt_companies(id) on delete set null,
  created_by_staff_id uuid references public.mkt_staff(id) on delete set null,
  memo                text,
  request_amount      numeric(14,2) not null default 0,   -- จำนวนเงินที่ขอเบิก
  approved_amount     numeric(14,2),                      -- จำนวนเงินที่อนุมัติเบิก
  active_status       mkt_active_status not null default 'active',
  flow_status         mkt_flow_status  not null default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_mkt_activities_date    on public.mkt_activities (activity_date desc);
create index if not exists idx_mkt_activities_company on public.mkt_activities (company_id);
create index if not exists idx_mkt_activities_flow    on public.mkt_activities (flow_status);

drop trigger if exists trg_mkt_activities_updated on public.mkt_activities;
create trigger trg_mkt_activities_updated before update on public.mkt_activities
  for each row execute function public.set_updated_at();

create table if not exists public.mkt_activity_photos (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.mkt_activities(id) on delete cascade,
  path        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_mkt_photos_activity on public.mkt_activity_photos (activity_id, sort_order);

-- ---------- บันทึกส่งเรื่องเบิกเงิน (หน้าจอ 2) ----------

create table if not exists public.mkt_submissions (
  id                    uuid primary key default gen_random_uuid(),
  activity_id           uuid not null unique references public.mkt_activities(id) on delete cascade,
  submitted_by_staff_id uuid references public.mkt_staff(id) on delete set null,
  submit_date           date not null,
  postal_no             text,                 -- เลขที่ไปรษณีย์
  letter_photo_path     text,                 -- รูปจดหมายที่ส่งเบิกเงิน
  ack_photo_path        text,                 -- รูปใบลงทะเบียนตอบรับไปรษณีย์
  active_status         mkt_active_status not null default 'active',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists trg_mkt_submissions_updated on public.mkt_submissions;
create trigger trg_mkt_submissions_updated before update on public.mkt_submissions
  for each row execute function public.set_updated_at();

-- ---------- บันทึกรับเงิน (หน้าจอ 3) ----------

create table if not exists public.mkt_receipts (
  id                   uuid primary key default gen_random_uuid(),
  activity_id          uuid not null unique references public.mkt_activities(id) on delete cascade,
  received_by_staff_id uuid references public.mkt_staff(id) on delete set null,
  receive_date         date not null,
  receipt_no           text,                  -- เลขที่ใบเสร็จ
  received_amount      numeric(14,2) not null default 0,
  active_status        mkt_active_status not null default 'active',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists trg_mkt_receipts_updated on public.mkt_receipts;
create trigger trg_mkt_receipts_updated before update on public.mkt_receipts
  for each row execute function public.set_updated_at();

-- ---------- RLS: ปิดตายทุกตาราง เข้าถึงผ่าน service role เท่านั้น ----------

alter table public.mkt_staff           enable row level security;
alter table public.mkt_companies       enable row level security;
alter table public.mkt_activity_types  enable row level security;
alter table public.mkt_doc_counters    enable row level security;
alter table public.mkt_activities      enable row level security;
alter table public.mkt_activity_photos enable row level security;
alter table public.mkt_submissions     enable row level security;
alter table public.mkt_receipts        enable row level security;

-- ---------- view รวมข้อมูลสำหรับหน้าสอบถาม / dashboard ----------

create or replace view public.v_mkt_activities as
select
  a.id,
  a.doc_no,
  a.activity_date,
  a.title,
  a.memo,
  a.request_amount,
  a.approved_amount,
  a.active_status,
  a.flow_status,
  a.activity_type_id,
  t.name  as activity_type_name,
  a.company_id,
  c.name  as company_name,
  a.created_by_staff_id,
  s.name  as created_by_name,
  sub.id            as submission_id,
  sub.submit_date,
  sub.postal_no,
  sub.letter_photo_path,
  sub.ack_photo_path,
  sub.active_status as submission_status,
  ss.name           as submitted_by_name,
  rc.id             as receipt_id,
  rc.receive_date,
  rc.receipt_no,
  rc.received_amount,
  rc.active_status  as receipt_status,
  rs.name           as received_by_name,
  a.created_at,
  a.updated_at
from public.mkt_activities a
left join public.mkt_activity_types t on t.id = a.activity_type_id
left join public.mkt_companies      c on c.id = a.company_id
left join public.mkt_staff          s on s.id = a.created_by_staff_id
left join public.mkt_submissions  sub on sub.activity_id = a.id
left join public.mkt_staff         ss on ss.id = sub.submitted_by_staff_id
left join public.mkt_receipts       rc on rc.activity_id = a.id
left join public.mkt_staff         rs on rs.id = rc.received_by_staff_id;

-- ---------- ข้อมูลตั้งต้น (รันซ้ำได้) ----------

insert into public.mkt_activity_types (code, name) values
  ('AT01', 'ออกบูธแสดงรถ'),
  ('AT02', 'โรดโชว์'),
  ('AT03', 'ทดลองขับ'),
  ('AT04', 'งานอีเวนต์ในห้าง'),
  ('AT05', 'สื่อโฆษณา/ป้ายประชาสัมพันธ์'),
  ('AT06', 'ของแถม/ของสมนาคุณ'),
  ('AT07', 'กิจกรรมลูกค้าสัมพันธ์'),
  ('AT99', 'อื่น ๆ')
on conflict (code) do nothing;

-- คัดชื่อพนักงานที่มีอยู่แล้วในระบบลงเวลามาเป็นตัวตั้งต้น (รันซ้ำแล้วไม่เพิ่มซ้ำ)
insert into public.mkt_staff (code, name)
select e.emp_code, e.full_name
from public.employees e
where e.is_active
on conflict (code) do nothing;
