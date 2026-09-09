-- ============================================================
-- ภาษีหัก ณ ที่จ่ายในใบรับเงิน
--
-- ปัญหาเดิม: บริษัทรถอนุมัติ 5,000 หักภาษี ณ ที่จ่าย 3% (150) โอนจริง 4,850
-- ผู้ใช้กรอก 4,850 ระบบจึงคิดว่ายังค้างอีก 150 บาท ทั้งที่จบยอดแล้ว
-- (ส่วนที่ถูกหักคือภาษีที่เอาไปเครดิตคืนได้ ไม่ใช่หนี้ที่บริษัทรถยังค้างอยู่)
--
-- ของใหม่ในใบรับเงิน 1 งวด:
--   received_amount  ยอดเต็มก่อนหักภาษี  ← ยอดนี้คือตัวที่ใช้ตัดยอดค้าง
--   wht_amount       ภาษีหัก ณ ที่จ่าย
--   เงินเข้าบัญชีจริง = received_amount - wht_amount (คำนวณจากสองค่านี้ ไม่เก็บซ้ำ)
-- ============================================================

alter table public.mkt_receipts
  add column if not exists wht_amount numeric(14,2) not null default 0;

comment on column public.mkt_receipts.received_amount is
  'ยอดเต็มก่อนหักภาษี ณ ที่จ่าย — ใช้ตัดยอดค้างของใบกิจกรรม';
comment on column public.mkt_receipts.wht_amount is
  'ภาษีหัก ณ ที่จ่ายของงวดนี้ (เงินเข้าบัญชีจริง = received_amount - wht_amount)';

-- ---------- view: รวมภาษีหัก ณ ที่จ่ายเข้าไปด้วย ----------

drop view if exists public.v_mkt_activities;

create view public.v_mkt_activities as
select
  a.id,
  a.doc_no,
  a.activity_date,
  a.title,
  a.memo,
  a.request_amount,
  a.approved_amount,
  a.active_status,
  a.flow_status,
  a.settled_short,
  a.settled_note,
  a.activity_type_id,
  t.name  as activity_type_name,
  a.company_id,
  c.name  as company_name,
  a.created_by_staff_id,
  s.name  as created_by_name,
  sub.id            as submission_id,
  sub.submit_date,
  sub.postal_no,
  sub.letter_photo_path,
  sub.ack_photo_path,
  sub.active_status as submission_status,
  ss.name           as submitted_by_name,
  coalesce(rc.received_amount, 0) as received_amount,
  coalesce(rc.wht_amount, 0)      as wht_amount,
  coalesce(rc.receipt_count, 0)   as receipt_count,
  rc.last_receive_date,
  rc.last_receipt_no,
  rc.last_received_by_name,
  a.created_at,
  a.updated_at
from public.mkt_activities a
left join public.mkt_activity_types t on t.id = a.activity_type_id
left join public.mkt_companies      c on c.id = a.company_id
left join public.mkt_staff          s on s.id = a.created_by_staff_id
left join public.mkt_submissions  sub on sub.activity_id = a.id
left join public.mkt_staff         ss on ss.id = sub.submitted_by_staff_id
left join lateral (
  -- นับเฉพาะงวดที่ยังใช้งานอยู่ งวดที่ยกเลิกไม่นับเข้ายอดรวม
  select
    sum(r.received_amount)                                   as received_amount,
    sum(r.wht_amount)                                        as wht_amount,
    count(*)                                                 as receipt_count,
    max(r.receive_date)                                      as last_receive_date,
    (array_agg(r.receipt_no order by r.receive_date desc, r.created_at desc))[1] as last_receipt_no,
    (array_agg(st.name    order by r.receive_date desc, r.created_at desc))[1]   as last_received_by_name
  from public.mkt_receipts r
  left join public.mkt_staff st on st.id = r.received_by_staff_id
  where r.activity_id = a.id and r.active_status = 'active'
) rc on true;
