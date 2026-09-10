-- ============================================================
-- ยกเลิกใบขอซ่อม / ใบขอจัดซื้อ ด้วยตัวเอง
--
-- เดิมช่อง "สถานะเอกสาร" เป็น dropdown เปิดอิสระอยู่ในฟอร์มแก้ไข
-- ใครที่แก้เอกสารได้ (ตอนนี้ 115 คน) จึงยกเลิกใบไหนก็ได้ ทุกสาขา ทุกสถานะ
-- รวมถึงใบที่อนุมัติแล้วและใบที่จ่ายเงินไปแล้ว ซึ่งทำให้ยอดในรายงานเพี้ยน
--
-- กฎใหม่ (บังคับที่ชั้นโค้ด ไม่ใช่แค่ซ่อนปุ่ม):
--   * เจ้าของใบยกเลิกใบของตัวเองได้ เฉพาะที่ยังไม่ผ่านการอนุมัติ
--   * คนที่ได้สิทธิ์ PR_CANCEL (ผู้จัดการ/หัวหน้างาน) ยกเลิกใบของคนอื่นได้ด้วย
--   * ใบที่อนุมัติหรือไม่อนุมัติไปแล้ว ต้องเป็นผู้มีอำนาจอนุมัติเท่านั้น
--   * ใบที่จ่ายเงินไปแล้ว ยกเลิกไม่ได้ทุกกรณี ต้องไปลบใบเบิกจ่ายก่อน
--
-- รันต่อจาก 0051 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- 1) ร่องรอยการยกเลิกบนตัวเอกสาร ----------
-- เก็บบนเอกสารเลย ไม่ใช่แค่ audit_logs เพราะหน้าจอกับใบพิมพ์ต้องบอกได้ว่า
-- ใครยกเลิกและยกเลิกเพราะอะไร โดยไม่ต้องให้ผู้ใช้ไปเปิด log
alter table public.pr_repairs
  add column if not exists cancelled_at   timestamptz,
  add column if not exists cancelled_by   uuid references public.employees (id) on delete set null,
  add column if not exists cancel_reason  text;

alter table public.pr_purchases
  add column if not exists cancelled_at   timestamptz,
  add column if not exists cancelled_by   uuid references public.employees (id) on delete set null,
  add column if not exists cancel_reason  text;

-- ---------- 2) view ----------
-- v_pr_repairs / v_pr_purchases ใช้ r.* อยู่แล้ว คอลัมน์ใหม่ไหลตามไปเอง
-- แต่ต้อง drop ก่อนเพื่อให้ชื่อคอลัมน์เรียงใหม่ครบ แล้วเพิ่มชื่อคนยกเลิกเข้าไปด้วย
drop view if exists public.v_pr_repairs;

create view public.v_pr_repairs as
select
  r.*,
  co.name as company_name,
  br.name as branch_name,
  at.code as asset_type_code,
  at.name as asset_type_name,
  e.full_name  as created_by_full_name,
  ec.full_name as cancelled_by_name,
  (select count(*) from public.pr_repair_photos p  where p.repair_id = r.id) as photo_count,
  (select count(*) from public.pr_repair_updates u where u.repair_id = r.id) as update_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.repair_id = r.id), 0) as paid_total
from public.pr_repairs r
left join public.companies      co on co.id = r.company_id
left join public.branches       br on br.id = r.branch_id
left join public.pr_asset_types at on at.id = r.asset_type_id
left join public.employees      e  on e.id  = r.created_by
left join public.employees      ec on ec.id = r.cancelled_by;

revoke all on public.v_pr_repairs from anon, authenticated;

drop view if exists public.v_pr_purchases;

create view public.v_pr_purchases as
select
  p.*,
  co.name as company_name,
  br.name as branch_name,
  mt.code as material_type_code,
  mt.name as material_type_name,
  e.full_name  as created_by_full_name,
  ec.full_name as cancelled_by_name,
  (select count(*) from public.pr_purchase_photos f where f.purchase_id = p.id) as photo_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.purchase_id = p.id), 0) as paid_total
from public.pr_purchases p
left join public.companies         co on co.id = p.company_id
left join public.branches          br on br.id = p.branch_id
left join public.pr_material_types mt on mt.id = p.material_type_id
left join public.employees         e  on e.id  = p.created_by
left join public.employees         ec on ec.id = p.cancelled_by;

revoke all on public.v_pr_purchases from anon, authenticated;

-- v_pr_docs ไล่ชื่อคอลัมน์เอง จึงต้องเติมช่องยกเลิกเข้าไปทั้งสองฝั่งของ union
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
  r.cancelled_at,
  r.cancelled_by,
  ec.full_name       as cancelled_by_name,
  r.cancel_reason,
  r.note,
  r.created_at
from public.pr_repairs r
left join public.companies      co on co.id = r.company_id
left join public.branches       br on br.id = r.branch_id
left join public.pr_asset_types at on at.id = r.asset_type_id
left join public.employees      ec on ec.id = r.cancelled_by
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
  p.cancelled_at,
  p.cancelled_by,
  ec.full_name        as cancelled_by_name,
  p.cancel_reason,
  p.note,
  p.created_at
from public.pr_purchases p
left join public.companies         co on co.id = p.company_id
left join public.branches          br on br.id = p.branch_id
left join public.pr_material_types mt on mt.id = p.material_type_id
left join public.employees         ec on ec.id = p.cancelled_by;

revoke all on public.v_pr_docs from anon, authenticated;

-- ---------- 3) เมนูสำหรับคุมสิทธิ์ยกเลิกเป็นรายคน ----------
-- path เป็น null เพราะไม่ใช่หน้าจอ เป็นแค่ที่เก็บสิทธิ์
-- แถบเมนูกับหน้าแรกของโปรแกรมใช้รายการที่เขียนตายตัวในโค้ด เมนูนี้จึงไม่ไปโผล่กวนผู้ใช้
-- แต่จะขึ้นในหน้า "กำหนดสิทธิ์เมนูในโปรแกรม" ให้ผู้ดูแลติ๊กเพิ่มเป็นรายคนได้
--
-- ใช้ช่อง "ลบ" (can_delete) เป็นตัวสิทธิ์ เพราะความหมายใกล้ที่สุด
-- และไม่ไปพ่วงกับสิทธิ์ลบเอกสารจริงบนเมนู PR_REPAIR / PR_PURCHASE
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('PR_CANCEL', 'สิทธิ์ยกเลิกเอกสารของผู้อื่น (ติ๊กช่อง "ลบ")', null, 'setting', 98)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'PR'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- ค่าเริ่มต้นตามระดับ: ผู้ดูแลกับผู้ช่วยผู้ดูแลได้เลย
-- ระดับ supervisor / user ไม่ให้เป็นค่าเริ่มต้น — ต้องให้ผู้ดูแลติ๊กเพิ่มเป็นรายคน
-- ตามที่ต้องการ คือเลือกได้ว่าจะเพิ่มผู้จัดการหรือหัวหน้างานคนไหนบ้าง
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  true,
  false,
  false,
  lvl.level in ('admin', 'assistant_admin')
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'PR_CANCEL'
on conflict (level, menu_id) do nothing;
