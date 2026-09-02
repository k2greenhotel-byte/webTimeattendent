-- ============================================================
-- ผูกพนักงานการตลาด (mkt_staff) เข้ากับบัญชีเข้าระบบ (employees)
--
-- โมดูลการตลาดเปลี่ยนมาใช้การล็อกอินด้วยเบอร์มือถือ + รหัสผ่าน ชุดเดียวกับระบบลงเวลา
-- จึงต้องรู้ว่าคนที่ล็อกอินอยู่ตรงกับพนักงานการตลาดแถวไหน เพื่อเลือก "ผู้บันทึก" ให้อัตโนมัติ
--
-- จับคู่ด้วยรหัส: mkt_staff.code = employees.emp_code (ตอน seed ครั้งแรกคัดมาจากตารางเดียวกัน)
-- แถวที่จับคู่ไม่ได้ปล่อยเป็น null ได้ ผู้ใช้ยังเลือกชื่อจาก dropdown เองได้เหมือนเดิม
-- ============================================================

alter table public.mkt_staff
  add column if not exists employee_id uuid references public.employees(id) on delete set null;

-- พนักงาน 1 คนผูกกับแถวการตลาดได้แถวเดียว
create unique index if not exists idx_mkt_staff_employee
  on public.mkt_staff (employee_id) where employee_id is not null;

update public.mkt_staff s
set employee_id = e.id
from public.employees e
where s.employee_id is null
  and upper(trim(s.code)) = upper(trim(e.emp_code));

-- view เดิมไม่ต้องแก้ (ไม่ได้อ้างถึงคอลัมน์นี้) แต่สร้างซ้ำเพื่อให้ schema ตรงกันเสมอ
comment on column public.mkt_staff.employee_id is
  'บัญชีเข้าระบบที่ผูกกับพนักงานการตลาดคนนี้ (null = ยังไม่ได้ผูก)';
