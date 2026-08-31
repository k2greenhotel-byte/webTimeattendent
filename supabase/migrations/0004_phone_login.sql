-- ============================================================
-- ใช้เบอร์มือถือเป็นรหัสเข้าระบบของพนักงาน
--   - เก็บเบอร์เป็นตัวเลขล้วน (ตัด - และช่องว่างออก) เพื่อให้ค้นหา/เทียบได้ตรง
--   - ห้ามซ้ำกัน (unique) เพราะใช้ระบุตัวตนตอน login
-- ============================================================

-- 1) ทำให้เบอร์เดิมเป็นตัวเลขล้วน
update public.employees
set phone = regexp_replace(phone, '[^0-9]', '', 'g')
where phone is not null and phone <> regexp_replace(phone, '[^0-9]', '', 'g');

-- 2) เบอร์ว่าง ๆ ให้เป็น null (null ซ้ำกันได้ แต่ค่าว่างซ้ำไม่ได้)
update public.employees set phone = null where phone = '';

-- 3) ห้ามเบอร์ซ้ำ (เฉพาะแถวที่มีเบอร์)
create unique index if not exists idx_employees_phone_unique
  on public.employees (phone) where phone is not null;

comment on column public.employees.phone is 'เบอร์มือถือ (ตัวเลขล้วน) ใช้เป็นรหัสเข้าระบบของพนักงาน';
comment on column public.employees.pin_hash is 'รหัสผ่าน/PIN 4-8 หลัก เก็บเป็น bcrypt hash พนักงานเปลี่ยนเองได้';
