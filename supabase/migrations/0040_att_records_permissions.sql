-- ============================================================
-- เปิดหน้ารายงานลงเวลาและหน้าแก้ไขเวลาย้อนหลัง ให้ผู้ที่ได้รับสิทธิ์เข้าได้โดยไม่ต้องใช้ PIN
--
-- ที่มา: ฝ่ายบุคคลต้องแก้เวลาเข้า-ออกให้พนักงานได้ แต่ไม่ควรต้องแจก PIN ผู้ดูแลระบบ
-- จึงใช้แพตเทิร์นเดียวกับตารางเวร: หน้ายังอยู่ใต้ /admin แต่ตรวจสิทธิ์รายเมนูแทน PIN
--   อ่าน   = เปิดดูรายงาน / เปิดหน้าแก้ไข
--   เพิ่ม  = เพิ่มรายการลงเวลาที่ขาดไป
--   แก้ไข  = แก้เวลาเข้า-ออก และเวลาธุระ
--   ลบ     = ลบรายการลงเวลา / ลบทั้งวัน
--
-- สำคัญ: 0009 เคย seed ให้ "ทุกระดับรวมถึง user" อ่านเมนูรายงานได้ ตอนนั้นไม่มีผลอะไร
-- เพราะหน้ารายงานถูกล็อกด้วย PIN อยู่แล้ว พอเปิดประตูสิทธิ์รายเมนู แถวเดิมจะกลายเป็นของจริง
-- และทำให้พนักงานทั่วไปเห็นเวลาเข้า-ออกของทุกคน จึงต้องปิดสิทธิ์อ่านของระดับ user ที่นี่
-- ============================================================

-- ---------- เมนูใหม่: แก้ไขเวลาย้อนหลัง ----------
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, 'ATT_RECORDS', 'แก้ไขเวลาย้อนหลัง', '/admin/records', 'entry'::menu_kind, 45
from public.programs p where p.code = 'ATT'
on conflict (code) do update
  set name = excluded.name, path = excluded.path, kind = excluded.kind, sort_order = excluded.sort_order;

-- ค่าเริ่มต้น: admin/ผู้ช่วย ทำได้ทุกอย่าง · supervisor อ่าน/เพิ่ม/แก้ไข (ไม่ลบ) · user ไม่เห็น
-- ฝ่ายบุคคลที่ไม่ได้อยู่ในระดับเหล่านี้ ให้กำหนดสิทธิ์รายคนที่ /core (สิทธิ์ผู้ใช้)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  lvl.level in ('admin', 'assistant_admin', 'supervisor'),
  lvl.level in ('admin', 'assistant_admin', 'supervisor'),
  lvl.level in ('admin', 'assistant_admin', 'supervisor'),
  lvl.level in ('admin', 'assistant_admin')
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'ATT_RECORDS'
on conflict (level, menu_id) do nothing;

-- ---------- ปิดสิทธิ์อ่านรายงานของระดับ user ----------
-- (ระดับอื่นคงเดิม · สิทธิ์ที่ตั้งไว้เป็นรายคนใน user_menu_permissions ไม่ถูกแตะ)
update public.level_menu_permissions l
set can_read = false, can_write = false, can_edit = false, can_delete = false
from public.program_menus m
where m.id = l.menu_id
  and l.level = 'user'
  and m.code in ('ATT_REP_DAILY', 'ATT_REP_MONTHLY', 'ATT_REP_EMP');
