-- ============================================================================
-- 0034 — ระบบบันทึกงานประจำวันพนักงานขาย (โปรแกรม SALEWORK)
--
--   sw_task_types    : ประเภทงานที่แอดมินตั้งเอง 2 ระดับ (หัวข้อ → งานย่อย)
--                      แต่ละงานย่อยกำหนดเองได้ว่าให้กรอกตัวเลขอะไร หน่วยอะไร
--                      ต้องแนบรูป/คลิปไหม แนบลิงก์ได้ไหม และเป้าหมายต่อวันเท่าไร
--   sw_doc_counters  : ตัวนับเลขที่ใบงาน แยกตามปี พ.ศ. (SW-2569-0001)
--   sw_logs          : ใบบันทึกงานประจำวัน — หนึ่งคนหนึ่งวันหนึ่งใบ
--   sw_log_items     : บรรทัดงานในใบ (ติ๊กว่าทำแล้ว + ตัวเลข + รายละเอียด + ลิงก์)
--   sw_item_media    : รูปภาพ/คลิปที่แนบกับงานแต่ละบรรทัด (เก็บในถังเดียวกับไฟล์ Memo)
--   sw_salesman_map  : จับคู่บัญชีผู้ใช้ในเว็บ (employees) กับรหัสพนักงานขายใน Db2 (SALCOD)
--
-- หลักการ:
--   * ประเภทงานเป็นข้อมูลตั้งต้นที่แอดมินแก้เองได้ ห้าม hard code ในโค้ดหน้าเว็บ
--   * บรรทัดงานเก็บ "ชื่อ/หน่วย ณ ตอนบันทึก" ไว้ด้วย ใบเก่าจึงอ่านออกแม้ประเภทงานถูกแก้ชื่อหรือลบ
--   * หนึ่งคนหนึ่งวันหนึ่งใบ (unique owner_id + work_date) — เปิดซ้ำคือแก้ใบเดิม ไม่ออกเลขใหม่
--   * เปิด RLS ทุกตารางและไม่มี policy ให้ anon — อ่าน/เขียนผ่าน service role ฝั่ง server เท่านั้น
--     การกรอง "พนักงานเห็นเฉพาะใบของตัวเอง" ทำที่ชั้น session (salework-db.ts) ไม่ใช่ที่ RLS
-- รันต่อจาก 0033 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================================

