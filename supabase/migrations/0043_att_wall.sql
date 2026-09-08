-- ============================================================
-- จอ War Room ของระบบลงเวลา — เปิดค้างบนจอมอนิเตอร์ในออฟฟิศ
-- ตอบคำถามที่หัวหน้าต้องรู้ตอนนี้: ใครยังไม่มา ใครสาย ใครออกไปข้างนอกอยู่
--
-- สิทธิ์: ใช้แพตเทิร์นเดียวกับหน้ารายงาน (เข้าได้ด้วย PIN หรือสิทธิ์รายเมนู)
-- เป็นจอสรุปรวมของทั้งบริษัท จึงเปิดให้ระดับหัวหน้าขึ้นไป ระดับ user ไม่เห็น
-- ============================================================

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, 'ATT_WALL', 'จอ War Room ลงเวลา', '/admin/wall', 'dashboard'::menu_kind, 35
from public.programs p where p.code = 'ATT'
on conflict (code) do update
  set name = excluded.name, path = excluded.path, kind = excluded.kind, sort_order = excluded.sort_order;

insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  lvl.level in ('admin', 'assistant_admin', 'supervisor'),
  false,
  false,
  false
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'ATT_WALL'
on conflict (level, menu_id) do nothing;
