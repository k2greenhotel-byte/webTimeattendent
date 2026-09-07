-- ============================================================
-- ระบบแจ้งเคลม (โปรแกรม CLM)
--
--   cl_doc_counters        : ตัวนับเลขที่เอกสาร แยกตามปี พ.ศ. (ชุดเดียวกับ pr_/bk_ แต่แยกตาราง)
--   cl_claims              : ใบขอเคลม (หน้าจอ 1.4)
--   cl_claim_items         : รายการที่ขอเคลม (ข้อ 1.4.10 — หนึ่งใบมีได้หลายรายการ)
--   cl_claim_photos        : รูปภาพของใบขอเคลม (ข้อ 1.4.14 สูงสุด 10 รูป)
--   cl_claim_updates       : ใบ update งานเคลม (หน้าจอ 1.5) — หนึ่งใบขอเคลมมีได้หลายใบ
--   cl_claim_update_photos : รูปงานที่กำลังซ่อม/ซ่อมเสร็จ (ข้อ 1.5.9)
--
-- หลักการ (เหมือนระบบแจ้งซ่อม เพราะเป็นงานติดตามสถานะแบบเดียวกัน):
--   * บริษัท/สาขา/ผู้บันทึก อ้างด้วย FK (on delete set null) ลบตัวแม่แล้วประวัติงานเคลมยังอยู่
--   * สถานะปัจจุบันอยู่บนใบขอเคลม ส่วนการเปลี่ยนแต่ละครั้งเก็บเป็นแถวใน cl_claim_updates
--     (ใบขอเคลม = "ตอนนี้เป็นยังไง" · ใบ update = "ใครเปลี่ยนอะไรเมื่อไหร่")
--   * รถและลูกค้าดึงจากระบบขาย (Db2) ผ่าน popup ค้นเลขตัวถัง แล้ว **เก็บสำเนาไว้บนใบ**
--     ทั้งรหัสและชื่อ — ใบเก่าต้องอ่านออกแม้ระบบขายจะแก้ข้อมูลภายหลัง และหน้าจอรายการ
--     จะได้ไม่ต้องยิงถาม Db2 ทีละแถว (Db2 อยู่ในวง LAN บริษัท ล่มได้)
--   * ลูกค้าภายนอกที่ไม่มีใน Db2 (ข้อ 1.4.9) ใช้ตารางเดียวกัน แค่ is_external = true
--     แล้วคีย์ เลขตัวถัง/เลขเครื่อง/ชื่อ/ที่อยู่/เบอร์ เองทั้งหมด
--   * เปิด RLS ทุกตารางและไม่มี policy ให้ anon — อ่าน/เขียนผ่าน service role ฝั่ง server เท่านั้น
-- รันต่อจาก 0034 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- ชนิดข้อมูลสถานะ ----------
do $$
begin
  -- 1.4.12 ความเร่งด่วนที่ต้องได้รับการแก้ไข (ชุดเดียวกับระบบแจ้งซ่อม)
  if not exists (select 1 from pg_type where typname = 'cl_urgency') then
    create type cl_urgency as enum ('d1_2', 'd2_5', 'd5_plus');
  end if;

  -- 1.4.18 สถานะเอกสาร
  if not exists (select 1 from pg_type where typname = 'cl_doc_status') then
    create type cl_doc_status as enum ('active', 'cancelled');
  end if;

  -- 1.4.19 / 1.5.4 สถานะงานเคลม
  --   wait_notify รอติดต่อแจ้งผู้ผลิต · sent_agent ส่งเรื่องให้ตัวแทนผู้ผลิต
  --   approved อนุมัติ · rejected ไม่อนุมัติ · in_progress อยู่ระหว่างดำเนินการแก้ไข
  --   done แก้ไขเรียบร้อย
  if not exists (select 1 from pg_type where typname = 'cl_job_status') then
    create type cl_job_status as enum
      ('wait_notify', 'sent_agent', 'approved', 'rejected', 'in_progress', 'done');
  end if;
end
$$;

-- ---------- ตัวนับเลขที่เอกสาร ----------
create table if not exists public.cl_doc_counters (
  prefix text primary key,
  seq    int  not null default 0
);

