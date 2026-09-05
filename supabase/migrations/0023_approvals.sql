-- ============================================================
-- ระบบอนุมัติกลาง (โปรแกรม APV) — ที่เดียวที่ผู้จัดการ/ผู้บริหารกดอนุมัติงานทุกเรื่อง
--
--   apv_types          : ทะเบียนประเภทเรื่องที่ต้องขออนุมัติ (แอดมินเพิ่ม/แก้เองได้จากหน้าจอ)
--   apv_requests       : ใบขออนุมัติ (โครงกลาง ใช้ได้ทุกเรื่อง)
--   apv_decisions      : ประวัติการพิจารณา เก็บทุกครั้ง วัน-เวลา ชื่อผู้อนุมัติ (append-only)
--   apv_limits         : กฎอำนาจอนุมัติ — ใครอนุมัติได้ถึงวงเงินเท่าไร (ปรับได้ตลอด)
--   apv_reject_reasons : เหตุผลการไม่อนุมัติ (แก้ได้จากหน้าจอ)
--   apv_files          : ไฟล์/รูปแนบใบขอ
--
-- หลักการสำคัญ
--   1. ประเภทเรื่องเป็น "ข้อมูล" ไม่ใช่ "โค้ด" — เพิ่มเรื่องใหม่ไม่ต้องแก้ฐานข้อมูล
--   2. โมดูลอื่นเสียบเข้ามาผ่าน source_table/source_id (ไม่ใช้ FK จะได้ไม่ต้องแก้ตารางนี้ทุกครั้ง)
--      ต่างจาก pr_approvals เดิมที่ต้องเพิ่มคอลัมน์ FK ทุกครั้งที่มีเอกสารชนิดใหม่
--   3. อนุมัติ 2 ชั้น: เกินวงเงินของตัวเอง กดอนุมัติไม่ได้ ทำได้แค่ "เสนอ" ขึ้นผู้มีอำนาจสูงกว่า
--   4. สิทธิ์แยกกัน 2 ชั้น: สิทธิ์เมนู = เข้าหน้าจอได้ไหม · apv_limits = อนุมัติได้แค่ไหน
--
-- รันต่อจาก 0022 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- ENUM ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'apv_status') then
    create type apv_status as enum (
      'pending',    -- รออนุมัติ
      'endorsed',   -- หัวหน้าเสนอขึ้นมาแล้ว รอผู้มีอำนาจสูงกว่าตัดสิน
      'approved',   -- อนุมัติตามที่ขอ
      'partial',    -- อนุมัติบางส่วน
      'rejected',   -- ไม่อนุมัติ
      'cancelled'   -- ผู้ขอยกเลิกเอง
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'apv_decision') then
    create type apv_decision as enum (
      'approve',    -- อนุมัติตามที่ขอ
      'partial',    -- อนุมัติบางส่วน
      'reject',     -- ไม่อนุมัติ
      'endorse'     -- เกินอำนาจตัวเอง เสนอต่อผู้มีอำนาจสูงกว่า
    );
  end if;
end
$$;

