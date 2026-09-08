-- ============================================================
-- จอ War Room ของอีก 4 โปรแกรม — เปิดค้างบนจอมอนิเตอร์ในออฟฟิศ
--
--   MKT_WALL  กิจกรรมการตลาด   เงินค่าส่งเสริมที่ยังไม่กลับเข้าบริษัท
--   BOOK_WALL จองรถ            คิวส่งมอบ ค้างเอกสาร รถขาดสต็อก
--   LEAD_WALL Lead การขาย      คิวติดตามลูกค้าวันนี้ และที่เลยกำหนด
--   PR_WALL   จัดซื้อ/แจ้งซ่อม  ใบรออนุมัติ งานซ่อมค้าง และยอดที่ต้องจ่าย
--
-- ใช้แพตเทิร์นสิทธิ์เดียวกับ ATT_WALL (migration 0043):
-- เป็นจอสรุปรวมของทั้งกิจการ จึงเปิดให้ระดับหัวหน้าขึ้นไป ระดับ user ไม่เห็น
-- ============================================================

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, v.code, v.name, v.path, 'dashboard'::menu_kind, v.sort_order
from (values
  ('MKT', 'MKT_WALL',  'จอ War Room การตลาด',   '/marketing/wall',   95),
  ('BOOK', 'BOOK_WALL', 'จอ War Room จองรถ',     '/booking/wall',     95),
  ('LEAD', 'LEAD_WALL', 'จอ War Room Lead',      '/leads/wall',       95),
  ('PR',  'PR_WALL',   'จอ War Room จัดซื้อ',    '/procurement/wall', 95)
) as v(program_code, code, name, path, sort_order)
join public.programs p on p.code = v.program_code
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
where m.code in ('MKT_WALL', 'BOOK_WALL', 'LEAD_WALL', 'PR_WALL')
on conflict (level, menu_id) do nothing;
