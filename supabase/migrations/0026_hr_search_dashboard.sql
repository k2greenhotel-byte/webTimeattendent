-- ============================================================
-- เพิ่มหน้าจอสอบถามและ Dashboard สรุปให้โปรแกรม HR (ขอลา/ขอเบิกเงินเดือน)
--
--   HR_SEARCH_LEAVE : สอบถามข้อมูลการลา — กรองบริษัท/สาขา/พนักงาน/ช่วงวันที่ + export Excel/CSV/พิมพ์
--   HR_SEARCH_ADV   : สอบถามข้อมูลขอเบิกเงิน — เงื่อนไขเดียวกัน
--   HR_DASHBOARD    : Dashboard สรุปทั้งสองเรื่อง แยกตามบริษัท/สาขา พร้อมอันดับพนักงาน
--
-- หน้าจอเหล่านี้มองเห็นข้อมูล "ทุกคน" ข้ามบริษัท/สาขาได้ (ต่างจากเมนู 2/4 ที่เห็นแค่ของตัวเอง)
-- จึงจัดเป็นสิทธิ์ระดับหัวหน้างานขึ้นไป เหมือนเมนูอนุมัติ (HR_LEAVE_APPROVE/HR_ADV_APPROVE)
-- ไม่ใช่เมนูบันทึกที่เปิดให้พนักงานทุกคน — ถ้าต้องการเปิดกว้างกว่านี้ ปรับได้ที่
-- /core/level-permissions หรือรายคนที่ /core/menu-permissions
--
-- รันต่อจาก 0025
-- ============================================================

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('HR_SEARCH_LEAVE', '8. สอบถามข้อมูลการลา',        '/hr/search/leave',    'inquiry',   80),
  ('HR_SEARCH_ADV',   '9. สอบถามข้อมูลขอเบิกเงิน',    '/hr/search/advance',  'inquiry',   90),
  ('HR_DASHBOARD',    '10. Dashboard สรุปขอลา/เบิกเงิน', '/hr/dashboard',    'dashboard', 100)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'HR'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้น: เปิดให้ supervisor ขึ้นไป (ระดับเดียวกับหน้าอนุมัติ)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  lvl.level in ('admin', 'assistant_admin', 'supervisor'),
  false,
  false,
  false
from public.program_menus m
join public.programs p on p.id = m.program_id and p.code = 'HR'
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('HR_SEARCH_LEAVE', 'HR_SEARCH_ADV', 'HR_DASHBOARD')
on conflict (level, menu_id) do nothing;