-- ออกเลขที่เอกสารถัดไปแบบกันชนกัน (นับต่อ prefix + ปี พ.ศ.)
--   cl_next_doc_no('CM', 2569)  -> 'CM-2569-0001'   (ใบขอเคลม)
--   cl_next_doc_no('CMU', 2569) -> 'CMU-2569-0001'  (ใบ update งานเคลม)
create or replace function public.cl_next_doc_no(doc_prefix text, be_year int)
returns text
language plpgsql
as $fn$
declare
  key      text := doc_prefix || '-' || be_year::text;
  next_seq int;
begin
  insert into public.cl_doc_counters (prefix, seq)
  values (key, 1)
  on conflict (prefix) do update set seq = public.cl_doc_counters.seq + 1
  returning seq into next_seq;

  return key || '-' || lpad(next_seq::text, 4, '0');
end;
$fn$;

-- ---------- ใบขอเคลม (หน้าจอ 1.4) ----------
create table if not exists public.cl_claims (
  id                 uuid primary key default gen_random_uuid(),
  doc_no             text not null unique,                                          -- 1.4.1 เลขที่ใบขอเคลม (ระบบรันให้)
  claim_date         date not null,                                                 -- 1.4.2 วันที่
  company_id         uuid references public.companies (id) on delete set null,      -- 1.4.3 บริษัท (ดึงจาก login)
  branch_id          uuid references public.branches (id)  on delete set null,      -- 1.4.4 สาขา (ดึงจาก login)

  -- ---------- รถ (1.4.5-1.4.6) — สำเนาจากระบบขาย (Db2) หรือคีย์เองถ้าเป็นลูกค้าภายนอก ----------
  chassis_no         text not null,                                                 -- 1.4.5 เลขตัวถัง (INVTRAN.STRNO)
  engine_no          text,                                                          -- 1.4.9 เลขเครื่อง (INVTRAN.ENGNO)
  db2_brand_code     text,                                                          -- 1.4.6 ยี่ห้อ (INVTRAN.TYPE)
  db2_brand_name     text,
  db2_model_code     text,                                                          --       รุ่น (SETMODEL)
  db2_model_name     text,
  db2_variant_code   text,                                                          --       แบบ (SETBAAB)
  db2_variant_name   text,
  db2_color_code     text,                                                          --       สี
  db2_color_name     text,
  db2_contno         text,                                                          -- เลขที่สัญญาขายใน Db2 (อ้างอิงกลับได้)
  db2_locat          text,                                                          -- สาขาที่ขาย
  db2_sale_date      date,                                                          -- วันที่ขาย

  -- ---------- ลูกค้า (1.4.7-1.4.9) ----------
  db2_cuscod         text,                                                          -- 1.4.7 รหัสลูกค้าใน Db2 (ว่าง = ลูกค้าภายนอก)
  customer_name      text not null,                                                 -- 1.4.7 ชื่อลูกค้า
  customer_phone     text,                                                          -- 1.4.8 เบอร์โทร (พิมพ์ใหม่เสมอ)
  customer_address   text,                                                          -- 1.4.9 ที่อยู่
  is_external        boolean not null default false,                                -- 1.4.9 ไม่มีข้อมูลใน Db2 → คีย์เอง

  damage_detail      text,                                                          -- 1.4.11 อธิบายความเสียหาย
  urgency            cl_urgency    not null default 'd2_5',                         -- 1.4.12 ความเร่งด่วน
  created_by         uuid references public.employees (id) on delete set null,      -- 1.4.13 ผู้บันทึกจัดทำ (ดึงจาก login)
  created_by_name    text,                                                          -- เก็บชื่อไว้ด้วย เผื่อบัญชีถูกลบภายหลัง

  maker_name         text,                                                          -- 1.4.15 ชื่อบริษัทผู้ผลิต
  maker_agent_name   text,                                                          -- 1.4.16 ชื่อตัวแทนบริษัทผู้ผลิต
  maker_phone        text,                                                          -- 1.4.17 เบอร์โทรผู้ที่ดำเนินการแก้ไข

  doc_status         cl_doc_status not null default 'active',                       -- 1.4.18 สถานะเอกสาร
  job_status         cl_job_status not null default 'wait_notify',                  -- 1.4.19 สถานะงาน
  reject_reason      text,                                                          -- 1.4.20 เหตุผลไม่อนุมัติ
  result_date        date,                                                          -- 1.4.21 วันที่แจ้งผลการอนุมัติ
  fixed_date         date,                                                          -- 1.4.22 วันที่ซ่อมเสร็จ
  delivered_date     date,                                                          -- 1.4.23 วันที่ส่งมอบรถคืนลูกค้า

  -- ค่าที่ใบ update (1.5) ผลักขึ้นมา — ใบขอเคลมเป็นที่เดียวที่บอก "ตอนนี้เป็นยังไง"
  expected_done_date date,                                                          -- 1.5.6 วันที่คาดว่าจะซ่อมเสร็จ
  requested_amount   numeric(12, 2) not null default 0,                             -- 1.5.7 จำนวนเงินที่ขออนุมัติ

  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_cl_claims_date     on public.cl_claims (claim_date);
create index if not exists idx_cl_claims_company  on public.cl_claims (company_id);
create index if not exists idx_cl_claims_branch   on public.cl_claims (branch_id);
create index if not exists idx_cl_claims_job      on public.cl_claims (job_status, doc_status);
create index if not exists idx_cl_claims_urgency  on public.cl_claims (urgency);
create index if not exists idx_cl_claims_chassis  on public.cl_claims (chassis_no);
create index if not exists idx_cl_claims_cuscod   on public.cl_claims (db2_cuscod);

-- 1.4.10 รายการที่ขอเคลม — บันทึกได้หลายรายการต่อหนึ่งใบ
create table if not exists public.cl_claim_items (
  id         uuid primary key default gen_random_uuid(),
  claim_id   uuid not null references public.cl_claims (id) on delete cascade,
  item_name  text not null,
  qty        numeric(10, 2) not null default 1,
  note       text,
  sort_order int not null default 0
);

create index if not exists idx_cl_claim_items on public.cl_claim_items (claim_id, sort_order);

-- 1.4.14 รูปภาพ บันทึกได้ 10 รูป (จำกัดจำนวนที่ชั้น server action)
create table if not exists public.cl_claim_photos (
  id         uuid primary key default gen_random_uuid(),
  claim_id   uuid not null references public.cl_claims (id) on delete cascade,
  path       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_cl_claim_photos on public.cl_claim_photos (claim_id, sort_order);

-- ---------- ใบ update งานเคลม (หน้าจอ 1.5) ----------
create table if not exists public.cl_claim_updates (
  id                 uuid primary key default gen_random_uuid(),
  doc_no             text not null unique,                                            -- 1.5.1 เลขที่
  update_date        date not null,                                                   -- 1.5.2 วันที่
  claim_id           uuid not null references public.cl_claims (id) on delete cascade, -- 1.5.3 อ้างอิงใบขอเคลม
  job_status         cl_job_status,                                                    -- 1.5.4 สถานะงาน (null = ไม่เปลี่ยน)
  detail             text,                                                             -- 1.5.5 รายละเอียดเพิ่มเติม
  expected_done_date date,                                                             -- 1.5.6 วันที่คาดว่าจะซ่อมเสร็จ
  requested_amount   numeric(12, 2),                                                   -- 1.5.7 จำนวนเงินที่ขออนุมัติ (null = ไม่เปลี่ยน)
  reject_reason      text,                                                             -- 1.4.20 เหตุผลไม่อนุมัติ (บันทึกพร้อมสถานะ "ไม่อนุมัติ")
  recorded_by        uuid references public.employees (id) on delete set null,         -- 1.5.8 ผู้บันทึก
  recorded_by_name   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_cl_claim_updates_claim on public.cl_claim_updates (claim_id);
create index if not exists idx_cl_claim_updates_date  on public.cl_claim_updates (update_date);

-- 1.5.9 รูปงานที่กำลังซ่อมหรือซ่อมเสร็จแล้ว
create table if not exists public.cl_claim_update_photos (
  id         uuid primary key default gen_random_uuid(),
  update_id  uuid not null references public.cl_claim_updates (id) on delete cascade,
  path       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_cl_claim_update_photos on public.cl_claim_update_photos (update_id, sort_order);

-- ---------- RLS + trigger updated_at ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'cl_doc_counters', 'cl_claims', 'cl_claim_items', 'cl_claim_photos',
    'cl_claim_updates', 'cl_claim_update_photos'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array array['cl_claims', 'cl_claim_updates']
  loop
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- ---------- View: ใบขอเคลมพร้อมชื่อที่ join แล้ว ----------
drop view if exists public.v_cl_claims;

create view public.v_cl_claims as
select
  c.*,
  co.name as company_name,
  co.code as company_code,
  br.name as branch_name,
  br.code as branch_code,
  e.full_name as created_by_full_name,
  (select count(*) from public.cl_claim_photos  p where p.claim_id = c.id) as photo_count,
  (select count(*) from public.cl_claim_items   i where i.claim_id = c.id) as item_count,
  (select count(*) from public.cl_claim_updates u where u.claim_id = c.id) as update_count,
  -- รายการที่ขอเคลมย่อเป็นบรรทัดเดียว ให้หน้าจอรายการ/สอบถามแสดงได้โดยไม่ต้องยิง query ซ้ำทีละใบ
  (select string_agg(i.item_name, ', ' order by i.sort_order)
     from public.cl_claim_items i where i.claim_id = c.id) as item_summary
from public.cl_claims c
left join public.companies co on co.id = c.company_id
left join public.branches  br on br.id = c.branch_id
left join public.employees e  on e.id  = c.created_by;

revoke all on public.v_cl_claims from anon, authenticated;

-- ---------- View: ใบ update งานเคลม ----------
drop view if exists public.v_cl_claim_updates;

create view public.v_cl_claim_updates as
select
  u.*,
  c.doc_no        as claim_no,
  c.chassis_no    as claim_chassis_no,
  c.customer_name as claim_customer_name,
  c.company_id    as company_id,
  c.branch_id     as branch_id,
  br.name         as branch_name,
  e.full_name     as recorded_by_full_name,
  (select count(*) from public.cl_claim_update_photos p where p.update_id = u.id) as photo_count
from public.cl_claim_updates u
join public.cl_claims c on c.id = u.claim_id
left join public.branches  br on br.id = c.branch_id
left join public.employees e  on e.id  = u.recorded_by;

revoke all on public.v_cl_claim_updates from anon, authenticated;

-- ---------- ลงทะเบียนโปรแกรมและเมนู ----------
insert into public.programs (code, name, description, path, icon, sort_order) values
  ('CLM', 'ระบบแจ้งเคลม',
          'แจ้งเคลมรถของลูกค้ากับบริษัทผู้ผลิต ติดตามผลการอนุมัติและงานแก้ไขจนส่งมอบรถคืน',
          '/claim', '🧾', 55)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('CLM_CLAIM',  '1.4 บันทึกแจ้งเคลม',      '/claim/claims',    'entry',     10),
  ('CLM_UPDATE', '1.5 Update งานเคลม',      '/claim/updates',   'entry',     20),
  ('CLM_SEARCH', '2. สอบถามงานขอเคลม',      '/claim/search',    'inquiry',   30),
  ('CLM_DASH',   '3. Dashboard ติดตามเคลม', '/claim/dashboard', 'dashboard', 40)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'CLM'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้นตามระดับ:
--   หน้าจอบันทึก (แจ้งเคลม / update) — ทุกระดับบันทึกและแก้ไขได้ ลบได้เฉพาะ admin
--   หน้าจอสอบถาม / dashboard — ทุกระดับดูอย่างเดียว
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  true,
  m.code in ('CLM_CLAIM', 'CLM_UPDATE'),
  m.code in ('CLM_CLAIM', 'CLM_UPDATE'),
  m.code in ('CLM_CLAIM', 'CLM_UPDATE') and lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('CLM_CLAIM', 'CLM_UPDATE', 'CLM_SEARCH', 'CLM_DASH')
on conflict (level, menu_id) do nothing;

-- ให้สิทธิ์เข้าโปรแกรมกับผู้ดูแลระบบไว้ก่อน คนอื่นเพิ่มทีหลังที่ /core/program-users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'CLM' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;
