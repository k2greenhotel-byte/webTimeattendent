-- ============================================================
-- สิทธิ์เข้าโปรแกรม (เมนู 5 "กำหนดผู้ใช้งานโปรแกรม") เป็นประตูด่านแรกของทุกสิทธิ์
--
-- เดิม v_user_permissions คิดสิทธิ์ อ่าน/เพิ่ม/แก้ไข/ลบ จากค่าระดับ (level_menu_permissions)
-- หรือค่าเฉพาะราย (user_menu_permissions) เท่านั้น โดยไม่ดู user_programs เลย
-- → สิ่งที่ตั้งในเมนู 5 ไม่มีผลกับการใช้งานจริง
--
-- ลำดับใหม่:
--   1. ระดับ admin              → ได้ทุกสิทธิ์เสมอ (กันแอดมินล็อกตัวเองออกจากระบบ)
--   2. ไม่มีแถวใน user_programs → ไม่มีสิทธิ์ใด ๆ ในโปรแกรมนั้น ไม่ว่าจะตั้งค่าอื่นไว้อย่างไร
--   3. มีค่าเฉพาะราย            → ใช้ค่านั้น
--   4. ไม่มี                    → ใช้ค่าเริ่มต้นของระดับ (แม่แบบ)
--   5. ไม่มีอีก                 → ไม่มีสิทธิ์
--
-- เมนู 4 เปลี่ยนจาก "สิทธิ์ตามระดับ" เป็น "กำหนดสิทธิ์เมนูในโปรแกรม" (/core/program-rights)
-- ที่เลือกโปรแกรม → เห็นเฉพาะคนที่มีสิทธิ์เข้าโปรแกรม → กำหนดเมนูและ อ่าน/เพิ่ม/แก้ไข/ลบ รายคน
-- หน้าสิทธิ์ตามระดับเดิม (/core/levels) ยังอยู่ในฐานะ "แม่แบบ" ที่ใช้เมื่อยังไม่ได้กำหนดเฉพาะราย
-- รันต่อจาก 0017 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

drop view if exists public.v_user_permissions;

create view public.v_user_permissions as
select
  e.id                     as user_id,
  e.access_level,
  p.code                   as program_code,
  p.name                   as program_name,
  m.id                     as menu_id,
  m.code                   as menu_code,
  m.name                   as menu_name,
  m.kind                   as menu_kind,
  m.path                   as menu_path,
  (e.access_level = 'admin')
    or (up.user_id is not null and coalesce(u.can_read,   l.can_read,   false)) as can_read,
  (e.access_level = 'admin')
    or (up.user_id is not null and coalesce(u.can_write,  l.can_write,  false)) as can_write,
  (e.access_level = 'admin')
    or (up.user_id is not null and coalesce(u.can_edit,   l.can_edit,   false)) as can_edit,
  (e.access_level = 'admin')
    or (up.user_id is not null and coalesce(u.can_delete, l.can_delete, false)) as can_delete,
  (u.user_id is not null)  as is_override,
  (up.user_id is not null) as has_program_access
from public.employees e
cross join public.program_menus m
join public.programs p on p.id = m.program_id
left join public.user_programs          up on up.user_id = e.id and up.program_id = p.id
left join public.user_menu_permissions  u  on u.user_id  = e.id and u.menu_id = m.id
left join public.level_menu_permissions l  on l.level = e.access_level and l.menu_id = m.id;

revoke all on public.v_user_permissions from anon, authenticated;

-- ---------- เมนูของระบบส่วนกลาง: ลำดับ 4 ชี้หน้าใหม่ ----------
-- CORE_PERM เดิมชี้ /core/users ซ้ำกับ CORE_USER — เอามาใช้เป็นเมนู 4 ตัวใหม่
update public.program_menus
set name = 'กำหนดสิทธิ์เมนูในโปรแกรม',
    path = '/core/program-rights',
    kind = 'setting',
    sort_order = 40
where code = 'CORE_PERM';

-- หน้าสิทธิ์ตามระดับเดิมยังอยู่ แต่เป็นแม่แบบที่เข้าจากในเมนู 4
update public.program_menus
set name = 'ค่าเริ่มต้นสิทธิ์ตามระดับ (แม่แบบ)',
    sort_order = 41
where code = 'CORE_LEVEL';
