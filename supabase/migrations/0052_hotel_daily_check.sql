-- ============================================================================
-- 0052 — ระบบตรวจเช็คโรงแรมประจำวัน (โปรแกรม HTL)
--
--   htl_groups        : ประเภทงานที่ตรวจ เช่น ระบบน้ำ ระบบไฟฟ้า ความปลอดภัย
--   htl_items         : รายการที่ต้องตรวจในแต่ละประเภทงาน (แอดมินเพิ่ม/ลดเองได้)
--   htl_doc_counters  : ตัวนับเลขที่ใบตรวจ แยกตามปี พ.ศ. (HTC-2569-0001)
--   htl_rounds        : ใบตรวจเช็คหนึ่งวัน = บริษัท + สาขา + วันที่ + ผู้ตรวจ
--   htl_results       : ผลรายข้อ (ปกติ/ไม่ปกติ/ไม่มี · หมายเหตุ · ความเร่งด่วนที่ต้องแก้)
--   htl_result_photos : รูปประกอบของผลรายข้อ
--
-- หลักการ (แพตเทิร์นเดียวกับระบบตรวจสอบสาขา migration 0047):
--   * รายการที่ตรวจเป็นข้อมูลตั้งค่า ห้าม hard code ในหน้าเว็บ
--   * ผลรายข้อเก็บสำเนา "ชื่อประเภทงาน/ชื่อรายการ ณ ตอนตรวจ" ไว้ด้วย
--     ใบเก่าจึงอ่านออกเหมือนเดิมแม้ภายหลังจะแก้ชื่อรายการหรือลบทิ้ง
--   * ยอดสรุปบนหัวใบ (ผ่านกี่ข้อ ไม่ผ่านกี่ข้อ) คำนวณด้วยฟังก์ชันกลางใน src/lib/hotel.ts
--     แล้วเก็บผลลัพธ์ลงหัวใบ รายงานและ dashboard จึงไม่ต้องคำนวณซ้ำคนละสูตร
--   * ข้อที่ไม่ปกติผูกกับใบขอซ่อม (pr_repairs) ได้ด้วย repair_id — กดจากผลตรวจไปเปิดใบซ่อมได้เลย
--   * เปิด RLS ทุกตารางและไม่มี policy ให้ anon — อ่าน/เขียนผ่าน service role ฝั่ง server เท่านั้น
-- รันต่อจาก 0051 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================================

do $$
begin
  -- ผลการตรวจรายข้อ: ปกติ/ผ่าน · ไม่ปกติ/ไม่ผ่าน · ไม่มีรายการนี้ในสาขา (ไม่ต้องตรวจ)
  if not exists (select 1 from pg_type where typname = 'htl_check_result') then
    create type htl_check_result as enum ('pass', 'fail', 'na');
  end if;

  -- ความเร่งด่วนที่ต้องได้รับการแก้ไข (สีแดง / เหลือง / น้ำเงิน ตามลำดับ)
  if not exists (select 1 from pg_type where typname = 'htl_priority') then
    create type htl_priority as enum ('urgent', 'soon', 'later');
  end if;

  -- draft ตรวจยังไม่จบ · submitted ส่งผลแล้ว · cancelled ยกเลิกใบ
  if not exists (select 1 from pg_type where typname = 'htl_round_status') then
    create type htl_round_status as enum ('draft', 'submitted', 'cancelled');
  end if;
end
$$;

