-- ============================================================
-- ระบบแจ้งเคลม: เลขที่ Job และวันที่ของ job ในใบ Update งานเคลม (ข้อ 1.5.10-1.5.13)
--
--   1.5.10 เลขที่ Job no          → job_no
--   1.5.11 วันที่เปิด job          → job_open_date
--   1.5.12 วันที่ปิด job           → job_close_date
--   1.5.13 วันที่ส่งมอบงาน/ปิด job → job_deliver_date
--
-- เก็บ 2 ที่โดยตั้งใจ (แบบเดียวกับสถานะงานและยอดที่ขออนุมัติ):
--   cl_claim_updates : "ครั้งนี้บันทึกอะไร" — ประวัติว่าใครใส่เลข job เมื่อไหร่
--   cl_claims        : "ตอนนี้เป็นยังไง"   — ค่าล่าสุด ใช้ค้นหา/แสดงในตารางและ dashboard
--                                            โดยไม่ต้อง join ใบ update ทีละแถว
-- ค่าบนใบขอเคลมถูกเขียนจาก applyClaimUpdate() ที่เดียว (src/lib/claim.ts)
--
-- view ต้องสร้างใหม่ เพราะรายชื่อคอลัมน์ของ view ถูกตรึงไว้ตอนสร้าง (ทั้งสอง view ใช้ c.* / u.*)
-- รันต่อจาก 0035 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

alter table public.cl_claim_updates
  add column if not exists job_no           text,
  add column if not exists job_open_date    date,
  add column if not exists job_close_date   date,
  add column if not exists job_deliver_date date;

alter table public.cl_claims
  add column if not exists job_no           text,
  add column if not exists job_open_date    date,
  add column if not exists job_close_date   date,
  add column if not exists job_deliver_date date;

-- ค้นใบขอเคลมจากเลขที่ job (หน้าจอสอบถาม ข้อ 2)
create index if not exists idx_cl_claims_job_no on public.cl_claims (job_no);

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
