-- ============================================================================
-- 0030 — โปรแกรม DB2: เพิ่มเมนู จอ War Room ยอดขาย และ สต็อก Cross Tab
-- (ข้อมูลสดจากแอป Db2 ผ่าน /api/db2/* — ไม่มีตารางใน Supabase)
-- ============================================================================

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('DB2_WALL',  '4. จอ War Room ยอดขาย (สาขา/พนักงานขาย/รุ่น)', '/db2/wall',        'dashboard', 40),
  ('DB2_PIVOT', '5. สต็อกรถ Cross Tab (เลือกแกน/กรองได้)',      '/db2/stock/pivot', 'inquiry',   50)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'DB2'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select lvl.level::access_level, m.id, true, false, false, false
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('DB2_WALL', 'DB2_PIVOT')
on conflict (level, menu_id) do nothing;
