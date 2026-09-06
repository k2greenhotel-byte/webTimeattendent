-- ============================================================
-- ใบเบิกเงินสดย่อย รอบปรับตามการใช้งานจริง
--
--   1) เพิ่มช่อง "รายการค่าใช้จ่าย" (คำอธิบายว่าจ่ายค่าอะไร)
--      แยกจาก "ประเภทค่าใช้จ่าย" ที่เป็นบัญชีในผังบัญชี
--
--   2) เพิ่มชื่อผู้ทำจ่ายและลายเซ็นผู้ทำจ่าย
--      ตัดลายเซ็นผู้อนุมัติออก เหลือแค่ชื่อ เพราะผู้อนุมัติเซ็นไว้ที่ใบอนุมัติแล้ว
--      ใบเบิกแค่ดึงชื่อมาแสดงประกอบ
--
--   3) ชื่อผู้อนุมัติขึ้นไปอยู่บนใบขอซ่อม/ใบขอซื้อ (เหมือนเลขที่และวันที่อนุมัติ)
--      เพื่อให้หน้าจ่ายเงินดึงมาเติมให้อัตโนมัติตอนติ๊กเลือกเอกสาร
--
-- รันต่อจาก 0030 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- 1) ชื่อผู้อนุมัติบนเอกสารต้นทาง ----------
alter table public.pr_repairs   add column if not exists approved_by text;
alter table public.pr_purchases add column if not exists approved_by text;

-- เอกสารที่อนุมัติไปแล้วก่อนมีคอลัมน์นี้ ให้ดึงชื่อจากใบอนุมัติล่าสุดที่ผลเป็น "อนุมัติ"
update public.pr_repairs r
set approved_by = a.approver_name
from (
  select distinct on (repair_id) repair_id, approver_name
  from public.pr_approvals
  where repair_id is not null and decision = 'approved'
  order by repair_id, approve_date desc, created_at desc
) a
where a.repair_id = r.id and r.approved_by is null;

update public.pr_purchases p
set approved_by = a.approver_name
from (
  select distinct on (purchase_id) purchase_id, approver_name
  from public.pr_approvals
  where purchase_id is not null and decision = 'approved'
  order by purchase_id, approve_date desc, created_at desc
) a
where a.purchase_id = p.id and p.approved_by is null;

-- ---------- 2) ช่องใหม่ของใบเบิกเงินสดย่อย ----------
alter table public.pr_payments add column if not exists expense_detail  text;
alter table public.pr_payments add column if not exists payer_name      text;
alter table public.pr_payments add column if not exists payer_signature text;

-- ผู้อนุมัติเซ็นไว้ที่ใบอนุมัติแล้ว ใบเบิกเก็บแค่ชื่อ จึงไม่ต้องมีช่องลายเซ็น
-- (ต้องทิ้ง view ที่ select * ก่อน ไม่งั้น Postgres ไม่ยอมให้ลบคอลัมน์ — สร้างใหม่ท้ายไฟล์)
drop view if exists public.v_pr_payments;
alter table public.pr_payments drop column if exists approver_signature;

-- ---------- สร้าง view ใหม่ให้มีชื่อผู้อนุมัติ ----------
drop view if exists public.v_pr_repairs;

create view public.v_pr_repairs as
select
  r.*,
  co.name as company_name,
  br.name as branch_name,
  at.code as asset_type_code,
  at.name as asset_type_name,
  e.full_name as created_by_full_name,
  (select count(*) from public.pr_repair_photos p  where p.repair_id = r.id) as photo_count,
  (select count(*) from public.pr_repair_updates u where u.repair_id = r.id) as update_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.repair_id = r.id), 0) as paid_total
from public.pr_repairs r
left join public.companies      co on co.id = r.company_id
left join public.branches       br on br.id = r.branch_id
left join public.pr_asset_types at on at.id = r.asset_type_id
left join public.employees      e  on e.id  = r.created_by;

