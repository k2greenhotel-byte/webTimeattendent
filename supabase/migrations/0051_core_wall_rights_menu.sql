-- ============================================================
-- เมนู "สิทธิ์จอ War Room" (/core/wall-rights) ในระบบส่วนกลาง
--
-- จอ War Room ของทุกโปรแกรมมีรหัสเมนู *_WALL อยู่แล้ว (ATT_WALL, MKT_WALL, ... DB2_WALL)
-- แต่กระจายอยู่ 10 โปรแกรม การตั้งว่าใครเห็นจอไหนต้องเปิดทีละโปรแกรม
-- หน้านี้รวมทุกจอไว้ตารางเดียว: แถว = ผู้ใช้ · คอลัมน์ = จอ War Room · ติ๊ก = เปิดดูได้
-- ข้อมูลยังลง user_menu_permissions เหมือนเดิม ไม่มีตารางใหม่
-- ============================================================

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, 'CORE_WALL', 'สิทธิ์จอ War Room', '/core/wall-rights', 'setting', 42
from public.programs p
where p.code = 'CORE'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้น: กฎเดียวกับเมนูตั้งค่าสิทธิ์อื่นของระบบส่วนกลาง
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  lvl.level <> 'user',
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'CORE_WALL'
on conflict (level, menu_id) do nothing;
