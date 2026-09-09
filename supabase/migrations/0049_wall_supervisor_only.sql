-- ============================================================
-- จอ War Room ทุกโปรแกรม: ยืนยันนโยบายเดียวกันทั้งหมด
-- เปิดให้ระดับ "หัวหน้าขึ้นไป" เห็น (admin / assistant_admin / supervisor)
-- ระดับ user ไม่เห็น
--
-- ทุกจอ War Room ใช้นโยบายนี้อยู่แล้วตอนสร้างเมนู ยกเว้น DB2_WALL
-- (migration 0030) ที่ตอนนั้นเปิดให้ทุกระดับเห็นได้หมด — แก้ให้ตรงกัน
-- ============================================================

update public.level_menu_permissions lp
set can_read = (lp.level in ('admin', 'assistant_admin', 'supervisor'))
from public.program_menus m
where lp.menu_id = m.id
  and m.code like '%\_WALL' escape '\';
