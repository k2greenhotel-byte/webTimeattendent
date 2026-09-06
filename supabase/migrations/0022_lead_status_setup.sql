-- ============================================================
-- ระบบข้อมูล Lead → หน้าตั้งค่าสถานะ (เมนู LEAD_SETUP)
--
--   ld_work_statuses : สถานะงาน (ข้อ 1.10) — เพิ่ม/แก้ไขเองได้จากหน้าจอตั้งค่า
--   ld_chances       : สถานะโอกาสการขาย (ข้อ 1.11) — เพิ่ม/แก้ไขเองได้เช่นกัน
--
-- เดิมสองอย่างนี้เป็น enum ตายตัวในฐานข้อมูล ทำให้ร้านเพิ่มสถานะเองไม่ได้
-- migration นี้ย้ายไปเป็นตารางข้อมูลหลัก แล้วเปลี่ยนคอลัมน์บนใบ Lead/ใบติดตามเป็น text + FK
--
-- หลักการ:
--   * code คือความหมายที่โค้ดใช้ตัดสินใจ — ตั้งตอนสร้างแล้วแก้ไม่ได้ (แก้ได้แค่ชื่อที่แสดง/สี/ลำดับ/เปิด-ปิด)
--   * kind บอกพฤติกรรมของสถานะงาน: open = ยังต้องติดตาม · won = ปิดการขายได้ · lost = จบแล้วไม่ได้ขาย
--     กฎ "ปิดการขายต้องมีเลขที่สัญญาขาย" และ "งานที่จบแล้วไม่ต้องนัดติดตาม" อ้างจาก kind ไม่ใช่ชื่อ
--   * สถานะตั้งต้น 4+3 รายการเป็น is_system = true — เปลี่ยนชื่อ/สี/ลำดับได้ แต่ลบไม่ได้
--     (ระบบต้องมีอย่างน้อยหนึ่งสถานะของแต่ละ kind ไม่งั้นบันทึกงานไม่ได้)
--   * สีเก็บเป็น "ชื่อชุดสี" (emerald/amber/rose/…) ไม่ใช่คลาส CSS — หน้าจอแปลงเป็นคลาสอีกที
--     เพราะ Tailwind ต้องเห็นชื่อคลาสแบบเต็มตอน build จะต่อสตริงเองไม่ได้
-- รันต่อจาก 0021
-- ============================================================

