-- ============================================================================
-- 0068 — โปรแกรม DB2: เพิ่มเมนู จอ War Room ลูกหนี้เช่าซื้อ
-- (ข้อมูลสดจาก ARMAST/ARPAY/NOTEFOLLOW ผ่าน /api/hpdebt — ไม่มีตารางใน Supabase)
--
-- ชื่อรหัสลงท้ายด้วย _WALL เพื่อให้นโยบายจอ War Room (0049) ครอบคลุมอัตโนมัติ
-- ============================================================================

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('DB2_HP_WALL', '8. จอ War Room ลูกหนี้เช่าซื้อ (คงเหลือ/ค้างงวด/ผลติดตาม)', '/db2/hpdebt/wall', 'dashboard', 80)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'DB2'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- จอ War Room: หัวหน้าขึ้นไป (นโยบายเดียวกับจอ War Room อื่นทุกโปรแกรม)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select lvl.level::access_level, m.id, true, false, false, false
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor')) as lvl(level)
where m.code = 'DB2_HP_WALL'
on conflict (level, menu_id) do nothing;
