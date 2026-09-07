-- ============================================================
-- แยกสถานะอนุมัติ/ไม่อนุมัติของใบแจ้งลาเป็น 2 ชั้นตามผู้ตัดสิน (ฝ่ายบุคคล vs ผู้บริหาร)
-- และเพิ่ม 2 สถานะใหม่ (ส่งให้ผู้บริหารอนุมัติ, ให้เปลี่ยนประเภทการลา)
--
-- สถานะเดิม (5): pending, need_docs, approved, rejected, cancelled
-- สถานะใหม่ (9): pending, need_docs, approved_hr, escalated, approved_exec,
--                rejected_hr, rejected_exec, need_type_change, cancelled
--
-- เหตุผล: ฝ่ายบุคคลกับผู้บริหารมีอำนาจต่างกัน ต้องแยกบันทึกว่าใครเป็นคนตัดสินจริง
-- เพื่อให้รายงาน/dashboard แยกได้ และเพื่อให้หน้าแก้ไขข้อมูลของฝ่ายบุคคล (/hr/manage/leave)
-- ล้มคำตัดสินของผู้บริหารไม่ได้ (บังคับที่ชั้นแอปพลิเคชัน แต่สถานะต้องแยกกันก่อนถึงจะคุมได้)
--
-- Postgres enum แก้ไข/ลบค่าเดิมในทรานแซกชันเดียวไม่ได้ จึงต้องสร้างชนิดใหม่ทั้งชนิด:
--   1. drop view ที่พึ่งพาคอลัมน์ status ก่อน (ห้าม alter column type ถ้ายังมี view อ้างอิงอยู่)
--   2. เปลี่ยนชื่อ enum เดิมออกไปพัก แล้วสร้างใหม่ด้วยชื่อเดิม
--   3. ย้ายข้อมูลเดิม: 'approved' → 'approved_hr' (ฝ่ายบุคคล) · 'rejected' → 'rejected_hr'
--      (เดิมมีผู้ตัดสินคนเดียว ถือว่าเป็นการตัดสินระดับฝ่ายบุคคลไปก่อน แก้ย้อนหลังได้ที่
--      หน้าฝ่ายบุคคล/หน้าอนุมัติตามปกติถ้าจริง ๆ ควรเป็นของผู้บริหาร)
--   4. สร้าง view กลับตามเดิมทุกประการ (0024_leave_advance.sql)
--
-- รันต่อจาก 0039
-- ============================================================

drop view if exists public.v_hr_leave_requests;

alter table public.hr_leave_requests alter column status drop default;

alter type public.hr_leave_status rename to hr_leave_status_old;

create type public.hr_leave_status as enum (
  'pending',           -- รออนุมัติ
  'need_docs',         -- ขอเอกสารเพิ่ม
  'approved_hr',       -- อนุมัติโดยฝ่ายบุคคล
  'escalated',         -- ส่งให้ผู้บริหารอนุมัติ
  'approved_exec',     -- อนุมัติโดยผู้บริหาร
  'rejected_hr',       -- ไม่อนุมัติโดยฝ่ายบุคคล
  'rejected_exec',     -- ไม่อนุมัติโดยผู้บริหาร
  'need_type_change',  -- ให้เปลี่ยนประเภทการลา
  'cancelled'          -- ผู้แจ้งยกเลิกเอง
);

alter table public.hr_leave_requests
  alter column status type public.hr_leave_status
  using (
    case status::text
      when 'approved' then 'approved_hr'
      when 'rejected' then 'rejected_hr'
      else status::text
    end
  )::public.hr_leave_status;

alter table public.hr_leave_requests alter column status set default 'pending'::public.hr_leave_status;

drop type public.hr_leave_status_old;

-- ---------- สร้าง view กลับตามเดิม (0024_leave_advance.sql) ----------
create view public.v_hr_leave_requests as
select
  r.*,
  t.code  as type_code,
  t.name  as type_name,
  t.icon  as type_icon,
  t.is_paid,
  t.require_medical_cert,
  t.needs_arrival_time,
  co.name as company_name,
  b.name  as branch_name,
  b.code  as branch_code,
  rr.name as reason_name,
  (select count(*) from public.hr_leave_files f where f.request_id = r.id) as file_count,
  (select count(*) from public.hr_leave_files f where f.request_id = r.id and f.kind = 'cert') as cert_count
from public.hr_leave_requests r
join public.hr_leave_types t on t.id = r.type_id
left join public.companies co on co.id = r.company_id
left join public.branches b on b.id = r.branch_id
left join public.apv_reject_reasons rr on rr.id = r.reason_id;

revoke all on public.v_hr_leave_requests from anon, authenticated;
