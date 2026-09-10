-- ============================================================================
-- 0061 — ระบบตรวจสอบบัญชี ธุรกิจมอเตอร์ไซค์ (โปรแกรม AUD)
--
--   aud_doc_types    : ทะเบียนเอกสารประกอบที่ต้องแนบ (บัตรประชาชน ทะเบียนบ้าน …) เพิ่ม/ลดเองได้
--   aud_check_types  : "รายการตรวจสอบ" ที่ระบบมีให้ตรวจ — ข้อ 1-3 มาเป็นค่าเบื้องต้น
--                      และผู้ใช้เพิ่มรายการของตัวเองได้ (ข้อ 4) โดยเลือกว่าจะมีช่วงไหนบ้าง
--   aud_doc_counters : ตัวนับเลขที่คุมงานแยกตามปี พ.ศ. (AUD-2569-0001)
--   aud_audits       : ใบคุมงานหนึ่งวัน = ผู้ตรวจสอบ + วันที่ทำงาน + บริษัท/สาขา
--   aud_checks       : รายการที่ตรวจในใบนั้น — หนึ่งแถวคือหนึ่งเอกสาร/หนึ่งเรื่องที่ตรวจ
--   aud_check_missing_docs : เอกสารที่ขาดของแต่ละรายการ (ข้อ 1.b.ii.1)
--
-- หลักการ:
--   * ทุกชนิดการตรวจ (ใบสั่งขาย · ใบเบิกเงินสดย่อย · กระทบยอดเงินสด · รายการที่ผู้ใช้เพิ่มเอง)
--     ใช้ตาราง aud_checks ตารางเดียวกัน ต่างกันแค่ kind และช่องที่เปิดใช้
--     → เพิ่มรายการตรวจใหม่ = เพิ่มแถวใน aud_check_types ไม่ต้องแก้โครงฐานข้อมูล
--   * aud_checks เป็น "ตารางคู่ขนาน" กับข้อมูลต้นทาง: ฝั่งขายยึด **เลขที่สัญญาขาย** (ref_no)
--     ที่ตรงกับ VIEW_SALEALL ใน Db2 · ฝั่งเงินสดย่อยยึด payment_id ของ pr_payments
--     ข้อมูลต้นทางถูก snapshot ไว้บนแถว (title/party/amount/extra) เพื่อให้ใบเก่าอ่านออกเสมอ
--     แม้ระบบต้นทางจะแก้ไขภายหลัง — และไม่ต้องยิง Db2 ซ้ำตอนเปิดรายงาน
--   * unique (kind, ref_no) เฉพาะฝั่งขาย/เงินสดย่อย → เอกสารหนึ่งใบถูกตรวจซ้ำสองใบคุมงานไม่ได้
--   * เปิด RLS ทุกตารางและไม่มี policy ให้ anon — อ่าน/เขียนผ่าน service role ฝั่ง server เท่านั้น
-- รันต่อจาก 0060 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================================

do $$
begin
  -- ชนิดของรายการตรวจ = แหล่งข้อมูลที่ดึงมาตรวจ
  --   sale    ใบสั่งขาย (ดึงจากระบบขาย Db2)
  --   payment ใบเบิกเงินสดย่อย (ดึงจากระบบขอซ่อมขอซื้อ pr_payments)
  --   cash    กระทบยอดเงินสดคงเหลือ/นำฝากธนาคาร (กรอกเอง)
  --   custom  รายการที่ผู้ใช้เพิ่มเอง (กรอกเอง)
  if not exists (select 1 from pg_type where typname = 'aud_check_kind') then
    create type aud_check_kind as enum ('sale', 'payment', 'cash', 'custom');
  end if;

  if not exists (select 1 from pg_type where typname = 'aud_status') then
    create type aud_status as enum ('draft', 'submitted', 'cancelled');
  end if;

  -- ผลการตรวจเอกสาร: ถูก / ผิด
  if not exists (select 1 from pg_type where typname = 'aud_result') then
    create type aud_result as enum ('pending', 'correct', 'wrong');
  end if;

  -- เอกสารประกอบ: ครบ / ไม่ครบ
  if not exists (select 1 from pg_type where typname = 'aud_doc_result') then
    create type aud_doc_result as enum ('pending', 'complete', 'incomplete');
  end if;

  -- การโทรถาม: ติดต่อได้ / ติดต่อไม่ได้
  if not exists (select 1 from pg_type where typname = 'aud_call_result') then
    create type aud_call_result as enum ('pending', 'contacted', 'no_contact');
  end if;

  -- ข้อมูลที่ได้จากการโทร: ตรง / ผิดปกติ (แดง) / สาขาสื่อสารผิด (เหลือง)
  if not exists (select 1 from pg_type where typname = 'aud_info_result') then
    create type aud_info_result as enum ('pending', 'match', 'abnormal', 'branch_error');
  end if;

  -- สลิปนำฝากเงิน: มี / ไม่มี
  if not exists (select 1 from pg_type where typname = 'aud_slip_result') then
    create type aud_slip_result as enum ('pending', 'has', 'none');
  end if;

  -- ยอดเงินบนสลิป: ถูกต้อง / ไม่ถูกต้อง
  if not exists (select 1 from pg_type where typname = 'aud_amount_result') then
    create type aud_amount_result as enum ('pending', 'correct', 'wrong');
  end if;
