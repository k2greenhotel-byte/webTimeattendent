-- ============================================================
-- จอ War Room ของอีก 3 โปรแกรม + จอรวมสำหรับเปิดบนทีวี
--
--   HR_WALL   ขอลา/ขอเบิกเงินเดือน  ใบรออนุมัติ วันนี้ใครลา ค้างใบรับรองแพทย์
--   CLM_WALL  แจ้งเคลม              งานเลยกำหนด รอผลผู้ผลิต รอส่งมอบรถคืน
--   SW_WALL   งานประจำวันพนักงานขาย  ใครยังไม่ส่งใบงานวันนี้ และทำงานได้กี่ %
--
-- ใช้แพตเทิร์นสิทธิ์เดียวกับ ATT_WALL / MKT_WALL: เปิดให้ระดับหัวหน้าขึ้นไป
--
-- ส่วนจอรวม /wall ไม่ต้องลงทะเบียนเมนู เพราะมันแสดงเฉพาะจอที่ผู้ใช้คนนั้น
-- มีสิทธิ์อยู่แล้ว (อ่านจาก level_menu_permissions ของแต่ละจอ)
-- ============================================================

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, v.code, v.name, v.path, 'dashboard'::menu_kind, v.sort_order
from (values
  ('HR',  'HR_WALL',  'จอ War Room การลา',      '/hr/wall',       95),
  ('CLM', 'CLM_WALL', 'จอ War Room งานเคลม',    '/claim/wall',    95),
  ('SALEWORK', 'SW_WALL',  'จอ War Room งานประจำวัน', '/salework/wall', 95)
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
where m.code in ('HR_WALL', 'CLM_WALL', 'SW_WALL')
on conflict (level, menu_id) do nothing;
