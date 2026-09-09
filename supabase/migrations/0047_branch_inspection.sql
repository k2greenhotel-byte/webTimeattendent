-- ============================================================================
-- 0047 — ระบบตรวจสอบสาขา (โปรแกรม INSP)
--
--   insp_templates     : แม่แบบใบตรวจ เช่น "สาขามอเตอร์ไซค์" / "สาขาไฟแนนซ์"
--   insp_sections      : หมวดที่ตรวจในแม่แบบนั้น (ข้อ 1, 2, 3, …)
--   insp_items         : รายการตรวจในหมวด — เลือกตัวเลือก (choice) หรือให้คะแนนเป็นระดับ (rating)
--   insp_item_options  : ตัวเลือกของรายการแบบ choice พร้อมคะแนนและค่าปรับของแต่ละตัวเลือก
--   insp_doc_counters  : ตัวนับเลขที่ใบตรวจ แยกตามปี พ.ศ. (INS-2569-0001)
--   insp_inspections   : ใบตรวจหนึ่งครั้ง = บริษัท + สาขา + วันที่ + แม่แบบ + ผู้ตรวจ
--   insp_results       : ผลรายข้อ (คะแนนที่ได้ ค่าปรับ หมายเหตุ)
--   insp_result_photos : รูปประกอบของผลรายข้อ
--
-- หลักการ:
--   * รายการที่ตรวจเป็น "ข้อมูลตั้งต้นที่แอดมินเพิ่ม/ลดเองได้" ห้าม hard code ในหน้าเว็บ
--   * ใบตรวจเก็บ "ชื่อหมวด/ชื่อรายการ/คะแนนเต็ม/ข้อความตัวเลือก ณ ตอนตรวจ" ไว้บนผลรายข้อ
--     ใบเก่าจึงอ่านออกเหมือนเดิม แม้ภายหลังจะแก้ชื่อรายการหรือลบแม่แบบทิ้ง
--   * คะแนนรวม/ค่าปรับรวม/เงินรางวัล คำนวณด้วยฟังก์ชันกลางใน src/lib/inspection.ts
--     แล้วเก็บผลลัพธ์ลงใบตรวจ เพื่อให้รายงานและ dashboard ไม่ต้องคำนวณซ้ำคนละสูตร
--   * เปิด RLS ทุกตารางและไม่มี policy ให้ anon — อ่าน/เขียนผ่าน service role ฝั่ง server เท่านั้น
-- รันต่อจาก 0046 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================================

do $$
begin
  -- choice = เลือกหนึ่งตัวเลือกที่ตั้งไว้ · rating = ให้คะแนนเป็นระดับ 0 ถึงคะแนนเต็ม
  if not exists (select 1 from pg_type where typname = 'insp_item_type') then
    create type insp_item_type as enum ('choice', 'rating');
  end if;

  -- draft ยังตรวจไม่จบ · submitted ส่งผลแล้ว · cancelled ยกเลิกใบ
  if not exists (select 1 from pg_type where typname = 'insp_status') then
    create type insp_status as enum ('draft', 'submitted', 'cancelled');
  end if;
end
$$;