end
$$;

-- ---------- ทะเบียนเอกสารประกอบ (ใช้ติ๊กว่าขาดอะไรบ้าง) ----------
create table if not exists public.aud_doc_types (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  note       text,
  sort_order int     not null default 100,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- รายการตรวจสอบที่ระบบมีให้ตรวจ (ข้อ 4 เพิ่ม/ลดได้เอง) ----------
create table if not exists public.aud_check_types (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  kind        aud_check_kind not null default 'custom',
  description text,
  -- ช่องที่เปิดใช้ของรายการนี้ — หน้าจอบันทึกอ่านจากค่าพวกนี้ ไม่ hard code
  has_docs    boolean not null default true,   -- ตรวจเอกสารครบ/ไม่ครบ
  has_call    boolean not null default true,   -- โทรถามผู้เกี่ยวข้อง
  has_slip    boolean not null default false,  -- สลิปนำฝากเงิน + ยอดเงิน
  has_amount  boolean not null default false,  -- กรอกจำนวนเงินเอง
  -- ป้ายกำกับที่แสดงบนหน้าจอของรายการที่ผู้ใช้เพิ่มเอง
  ref_label   text not null default 'เลขที่เอกสาร',
  title_label text not null default 'รายละเอียด',
  party_label text not null default 'ผู้เกี่ยวข้อง',
  -- true = รายการตั้งต้นของระบบ (ข้อ 1-3) ลบไม่ได้ แต่ปิดใช้งานได้
  is_builtin  boolean not null default false,
  sort_order  int     not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_aud_check_types_kind on public.aud_check_types (kind, sort_order);

-- ---------- ตัวนับเลขที่คุมงาน ----------
create table if not exists public.aud_doc_counters (
  prefix text primary key,
  seq    int  not null default 0
);

-- aud_next_doc_no('AUD', 2569) → 'AUD-2569-0001'
create or replace function public.aud_next_doc_no(doc_prefix text, be_year int)
returns text
language plpgsql
as $fn$
declare
  ckey     text := doc_prefix || '-' || be_year::text;
  next_seq int;
begin
  insert into public.aud_doc_counters (prefix, seq)
  values (ckey, 1)
  on conflict (prefix) do update set seq = public.aud_doc_counters.seq + 1
  returning seq into next_seq;

  return ckey || '-' || lpad(next_seq::text, 4, '0');
end;
$fn$;

-- ---------- ใบคุมงานตรวจสอบประจำวัน ----------
create table if not exists public.aud_audits (
  id           uuid primary key default gen_random_uuid(),
  doc_no       text not null unique,
  audit_date   date not null,
  -- ผู้ตรวจสอบ = คนที่ล็อกอินตอนเปิดใบ (ชื่อเก็บสำเนาไว้ด้วย เผื่อบัญชีถูกลบ)
  auditor_id   uuid references public.employees (id) on delete set null,
  auditor_name text not null,
  company_id   uuid references public.companies (id) on delete set null,
  company_name text,
  branch_id    uuid references public.branches (id) on delete set null,
  branch_name  text,
  status       aud_status not null default 'draft',
  note         text,
  created_by   uuid references public.employees (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_aud_audits_date    on public.aud_audits (audit_date desc);
create index if not exists idx_aud_audits_auditor on public.aud_audits (auditor_id, audit_date desc);
create index if not exists idx_aud_audits_branch  on public.aud_audits (branch_id, audit_date desc);
create index if not exists idx_aud_audits_status  on public.aud_audits (status);

-- ---------- รายการที่ตรวจในใบคุมงาน ----------
create table if not exists public.aud_checks (
  id           uuid primary key default gen_random_uuid(),
  audit_id     uuid not null references public.aud_audits (id) on delete cascade,
  type_id      uuid references public.aud_check_types (id) on delete set null,
  -- สำเนาชื่อรายการตรวจ ณ ตอนตรวจ — ใบเก่าอ่านออกแม้ภายหลังแก้ชื่อหรือลบรายการทิ้ง
  type_code    text,
  type_name    text not null,
  kind         aud_check_kind not null default 'custom',

  -- ข้อมูลจากต้นทาง (snapshot)
  ref_no       text,                 -- เลขที่สัญญาขาย / เลขที่ใบเบิก / เลขที่เอกสาร
  ref_date     date,                 -- วันที่ขาย / วันที่จ่าย / วันที่ของเรื่องที่ตรวจ
  title        text,                 -- ชื่อลูกค้า / รายการค่าใช้จ่าย / หัวข้อที่ตรวจ
  party        text,                 -- พนักงานขาย / ผู้รับเงิน / ผู้เกี่ยวข้อง
  branch_label text,                 -- สาขาที่ขาย / สาขาที่จ่าย (ตามที่ต้นทางบันทึก)
  amount       numeric(14, 2),
  -- รายละเอียดเพิ่มเติมของต้นทางที่ไม่ต้องค้นหา เช่น ยี่ห้อ รุ่นรถ บริษัทไฟแนนซ์ ผู้จัดทำ ผลอนุมัติ
  extra        jsonb not null default '{}'::jsonb,
  -- ใบเบิกเงินสดย่อยในระบบขอซ่อมขอซื้อ (เปิดดูเอกสารจริงได้จากหน้าตรวจ)
  payment_id   uuid references public.pr_payments (id) on delete set null,

  -- ผลการตรวจ (ข้อ b.i)
  result      aud_result     not null default 'pending',
  result_note text,
  -- เอกสารประกอบ (ข้อ b.ii)
  doc_result  aud_doc_result not null default 'pending',
  doc_note    text,
  -- การโทรถาม (ข้อ c)
  call_result aud_call_result not null default 'pending',
  info_result aud_info_result not null default 'pending',
  call_note   text,
  -- สลิปนำฝากเงิน (ข้อ 3.a.ii)
  slip_result        aud_slip_result   not null default 'pending',
  slip_amount_result aud_amount_result not null default 'pending',
  slip_amount        numeric(14, 2),
  deposit_amount     numeric(14, 2),

  sort_order int not null default 100,
  checked_by uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_aud_checks_audit  on public.aud_checks (audit_id, sort_order);
create index if not exists idx_aud_checks_type   on public.aud_checks (type_id);
create index if not exists idx_aud_checks_ref    on public.aud_checks (kind, ref_no);
create index if not exists idx_aud_checks_result on public.aud_checks (result);
create index if not exists idx_aud_checks_pay    on public.aud_checks (payment_id);

-- เอกสารต้นทางหนึ่งใบถูกตรวจได้ครั้งเดียว (คู่ขนานกับตารางการขาย/ใบเบิกจริง)
create unique index if not exists uq_aud_checks_source
  on public.aud_checks (kind, ref_no)
  where ref_no is not null and kind in ('sale', 'payment');

-- ---------- เอกสารที่ขาดของแต่ละรายการ ----------
create table if not exists public.aud_check_missing_docs (
  id          uuid primary key default gen_random_uuid(),
  check_id    uuid not null references public.aud_checks (id) on delete cascade,
  doc_type_id uuid references public.aud_doc_types (id) on delete set null,
  -- สำเนาชื่อเอกสาร ณ ตอนตรวจ (รายการ "อื่น ๆ" พิมพ์ชื่อเองได้)
  doc_name    text not null,
  note        text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_aud_missing_docs_check on public.aud_check_missing_docs (check_id, sort_order);

-- ---------- RLS + trigger updated_at ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'aud_doc_types', 'aud_check_types', 'aud_doc_counters',
    'aud_audits', 'aud_checks', 'aud_check_missing_docs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array array['aud_doc_types', 'aud_check_types', 'aud_audits', 'aud_checks']
  loop
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- ---------- View: ใบคุมงานพร้อมยอดสรุปรายใบ ----------
drop view if exists public.v_aud_audits;

create view public.v_aud_audits as
select
  a.*,
  co.name     as company_ref_name,
  br.name     as branch_ref_name,
  br.code     as branch_code,
  e.full_name as auditor_full_name,
  c.check_count,
  c.wrong_count,
  c.incomplete_count,
  c.no_contact_count,
  c.mismatch_count,
  c.pending_count
from public.aud_audits a
left join public.companies co on co.id = a.company_id
left join public.branches  br on br.id = a.branch_id
left join public.employees e  on e.id  = a.auditor_id
left join lateral (
  select
    count(*)                                                              as check_count,
    count(*) filter (where k.result = 'wrong')                            as wrong_count,
    count(*) filter (where k.doc_result = 'incomplete')                   as incomplete_count,
    count(*) filter (where k.call_result = 'no_contact')                  as no_contact_count,
    count(*) filter (where k.info_result in ('abnormal', 'branch_error')) as mismatch_count,
    count(*) filter (where k.result = 'pending')                          as pending_count
  from public.aud_checks k
  where k.audit_id = a.id
) c on true;

revoke all on public.v_aud_audits from anon, authenticated;

-- ---------- View: รายการที่ตรวจ พร้อมหัวใบและรายชื่อเอกสารที่ขาด ----------
drop view if exists public.v_aud_checks;

create view public.v_aud_checks as
select
  k.*,
  a.doc_no as audit_no,
  a.audit_date,
  a.auditor_id,
  a.auditor_name,
  a.status as audit_status,
  a.company_id,
  a.company_name,
  a.branch_id,
  a.branch_name,
  coalesce(d.missing_docs, array[]::text[]) as missing_docs,
  coalesce(d.missing_count, 0)             as missing_count
from public.aud_checks k
join public.aud_audits a on a.id = k.audit_id
left join lateral (
  select array_agg(m.doc_name order by m.sort_order, m.doc_name) as missing_docs,
         count(*)                                                as missing_count
  from public.aud_check_missing_docs m
  where m.check_id = k.id
) d on true;

revoke all on public.v_aud_checks from anon, authenticated;

-- ---------- ลงทะเบียนโปรแกรมและเมนู ----------
insert into public.programs (code, name, description, path, icon, sort_order) values
  ('AUD', 'ระบบตรวจสอบบัญชี (ธุรกิจมอเตอร์ไซค์)',
          'ผู้ตรวจสอบบันทึกผลการตรวจประจำวันเป็นใบคุมงาน — ใบสั่งขายจากระบบขาย ใบเบิกเงินสดย่อย กระทบยอดเงินสดและสลิปนำฝาก พร้อมรายการตรวจที่เพิ่มเองได้ สรุปเป็น Dashboard และรายงาน',
          '/audit', '🧾', 59)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('AUD_ENTRY',  '1. บันทึกผลการตรวจสอบประจำวัน', '/audit/audits',    'entry',     10),
  ('AUD_SEARCH', '2. สอบถามผลการตรวจสอบ',        '/audit/search',    'inquiry',   20),
  ('AUD_REPORT', '3. รายงานผลการตรวจสอบ',        '/audit/reports',   'report',    30),
  ('AUD_DASH',   '4. Dashboard ตรวจสอบบัญชี',     '/audit/dashboard', 'dashboard', 40),
  ('AUD_SETUP',  '5. ตั้งค่ารายการตรวจสอบ',        '/audit/setup',     'setting',   50)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'AUD'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้นตามระดับ (ปรับรายคนได้ที่ /core — เมนู "กำหนดสิทธิ์ผู้ใช้งาน"):
--   AUD_ENTRY  ทุกระดับบันทึก/แก้ไขได้ · ลบได้เฉพาะ admin
--   AUD_SEARCH ทุกระดับดูได้
--   AUD_REPORT ทุกระดับดูได้
--   AUD_DASH   หัวหน้างานขึ้นไป
--   AUD_SETUP  หัวหน้างานขึ้นไปดูได้ · แก้ไขได้ admin/ผู้ช่วย admin · ลบเฉพาะ admin
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  case m.code
    when 'AUD_DASH'  then lvl.level in ('admin', 'assistant_admin', 'supervisor')
    when 'AUD_SETUP' then lvl.level in ('admin', 'assistant_admin', 'supervisor')
    else true
  end,
  case m.code
    when 'AUD_ENTRY' then true
    when 'AUD_SETUP' then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  case m.code
    when 'AUD_ENTRY' then true
    when 'AUD_SETUP' then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  case m.code
    when 'AUD_ENTRY' then lvl.level = 'admin'
    when 'AUD_SETUP' then lvl.level = 'admin'
    else false
  end
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('AUD_ENTRY', 'AUD_SEARCH', 'AUD_REPORT', 'AUD_DASH', 'AUD_SETUP')
on conflict (level, menu_id) do nothing;

-- ให้สิทธิ์เข้าโปรแกรมกับผู้ดูแลระบบไว้ก่อน คนอื่นเพิ่มทีหลังที่ /core/program-users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'AUD' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;
