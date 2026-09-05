-- ============================================================
-- ระบบขอลา / ขอเบิกเงินเดือน (โปรแกรม HR)
--
--   hr_leave_types      : ประเภทการลา + เงื่อนไขการใช้สิทธิ์ (แอดมินแก้เองได้จากหน้าจอตั้งค่า)
--   hr_leave_requests   : ใบแจ้งลา / แจ้งหยุดงาน / แจ้งเข้างานสาย
--   hr_leave_files      : ไฟล์แนบของใบแจ้งลา (รวมใบรับรองแพทย์)
--   hr_advance_requests : ใบขอเบิกเงินเดือนล่วงหน้า
--
-- หลักการสำคัญ
--   1. "เงื่อนไขการใช้สิทธิ์" เป็นข้อมูลในตาราง ไม่ใช่ค่าคงที่ในโค้ด —
--      ผู้ใช้ปรับจำนวนวันแจ้งล่วงหน้า อายุงานขั้นต่ำ เวลาตัด และตัวคูณค่าปรับได้เองทุกเมื่อ
--   2. ผลการตรวจเงื่อนไข ณ วันที่ยื่น (แจ้งช้าไหม ถือเป็นขาดงานไหม ส่งใบรับรองแพทย์ภายในวันไหน)
--      ถูก "แช่แข็ง" ลงในใบแจ้งตอนบันทึก การแก้เงื่อนไขภายหลังจึงไม่ย้อนไปเปลี่ยนใบเก่า
--   3. หน้าจออนุมัติของโมดูลนี้ใช้ประตูรหัสผ่านตัวเดียวกับระบบอนุมัติกลาง (cookie ผู้อนุมัติ)
--      ผ่านที่ไหนแล้วใช้ได้ทุกที่ภายใน 30 นาที
--   4. เชื่อมเข้ากล่องรออนุมัติกลางแบบเดียวกับโมดูลจัดซื้อ คือให้หน้ากลาง "อ่านและลิงก์มา"
--      ไม่คัดลอกสถานะไปเก็บซ้ำ สถานะจึงมีเจ้าของเพียงตารางเดียว
--
-- รันต่อจาก 0023 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- ENUM ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'hr_leave_status') then
    create type hr_leave_status as enum (
      'pending',    -- รออนุมัติ
      'need_docs',  -- อนุมัติแต่ขอหลักฐานเพิ่ม
      'approved',   -- อนุมัติ
      'rejected',   -- ไม่อนุมัติ
      'cancelled'   -- ผู้แจ้งยกเลิกเอง
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'hr_advance_status') then
    create type hr_advance_status as enum (
      'pending',    -- รออนุมัติ
      'partial',    -- อนุมัติบางส่วน
      'approved',   -- อนุมัติ
      'rejected',   -- ไม่อนุมัติ
      'cancelled'   -- ผู้ขอยกเลิกเอง
    );
  end if;
end
$$;

