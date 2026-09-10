-- ============================================================================
-- 0063 — โปรแกรม DB2: เพิ่มเมนู Dashboard งานซ่อม และ จอ War Room งานซ่อม
-- (ข้อมูลสดจาก JOBORDER ในแอป Db2 ผ่าน /api/jobs — ไม่มีตารางใน Supabase)
--
-- DB2_JOBS    หน้า dashboard ดึงข้อมูลฝั่ง server (ไม่ผ่าน proxy)
-- DB2_JOB_WALL จอ War Room ดึงเองจาก browser ผ่าน /api/db2/jobs → ต้องมีสิทธิ์นี้
--             ตามนโยบายจอ War Room (0049) ให้เฉพาะระดับหัวหน้าขึ้นไป
-- ============================================================================

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('DB2_JOBS',    '6. Dashboard งานซ่อม (สาขา/ช่าง/งานค้างปิด job)', '/db2/jobs',      'dashboard', 60),
  ('DB2_JOB_WALL', '7. จอ War Room งานซ่อม',                          '/db2/jobs/wall', 'dashboard', 70)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'DB2'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- dashboard งานซ่อม: ดูได้ทุกระดับเหมือน DB2_DASH
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select lvl.level::access_level, m.id, true, false, false, false
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'DB2_JOBS'
on conflict (level, menu_id) do nothing;

-- จอ War Room: หัวหน้าขึ้นไป (ตามนโยบายเดียวกับจอ War Room อื่น)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select lvl.level::access_level, m.id, true, false, false, false
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor')) as lvl(level)
where m.code = 'DB2_JOB_WALL'
on conflict (level, menu_id) do nothing;
