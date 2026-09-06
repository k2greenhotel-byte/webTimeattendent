-- ============================================================================
-- 0029 — โปรแกรม "ข้อมูลสดจากระบบขาย (Db2)"
--
-- หน้าเว็บในโปรแกรมนี้ไม่มีตารางของตัวเองใน Supabase — ทุกหน้าเรียกข้อมูลสดจาก
-- แอป Db2 ที่รันในบริษัท (src/lib/db2-api.ts) ผ่าน DB2_API_URL + DB2_API_KEY
-- migration นี้จึงมีแค่การลงทะเบียนโปรแกรม/เมนู/สิทธิ์ให้ระบบส่วนกลางรู้จัก
-- ============================================================================

insert into public.programs (code, name, description, path, icon, sort_order) values
  ('DB2', 'ข้อมูลสดจากระบบขาย (Db2)',
          'ยอดขายสด สต็อกรถคงเหลือ และค้นลูกค้า/สัญญาผ่อน ดึงตรงจากฐานข้อมูลระบบขายในบริษัท ณ เวลาที่เปิดดู',
          '/db2', '📡', 48)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      path        = excluded.path,
      icon        = excluded.icon;

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('DB2_DASH',     '1. Dashboard ยอดขายสด',            '/db2/dashboard', 'dashboard', 10),
  ('DB2_STOCK',    '2. สต็อกรถคงเหลือ',                '/db2/stock',     'dashboard', 20),
  ('DB2_CUSTOMER', '3. ค้นลูกค้า / สัญญาผ่อนจากระบบขาย', '/db2/customers', 'inquiry',   30)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'DB2'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- ทุกเมนูเป็นการดูอย่างเดียว (ข้อมูลอยู่ใน Db2 แก้จากที่นี่ไม่ได้) → ทุกระดับอ่านได้ ไม่มีสิทธิ์เขียน
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select lvl.level::access_level, m.id, true, false, false, false
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('DB2_DASH', 'DB2_STOCK', 'DB2_CUSTOMER')
on conflict (level, menu_id) do nothing;

-- ให้สิทธิ์เข้าโปรแกรมกับผู้ดูแลระบบไว้ก่อน คนอื่นเพิ่มทีหลังที่ /core/program-users
insert into public.user_programs (user_id, program_id)
select e.id, p.id
from public.employees e
cross join public.programs p
where p.code = 'DB2' and e.access_level in ('admin', 'assistant_admin')
on conflict do nothing;
