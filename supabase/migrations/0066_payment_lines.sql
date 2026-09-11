-- ============================================================
-- ใบเบิกหนึ่งใบ จ่ายได้หลายรายการ
--
-- เดิมใบเบิกหนึ่งใบมี "รายการค่าใช้จ่าย" ช่องเดียว ประเภทค่าใช้จ่าย (ผังบัญชี) ช่องเดียว
-- และจำนวนเงินก้อนเดียว — ถ้าใบเดียวจ่ายหลายอย่าง เช่น ค่าน้ำมัน ค่าเครื่องเขียน ค่าส่งของ
-- ต้องยัดรวมในข้อความเดียวกัน แล้วลงบัญชีได้หมวดเดียว รายงานแยกตามผังบัญชีจึงไม่ตรง
--
-- ตาราง pr_payment_items มีอยู่แล้วและอ้างใบขอซ่อม/ใบขอซื้อได้หลายใบต่อหนึ่งใบเบิก
-- (หน้าจอเลือกเลขที่อนุมัติหลายใบได้อยู่ก่อนแล้ว) แต่เก็บได้แค่ยอด
-- จึงเติมรายละเอียดกับผังบัญชีรายบรรทัด ให้บรรทัดที่ไม่ได้ผูกกับเอกสารอนุมัติก็บันทึกได้
--
-- รันต่อจาก 0065 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- 1) รายละเอียดรายบรรทัด ----------
alter table public.pr_payment_items
  add column if not exists detail     text,
  add column if not exists account_id uuid references public.pr_accounts (id) on delete set null;

create index if not exists idx_pr_payment_items_account on public.pr_payment_items (account_id);

-- ---------- 2) ย้ายใบเบิกเดิมให้มาอยู่ในรูปแบบรายบรรทัด ----------
-- ใบที่ยังไม่มีบรรทัดเลย (จ่ายทั่วไปไม่ผ่านอนุมัติ) — สร้างบรรทัดเดียวจากหัวเอกสาร
insert into public.pr_payment_items (payment_id, repair_id, purchase_id, amount, detail, account_id, sort_order)
select p.id, null, null, p.paid_amount, p.expense_detail, p.account_id, 0
from public.pr_payments p
where not exists (select 1 from public.pr_payment_items i where i.payment_id = p.id);

-- ใบที่มีบรรทัดอยู่แล้ว (ผูกกับใบขอซ่อม/ขอซื้อ) — เติมรายละเอียดจากเอกสารต้นทาง
-- และผังบัญชีจากหัวเอกสาร เพื่อให้ทุกบรรทัดมีข้อมูลครบเหมือนกัน
update public.pr_payment_items i
set detail = coalesce(
      i.detail,
      (select r.item_name  from public.pr_repairs   r  where r.id  = i.repair_id),
      (select pu.item_name from public.pr_purchases pu where pu.id = i.purchase_id),
      p.expense_detail
    ),
    account_id = coalesce(i.account_id, p.account_id)
from public.pr_payments p
where p.id = i.payment_id
  and (i.detail is null or i.account_id is null);

-- ---------- 3) view สำหรับอ่านรายการพร้อมชื่อที่ join มาแล้ว ----------
-- หน้ารายละเอียดและใบพิมพ์อ่านจาก view นี้ จะได้ไม่ต้อง join เองในหน้าเว็บ
drop view if exists public.v_pr_payment_items;

create view public.v_pr_payment_items as
select
  i.id,
  i.payment_id,
  i.repair_id,
  i.purchase_id,
  i.amount,
  i.detail,
  i.account_id,
  i.sort_order,
  ac.code     as account_code,
  ac.name     as account_name,
  ac.category as account_category,
  -- เลขที่เอกสารต้นทางและเลขที่อนุมัติ ใช้แสดงบนใบพิมพ์
  coalesce(r.doc_no, pu.doc_no)             as doc_no,
  coalesce(r.approval_no, pu.approval_no)   as approval_no,
  coalesce(r.approved_date, pu.approved_date) as approved_date,
  coalesce(r.approved_by, pu.approved_by)   as approved_by,
  coalesce(r.item_name, pu.item_name)       as doc_item_name,
  case
    when i.repair_id is not null then 'repair'
    when i.purchase_id is not null then 'purchase'
    else null
  end as doc_kind
from public.pr_payment_items i
left join public.pr_accounts   ac on ac.id = i.account_id
left join public.pr_repairs    r  on r.id  = i.repair_id
left join public.pr_purchases  pu on pu.id = i.purchase_id;

revoke all on public.v_pr_payment_items from anon, authenticated;