-- ---------- ประเภทเรื่องที่ต้องขออนุมัติ ----------
create table if not exists public.apv_types (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  description   text,
  -- โปรแกรมต้นทางของเรื่องนี้ (null = เรื่องทั่วไปที่ไม่ผูกกับโปรแกรมไหน)
  program_id    uuid references public.programs (id) on delete set null,
  -- เรื่องนี้มีจำนวนเงิน/จำนวนหน่วยให้อนุมัติไหม (ขอลาหยุด = ไม่มี จึงไม่ต้องตรวจวงเงิน)
  has_amount    boolean not null default true,
  amount_label  text not null default 'จำนวนเงิน (บาท)',
  allow_partial boolean not null default true,
  -- true = ยื่นผ่านฟอร์มกลางได้ · false = รับเรื่องจากโมดูลอื่นเท่านั้น
  form_enabled  boolean not null default true,
  icon          text,
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- เหตุผลการไม่อนุมัติ ----------
create table if not exists public.apv_reject_reasons (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- ใบขออนุมัติ ----------
create table if not exists public.apv_requests (
  id               uuid primary key default gen_random_uuid(),
  doc_no           text not null unique,                                        -- AV-2569-0001
  type_id          uuid not null references public.apv_types (id) on delete restrict,
  company_id       uuid references public.companies (id) on delete set null,
  branch_id        uuid references public.branches (id) on delete set null,
  requester_id     uuid references public.employees (id) on delete set null,
  requester_name   text not null,                                               -- snapshot กันชื่อหายเมื่อลบบัญชี
  subject          text not null,                                               -- เรื่องที่ขอ
  detail           text,
  requested_amount numeric(12, 2) not null default 0,
  approved_amount  numeric(12, 2) not null default 0,
  status           apv_status not null default 'pending',
  request_date     date not null default current_date,
  needed_by        date,                                                        -- ต้องการภายในวันที่ (ใช้เรียงความเร่งด่วน)
  -- ผลการตัดสินขั้นสุดท้าย (ประวัติทุกครั้งอยู่ที่ apv_decisions)
  decided_at       timestamptz,
  decided_by       uuid references public.employees (id) on delete set null,
  decided_by_name  text,
  -- จุดเสียบโมดูลอื่น: ไม่ใช้ FK เพื่อให้โมดูลใหม่ต่อเข้ามาได้โดยไม่ต้องแก้ตารางนี้
  source_table     text,
  source_id        uuid,
  source_url       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_apv_req_status on public.apv_requests (status, needed_by);
create index if not exists idx_apv_req_type on public.apv_requests (type_id);
create index if not exists idx_apv_req_requester on public.apv_requests (requester_id);
create index if not exists idx_apv_req_company on public.apv_requests (company_id, branch_id);

-- โมดูลอื่นสร้างใบขอซ้ำจากเอกสารเดิมไม่ได้
create unique index if not exists idx_apv_req_source
  on public.apv_requests (source_table, source_id)
  where source_table is not null and source_id is not null;

-- ---------- ประวัติการพิจารณา (เพิ่มอย่างเดียว ไม่แก้ไม่ลบ) ----------
create table if not exists public.apv_decisions (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.apv_requests (id) on delete cascade,
  seq             int not null default 1,                                       -- ครั้งที่พิจารณา
  decision        apv_decision not null,
  approver_id     uuid references public.employees (id) on delete set null,
  approver_name   text not null,                                                -- snapshot
  approver_level  access_level,                                                 -- ระดับ ณ เวลาที่ตัดสิน
  approved_amount numeric(12, 2) not null default 0,
  reason_id       uuid references public.apv_reject_reasons (id) on delete set null,
  note            text,
  decided_at      timestamptz not null default now(),                           -- วันที่ + เวลา
  -- วงเงินที่คนนี้มี ณ ตอนตัดสิน (null = ไม่จำกัด) เก็บไว้ตรวจย้อนหลังว่าตัดสินในอำนาจจริง
  authority_limit numeric(12, 2),
  created_at      timestamptz not null default now()
);

create index if not exists idx_apv_dec_request on public.apv_decisions (request_id, seq);
create index if not exists idx_apv_dec_approver on public.apv_decisions (approver_id, decided_at desc);

-- ---------- กฎอำนาจอนุมัติ ----------
-- ระบุได้ 2 แบบ: ตามระดับ (ใช้กับทุกคนในระดับนั้น) หรือเจาะจงรายคน (ทับค่าของระดับ)
-- ความเฉพาะเจาะจงมากกว่าชนะ: user+type > user(ทุกเรื่อง) > level+type > level(ทุกเรื่อง)
create table if not exists public.apv_limits (
  id         uuid primary key default gen_random_uuid(),
  level      access_level,
  user_id    uuid references public.employees (id) on delete cascade,
  type_id    uuid references public.apv_types (id) on delete cascade,           -- null = ทุกประเภทเรื่อง
  company_id uuid references public.companies (id) on delete cascade,           -- null = ทุกบริษัท
  max_amount numeric(12, 2),                                                    -- null = ไม่จำกัดวงเงิน
  can_reject boolean not null default true,
  is_final   boolean not null default false,                                    -- ตัดสินขั้นสุดท้ายได้ทุกจำนวน
  note       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apv_limits_target_required check (level is not null or user_id is not null)
);

create index if not exists idx_apv_limits_lookup on public.apv_limits (is_active, user_id, level);

-- ---------- ไฟล์แนบ ----------
create table if not exists public.apv_files (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.apv_requests (id) on delete cascade,
  file_path  text not null,
  file_name  text,
  created_at timestamptz not null default now()
);

create index if not exists idx_apv_files_request on public.apv_files (request_id);

-- ---------- RLS: ปิดทุกทาง เข้าผ่าน service role เท่านั้น ----------
alter table public.apv_types          enable row level security;
alter table public.apv_reject_reasons enable row level security;
alter table public.apv_requests       enable row level security;
alter table public.apv_decisions      enable row level security;
alter table public.apv_limits         enable row level security;
alter table public.apv_files          enable row level security;

-- ---------- trigger: updated_at ----------
drop trigger if exists trg_apv_types_updated on public.apv_types;
create trigger trg_apv_types_updated before update on public.apv_types
  for each row execute function public.set_updated_at();

drop trigger if exists trg_apv_requests_updated on public.apv_requests;
create trigger trg_apv_requests_updated before update on public.apv_requests
  for each row execute function public.set_updated_at();

drop trigger if exists trg_apv_limits_updated on public.apv_limits;
create trigger trg_apv_limits_updated before update on public.apv_limits
  for each row execute function public.set_updated_at();

-- ---------- View: ใบขอพร้อมชื่อที่ resolve แล้ว ----------
drop view if exists public.v_apv_requests;

create view public.v_apv_requests as
select
  r.*,
  t.code        as type_code,
  t.name        as type_name,
  t.icon        as type_icon,
  t.has_amount,
  t.allow_partial,
  t.amount_label,
  co.name       as company_name,
  b.name        as branch_name,
  b.code        as branch_code,
  (select count(*) from public.apv_decisions d where d.request_id = r.id) as decision_count,
  (select d.note from public.apv_decisions d
    where d.request_id = r.id and d.decision = 'endorse'
    order by d.decided_at desc limit 1) as endorse_note,
  (select d.approver_name from public.apv_decisions d
    where d.request_id = r.id and d.decision = 'endorse'
    order by d.decided_at desc limit 1) as endorse_by_name
from public.apv_requests r
join public.apv_types t on t.id = r.type_id
left join public.companies co on co.id = r.company_id
left join public.branches b on b.id = r.branch_id;

revoke all on public.v_apv_requests from anon, authenticated;

-- ---------- ข้อมูลตั้งต้น: ประเภทเรื่อง ----------
-- 8 เรื่องแรกยื่นผ่านฟอร์มกลางได้ทันที (โมดูลเฉพาะทางยังไม่มี)
-- 2 เรื่องท้ายเตรียมไว้ให้โมดูลจัดซื้อ/แจ้งซ่อมย้ายมาเชื่อมทีหลัง จึงปิดฟอร์มกลางไว้ก่อน
insert into public.apv_types
  (code, name, description, has_amount, amount_label, allow_partial, form_enabled, icon, sort_order)
values
  ('LEAVE',      'ขอลาหยุด',              'ลาป่วย ลากิจ ลาพักร้อน',                    true,  'จำนวนวันลา',        true,  true,  '🌴', 10),
  ('SALARY_ADV', 'ขอเบิกเงินเดือนล่วงหน้า', 'ขอเบิกเงินเดือนก่อนถึงรอบจ่าย',              true,  'จำนวนเงิน (บาท)',   true,  true,  '💰', 20),
  ('SHIFT_SWAP', 'ขอสลับกะทำงาน',          'ขอแลกเวร/เปลี่ยนกะกับเพื่อนร่วมงาน',          false, 'จำนวน',            false, true,  '🔄', 30),
  ('MOTO_DISC',  'ขอส่วนลดการขาย (มอเตอร์ไซค์)', 'ส่วนลดพิเศษที่ให้ลูกค้านอกเหนือจากปกติ',  true,  'ส่วนลด (บาท)',      true,  true,  '🏍', 40),
  ('MOTO_GIFT',  'ขอของแถมพิเศษ (มอเตอร์ไซค์)',  'ของแถม/ของสมนาคุณนอกเหนือรายการปกติ',   true,  'มูลค่าของแถม (บาท)', true,  true,  '🎁', 50),
  ('HOTEL_DISC', 'ขอส่วนลดค่าห้อง (โรงแรม)',    'ส่วนลดค่าห้องพักให้ลูกค้า',              true,  'ส่วนลด (บาท)',      true,  true,  '🏨', 60),
  ('HOTEL_FREE', 'ขอห้องพักฟรี (โรงแรม)',       'ให้ห้องพักฟรี/อัปเกรดห้องให้ลูกค้า',       true,  'มูลค่าห้อง (บาท)',   true,  true,  '🛏', 70),
  ('HOTEL_MOVE', 'ขอย้ายห้องพัก (โรงแรม)',      'ย้ายห้องให้ลูกค้าหลังเช็คอินแล้ว',         false, 'จำนวน',            false, true,  '🔑', 80),
  ('PR_REPAIR',  'ใบขอซ่อม (จัดซื้อ/ซ่อม)',      'เชื่อมจากโมดูลจัดซื้อจัดจ้างแจ้งซ่อม',      true,  'จำนวนเงิน (บาท)',   true,  false, '🛠', 90),
  ('PR_PURCHASE','ใบขอจัดซื้อ (จัดซื้อ/ซ่อม)',    'เชื่อมจากโมดูลจัดซื้อจัดจ้างแจ้งซ่อม',      true,  'จำนวนเงิน (บาท)',   true,  false, '🧾', 100)
on conflict (code) do nothing;

-- ---------- ข้อมูลตั้งต้น: เหตุผลไม่อนุมัติ ----------
insert into public.apv_reject_reasons (code, name, sort_order) values
  ('BUDGET',     'งบประมาณไม่พอ',              10),
  ('PRICE_HIGH', 'ราคาสูงเกินไป',              20),
  ('NOT_URGENT', 'ยังไม่จำเป็นเร่งด่วน',        30),
  ('USE_OLD',    'ใช้ของเดิม/วิธีเดิมไปก่อนได้',  40),
  ('DOC_MISSING','เอกสารหรือรายละเอียดไม่ครบ',  50),
  ('FIND_OTHER', 'ให้หาทางเลือกอื่นมาเทียบก่อน', 60),
  ('OVER_POLICY','เกินเกณฑ์ที่บริษัทกำหนด',      70),
  ('OTHER',      'อื่น ๆ (ระบุในหมายเหตุ)',      99)
on conflict (code) do nothing;

-- ---------- ข้อมูลตั้งต้น: อำนาจอนุมัติตามระดับ (แก้ได้จากหน้าจอทีหลัง) ----------
insert into public.apv_limits (level, type_id, company_id, max_amount, can_reject, is_final, note)
select v.level::access_level, null, null, v.max_amount, true, v.is_final, v.note
from (values
  ('admin',           null::numeric, true,  'ผู้ดูแลระบบ — อนุมัติได้ทุกจำนวน ตัดสินขั้นสุดท้าย'),
  ('assistant_admin', 50000::numeric, true, 'ผู้ช่วยผู้ดูแลระบบ — อนุมัติได้ถึง 50,000 บาท'),
  ('supervisor',      5000::numeric, false, 'หัวหน้างาน — อนุมัติได้ถึง 5,000 บาท เกินกว่านี้ให้เสนอขึ้น'),
  ('user',            0::numeric,    false, 'ผู้ใช้งานทั่วไป — ยื่นเรื่องได้ แต่อนุมัติไม่ได้')
) as v(level, max_amount, is_final, note)
where not exists (
  select 1 from public.apv_limits l
  where l.level = v.level::access_level and l.user_id is null and l.type_id is null and l.company_id is null
);

-- ---------- ลงทะเบียนโปรแกรมและเมนู ----------
insert into public.programs (code, name, description, path, icon, sort_order) values
  ('APV', 'ระบบอนุมัติกลาง', 'ผู้จัดการ/ผู้บริหารอนุมัติงานทุกเรื่องในที่เดียว', '/approvals', '✅', 60)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('APV_INBOX',  '1. กล่องรออนุมัติ',        '/approvals',              'dashboard', 10),
  ('APV_NEW',    '2. ยื่นเรื่องขออนุมัติ',    '/approvals/new',          'entry',     20),
  ('APV_MINE',   '3. เรื่องของฉัน',          '/approvals/mine',         'inquiry',   30),
  ('APV_SEARCH', '4. สอบถามประวัติการอนุมัติ', '/approvals/search',       'inquiry',   40),
  ('APV_LIMITS', '5. ตั้งค่าอำนาจอนุมัติ',    '/approvals/setup/limits', 'setting',   50),
  ('APV_TYPES',  '6. ตั้งค่าประเภทเรื่อง',    '/approvals/setup/types',  'setting',   60)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'APV'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เมนูเริ่มต้น: ยื่นเรื่อง/ดูเรื่องของตัวเอง ทุกคนทำได้ ·
-- กล่องอนุมัติกับสอบถามเปิดให้ระดับหัวหน้าขึ้นไป · ตั้งค่าเฉพาะผู้ดูแล
-- (อำนาจว่าอนุมัติได้ถึงเท่าไร คุมแยกที่ apv_limits ไม่ใช่ที่นี่)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  -- อ่าน
  case
    when m.code in ('APV_NEW', 'APV_MINE') then true
    when m.code in ('APV_INBOX', 'APV_SEARCH')
      then lvl.level in ('admin', 'assistant_admin', 'supervisor')
    else lvl.level in ('admin', 'assistant_admin')
  end,
  -- เพิ่ม (สำหรับ APV_INBOX คือ "ตัดสินเรื่องได้")
  case
    when m.code in ('APV_NEW', 'APV_MINE') then true
    when m.code = 'APV_INBOX' then lvl.level in ('admin', 'assistant_admin', 'supervisor')
    when m.code in ('APV_LIMITS', 'APV_TYPES') then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  -- แก้ไข
  case
    when m.code = 'APV_NEW' then true
    when m.code in ('APV_LIMITS', 'APV_TYPES') then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  -- ลบ (เฉพาะ admin และเฉพาะเมนูที่มีข้อมูลให้ลบ)
  lvl.level = 'admin' and m.code in ('APV_NEW', 'APV_LIMITS', 'APV_TYPES')
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('APV_INBOX', 'APV_NEW', 'APV_MINE', 'APV_SEARCH', 'APV_LIMITS', 'APV_TYPES')
on conflict (level, menu_id) do nothing;

-- เปิดสิทธิ์เข้าโปรแกรมให้ผู้ดูแลไว้ก่อน คนอื่นเพิ่มทีหลังที่ /core/program-users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'APV' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;
