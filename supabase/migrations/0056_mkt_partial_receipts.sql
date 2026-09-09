-- ============================================================
-- รับเงินได้หลายครั้งต่อ 1 ใบกิจกรรม + ปิดยอดกรณีถูกตัดเงิน
--
-- เดิม mkt_receipts ผูก 1 ใบกิจกรรมต่อ 1 ใบรับเงิน (unique activity_id)
-- ทำให้บันทึกรับเงินงวดถัดไปไม่ได้ ต้องไปแก้ทับใบเดิม
--
-- ของใหม่:
--   * ถอด unique ออก — 1 ใบกิจกรรมมีใบรับเงินได้หลายงวด ยอดรวมคือผลบวกของทุกงวด
--   * mkt_activities.settled_short = ปิดยอดเพราะบริษัทรถตัดเงิน ไม่จ่ายส่วนที่เหลือแล้ว
--   * view รวมยอดรับเงินให้ (sum) พร้อมงวดล่าสุด — ถ้าไม่รวมจะได้ใบกิจกรรมซ้ำหลายแถว
--
-- สถานะการเบิกคิดจากยอดเงินตามกฎใน computeFlowStatus (src/lib/marketing.ts)
-- ที่เดียว — migration นี้แค่ตั้งค่าตั้งต้นให้ข้อมูลเดิมตรงกับกฎใหม่
-- ============================================================

-- ---------- 1 ใบกิจกรรมรับเงินได้หลายงวด ----------

alter table public.mkt_receipts drop constraint if exists mkt_receipts_activity_id_key;

create index if not exists idx_mkt_receipts_activity
  on public.mkt_receipts (activity_id, receive_date desc, created_at desc);

-- ---------- ปิดยอดเพราะถูกตัดเงิน ----------

alter table public.mkt_activities
  add column if not exists settled_short boolean not null default false,
  add column if not exists settled_note  text;

comment on column public.mkt_activities.settled_short is
  'บริษัทรถจ่ายน้อยกว่าที่ขอ/อนุมัติ และจะไม่จ่ายส่วนที่เหลืออีก — ถือว่าจบเรื่องแล้ว';

-- ---------- view: รวมยอดรับเงินทุกงวดเข้าเป็นแถวเดียว ----------

-- ต้อง drop ก่อน เพราะ create or replace เปลี่ยนลำดับ/ชื่อคอลัมน์เดิมไม่ได้
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
    count(*)                                                 as receipt_count,
    max(r.receive_date)                                      as last_receive_date,
    (array_agg(r.receipt_no order by r.receive_date desc, r.created_at desc))[1] as last_receipt_no,
    (array_agg(st.name    order by r.receive_date desc, r.created_at desc))[1]   as last_received_by_name
  from public.mkt_receipts r
  left join public.mkt_staff st on st.id = r.received_by_staff_id
  where r.activity_id = a.id and r.active_status = 'active'
) rc on true;

-- ---------- ปรับสถานะของข้อมูลเดิมให้ตรงกับกฎใหม่ ----------
-- ใบที่เคยเป็น received แต่ยอดรวมยังไม่ถึงยอดที่ควรได้ ให้เป็น "รับเงินบางส่วน"

update public.mkt_activities a
set flow_status = 'partial_received'
from (
  select
    r.activity_id,
    sum(r.received_amount) as total
  from public.mkt_receipts r
  where r.active_status = 'active'
  group by r.activity_id
) t
where t.activity_id = a.id
  and a.flow_status = 'received'
  and a.settled_short = false
  and t.total < coalesce(a.approved_amount, a.request_amount);