-- ---------- ประเภทงานที่ตรวจ ----------
create table if not exists public.htl_groups (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  note       text,
  sort_order int     not null default 100,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- รายการที่ต้องตรวจ ----------
create table if not exists public.htl_items (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.htl_groups (id) on delete cascade,
  code       text not null unique,
  name       text not null,
  note       text,
  -- null = ใช้กับทุกสาขา · ใส่ค่า = รายการเฉพาะของสาขานั้น (เช่น สาขาที่มีสระว่ายน้ำเท่านั้น)
  branch_id  uuid references public.branches (id) on delete cascade,
  -- บังคับแนบรูปทุกครั้งที่ตรวจ ไม่ว่าผลจะปกติหรือไม่
  require_photo boolean not null default false,
  -- บังคับแนบรูปเมื่อผลออกมาไม่ปกติ — เปิดไว้เป็นค่าเริ่มต้น เพราะช่างต้องมีหลักฐานให้ฝ่ายซ่อม
  require_photo_on_fail boolean not null default true,
  -- ความเร่งด่วนตั้งต้นเมื่อข้อนี้ไม่ปกติ (ผู้ตรวจแก้ทับได้ตอนบันทึก)
  default_priority htl_priority not null default 'soon',
  sort_order int     not null default 100,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_htl_items_group  on public.htl_items (group_id, sort_order);
create index if not exists idx_htl_items_branch on public.htl_items (branch_id);

-- ---------- ตัวนับเลขที่ใบตรวจ ----------
create table if not exists public.htl_doc_counters (
  prefix text primary key,
  seq    int  not null default 0
);

-- htl_next_doc_no('HTC', 2569) → 'HTC-2569-0001'
create or replace function public.htl_next_doc_no(doc_prefix text, be_year int)
returns text
language plpgsql
as $fn$
declare
  ckey     text := doc_prefix || '-' || be_year::text;
  next_seq int;
begin
  insert into public.htl_doc_counters (prefix, seq)
  values (ckey, 1)
  on conflict (prefix) do update set seq = public.htl_doc_counters.seq + 1
  returning seq into next_seq;

  return ckey || '-' || lpad(next_seq::text, 4, '0');
end;
$fn$;

-- ---------- ใบตรวจเช็คประจำวัน ----------
create table if not exists public.htl_rounds (
  id             uuid primary key default gen_random_uuid(),
  doc_no         text not null unique,
  check_date     date not null,
  company_id     uuid references public.companies (id) on delete set null,
  company_name   text,
  branch_id      uuid references public.branches (id)  on delete set null,
  branch_name    text,
  inspector_id   uuid references public.employees (id) on delete set null,
  inspector_name text,
  status         htl_round_status not null default 'draft',
  -- ยอดสรุปที่คำนวณจากผลรายข้อด้วยสูตรกลาง (src/lib/hotel.ts) แล้วเก็บไว้ให้รายงานอ่านเร็ว
  total_items    int not null default 0,
  checked_count  int not null default 0,
  pass_count     int not null default 0,
  fail_count     int not null default 0,
  na_count       int not null default 0,
  urgent_count   int not null default 0,
  soon_count     int not null default 0,
  later_count    int not null default 0,
  open_fix_count int not null default 0,
  pass_pct       numeric(6, 2) not null default 0,
  note           text,
  created_by     uuid references public.employees (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- หนึ่งสาขาตรวจได้วันละหนึ่งใบ — กันช่างสองคนเปิดใบซ้ำวันเดียวกัน
create unique index if not exists uq_htl_rounds_branch_date
  on public.htl_rounds (branch_id, check_date)
  where branch_id is not null;

create index if not exists idx_htl_rounds_date    on public.htl_rounds (check_date);
create index if not exists idx_htl_rounds_branch  on public.htl_rounds (branch_id, check_date);
create index if not exists idx_htl_rounds_company on public.htl_rounds (company_id);
create index if not exists idx_htl_rounds_status  on public.htl_rounds (status);

-- ---------- ผลรายข้อ ----------
create table if not exists public.htl_results (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid not null references public.htl_rounds (id) on delete cascade,
  item_id       uuid references public.htl_items (id) on delete set null,
  -- สำเนาโครงรายการ ณ ตอนตรวจ — ใบเก่าต้องอ่านออกแม้รายการถูกแก้/ลบภายหลัง
  group_name    text not null,
  group_sort    int  not null default 100,
  item_name     text not null,
  sort_order    int  not null default 100,
  -- null = ยังไม่ได้ตรวจข้อนี้ (ฉบับร่างมีได้ ส่งผลแล้วต้องครบทุกข้อ)
  result        htl_check_result,
  note          text,
  -- ใช้เมื่อ result = 'fail' — ต้องแก้ภายในกี่วัน
  priority      htl_priority,
  is_fixed      boolean not null default false,
  fixed_at      timestamptz,
  fixed_note    text,
  -- ใบขอซ่อมที่เปิดจากข้อนี้ (โปรแกรมจัดซื้อ/แจ้งซ่อม)
  repair_id     uuid references public.pr_repairs (id) on delete set null,
  repair_doc_no text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_htl_results_round  on public.htl_results (round_id, group_sort, sort_order);
create index if not exists idx_htl_results_item   on public.htl_results (item_id);
create index if not exists idx_htl_results_fail   on public.htl_results (result, is_fixed);
create index if not exists idx_htl_results_repair on public.htl_results (repair_id);

-- ---------- รูปประกอบของผลรายข้อ ----------
create table if not exists public.htl_result_photos (
  id         uuid primary key default gen_random_uuid(),
  result_id  uuid not null references public.htl_results (id) on delete cascade,
  path       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_htl_result_photos on public.htl_result_photos (result_id, sort_order);

-- ---------- RLS + trigger updated_at ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'htl_groups', 'htl_items', 'htl_doc_counters',
    'htl_rounds', 'htl_results', 'htl_result_photos'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array array['htl_groups', 'htl_items', 'htl_rounds', 'htl_results']
  loop
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- ---------- View: ใบตรวจพร้อมชื่อที่ join แล้ว ----------
drop view if exists public.v_htl_rounds;

create view public.v_htl_rounds as
select
  d.*,
  co.name     as company_ref_name,
  br.name     as branch_ref_name,
  br.code     as branch_code,
  e.full_name as inspector_full_name,
  (select count(*)
     from public.htl_results r
     join public.htl_result_photos p on p.result_id = r.id
    where r.round_id = d.id) as photo_count
from public.htl_rounds d
left join public.companies co on co.id = d.company_id
left join public.branches  br on br.id = d.branch_id
left join public.employees e  on e.id  = d.inspector_id;

revoke all on public.v_htl_rounds from anon, authenticated;

-- ---------- View: ข้อที่ตรวจแล้วไม่ปกติ (หน้า "รายการที่ต้องแก้ไข" และจอ War Room) ----------
drop view if exists public.v_htl_issues;

create view public.v_htl_issues as
select
  r.id            as result_id,
  r.round_id,
  r.item_id,
  r.group_name,
  r.group_sort,
  r.item_name,
  r.sort_order,
  r.note,
  r.priority,
  r.is_fixed,
  r.fixed_at,
  r.fixed_note,
  r.repair_id,
  r.repair_doc_no,
  d.doc_no,
  d.check_date,
  d.company_id,
  d.company_name,
  d.branch_id,
  d.branch_name,
  d.inspector_id,
  d.inspector_name,
  d.status,
  (select count(*) from public.htl_result_photos p where p.result_id = r.id) as photo_count,
  pr.doc_no     as repair_ref_no,
  pr.job_status as repair_job_status
from public.htl_results r
join public.htl_rounds d on d.id = r.round_id
left join public.pr_repairs pr on pr.id = r.repair_id
where r.result = 'fail';

revoke all on public.v_htl_issues from anon, authenticated;

-- ---------- ลงทะเบียนโปรแกรมและเมนู ----------
insert into public.programs (code, name, description, path, icon, sort_order) values
  ('HTL', 'ตรวจเช็คโรงแรมประจำวัน',
          'ช่างเลือกบริษัทและสาขา แล้วตรวจเช็คตามรายการที่ตั้งไว้ ระบุปกติ/ไม่ปกติ แนบรูป ใส่หมายเหตุ กำหนดความเร่งด่วนที่ต้องแก้ และเปิดใบแจ้งซ่อมต่อได้ทันที',
          '/hotel', '🏨', 59)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('HTL_ENTRY',  '1. บันทึกตรวจเช็คประจำวัน', '/hotel/rounds',    'entry',     10),
  ('HTL_ISSUE',  '2. รายการที่ต้องแก้ไข',      '/hotel/issues',    'entry',     20),
  ('HTL_SEARCH', '3. สอบถามผลการตรวจเช็ค',    '/hotel/search',    'inquiry',   30),
  ('HTL_DASH',   '4. Dashboard ตรวจเช็ค',      '/hotel/dashboard', 'dashboard', 40),
  ('HTL_SETUP',  '5. ตั้งค่ารายการตรวจเช็ค',   '/hotel/setup',     'setting',   50),
  ('HTL_WALL',   'จอ War Room ตรวจเช็คโรงแรม', '/hotel/wall',      'dashboard', 95)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'HTL'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้นตามระดับ (แพตเทิร์นเดียวกับโปรแกรม INSP):
--   HTL_ENTRY   ทุกระดับบันทึก/แก้ไขเองได้ ลบได้เฉพาะ admin
--   HTL_ISSUE   ทุกระดับดู ปิดงาน และผูกใบซ่อมได้
--   HTL_SEARCH  ทุกระดับสอบถามได้
--   HTL_DASH    หัวหน้างานขึ้นไป
--   HTL_SETUP   หัวหน้างานขึ้นไปดูได้ · แก้ไขได้เฉพาะ admin/ผู้ช่วย admin · ลบเฉพาะ admin
--   HTL_WALL    หัวหน้างานขึ้นไป (แพตเทิร์นเดียวกับจอ War Room อื่น)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  case m.code
    when 'HTL_DASH'  then lvl.level in ('admin', 'assistant_admin', 'supervisor')
    when 'HTL_SETUP' then lvl.level in ('admin', 'assistant_admin', 'supervisor')
    when 'HTL_WALL'  then lvl.level in ('admin', 'assistant_admin', 'supervisor')
    else true
  end,
  case m.code
    when 'HTL_ENTRY' then true
    when 'HTL_ISSUE' then true
    when 'HTL_SETUP' then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  case m.code
    when 'HTL_ENTRY' then true
    when 'HTL_ISSUE' then true
    when 'HTL_SETUP' then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  case m.code
    when 'HTL_ENTRY' then lvl.level = 'admin'
    when 'HTL_SETUP' then lvl.level = 'admin'
    else false
  end
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('HTL_ENTRY', 'HTL_ISSUE', 'HTL_SEARCH', 'HTL_DASH', 'HTL_SETUP', 'HTL_WALL')
on conflict (level, menu_id) do nothing;

-- ให้สิทธิ์เข้าโปรแกรมกับผู้ดูแลระบบไว้ก่อน คนอื่นเพิ่มทีหลังที่ /core/program-users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'HTL' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;
