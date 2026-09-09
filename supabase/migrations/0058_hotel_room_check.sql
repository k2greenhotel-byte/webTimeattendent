-- ============================================================================
-- 0058 — ตรวจเช็คห้องพักรายห้อง (ต่อยอดโปรแกรม HTL จาก migration 0052)
--
-- ของเดิม: หนึ่งใบ = หนึ่งสาขา หนึ่งวัน (ตรวจอาคาร)
-- ของใหม่: เพิ่มการตรวจ "รายห้องพัก" — หนึ่งใบ = หนึ่งห้อง หนึ่งวัน
--
--   htl_rooms : เบอร์ห้องพักของแต่ละสาขา (แอดมินเพิ่ม/ลดเองได้ที่ /hotel/setup/rooms)
--   htl_groups.scope / htl_items.scope : รายการนี้ใช้กับงานตรวจอาคาร หรืองานตรวจห้องพัก
--   htl_rounds.room_id / room_code : ใบตรวจใบนี้เป็นของห้องไหน (null = ใบตรวจอาคาร)
--
-- ทำไมรวมไว้ในโปรแกรมเดียว ไม่แยกโปรแกรมใหม่:
--   ข้อที่ตรวจเจอว่าไม่ปกติ ไม่ว่าจะมาจากงานอาคารหรืองานห้องพัก ช่างทีมเดียวกันเป็นคนแก้
--   ถ้าแยกโปรแกรมจะมีรายการที่ต้องแก้ไขสองที่ จอ War Room สองจอ และงานจะตกหล่นระหว่างสองที่นั้น
--   ที่นี่จึงใช้ตารางใบตรวจ/ผลรายข้อ/รูป ชุดเดิมทั้งหมด แค่เพิ่มมิติ "ห้อง" เข้าไป
--
-- เลขที่เอกสารแยกชุดกัน: อาคาร = HTC-2569-0001 · ห้องพัก = HTR-2569-0001
-- รันต่อจาก 0057 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================================

do $$
begin
  -- รายการตรวจชุดนี้ใช้กับงานตรวจอาคาร หรืองานตรวจห้องพัก
  if not exists (select 1 from pg_type where typname = 'htl_scope') then
    create type htl_scope as enum ('building', 'room');
  end if;
end
$$;

-- ---------- เบอร์ห้องพัก ----------
create table if not exists public.htl_rooms (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches (id) on delete cascade,
  -- เบอร์ห้องที่ช่างเรียกกันจริง เช่น V1, 801
  code       text not null,
  -- ชื่อ/ประเภทห้อง เช่น "พูลวิลล่า 2 ห้องนอน" (ไม่ใส่ก็ได้)
  name       text,
  note       text,
  sort_order int     not null default 100,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- เบอร์ห้องซ้ำกันข้ามสาขาได้ (V1 มีได้ทุกโรงแรม) แต่ห้ามซ้ำในสาขาเดียวกัน
  unique (branch_id, code)
);

create index if not exists idx_htl_rooms_branch on public.htl_rooms (branch_id, sort_order);

-- ---------- ขอบเขตของรายการตรวจ ----------
alter table public.htl_groups add column if not exists scope htl_scope not null default 'building';
alter table public.htl_items  add column if not exists scope htl_scope not null default 'building';

create index if not exists idx_htl_groups_scope on public.htl_groups (scope, sort_order);
create index if not exists idx_htl_items_scope  on public.htl_items  (scope, sort_order);

-- ---------- ใบตรวจ: เพิ่มห้องพัก ----------
alter table public.htl_rounds add column if not exists room_id uuid references public.htl_rooms (id) on delete set null;
-- เก็บสำเนาเบอร์ห้อง ณ ตอนตรวจ ใบเก่าจึงอ่านออกแม้ห้องถูกลบภายหลัง
alter table public.htl_rounds add column if not exists room_code text;

create index if not exists idx_htl_rounds_room on public.htl_rounds (room_id, check_date);

-- หนึ่งใบต่อหนึ่งวัน: ฝั่งอาคารนับตามสาขา · ฝั่งห้องพักนับตามห้อง
drop index if exists public.uq_htl_rounds_branch_date;

create unique index if not exists uq_htl_rounds_building_date
  on public.htl_rounds (branch_id, check_date)
  where room_id is null and branch_id is not null;

create unique index if not exists uq_htl_rounds_room_date
  on public.htl_rounds (room_id, check_date)
  where room_id is not null;

-- trigger updated_at ของตารางใหม่
drop trigger if exists trg_htl_rooms_updated on public.htl_rooms;
create trigger trg_htl_rooms_updated before update on public.htl_rooms
  for each row execute function public.set_updated_at();

alter table public.htl_rooms enable row level security;

-- ---------- View: ใบตรวจ (เพิ่มชื่อห้องที่ join แล้ว) ----------
drop view if exists public.v_htl_rounds;

create view public.v_htl_rounds as
select
  d.*,
  co.name     as company_ref_name,
  br.name     as branch_ref_name,
  br.code     as branch_code,
  rm.code     as room_ref_code,
  rm.name     as room_name,
  e.full_name as inspector_full_name,
  (select count(*)
     from public.htl_results r
     join public.htl_result_photos p on p.result_id = r.id
    where r.round_id = d.id) as photo_count
from public.htl_rounds d
left join public.companies co on co.id = d.company_id
left join public.branches  br on br.id = d.branch_id
left join public.htl_rooms rm on rm.id = d.room_id
left join public.employees e  on e.id  = d.inspector_id;

revoke all on public.v_htl_rounds from anon, authenticated;

-- ---------- View: ข้อที่ต้องแก้ไข (เพิ่มเบอร์ห้อง) ----------
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
  d.room_id,
  d.room_code,
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

-- ---------- เมนู: เพิ่มหน้าตรวจห้องพัก และเรียงเลขหน้าใหม่ ----------
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('HTL_ENTRY',  '1. บันทึกตรวจเช็คอาคาร',   '/hotel/rounds',    'entry',     10),
  ('HTL_ROOM',   '2. บันทึกตรวจเช็คห้องพัก',  '/hotel/rooms',     'entry',     20),
  ('HTL_ISSUE',  '3. รายการที่ต้องแก้ไข',     '/hotel/issues',    'entry',     30),
  ('HTL_SEARCH', '4. สอบถามผลการตรวจเช็ค',   '/hotel/search',    'inquiry',   40),
  ('HTL_DASH',   '5. Dashboard ตรวจเช็ค',     '/hotel/dashboard', 'dashboard', 50),
  ('HTL_SETUP',  '6. ตั้งค่ารายการและห้องพัก', '/hotel/setup',     'setting',   60),
  ('HTL_WALL',   'จอ War Room ตรวจเช็คโรงแรม', '/hotel/wall',      'dashboard', 95)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'HTL'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้นของเมนูใหม่ — ชุดเดียวกับ HTL_ENTRY (ทุกระดับบันทึก/แก้ไขได้ ลบเฉพาะ admin)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select lvl.level::access_level, m.id, true, true, true, lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'HTL_ROOM'
on conflict (level, menu_id) do nothing;

-- คำอธิบายโปรแกรมเปลี่ยนไปแล้ว (มีทั้งงานอาคารและงานห้องพัก)
update public.programs
   set description = 'ช่างตรวจเช็คประจำวันทั้งงานอาคารและงานห้องพักรายห้อง ระบุปกติ/ไม่ปกติ แนบรูป ใส่หมายเหตุ กำหนดความเร่งด่วนที่ต้องแก้ และเปิดใบแจ้งซ่อมต่อได้ทันที'
 where code = 'HTL';
