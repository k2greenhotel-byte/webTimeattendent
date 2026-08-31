-- ============================================================
-- ข้อมูลตั้งต้น : รันหลังจาก 0001_init.sql
-- PIN เริ่มต้นของทุกบัญชีในไฟล์นี้คือ 1234  (เปลี่ยนทันทีหลัง login ครั้งแรก)
-- ============================================================

-- ตั้งค่าเวลาทำงานมาตรฐาน
insert into public.work_settings (id, org_name, work_start, work_end, break_start, break_end)
values (1, 'ร้านของฉัน', '08:00', '17:00', '12:00', '13:00')
on conflict (id) do nothing;

-- แอดมิน + พนักงานตัวอย่าง (bcrypt hash สร้างด้วย pgcrypto)
insert into public.employees (emp_code, full_name, nickname, department, position, pin_hash, role)
values
  ('admin', 'ผู้ดูแลระบบ',      'แอดมิน', 'สำนักงาน', 'ผู้จัดการ',
     extensions.crypt('1234', extensions.gen_salt('bf', 10)), 'admin'),
  ('EMP001', 'สมชาย ใจดี',      'ชาย',    'หน้าร้าน',  'พนักงานขาย',
     extensions.crypt('1234', extensions.gen_salt('bf', 10)), 'employee'),
  ('EMP002', 'สมหญิง รักงาน',   'หญิง',   'หน้าร้าน',  'พนักงานขาย',
     extensions.crypt('1234', extensions.gen_salt('bf', 10)), 'employee')
on conflict (emp_code) do nothing;

-- ตัวอย่างวันหยุด (แก้ไข/เพิ่มได้ตามจริง)
insert into public.holidays (holiday_date, name) values
  ('2026-01-01', 'วันขึ้นปีใหม่'),
  ('2026-04-13', 'วันสงกรานต์'),
  ('2026-04-14', 'วันสงกรานต์'),
  ('2026-04-15', 'วันสงกรานต์')
on conflict (holiday_date) do nothing;
