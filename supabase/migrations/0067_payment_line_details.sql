-- ============================================================
-- แต่ละรายการจ่ายในใบเบิก มีผู้รับเงิน เลขที่อ้างอิง ป้ายกำกับ และไฟล์แนบของตัวเอง
--
-- 0066 ทำให้ใบเบิกหนึ่งใบมีหลายรายการได้แล้ว แต่ผู้รับเงิน เลขที่อ้างอิง ป้ายกำกับ
-- และรูป/เอกสารแนบ ยังเป็นของหัวเอกสารใบเดียว พอจ่ายหลายรายการให้คนละร้าน
-- ค่าพวกนี้จึงถูกยำรวมกันเป็นข้อความเดียว (เช่นเลขที่อนุมัติหลายเลขต่อกันในช่องเดียว)
-- แยกใบเสร็จของแต่ละรายการไม่ได้ และรายงานตามป้ายกำกับก็ลงลึกได้แค่ระดับใบ
--
-- ย้ายทั้งสี่อย่างลงมาอยู่ที่รายการ ใบเบิกหนึ่งใบจึงเป็นชุดของรายการจ่ายที่สมบูรณ์ในตัว
-- ส่วนหัวเอกสารเหลือแค่สิ่งที่เป็นของทั้งใบจริง ๆ (วันที่ บริษัท/สาขา ยอดรวม ผู้ทำจ่าย ลายเซ็น)
--
-- ช่องเดิมบน pr_payments ไม่ได้ลบทิ้ง — เก็บไว้เป็นค่าสรุปของทั้งใบ ให้รายงานและใบพิมพ์
-- ที่อ้างอยู่เดิมยังอ่านได้ ระบบจะสรุปจากรายการมาเติมให้เอง
--
-- รันต่อจาก 0066 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- 1) ผู้รับเงินและเลขที่อ้างอิงรายบรรทัด ----------
alter table public.pr_payment_items
  add column if not exists ref_no        text,
  add column if not exists vendor_id     uuid references public.pr_vendors (id) on delete set null,
  add column if not exists payee_name    text,
  add column if not exists payee_phone   text,
  add column if not exists payee_address text;

create index if not exists idx_pr_payment_items_vendor on public.pr_payment_items (vendor_id);

-- ---------- 2) ไฟล์แนบผูกกับรายการได้ ----------
-- item_id เป็น null ได้ เพื่อให้ไฟล์ของใบเบิกเก่าที่ยังไม่ได้ระบุรายการไม่หายไป
alter table public.pr_payment_files
  add column if not exists item_id uuid references public.pr_payment_items (id) on delete cascade;

create index if not exists idx_pr_payment_files_item on public.pr_payment_files (item_id, kind, sort_order);

-- ---------- 3) ป้ายกำกับผูกกับรายการ ----------
alter table public.pr_payment_tags
  add column if not exists item_id uuid references public.pr_payment_items (id) on delete cascade;

create index if not exists idx_pr_payment_tags_item on public.pr_payment_tags (item_id);

-- ---------- 4) ย้ายค่าจากหัวเอกสารลงมาที่รายการ ----------
-- ใบเบิกที่มีอยู่ตอนนี้มีรายการละหนึ่งบรรทัด การย้ายจึงตรงตัวและไม่มียอดไหนเพี้ยน
update public.pr_payment_items i
set ref_no        = coalesce(i.ref_no, p.ref_no),
    vendor_id     = coalesce(i.vendor_id, p.vendor_id),
    payee_name    = coalesce(i.payee_name, p.payee_name),
    payee_phone   = coalesce(i.payee_phone, p.payee_phone),
    payee_address = coalesce(i.payee_address, p.payee_address)
from public.pr_payments p
where p.id = i.payment_id
  and (i.payee_name is null or i.ref_no is null);

-- ไฟล์และป้ายเดิมเป็นของทั้งใบ ผูกเข้ากับรายการแรกของใบนั้น
-- (ไม่ปล่อยให้ค้างเป็น null เพราะหน้าจอจัดการไฟล์/ป้ายรายรายการแล้ว ของที่ไม่ผูกจะกลายเป็นของกำพร้า)
create temporary table _first_item on commit drop as
select distinct on (payment_id) payment_id, id as item_id
from public.pr_payment_items
order by payment_id, sort_order, id;