-- ---------- ประเภทงาน (แอดมินตั้งเอง) ----------
create table if not exists public.sw_task_types (
  id             uuid primary key default gen_random_uuid(),
  parent_id      uuid references public.sw_task_types (id) on delete cascade,  -- null = หัวข้อหลัก/งานเดี่ยว
  code           text not null unique,
  name           text not null,
  description    text,
  -- ช่องตัวเลขที่ให้กรอก เช่น "จำนวนใบปลิวที่แจก" หน่วย "ใบ" (null = งานนี้ไม่ต้องกรอกตัวเลข)
  metric_label   text,
  metric_unit    text,
  require_metric boolean not null default false,   -- ติ๊กว่าทำแล้วต้องใส่ตัวเลขมากกว่า 0
  require_media  boolean not null default false,   -- ติ๊กว่าทำแล้วต้องแนบรูป/คลิปอย่างน้อย 1
  allow_link     boolean not null default false,   -- มีช่องลิงก์โพสต์/คลิป
  daily_target   numeric(12, 2),                   -- เป้าหมายต่อวัน (null = ไม่ตั้งเป้า)
  sort_order     int not null default 100,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_sw_task_types_parent on public.sw_task_types (parent_id, sort_order);

drop trigger if exists trg_sw_task_types_updated on public.sw_task_types;
create trigger trg_sw_task_types_updated before update on public.sw_task_types
  for each row execute function public.set_updated_at();

-- ---------- ตัวนับเลขที่ใบงาน ----------
create table if not exists public.sw_doc_counters (
  prefix text primary key,
  seq    int  not null default 0
);

-- sw_next_doc_no('SW', 2569) → 'SW-2569-0001'
create or replace function public.sw_next_doc_no(doc_prefix text, be_year int)
returns text
language plpgsql
as $fn$
declare
  ckey     text := doc_prefix || '-' || be_year::text;
  next_seq int;
begin
  insert into public.sw_doc_counters (prefix, seq)
  values (ckey, 1)
  on conflict (prefix) do update set seq = public.sw_doc_counters.seq + 1
  returning seq into next_seq;

  return ckey || '-' || lpad(next_seq::text, 4, '0');
end;
$fn$;

-- ---------- ใบบันทึกงานประจำวัน ----------
create table if not exists public.sw_logs (
  id           uuid primary key default gen_random_uuid(),
  doc_no       text not null unique,                                          -- เลขที่ใบงาน (ระบบรันให้)
  work_date    date not null,                                                 -- วันที่ทำงาน
  owner_id     uuid references public.employees (id) on delete set null,      -- พนักงานขาย (จาก login)
  owner_name   text not null,                                                 -- สำเนาชื่อ กันบัญชีถูกลบ/เปลี่ยนชื่อ
  branch_id    uuid references public.branches (id) on delete set null,
  company_id   uuid references public.companies (id) on delete set null,
  note         text,                                                          -- สรุปงานประจำวัน/ปัญหาที่พบ
  submitted_at timestamptz,                                                   -- null = ยังเป็นฉบับร่าง
  created_by   uuid references public.employees (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists uq_sw_logs_owner_date on public.sw_logs (owner_id, work_date);
create index if not exists idx_sw_logs_date   on public.sw_logs (work_date);
create index if not exists idx_sw_logs_branch on public.sw_logs (branch_id);

drop trigger if exists trg_sw_logs_updated on public.sw_logs;
create trigger trg_sw_logs_updated before update on public.sw_logs
  for each row execute function public.set_updated_at();

-- ---------- บรรทัดงานในใบ ----------
create table if not exists public.sw_log_items (
  id           uuid primary key default gen_random_uuid(),
  log_id       uuid not null references public.sw_logs (id) on delete cascade,
  task_type_id uuid references public.sw_task_types (id) on delete set null,
  task_code    text not null,                 -- สำเนา ณ ตอนบันทึก
  task_name    text not null,
  metric_label text,
  metric_unit  text,
  done         boolean not null default false,
  qty          numeric(12, 2),
  detail       text,
  link_url     text,
  sort_order   int not null default 100,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists uq_sw_log_items_task on public.sw_log_items (log_id, task_type_id);
create index if not exists idx_sw_log_items_log on public.sw_log_items (log_id, sort_order);

drop trigger if exists trg_sw_log_items_updated on public.sw_log_items;
create trigger trg_sw_log_items_updated before update on public.sw_log_items
  for each row execute function public.set_updated_at();

-- ---------- รูป/คลิปแนบของแต่ละบรรทัด ----------
create table if not exists public.sw_item_media (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.sw_log_items (id) on delete cascade,
  path       text not null,                  -- เส้นทางไฟล์ในถัง (sw/…)
  kind       text not null default 'image',  -- image | video
  filename   text,
  mime       text,
  size_bytes bigint,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_sw_item_media_item on public.sw_item_media (item_id, sort_order);

-- ---------- จับคู่ผู้ใช้เว็บ ↔ พนักงานขายใน Db2 ----------
-- SALCOD ในระบบขายเดิม = USERID ของโปรแกรมเดิม และชื่อในระบบขายมีไม่ครบทุกรหัส
-- จึงเก็บชื่อที่เห็นตอนจับคู่ไว้ด้วย เพื่อให้หน้าจอแสดงได้แม้ตอนนั้น Db2 ปิดอยู่
create table if not exists public.sw_salesman_map (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees (id) on delete cascade,
  db2_salcod  text not null unique,
  db2_name    text,
  note        text,
  mapped_by   uuid references public.employees (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_sw_salesman_map_updated on public.sw_salesman_map;
create trigger trg_sw_salesman_map_updated before update on public.sw_salesman_map
  for each row execute function public.set_updated_at();

-- ---------- RLS (ปิดทุกทาง เข้าถึงผ่าน service role เท่านั้น) ----------
do $rls$
declare t text;
begin
  foreach t in array array[
    'sw_task_types', 'sw_doc_counters', 'sw_logs', 'sw_log_items', 'sw_item_media', 'sw_salesman_map'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end
$rls$;

-- ---------- View: ใบงาน + ชื่อ/สาขา + จำนวนงานที่ทำแล้ว ----------
drop view if exists public.v_sw_logs;

create view public.v_sw_logs as
select
  l.*,
  e.full_name as owner_full_name,
  e.emp_code  as owner_emp_code,
  b.name      as branch_name,
  c.name      as company_name,
  coalesce(i.item_count, 0)  as item_count,
  coalesce(i.done_count, 0)  as done_count,
  coalesce(i.media_count, 0) as media_count
from public.sw_logs l
left join public.employees e on e.id = l.owner_id
left join public.branches  b on b.id = l.branch_id
left join public.companies c on c.id = l.company_id
left join lateral (
  select
    count(*)                        as item_count,
    count(*) filter (where it.done) as done_count,
    coalesce(sum(m.n), 0)           as media_count
  from public.sw_log_items it
  left join lateral (
    select count(*) as n from public.sw_item_media md where md.item_id = it.id
  ) m on true
  where it.log_id = l.id
) i on true;

revoke all on public.v_sw_logs from anon, authenticated;

-- ---------- View: บรรทัดงาน + ข้อมูลใบ (ใช้ทำ dashboard/รายงาน) ----------
drop view if exists public.v_sw_items;

create view public.v_sw_items as
select
  it.*,
  l.doc_no,
  l.work_date,
  l.owner_id,
  l.owner_name,
  l.branch_id,
  l.company_id,
  l.submitted_at,
  e.full_name as owner_full_name,
  br.name     as branch_name,
  coalesce(md.n, 0) as media_count
from public.sw_log_items it
join public.sw_logs l on l.id = it.log_id
left join public.employees e on e.id = l.owner_id
left join public.branches br on br.id = l.branch_id
left join lateral (
  select count(*) as n from public.sw_item_media m where m.item_id = it.id
) md on true;

revoke all on public.v_sw_items from anon, authenticated;

-- ---------- ประเภทงานตั้งต้น (แอดมินแก้/เพิ่ม/ปิดใช้งานเองได้ที่ /salework/setup) ----------
insert into public.sw_task_types
  (code, name, metric_label, metric_unit, require_metric, require_media, allow_link, sort_order)
values
  ('SW01', 'งานแจกใบปลิว',          'จำนวนใบปลิวที่แจก',   'ใบ',  true,  true,  false, 10),
  ('SW02', 'งานการตลาดออนไลน์',      null,                  null,  false, false, false, 20),
  ('SW03', 'ถ่ายรูปหน้าร้าน',         'จำนวนรูปที่ถ่าย',      'รูป', false, true,  false, 30),
  ('SW04', 'การตอบแชต',              'จำนวนแชตที่ตอบ',      'แชต', true,  false, false, 40),
  ('SW05', 'การโทรตามลูกค้าประจำวัน', 'จำนวนลูกค้าที่โทรคุย', 'ราย', true,  false, false, 50)
on conflict (code) do nothing;

insert into public.sw_task_types
  (parent_id, code, name, metric_label, metric_unit, require_metric, require_media, allow_link, sort_order)
select p.id, v.code, v.name, v.metric_label, v.metric_unit, v.require_metric, v.require_media, v.allow_link, v.sort_order
from (values
  ('SW02A', 'การโพสต์ Facebook', 'จำนวนผู้ชม/ผู้เห็นโพสต์', 'คน', true, true, true, 21),
  ('SW02B', 'การโพสต์ TikTok',   'จำนวนผู้ชม/ผู้เห็นโพสต์', 'คน', true, true, true, 22),
  ('SW02C', 'การไลฟ์สด',         'จำนวนผู้ชมไลฟ์',          'คน', true, true, true, 23)
) as v(code, name, metric_label, metric_unit, require_metric, require_media, allow_link, sort_order)
join public.sw_task_types p on p.code = 'SW02'
on conflict (code) do nothing;

-- ---------- ลงทะเบียนโปรแกรมและเมนู ----------
insert into public.programs (code, name, description, path, icon, sort_order) values
  ('SALEWORK', 'บันทึกงานประจำวันพนักงานขาย',
               'พนักงานขายติ๊กงานที่ทำในแต่ละวัน กรอกตัวเลขผลงาน แนบรูป/คลิป พร้อม dashboard สรุปรายคน และจับคู่กับพนักงานขายในระบบขาย (Db2)',
               '/salework', '📋', 46)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('SW_ENTRY',  '1. บันทึกงานประจำวัน',              '/salework/daily',     'entry',     10),
  ('SW_SEARCH', '2. สอบถาม/ประวัติการทำงาน',          '/salework/search',    'inquiry',   20),
  ('SW_DASH',   '3. Dashboard สรุปงานพนักงานขาย',     '/salework/dashboard', 'dashboard', 30),
  ('SW_SETUP',  '4. ตั้งค่าประเภทงาน',                '/salework/setup',     'setting',   40),
  ('SW_MAP',    '5. จับคู่พนักงานขายกับระบบขาย (Db2)', '/salework/mapping',   'setting',   50)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'SALEWORK'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้นตามระดับ:
--   หน้าจอบันทึก — ทุกระดับบันทึก/แก้ไขได้ (แก้ได้เฉพาะใบของตัวเอง บังคับที่ชั้น session) ลบได้เฉพาะ admin
--   สอบถาม/dashboard — ทุกระดับดูได้ (ระดับ user เห็นเฉพาะของตัวเอง)
--   ตั้งค่าประเภทงาน / จับคู่พนักงานขาย — เฉพาะ admin และผู้ช่วย admin
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  m.code in ('SW_ENTRY', 'SW_SEARCH', 'SW_DASH')
    or lvl.level in ('admin', 'assistant_admin'),
  case
    when m.code = 'SW_ENTRY' then true
    when m.code in ('SW_SETUP', 'SW_MAP') then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  case
    when m.code = 'SW_ENTRY' then true
    when m.code in ('SW_SETUP', 'SW_MAP') then lvl.level in ('admin', 'assistant_admin')
    else false
  end,
  case
    when m.code in ('SW_ENTRY', 'SW_SETUP', 'SW_MAP') then lvl.level = 'admin'
    else false
  end
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('SW_ENTRY', 'SW_SEARCH', 'SW_DASH', 'SW_SETUP', 'SW_MAP')
on conflict (level, menu_id) do nothing;

-- ให้สิทธิ์เข้าโปรแกรมกับผู้ดูแลระบบไว้ก่อน คนอื่นเพิ่มทีหลังที่ /core/program-users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'SALEWORK' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;