-- ---------- ประเภทการลา + เงื่อนไขการใช้สิทธิ์ ----------
create table if not exists public.hr_leave_types (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique,
  name                    text not null,
  -- คำอธิบายสิทธิ์ และเงื่อนไขการใช้สิทธิ์ (ข้อความอิสระ แก้ไขได้ภายหลัง แสดงให้พนักงานอ่านตอนยื่น)
  description             text,
  conditions              text,
  -- ต้องแจ้งล่วงหน้ากี่วัน (0 = แจ้งวันเดียวกันได้)
  advance_days            int not null default 0,
  -- แจ้งไม่ทันตาม advance_days แล้วถือเป็นขาดงานหรือไม่
  late_becomes_absent     boolean not null default false,
  -- อายุงานขั้นต่ำที่ใช้สิทธิ์นี้ได้ (เดือน) — 12 = ต้องทำงานครบ 1 ปี
  min_service_months      int not null default 0,
  -- ต้องแนบใบรับรองแพทย์ภายในกี่วันนับจากวันที่แจ้ง
  require_medical_cert    boolean not null default false,
  cert_within_days        int not null default 3,
  -- ต้องแจ้งก่อนเวลานี้ของวันที่เริ่มลา/หยุด (null = ไม่มีเวลาตัด)
  same_day_cutoff         time,
  -- แจ้งหลังเวลาตัดแล้วโดนหักเงินกี่เท่าของค่าจ้าง (0 = ไม่หัก)
  late_penalty_multiplier numeric(4, 2) not null default 0,
  -- โควตาต่อปี (null = ไม่จำกัด) ใช้เตือนตอนยื่น ไม่บล็อก
  max_days_per_year       int,
  -- ระบุช่วงวันที่ลาไหม / ต้องระบุเวลาที่จะมาถึงไหม (แจ้งเข้างานสายใช้เวลาแทนช่วงวัน)
  needs_date_range        boolean not null default true,
  needs_arrival_time      boolean not null default false,
  is_paid                 boolean not null default true,
  icon                    text,
  sort_order              int not null default 0,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------- ใบแจ้งลา / หยุดงาน / เข้างานสาย ----------
create table if not exists public.hr_leave_requests (
  id                 uuid primary key default gen_random_uuid(),
  doc_no             text not null unique,                                       -- 1. เลขที่ (LV-2569-0001)
  request_date       date not null default current_date,                         -- 2. วันที่
  reported_at        timestamptz not null default now(),                         -- 3. เวลาที่แจ้ง (เวลาจาก server)
  employee_id        uuid references public.employees (id) on delete set null,   -- 4. ผู้แจ้ง (มาจาก login)
  employee_name      text not null,                                              --    snapshot กันชื่อหายเมื่อลบบัญชี
  company_id         uuid references public.companies (id) on delete set null,
  branch_id          uuid references public.branches (id) on delete set null,
  type_id            uuid not null references public.hr_leave_types (id) on delete restrict,  -- 6. ประเภทการลา
  detail             text,                                                       -- 5. รายละเอียด
  start_date         date not null,
  end_date           date not null,
  total_days         numeric(5, 1) not null default 1,
  arrival_time       time,                                                       -- เข้างานสาย: คาดว่าจะถึงกี่โมง
  status             hr_leave_status not null default 'pending',                 -- 7. สถานะ
  -- 8. ผู้อนุมัติ (มาจาก login ของผู้อนุมัติ)
  decided_at         timestamptz,
  decided_by         uuid references public.employees (id) on delete set null,
  decided_by_name    text,
  decision_note      text,
  reason_id          uuid references public.apv_reject_reasons (id) on delete set null,
  -- ผลการตรวจเงื่อนไข ณ วันที่ยื่น (แช่แข็งไว้ ไม่คำนวณใหม่เมื่อแก้เงื่อนไขทีหลัง)
  notice_days        int not null default 0,                                     -- แจ้งล่วงหน้ากี่วัน
  service_months     int,                                                        -- อายุงาน ณ วันยื่น (เดือน)
  counts_as_absent   boolean not null default false,                             -- แจ้งไม่ทัน → ถือเป็นขาดงาน
  is_late_notice     boolean not null default false,                             -- แจ้งหลังเวลาตัด
  penalty_multiplier numeric(4, 2) not null default 0,                           -- หักเงินกี่เท่าของค่าจ้าง
  cert_due_date      date,                                                       -- ส่งใบรับรองแพทย์ภายในวันที่
  cert_received      boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint hr_leave_dates check (end_date >= start_date)
);

create index if not exists idx_hr_leave_status on public.hr_leave_requests (status, request_date desc);
create index if not exists idx_hr_leave_employee on public.hr_leave_requests (employee_id, request_date desc);
create index if not exists idx_hr_leave_company on public.hr_leave_requests (company_id, branch_id);
create index if not exists idx_hr_leave_type on public.hr_leave_requests (type_id);

-- ---------- ไฟล์แนบ (9. เอกสารเพิ่มเติม / ใบรับรองแพทย์) ----------
create table if not exists public.hr_leave_files (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.hr_leave_requests (id) on delete cascade,
  -- 'attach' = เอกสารประกอบทั่วไป · 'cert' = ใบรับรองแพทย์
  kind        text not null default 'attach',
  file_path   text not null,
  file_name   text,
  mime        text,
  size_bytes  bigint,
  uploaded_by uuid references public.employees (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_hr_leave_files_req on public.hr_leave_files (request_id);

-- ---------- ใบขอเบิกเงินเดือนล่วงหน้า ----------
create table if not exists public.hr_advance_requests (
  id              uuid primary key default gen_random_uuid(),
  doc_no          text not null unique,                                         -- 1. เลขที่ใบขอเบิก (AD-2569-0001)
  request_date    date not null default current_date,                           -- 2. วันที่ขอเบิก
  requested_at    timestamptz not null default now(),
  purpose         text not null,                                                -- 3. รายการขอเบิกเพื่อ
  detail          text,
  employee_id     uuid references public.employees (id) on delete set null,     -- 4. ผู้ขอเบิก (มาจาก login)
  employee_name   text not null,
  company_id      uuid references public.companies (id) on delete set null,
  branch_id       uuid references public.branches (id) on delete set null,
  amount          numeric(12, 2) not null default 0,                            -- 5. ยอดเงินที่ขอเบิก
  approved_amount numeric(12, 2) not null default 0,                            -- 6. ยอดเงินที่อนุมัติให้เบิก
  status          hr_advance_status not null default 'pending',                 -- 7. สถานะ
  -- 8. ผู้อนุมัติ (มาจาก login ของผู้อนุมัติ)
  decided_at      timestamptz,
  decided_by      uuid references public.employees (id) on delete set null,
  decided_by_name text,
  decision_note   text,
  reason_id       uuid references public.apv_reject_reasons (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint hr_advance_amount check (amount >= 0 and approved_amount >= 0)
);

create index if not exists idx_hr_adv_status on public.hr_advance_requests (status, request_date desc);
create index if not exists idx_hr_adv_employee on public.hr_advance_requests (employee_id, request_date desc);
create index if not exists idx_hr_adv_company on public.hr_advance_requests (company_id, branch_id);

-- ---------- RLS: ปิดทุกทาง เข้าผ่าน service role เท่านั้น ----------
alter table public.hr_leave_types      enable row level security;
alter table public.hr_leave_requests   enable row level security;
alter table public.hr_leave_files      enable row level security;
alter table public.hr_advance_requests enable row level security;

-- ---------- trigger: updated_at ----------
drop trigger if exists trg_hr_leave_types_updated on public.hr_leave_types;
create trigger trg_hr_leave_types_updated before update on public.hr_leave_types
  for each row execute function public.set_updated_at();

drop trigger if exists trg_hr_leave_req_updated on public.hr_leave_requests;
create trigger trg_hr_leave_req_updated before update on public.hr_leave_requests
  for each row execute function public.set_updated_at();

drop trigger if exists trg_hr_adv_req_updated on public.hr_advance_requests;
create trigger trg_hr_adv_req_updated before update on public.hr_advance_requests
  for each row execute function public.set_updated_at();

-- ---------- View: ใบแจ้งลาพร้อมชื่อที่ resolve แล้ว ----------
drop view if exists public.v_hr_leave_requests;

create view public.v_hr_leave_requests as
select
  r.*,
  t.code  as type_code,
  t.name  as type_name,
  t.icon  as type_icon,
  t.is_paid,
  t.require_medical_cert,
  t.needs_arrival_time,
  co.name as company_name,
  b.name  as branch_name,
  b.code  as branch_code,
  rr.name as reason_name,
  (select count(*) from public.hr_leave_files f where f.request_id = r.id) as file_count,
  (select count(*) from public.hr_leave_files f where f.request_id = r.id and f.kind = 'cert') as cert_count
from public.hr_leave_requests r
join public.hr_leave_types t on t.id = r.type_id
left join public.companies co on co.id = r.company_id
left join public.branches b on b.id = r.branch_id
left join public.apv_reject_reasons rr on rr.id = r.reason_id;

revoke all on public.v_hr_leave_requests from anon, authenticated;

-- ---------- View: ใบขอเบิกเงินพร้อมชื่อที่ resolve แล้ว ----------
drop view if exists public.v_hr_advance_requests;

create view public.v_hr_advance_requests as
select
  r.*,
  co.name as company_name,
  b.name  as branch_name,
  b.code  as branch_code,
  rr.name as reason_name
from public.hr_advance_requests r
left join public.companies co on co.id = r.company_id
left join public.branches b on b.id = r.branch_id
left join public.apv_reject_reasons rr on rr.id = r.reason_id;

revoke all on public.v_hr_advance_requests from anon, authenticated;

-- ---------- ข้อมูลตั้งต้น: ประเภทการลาและเงื่อนไข ----------
-- ตัวเลขทุกตัวด้านล่างเป็นค่าเริ่มต้นเท่านั้น ผู้ใช้แก้เองได้ที่เมนู "ตั้งค่าประเภทการลา"
insert into public.hr_leave_types (
  code, name, description, conditions,
  advance_days, late_becomes_absent, min_service_months,
  require_medical_cert, cert_within_days,
  same_day_cutoff, late_penalty_multiplier, max_days_per_year,
  needs_date_range, needs_arrival_time, is_paid, icon, sort_order
) values
  ('ABSENT', 'แจ้งหยุดงาน',
   'แจ้งว่าจะไม่มาทำงานในวันนั้น โดยไม่ได้ใช้สิทธิ์ลาประเภทอื่น',
   E'• ต้องแจ้งก่อนเวลา 08:00 น. ของวันที่หยุด\n• แจ้งหลัง 08:00 น. ถือว่าแจ้งช้า และถูกหักเงิน 2 เท่าของค่าจ้างวันนั้น\n• วันที่หยุดงานไม่ได้รับค่าจ้าง',
   0, false, 0, false, 3, '08:00', 2, null, true, false, false, '🚫', 10),

  ('LATE', 'แจ้งเข้างานสาย',
   'แจ้งล่วงหน้าว่าจะเข้างานสายกว่าเวลาปกติ',
   E'• ต้องแจ้งก่อนเวลา 08:00 น. ของวันที่จะเข้าสาย\n• แจ้งหลัง 08:00 น. ถือว่าแจ้งช้า และถูกหักเงิน 2 เท่าของค่าจ้างตามเวลาที่สาย\n• ระบุเวลาที่คาดว่าจะมาถึงทุกครั้ง',
   0, false, 0, false, 3, '08:00', 2, null, false, true, true, '⏰', 20),

  ('SICK', 'ลาป่วย',
   'ลาเนื่องจากเจ็บป่วย ใช้สิทธิ์ได้ทันทีไม่ต้องแจ้งล่วงหน้า',
   E'• แจ้งได้ทันทีในวันที่ป่วย ไม่ต้องแจ้งล่วงหน้า\n• ต้องแนบใบรับรองแพทย์ภายใน 3 วันนับจากวันที่แจ้งลา\n• ไม่ส่งใบรับรองแพทย์ตามกำหนด อาจถูกเปลี่ยนเป็นขาดงาน',
   0, false, 0, true, 3, null, 0, 30, true, false, true, '🤒', 30),

  ('PERSONAL', 'ลากิจ',
   'ลาเพื่อไปทำธุระส่วนตัวที่จำเป็น',
   E'• ต้องมีอายุงานครบ 1 ปีขึ้นไป\n• ต้องแจ้งล่วงหน้าอย่างน้อย 3 วัน\n• แจ้งล่วงหน้าไม่ครบ 3 วัน ถือว่าขาดงาน',
   3, true, 12, false, 3, null, 0, 6, true, false, true, '📋', 40),

  ('VACATION', 'ลาพักร้อน',
   'ใช้สิทธิ์วันหยุดพักผ่อนประจำปี',
   E'• ต้องมีอายุงานครบ 1 ปีขึ้นไป\n• ต้องแจ้งล่วงหน้าอย่างน้อย 3 วัน\n• แจ้งล่วงหน้าไม่ครบ 3 วัน ถือว่าขาดงาน',
   3, true, 12, false, 3, null, 0, 6, true, false, true, '🌴', 50),

  ('OTHER', 'อื่น ๆ',
   'กรณีที่ไม่เข้าประเภทใดข้างต้น เช่น ลาคลอด ลาบวช ลาอุปสมบท',
   E'• ระบุเหตุผลให้ชัดเจนในช่องรายละเอียด\n• แนบเอกสารประกอบถ้ามี\n• ผู้อนุมัติพิจารณาเป็นรายกรณี',
   0, false, 0, false, 3, null, 0, null, true, false, true, '📝', 90)
on conflict (code) do nothing;

-- ---------- ลงทะเบียนโปรแกรมและเมนู ----------
insert into public.programs (code, name, description, path, icon, sort_order) values
  ('HR', 'ระบบขอลา / ขอเบิกเงินเดือน',
   'พนักงานแจ้งลา แจ้งหยุดงาน แจ้งเข้างานสาย และขอเบิกเงินเดือนล่วงหน้า', '/hr', '🗓', 70)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('HR_LEAVE_NEW',     '1. แจ้งลา / หยุดงาน / เข้างานสาย', '/hr/leave/new',         'entry',     10),
  ('HR_LEAVE_MINE',    '2. ใบแจ้งลาของฉัน',                '/hr/leave',             'inquiry',   20),
  ('HR_ADV_NEW',       '3. ขอเบิกเงินเดือน',               '/hr/advance/new',       'entry',     30),
  ('HR_ADV_MINE',      '4. ใบขอเบิกของฉัน',                '/hr/advance',           'inquiry',   40),
  ('HR_LEAVE_APPROVE', '5. อนุมัติการลา',                  '/hr/approvals/leave',   'dashboard', 50),
  ('HR_ADV_APPROVE',   '6. อนุมัติขอเบิกเงิน',             '/hr/approvals/advance', 'dashboard', 60),
  ('HR_TYPES',         '7. ตั้งค่าประเภทการลา',            '/hr/setup/leave-types', 'setting',   70)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'HR'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เมนูเริ่มต้น: ยื่น/ดูของตัวเอง ทุกคนทำได้ ·
-- หน้าอนุมัติเปิดให้ระดับหัวหน้าขึ้นไป · ตั้งค่าประเภทการลาเฉพาะผู้ดูแล
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  -- อ่าน
  case
    when m.code in ('HR_LEAVE_NEW', 'HR_LEAVE_MINE', 'HR_ADV_NEW', 'HR_ADV_MINE') then true
    when m.code in ('HR_LEAVE_APPROVE', 'HR_ADV_APPROVE')
      then lvl.level in ('admin', 'assistant_admin', 'supervisor')
    else lvl.level in ('admin', 'assistant_admin')
  end,
  -- เพิ่ม (สำหรับหน้าอนุมัติ = ตัดสินเรื่องได้)
  case
    when m.code in ('HR_LEAVE_NEW', 'HR_LEAVE_MINE', 'HR_ADV_NEW', 'HR_ADV_MINE') then true
    when m.code in ('HR_LEAVE_APPROVE', 'HR_ADV_APPROVE')
      then lvl.level in ('admin', 'assistant_admin', 'supervisor')
    else lvl.level in ('admin', 'assistant_admin')
  end,
  -- แก้ไข
  case
    when m.code in ('HR_LEAVE_NEW', 'HR_ADV_NEW') then true
    when m.code = 'HR_TYPES' then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  -- ลบ (เฉพาะผู้ดูแลระบบ)
  lvl.level = 'admin' and m.code in ('HR_LEAVE_MINE', 'HR_ADV_MINE', 'HR_TYPES')
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in (
  'HR_LEAVE_NEW', 'HR_LEAVE_MINE', 'HR_ADV_NEW', 'HR_ADV_MINE',
  'HR_LEAVE_APPROVE', 'HR_ADV_APPROVE', 'HR_TYPES'
)
on conflict (level, menu_id) do nothing;

-- เปิดสิทธิ์เข้าโปรแกรมให้ผู้ดูแลไว้ก่อน คนอื่นเพิ่มทีหลังที่ /core/program-users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'HR' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;

-- ---------- ปิดฟอร์มกลางของเรื่องลา/เบิกเงิน ----------
-- สองเรื่องนี้มีหน้าจอเฉพาะของตัวเองแล้ว (โปรแกรม HR) จึงไม่ให้ยื่นซ้ำจากฟอร์มกลางอีก
-- เพื่อไม่ให้เกิดใบขอสองชุดของเรื่องเดียวกันอยู่คนละที่
update public.apv_types
   set form_enabled = false,
       description  = case code
         when 'LEAVE'      then 'ลาป่วย ลากิจ ลาพักร้อน — ยื่นที่โปรแกรมขอลา/ขอเบิกเงินเดือน'
         when 'SALARY_ADV' then 'ขอเบิกเงินเดือนก่อนถึงรอบจ่าย — ยื่นที่โปรแกรมขอลา/ขอเบิกเงินเดือน'
         else description
       end,
       program_id   = (select id from public.programs where code = 'HR')
 where code in ('LEAVE', 'SALARY_ADV');
