-- ============================================================
-- ระบบงานขาย → ระบบข้อมูล Lead (โปรแกรม LEAD)
--
--   ld_doc_counters : ตัวนับเลขที่เอกสาร (ใบ Lead / ใบติดตาม) แยกตามปี พ.ศ.
--   ld_leads        : ข้อมูล Lead — ลูกค้ามุ่งหวังที่พนักงานขายรับเข้ามา (หน้าจอ 1)
--   ld_follow_ups   : ผลการโทรติดตามแต่ละครั้ง (หน้าจอ 2) — หนึ่ง Lead มีได้หลายใบ
--
-- หลักการ:
--   * ลูกค้า/ยี่ห้อ/รุ่น/ช่องทางการติดต่อ ไม่พิมพ์ซ้ำ — อ้างด้วย FK ไปตารางข้อมูลเบื้องต้นที่มีอยู่แล้ว
--     (customers, mc_brands, mc_models, mc_contact_channels) ลบตัวแม่แล้ว Lead ยังอยู่ (on delete set null)
--   * สถานะปัจจุบันอยู่บนใบ Lead ส่วนการติดตามแต่ละครั้งเก็บเป็นแถวใน ld_follow_ups
--     (ใบ Lead คือ "ตอนนี้เป็นยังไง" · ใบติดตามคือ "ใครโทรเมื่อไหร่ ได้ผลยังไง")
--   * ปิดการขายต้องมีเลขที่สัญญาขาย — บังคับที่ชั้นฐานข้อมูลด้วย trigger
--     และสถานะที่จบแล้ว (ไม่เอาแล้ว / ได้รถที่อื่น / ปิดการขาย) จะถูกล้างวันนัดติดตามให้อัตโนมัติ
--   * เปิด RLS ทุกตารางและไม่มี policy ให้ anon — อ่าน/เขียนผ่าน service role ฝั่ง server เท่านั้น
--     การกรอง "พนักงานเห็นเฉพาะ Lead ของตัวเอง" ทำที่ชั้น session (lead-db.ts) ไม่ใช่ที่ RLS
-- รันต่อจาก 0019 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- ชนิดข้อมูลสถานะ ----------
do $$
begin
  -- 1.10 สถานะงาน
  if not exists (select 1 from pg_type where typname = 'ld_work_status') then
    create type ld_work_status as enum ('follow_up', 'dropped', 'bought_other', 'closed_won');
  end if;

  -- 1.11 สถานะโอกาสการขาย (สูง=เขียว / กลาง=เหลือง / น้อย=แดง)
  if not exists (select 1 from pg_type where typname = 'ld_chance') then
    create type ld_chance as enum ('high', 'medium', 'low');
  end if;
end
$$;

-- ---------- ตัวนับเลขที่เอกสาร ----------
create table if not exists public.ld_doc_counters (
  prefix text primary key,
  seq    int  not null default 0
);

alter table public.ld_doc_counters enable row level security;

-- ออกเลขที่เอกสารถัดไปแบบกันชนกัน (นับต่อ prefix + ปี พ.ศ.)
--   ld_next_doc_no('LD',  2569) → 'LD-2569-0001'   (ใบ Lead)
--   ld_next_doc_no('LDF', 2569) → 'LDF-2569-0001'  (ใบติดตาม)
create or replace function public.ld_next_doc_no(doc_prefix text, be_year int)
returns text
language plpgsql
as $fn$
declare
  key      text := doc_prefix || '-' || be_year::text;
  next_seq int;
begin
  insert into public.ld_doc_counters (prefix, seq)
  values (key, 1)
  on conflict (prefix) do update set seq = public.ld_doc_counters.seq + 1
  returning seq into next_seq;

  return key || '-' || lpad(next_seq::text, 4, '0');
end;
$fn$;