-- ---------- แม่แบบใบตรวจ ----------
create table if not exists public.insp_templates (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  description     text,
  -- เกณฑ์เงินรางวัล: ได้คะแนนตั้งแต่ bonus_threshold ขึ้นไป รับ bonus_amount บาท
  bonus_threshold numeric(10, 2),
  bonus_amount    numeric(12, 2) not null default 0,
  footer_note     text,
  sort_order      int     not null default 100,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- หมวดที่ตรวจ ----------
create table if not exists public.insp_sections (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.insp_templates (id) on delete cascade,
  code        text not null unique,
  name        text not null,
  note        text,
  sort_order  int     not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_insp_sections_template on public.insp_sections (template_id, sort_order);

-- ---------- รายการตรวจในหมวด ----------
create table if not exists public.insp_items (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references public.insp_sections (id) on delete cascade,
  code          text not null unique,
  name          text not null,
  item_type     insp_item_type not null default 'choice',
  -- rating: คะแนนเต็มของข้อนี้ (ให้คะแนน 0 ถึงค่านี้)
  -- choice: ไม่ใช้ — คะแนนเต็มคือคะแนนสูงสุดของตัวเลือกที่ตั้งไว้
  max_score     numeric(10, 2) not null default 0,
  require_photo boolean not null default false,
  note          text,
  sort_order    int     not null default 100,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_insp_items_section on public.insp_items (section_id, sort_order);

-- ---------- ตัวเลือกของรายการแบบ choice ----------
create table if not exists public.insp_item_options (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.insp_items (id) on delete cascade,
  code        text not null unique,
  label       text not null,
  score       numeric(10, 2) not null default 0,
  fine_amount numeric(12, 2) not null default 0,
  sort_order  int     not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_insp_item_options_item on public.insp_item_options (item_id, sort_order);

-- ---------- ตัวนับเลขที่ใบตรวจ ----------
create table if not exists public.insp_doc_counters (
  prefix text primary key,
  seq    int  not null default 0
);

-- insp_next_doc_no('INS', 2569) → 'INS-2569-0001'
create or replace function public.insp_next_doc_no(doc_prefix text, be_year int)
returns text
language plpgsql
as $fn$
declare
  ckey     text := doc_prefix || '-' || be_year::text;
  next_seq int;
begin
  insert into public.insp_doc_counters (prefix, seq)
  values (ckey, 1)
  on conflict (prefix) do update set seq = public.insp_doc_counters.seq + 1
  returning seq into next_seq;

  return ckey || '-' || lpad(next_seq::text, 4, '0');
end;
$fn$;

-- ---------- ใบตรวจ ----------
create table if not exists public.insp_inspections (
  id              uuid primary key default gen_random_uuid(),
  doc_no          text not null unique,
  inspect_date    date not null,
  template_id     uuid references public.insp_templates (id) on delete set null,
  template_code   text,
  template_name   text not null,
  company_id      uuid references public.companies (id) on delete set null,
  company_name    text,
  branch_id       uuid references public.branches (id)  on delete set null,
  branch_name     text,
  inspector_id    uuid references public.employees (id) on delete set null,
  inspector_name  text,
  status          insp_status not null default 'draft',
  total_score     numeric(10, 2) not null default 0,
  max_score       numeric(10, 2) not null default 0,
  score_pct       numeric(6, 2)  not null default 0,
  total_fine      numeric(12, 2) not null default 0,
  bonus_amount    numeric(12, 2) not null default 0,
  fail_count      int not null default 0,
  note            text,
  created_by      uuid references public.employees (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_insp_inspections_date     on public.insp_inspections (inspect_date);
create index if not exists idx_insp_inspections_branch   on public.insp_inspections (branch_id, inspect_date);
create index if not exists idx_insp_inspections_company  on public.insp_inspections (company_id);
create index if not exists idx_insp_inspections_template on public.insp_inspections (template_id);
create index if not exists idx_insp_inspections_status   on public.insp_inspections (status);

-- ---------- ผลรายข้อ ----------
create table if not exists public.insp_results (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.insp_inspections (id) on delete cascade,
  item_id       uuid references public.insp_items (id) on delete set null,
  -- สำเนาโครงแบบฟอร์ม ณ ตอนตรวจ — ใบเก่าต้องอ่านออกแม้แม่แบบถูกแก้ภายหลัง
  section_name  text not null,
  section_sort  int  not null default 100,
  item_name     text not null,
  item_type     insp_item_type not null default 'choice',
  option_id     uuid references public.insp_item_options (id) on delete set null,
  option_label  text,
  score         numeric(10, 2) not null default 0,
  max_score     numeric(10, 2) not null default 0,
  fine_amount   numeric(12, 2) not null default 0,
  note          text,
  sort_order    int not null default 100,
  created_at    timestamptz not null default now()
);

create index if not exists idx_insp_results_inspection on public.insp_results (inspection_id, section_sort, sort_order);
create index if not exists idx_insp_results_item       on public.insp_results (item_id);

-- ---------- รูปประกอบของผลรายข้อ ----------
create table if not exists public.insp_result_photos (
  id         uuid primary key default gen_random_uuid(),
  result_id  uuid not null references public.insp_results (id) on delete cascade,
  path       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_insp_result_photos on public.insp_result_photos (result_id, sort_order);

-- ---------- RLS + trigger updated_at ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'insp_templates', 'insp_sections', 'insp_items', 'insp_item_options',
    'insp_doc_counters', 'insp_inspections', 'insp_results', 'insp_result_photos'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array array[
    'insp_templates', 'insp_sections', 'insp_items', 'insp_item_options', 'insp_inspections'
  ]
  loop
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- ---------- View: ใบตรวจพร้อมชื่อที่ join แล้ว ----------
drop view if exists public.v_insp_inspections;

create view public.v_insp_inspections as
select
  i.*,
  co.name     as company_ref_name,
  br.name     as branch_ref_name,
  br.code     as branch_code,
  e.full_name as inspector_full_name,
  (select count(*) from public.insp_results r where r.inspection_id = i.id) as result_count,
  (select count(*)
     from public.insp_results r
     join public.insp_result_photos p on p.result_id = r.id
    where r.inspection_id = i.id) as photo_count
from public.insp_inspections i
left join public.companies co on co.id = i.company_id
left join public.branches  br on br.id = i.branch_id
left join public.employees e  on e.id  = i.inspector_id;

revoke all on public.v_insp_inspections from anon, authenticated;

-- ---------- ลงทะเบียนโปรแกรมและเมนู ----------
insert into public.programs (code, name, description, path, icon, sort_order) values
  ('INSP', 'ระบบตรวจสอบสาขา',
           'ออกตรวจสาขาตามแบบฟอร์มที่ตั้งไว้ ให้คะแนนรายข้อ บันทึกหมายเหตุและแนบรูปประกอบ สรุปคะแนน ค่าปรับ และเงินรางวัล',
           '/inspection', '🏍️', 58)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('INSP_ENTRY',  '1. บันทึกตรวจสอบสาขา',  '/inspection/inspections', 'entry',     10),
  ('INSP_SEARCH', '2. สอบถามผลการตรวจ',    '/inspection/search',      'inquiry',   20),
  ('INSP_DASH',   '3. Dashboard ตรวจสาขา', '/inspection/dashboard',   'dashboard', 30),
  ('INSP_SETUP',  '4. ตั้งค่ารายการตรวจ',   '/inspection/setup',       'setting',   40),
  ('INSP_WALL',   'จอ War Room ตรวจสาขา',  '/inspection/wall',        'dashboard', 95)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'INSP'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้นตามระดับ:
--   INSP_ENTRY   ทุกระดับบันทึก/แก้ไขได้ ลบได้เฉพาะ admin
--   INSP_SEARCH  ทุกระดับดูได้
--   INSP_DASH    หัวหน้างานขึ้นไป (ระดับ user ไม่ต้องเห็นคะแนนรวมทุกสาขา)
--   INSP_SETUP   หัวหน้างานขึ้นไปดูได้ · แก้ไขได้เฉพาะ admin/ผู้ช่วย admin · ลบเฉพาะ admin
--   INSP_WALL    หัวหน้างานขึ้นไป (แพตเทิร์นเดียวกับจอ War Room อื่น)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  case m.code
    when 'INSP_DASH'  then lvl.level in ('admin', 'assistant_admin', 'supervisor')
    when 'INSP_SETUP' then lvl.level in ('admin', 'assistant_admin', 'supervisor')
    when 'INSP_WALL'  then lvl.level in ('admin', 'assistant_admin', 'supervisor')
    else true
  end,
  case m.code
    when 'INSP_ENTRY' then true
    when 'INSP_SETUP' then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  case m.code
    when 'INSP_ENTRY' then true
    when 'INSP_SETUP' then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  case m.code
    when 'INSP_ENTRY' then lvl.level = 'admin'
    when 'INSP_SETUP' then lvl.level = 'admin'
    else false
  end
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('INSP_ENTRY', 'INSP_SEARCH', 'INSP_DASH', 'INSP_SETUP', 'INSP_WALL')
on conflict (level, menu_id) do nothing;

-- ให้สิทธิ์เข้าโปรแกรมกับผู้ดูแลระบบไว้ก่อน คนอื่นเพิ่มทีหลังที่ /core/program-users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'INSP' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;