-- ---------- ตารางสถานะงาน ----------
create table if not exists public.ld_work_statuses (
  code       text primary key,
  name       text not null,
  kind       text not null default 'open' check (kind in ('open', 'won', 'lost')),
  color      text not null default 'slate',
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  is_system  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- ตารางสถานะโอกาสการขาย ----------
-- sort_order น้อย = โอกาสสูงกว่า (ตัวแรกสุดคือกลุ่มที่ต้องดูแลก่อนใคร)
create table if not exists public.ld_chances (
  code       text primary key,
  name       text not null,
  color      text not null default 'slate',
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  is_system  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ld_work_statuses enable row level security;
alter table public.ld_chances       enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['ld_work_statuses', 'ld_chances']
  loop
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- ---------- ค่าตั้งต้น (ตรงกับ enum เดิม ไม่ให้ข้อมูลเก่าเสียความหมาย) ----------
insert into public.ld_work_statuses (code, name, kind, color, sort_order, is_system) values
  ('follow_up',    'ติดตามอีกครั้ง',   'open', 'sky',     10, true),
  ('closed_won',   'ปิดการขายแล้ว',    'won',  'emerald', 20, true),
  ('bought_other', 'ได้รถที่อื่นแล้ว', 'lost', 'orange',  30, true),
  ('dropped',      'ไม่เอาแล้ว',       'lost', 'slate',   40, true)
on conflict (code) do nothing;

insert into public.ld_chances (code, name, color, sort_order, is_system) values
  ('high',   'สูง',   'emerald', 10, true),
  ('medium', 'กลาง',  'amber',   20, true),
  ('low',    'น้อย',  'rose',    30, true)
on conflict (code) do nothing;

-- ---------- เปลี่ยนคอลัมน์จาก enum เป็น text + FK ----------
-- ต้องทิ้ง view ที่อ้างคอลัมน์เหล่านี้ก่อน ไม่งั้น Postgres ไม่ยอมให้เปลี่ยนชนิดข้อมูล
-- (สร้างใหม่ให้ท้ายไฟล์ พร้อมคอลัมน์ชื่อ/สีของสถานะที่ join มาแล้ว)
drop view if exists public.v_ld_leads;
drop view if exists public.v_ld_follow_ups;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ld_leads'
      and column_name = 'work_status' and udt_name = 'ld_work_status'
  ) then
    alter table public.ld_leads alter column work_status drop default;
    alter table public.ld_leads alter column work_status type text using work_status::text;
    alter table public.ld_leads alter column work_status set default 'follow_up';

    alter table public.ld_leads alter column chance drop default;
    alter table public.ld_leads alter column chance type text using chance::text;
    alter table public.ld_leads alter column chance set default 'medium';

    alter table public.ld_follow_ups alter column work_status type text using work_status::text;
    alter table public.ld_follow_ups alter column chance      type text using chance::text;
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ld_leads_work_status_fk') then
    alter table public.ld_leads add constraint ld_leads_work_status_fk
      foreign key (work_status) references public.ld_work_statuses (code) on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ld_leads_chance_fk') then
    alter table public.ld_leads add constraint ld_leads_chance_fk
      foreign key (chance) references public.ld_chances (code) on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ld_follow_ups_work_status_fk') then
    alter table public.ld_follow_ups add constraint ld_follow_ups_work_status_fk
      foreign key (work_status) references public.ld_work_statuses (code) on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ld_follow_ups_chance_fk') then
    alter table public.ld_follow_ups add constraint ld_follow_ups_chance_fk
      foreign key (chance) references public.ld_chances (code) on update cascade;
  end if;
end
$$;

-- enum เดิมไม่มีใครใช้แล้ว
drop type if exists ld_work_status;
drop type if exists ld_chance;

-- ---------- trigger: อ้างพฤติกรรมจาก kind แทนชื่อสถานะตายตัว ----------
create or replace function public.ld_sync_status()
returns trigger
language plpgsql
as $fn$
declare
  won_code     text;
  current_kind text;
begin
  -- กรอกเลขที่สัญญาขายมาแล้ว = ปิดการขายได้ ไม่ว่าจะเลือกสถานะไหนมา
  if coalesce(new.sale_contract_no, '') <> '' then
    select code into won_code
    from public.ld_work_statuses
    where kind = 'won' and is_active
    order by sort_order, code
    limit 1;

    if won_code is not null then
      new.work_status := won_code;
    end if;
  end if;

  -- งานที่ไม่ได้อยู่ระหว่างติดตามแล้ว ไม่ต้องขึ้นในรายการรอติดตาม
  select kind into current_kind
  from public.ld_work_statuses
  where code = new.work_status;

  if current_kind is distinct from 'open' then
    new.next_follow_date := null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_ld_leads_sync on public.ld_leads;
create trigger trg_ld_leads_sync before insert or update on public.ld_leads
  for each row execute function public.ld_sync_status();

-- ---------- View: เพิ่มชื่อ/สี/พฤติกรรมของสถานะที่ join มาแล้ว ----------
drop view if exists public.v_ld_leads;

create view public.v_ld_leads as
select
  l.*,
  c.code      as customer_code,
  cu.name     as channel_name,
  br.name     as branch_name,
  co.name     as company_name,
  bd.name     as brand_name,
  md.name     as model_name,
  e.full_name as owner_full_name,
  ws.name       as work_status_name,
  ws.kind       as work_status_kind,
  ws.color      as work_status_color,
  ws.sort_order as work_status_sort,
  ch.name       as chance_name,
  ch.color      as chance_color,
  ch.sort_order as chance_sort,
  (select count(*)           from public.ld_follow_ups f where f.lead_id = l.id) as follow_count,
  (select max(f.follow_date) from public.ld_follow_ups f where f.lead_id = l.id) as last_follow_date
from public.ld_leads l
left join public.customers           c  on c.id  = l.customer_id
left join public.mc_contact_channels cu on cu.id = l.channel_id
left join public.branches            br on br.id = l.branch_id
left join public.companies           co on co.id = l.company_id
left join public.mc_brands           bd on bd.id = l.brand_id
left join public.mc_models           md on md.id = l.model_id
left join public.employees           e  on e.id  = l.owner_id
left join public.ld_work_statuses    ws on ws.code = l.work_status
left join public.ld_chances          ch on ch.code = l.chance;

revoke all on public.v_ld_leads from anon, authenticated;

drop view if exists public.v_ld_follow_ups;

create view public.v_ld_follow_ups as
select
  f.*,
  l.doc_no        as lead_no,
  l.customer_name as customer_name,
  l.owner_id      as lead_owner_id,
  e.full_name     as recorded_by_full_name,
  ws.name  as work_status_name,
  ws.color as work_status_color,
  ch.name  as chance_name,
  ch.color as chance_color
from public.ld_follow_ups f
join public.ld_leads l on l.id = f.lead_id
left join public.employees        e  on e.id = f.recorded_by
left join public.ld_work_statuses ws on ws.code = f.work_status
left join public.ld_chances       ch on ch.code = f.chance;

revoke all on public.v_ld_follow_ups from anon, authenticated;

-- ---------- เมนูตั้งค่า ----------
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, 'LEAD_SETUP', '5. ตั้งค่าสถานะ', '/leads/setup', 'setting'::menu_kind, 50
from public.programs p
where p.code = 'LEAD'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้น: ผู้ดูแลระบบและผู้ช่วยแก้ไขได้ · หัวหน้าดูได้อย่างเดียว · พนักงานทั่วไปไม่เห็นเมนูนี้
-- (ให้สิทธิ์เป็นรายคนเพิ่มได้ที่ /core/program-rights)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  lvl.level in ('admin', 'assistant_admin', 'supervisor'),
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'LEAD_SETUP'
on conflict (level, menu_id) do nothing;