-- ---------- ข้อมูล Lead (หน้าจอ 1) ----------
create table if not exists public.ld_leads (
  id               uuid primary key default gen_random_uuid(),
  doc_no           text not null unique,                                                -- 1.1 เลขที่ (ระบบรันให้)
  lead_date        date not null,                                                       -- 1.2 วันที่
  owner_id         uuid references public.employees (id) on delete set null,            -- 1.3 พนักงานขาย (จาก login)
  owner_name       text,                                                                -- เก็บชื่อไว้ด้วย เผื่อบัญชีถูกลบภายหลัง
  customer_id      uuid references public.customers (id) on delete set null,            -- 1.4 ชื่อลูกค้า (ทะเบียนลูกค้า)
  customer_name    text not null,                                                       -- สำเนาชื่อบนใบ กันลูกค้าถูกลบแล้วอ่านไม่ออก
  phone            text,                                                                -- 1.5 เบอร์โทร
  brand_id         uuid references public.mc_brands (id) on delete set null,            -- 1.6 ยี่ห้อ
  model_id         uuid references public.mc_models (id) on delete set null,            -- 1.7 รุ่นรถ
  note             text,                                                                -- 1.8 หมายเหตุ
  channel_id       uuid references public.mc_contact_channels (id) on delete set null,  -- 1.9 ช่องทางการติดต่อ
  channel_other    text,                                                                -- ช่องทาง "อื่นๆ" ระบุเอง
  work_status      ld_work_status not null default 'follow_up',                         -- 1.10 สถานะงาน
  chance           ld_chance      not null default 'medium',                            -- 1.11 สถานะโอกาส
  next_follow_date date,                                                                -- 2.5 วันที่คาดจะติดตามต่อ
  sale_contract_no text,                                                                -- 2.6 เลขที่สัญญาขาย (เมื่อปิดการขาย)
  sale_date        date,                                                                -- 2.6 วันที่ขาย
  branch_id        uuid references public.branches (id) on delete set null,
  company_id       uuid references public.companies (id) on delete set null,
  created_by       uuid references public.employees (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_ld_leads_owner  on public.ld_leads (owner_id);
create index if not exists idx_ld_leads_status on public.ld_leads (work_status, chance);
create index if not exists idx_ld_leads_next   on public.ld_leads (next_follow_date);
create index if not exists idx_ld_leads_date   on public.ld_leads (lead_date);
create index if not exists idx_ld_leads_branch on public.ld_leads (branch_id);
create index if not exists idx_ld_leads_model  on public.ld_leads (model_id);
create index if not exists idx_ld_leads_cust   on public.ld_leads (customer_id);

-- ---------- ผลการติดตาม (หน้าจอ 2) ----------
create table if not exists public.ld_follow_ups (
  id               uuid primary key default gen_random_uuid(),
  doc_no           text not null unique,                                              -- 2.1 เลขที่การติดตาม
  follow_date      date not null,                                                     -- 2.2 วันที่ติดตาม
  lead_id          uuid not null references public.ld_leads (id) on delete cascade,   -- 2.3 อ้างอิงเลขที่ Lead
  detail           text,                                                              -- 2.4 รายละเอียดผลการติดตาม
  next_follow_date date,                                                              -- 2.5 วันที่คาดจะติดตามต่อ
  work_status      ld_work_status,                                                    -- 2.6 เปลี่ยนสถานะงาน (null = ไม่เปลี่ยน)
  chance           ld_chance,                                                         -- 2.7 เปลี่ยนสถานะโอกาส (null = ไม่เปลี่ยน)
  sale_contract_no text,                                                              -- 2.6 เลขที่สัญญาขาย
  sale_date        date,                                                              -- 2.6 วันที่ขาย
  recorded_by      uuid references public.employees (id) on delete set null,
  recorded_by_name text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_ld_follow_lead on public.ld_follow_ups (lead_id);
create index if not exists idx_ld_follow_date on public.ld_follow_ups (follow_date);

-- ---------- RLS + trigger updated_at ----------
do $$
declare
  t text;
begin
  foreach t in array array['ld_leads', 'ld_follow_ups']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- ปิดการขาย = ต้องมีเลขที่สัญญาขาย · งานที่จบแล้วไม่ต้องนัดติดตามต่อ
-- เขียนไว้ที่ชั้นฐานข้อมูลเพื่อให้ได้ผลเหมือนกันทุกทางที่แก้ข้อมูล
create or replace function public.ld_sync_status()
returns trigger
language plpgsql
as $fn$
begin
  -- กรอกเลขที่สัญญาขายมาแล้ว ถือว่าปิดการขายได้ ไม่ว่าจะเลือกสถานะไหนมา
  if coalesce(new.sale_contract_no, '') <> '' then
    new.work_status := 'closed_won';
  end if;

  -- งานที่จบแล้ว (ไม่เอาแล้ว / ได้รถที่อื่น / ปิดการขาย) ไม่ต้องขึ้นในรายการรอติดตาม
  if new.work_status <> 'follow_up' then
    new.next_follow_date := null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_ld_leads_sync on public.ld_leads;
create trigger trg_ld_leads_sync before insert or update on public.ld_leads
  for each row execute function public.ld_sync_status();

-- ---------- View: Lead พร้อมชื่อที่ join แล้ว (ทุกหน้าจออ่านตัวนี้ตัวเดียว) ----------
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
  (select count(*)          from public.ld_follow_ups f where f.lead_id = l.id) as follow_count,
  (select max(f.follow_date) from public.ld_follow_ups f where f.lead_id = l.id) as last_follow_date
from public.ld_leads l
left join public.customers           c  on c.id  = l.customer_id
left join public.mc_contact_channels cu on cu.id = l.channel_id
left join public.branches            br on br.id = l.branch_id
left join public.companies           co on co.id = l.company_id
left join public.mc_brands           bd on bd.id = l.brand_id
left join public.mc_models           md on md.id = l.model_id
left join public.employees           e  on e.id  = l.owner_id;

revoke all on public.v_ld_leads from anon, authenticated;

-- ---------- View: ใบติดตามพร้อมเลขที่ Lead และชื่อลูกค้า ----------
drop view if exists public.v_ld_follow_ups;

create view public.v_ld_follow_ups as
select
  f.*,
  l.doc_no        as lead_no,
  l.customer_name as customer_name,
  l.owner_id      as lead_owner_id,
  e.full_name     as recorded_by_full_name
from public.ld_follow_ups f
join public.ld_leads l on l.id = f.lead_id
left join public.employees e on e.id = f.recorded_by;

revoke all on public.v_ld_follow_ups from anon, authenticated;

-- ---------- ช่องทางการติดต่อตั้งต้น (ข้อ 1.9) ----------
-- เพิ่มเฉพาะที่ยังไม่มี — ร้านเพิ่ม/แก้ชื่อเองได้ที่ /moto/setup/channels
insert into public.mc_contact_channels (code, name, is_active) values
  ('CH01', 'Facebook',        true),
  ('CH02', 'TikTok',          true),
  ('CH03', 'Line',            true),
  ('CH04', 'โทรศัพท์ (Call)', true),
  ('CH05', 'หน้าร้าน (Walk-in)', true),
  ('CH06', 'ออกบูธ (Booth)',  true),
  ('CH99', 'อื่นๆ',           true)
on conflict (code) do nothing;

-- ---------- ลงทะเบียนโปรแกรมและเมนู ----------
insert into public.programs (code, name, description, path, icon, sort_order) values
  ('LEAD', 'ระบบข้อมูล Lead',
           'บันทึกลูกค้ามุ่งหวัง โทรติดตามการขาย จัดลำดับโอกาส และ dashboard ประเมินพนักงานขาย',
           '/leads', '🎯', 45)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('LEAD_ENTRY',  '1. บันทึกข้อมูล Lead',   '/leads/leads',     'entry',     10),
  ('LEAD_FOLLOW', '2. Update ผลการติดตาม',  '/leads/follow',    'entry',     20),
  ('LEAD_SEARCH', '3. สอบถามข้อมูล Lead',   '/leads/search',    'inquiry',   30),
  ('LEAD_DASH',   '4. Dashboard งานขาย',    '/leads/dashboard', 'dashboard', 40)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'LEAD'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้นตามระดับ:
--   หน้าจอบันทึก (Lead/ติดตาม) — ทุกระดับบันทึกและแก้ไขได้ ลบได้เฉพาะ admin
--   หน้าจอสอบถาม/dashboard — ทุกระดับดูได้อย่างเดียว
--   (ระดับ user จะเห็นเฉพาะ Lead ของตัวเอง — บังคับที่ชั้น session ไม่ใช่ที่สิทธิ์เมนู)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  true,
  m.code in ('LEAD_ENTRY', 'LEAD_FOLLOW'),
  m.code in ('LEAD_ENTRY', 'LEAD_FOLLOW'),
  m.code in ('LEAD_ENTRY', 'LEAD_FOLLOW') and lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('LEAD_ENTRY', 'LEAD_FOLLOW', 'LEAD_SEARCH', 'LEAD_DASH')
on conflict (level, menu_id) do nothing;

-- ให้สิทธิ์เข้าโปรแกรมกับผู้ดูแลระบบไว้ก่อน คนอื่นเพิ่มทีหลังที่ /core/program-users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'LEAD' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;