revoke all on public.v_pr_repairs from anon, authenticated;

drop view if exists public.v_pr_purchases;

create view public.v_pr_purchases as
select
  p.*,
  co.name as company_name,
  br.name as branch_name,
  mt.code as material_type_code,
  mt.name as material_type_name,
  e.full_name as created_by_full_name,
  (select count(*) from public.pr_purchase_photos f where f.purchase_id = p.id) as photo_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.purchase_id = p.id), 0) as paid_total
from public.pr_purchases p
left join public.companies         co on co.id = p.company_id
left join public.branches          br on br.id = p.branch_id
left join public.pr_material_types mt on mt.id = p.material_type_id
left join public.employees         e  on e.id  = p.created_by;

revoke all on public.v_pr_purchases from anon, authenticated;

-- v_pr_docs ต้องมีชื่อผู้อนุมัติด้วย เพราะหน้าจ่ายเงินดึงจาก view นี้
drop view if exists public.v_pr_docs;

create view public.v_pr_docs as
select
  'repair'::text     as kind,
  r.id,
  r.doc_no,
  r.request_date     as doc_date,
  r.company_id,
  co.name            as company_name,
  r.branch_id,
  br.name            as branch_name,
  r.item_name,
  at.name            as type_name,
  r.urgency,
  r.requested_amount,
  r.approved_amount,
  r.actual_amount,
  r.doc_status,
  r.pay_status,
  r.approve_status,
  r.reject_reason,
  r.reject_note,
  r.approval_no,
  r.approved_date,
  r.approved_by,
  r.job_status,
  r.expected_done_date,
  r.fixed_date       as done_date,
  r.created_by,
  r.created_by_name,
  r.note,
  r.created_at
from public.pr_repairs r
left join public.companies      co on co.id = r.company_id
left join public.branches       br on br.id = r.branch_id
left join public.pr_asset_types at on at.id = r.asset_type_id
union all
select
  'purchase'::text   as kind,
  p.id,
  p.doc_no,
  p.request_date     as doc_date,
  p.company_id,
  co.name            as company_name,
  p.branch_id,
  br.name            as branch_name,
  p.item_name,
  mt.name            as type_name,
  p.urgency,
  p.requested_amount,
  p.approved_amount,
  p.actual_amount,
  p.doc_status,
  p.pay_status,
  p.approve_status,
  p.reject_reason,
  p.reject_note,
  p.approval_no,
  p.approved_date,
  p.approved_by,
  null::pr_job_status as job_status,
  null::date          as expected_done_date,
  p.received_date     as done_date,
  p.created_by,
  p.created_by_name,
  p.note,
  p.created_at
from public.pr_purchases p
left join public.companies         co on co.id = p.company_id
left join public.branches          br on br.id = p.branch_id
left join public.pr_material_types mt on mt.id = p.material_type_id;

revoke all on public.v_pr_docs from anon, authenticated;

-- ใบเบิกเงินสดย่อยพร้อมชื่อบัญชีและผู้เกี่ยวข้อง
drop view if exists public.v_pr_payments;

create view public.v_pr_payments as
select
  pay.*,
  co.name as company_name,
  co.code as company_code,
  br.name as branch_name,
  br.code as branch_code,
  ac.code as account_code,
  ac.name as account_name,
  ac.category as account_category,
  e.full_name as created_by_full_name,
  (select count(*) from public.pr_payment_items i where i.payment_id = pay.id) as item_count,
  (select count(*) from public.pr_payment_files f where f.payment_id = pay.id) as file_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.payment_id = pay.id), 0) as item_total
from public.pr_payments pay
left join public.companies   co on co.id = pay.company_id
left join public.branches    br on br.id = pay.branch_id
left join public.pr_accounts ac on ac.id = pay.account_id
left join public.employees   e  on e.id  = pay.created_by;

revoke all on public.v_pr_payments from anon, authenticated;