update public.pr_payment_files f
set item_id = fi.item_id
from _first_item fi
where fi.payment_id = f.payment_id
  and f.item_id is null;

update public.pr_payment_tags pt
set item_id = fi.item_id
from _first_item fi
where fi.payment_id = pt.payment_id
  and pt.item_id is null;

-- ป้ายที่หารายการเจ้าของไม่เจอ (ใบที่ไม่มีรายการเลย ซึ่งไม่ควรมีหลัง 0066) ตัดทิ้งเพื่อให้ตั้ง not null ได้
delete from public.pr_payment_tags where item_id is null;

alter table public.pr_payment_tags alter column item_id set not null;

-- คีย์หลักเดิม (payment_id, tag_id) ติดป้ายเดียวกันให้คนละรายการในใบเดียวไม่ได้
-- เปลี่ยนเป็น (item_id, tag_id) — ป้ายเป็นของรายการแล้ว
alter table public.pr_payment_tags drop constraint if exists pr_payment_tags_pkey;
alter table public.pr_payment_tags add primary key (item_id, tag_id);

-- ---------- 5) view รายการพร้อมชื่อที่ join มาแล้ว ----------
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
  i.ref_no,
  i.vendor_id,
  i.payee_name,
  i.payee_phone,
  i.payee_address,
  ac.code     as account_code,
  ac.name     as account_name,
  ac.category as account_category,
  ve.code     as vendor_code,
  ve.name     as vendor_name,
  -- เลขที่เอกสารต้นทางและเลขที่อนุมัติ ใช้แสดงบนใบพิมพ์
  coalesce(r.doc_no, pu.doc_no)               as doc_no,
  coalesce(r.approval_no, pu.approval_no)     as approval_no,
  coalesce(r.approved_date, pu.approved_date) as approved_date,
  coalesce(r.approved_by, pu.approved_by)     as approved_by,
  coalesce(r.item_name, pu.item_name)         as doc_item_name,
  case
    when i.repair_id is not null then 'repair'
    when i.purchase_id is not null then 'purchase'
    else null
  end as doc_kind
from public.pr_payment_items i
left join public.pr_accounts   ac on ac.id = i.account_id
left join public.pr_vendors    ve on ve.id = i.vendor_id
left join public.pr_repairs    r  on r.id  = i.repair_id
left join public.pr_purchases  pu on pu.id = i.purchase_id;

revoke all on public.v_pr_payment_items from anon, authenticated;

-- ---------- 6) รายงานตามป้ายกำกับ ลงลึกถึงระดับรายการ ----------
-- เดิมนับยอดทั้งใบต่อหนึ่งป้าย พอติดป้ายได้รายรายการแล้วต้องนับยอดของรายการนั้นแทน
-- ไม่งั้นใบที่จ่ายหลายรายการจะถูกนับซ้ำเต็มจำนวนในทุกป้าย
drop view if exists public.v_pr_payment_tag_rows;

create view public.v_pr_payment_tag_rows as
select
  pay.id            as payment_id,
  pay.doc_no,
  pay.pay_date,
  -- ยอดของรายการที่ติดป้ายนี้ (ถ้าใบไหนยังไม่มีรายการเลย ใช้ยอดทั้งใบ)
  coalesce(i.amount, pay.paid_amount) as paid_amount,
  pay.pay_source,
  pay.company_id,
  co.name           as company_name,
  pay.branch_id,
  br.name           as branch_name,
  coalesce(i.payee_name, pay.payee_name)         as payee_name,
  coalesce(i.detail, pay.expense_detail)         as expense_detail,
  coalesce(i.account_id, pay.account_id)         as account_id,
  ac.code           as account_code,
  ac.name           as account_name,
  i.id              as item_id,
  t.id              as tag_id,
  t.name            as tag_name,
  t.slug            as tag_slug
from public.pr_payments pay
left join public.pr_payment_items i on i.payment_id = pay.id
left join public.pr_payment_tags  pt on pt.item_id = i.id
left join public.pr_tags          t  on t.id  = pt.tag_id
left join public.companies        co on co.id = pay.company_id
left join public.branches         br on br.id = pay.branch_id
left join public.pr_accounts      ac on ac.id = coalesce(i.account_id, pay.account_id);

revoke all on public.v_pr_payment_tag_rows from anon, authenticated;
