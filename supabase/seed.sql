-- ============================================================
-- ข้อมูลตั้งต้น : รันหลัง migration ทั้งหมด
-- PIN เริ่มต้นของทุกบัญชีในไฟล์นี้คือ 1234  (เปลี่ยนทันทีหลัง login ครั้งแรก)
-- ============================================================

-- ค่าระดับองค์กร (เวลาทำงานอยู่ในตาราง work_schedules)
insert into public.work_settings (id, org_name)
values (1, 'ร้านของฉัน')
on conflict (id) do nothing;

-- แผนก / ตำแหน่ง
insert into public.departments (name) values ('สำนักงาน'), ('หน้าร้าน')
on conflict (name) do nothing;

insert into public.positions (name) values ('ผู้จัดการ'), ('พนักงานขาย')
on conflict (name) do nothing;

-- พนักงานตัวอย่าง (ผูกสาขาหลัก + แผนก + ตำแหน่ง)
insert into public.employees
  (emp_code, full_name, nickname, phone, branch_id, department_id, position_id, pin_hash, role)
values
  ('admin', 'ผู้ดูแลระบบ', 'แอดมิน', '0800000000',
   (select id from public.branches where code = 'MAIN'),
   (select id from public.departments where name = 'สำนักงาน'),
   (select id from public.positions where name = 'ผู้จัดการ'),
   extensions.crypt('1234', extensions.gen_salt('bf', 10)), 'admin'),
  ('EMP001', 'สมชาย ใจดี', 'ชาย', '0811111111',
   (select id from public.branches where code = 'MAIN'),
   (select id from public.departments where name = 'หน้าร้าน'),
   (select id from public.positions where name = 'พนักงานขาย'),
   extensions.crypt('1234', extensions.gen_salt('bf', 10)), 'employee'),
  ('EMP002', 'สมหญิง รักงาน', 'หญิง', '0822222222',
   (select id from public.branches where code = 'MAIN'),
   (select id from public.departments where name = 'หน้าร้าน'),
   (select id from public.positions where name = 'พนักงานขาย'),
   extensions.crypt('1234', extensions.gen_salt('bf', 10)), 'employee')
on conflict (emp_code) do update
  -- เติมเบอร์ให้บัญชีเดิมที่ยังไม่มี (เบอร์ใช้เป็นรหัสเข้าระบบ)
  set phone = coalesce(public.employees.phone, excluded.phone);

-- ตัวอย่างวันหยุด (แก้ไข/เพิ่มได้ในหน้าหลังบ้าน)
insert into public.holidays (holiday_date, name) values
  ('2026-01-01', 'วันขึ้นปีใหม่'),
  ('2026-04-13', 'วันสงกรานต์'),
  ('2026-04-14', 'วันสงกรานต์'),
  ('2026-04-15', 'วันสงกรานต์')
on conflict (holiday_date) do nothing;
