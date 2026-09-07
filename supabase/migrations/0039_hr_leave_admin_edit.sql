-- ============================================================
-- เพิ่มหน้าจอฝ่ายบุคคล: แก้ไขใบแจ้งลาของพนักงานคนอื่น (โปรแกรม HR)
--
--   HR_LEAVE_MANAGE : /hr/manage/leave
--     - เห็นใบแจ้งลาทุกสถานะ ไม่ใช่แค่ที่รออนุมัติเหมือนเมนู 5 (HR_LEAVE_APPROVE)
--     - แก้ประเภทการลา ช่วงวันที่ รายละเอียด และเปลี่ยนสถานะได้ตรง ๆ ทั้ง 5 สถานะ
--       (ไม่ใช่แค่เลือกผลอนุมัติ 3 แบบเหมือนหน้าอนุมัติปกติ)
--     - ใช้กรณีพนักงานบันทึกเข้ามาผิด หรือแจ้งใช้สิทธิ์การลาผิดประเภท
--
-- สิทธิ์: เฉพาะ admin/assistant_admin (ฝ่ายบุคคล) — ไม่ให้ supervisor เพราะสิทธิ์นี้
-- เขียนทับข้อมูลของพนักงานคนอื่นได้โดยตรง (แม้ใบจะตัดสินไปแล้ว) ไม่ผ่านเงื่อนไขการยื่น/อนุมัติปกติ
-- จึงเป็นอำนาจที่สูงกว่าเมนูอนุมัติทั่วไป — ยังต้องผ่านประตูรหัสผ่านผู้อนุมัติเหมือนเมนูอื่นในกลุ่มนี้
--
-- รันต่อจาก 0038
-- ============================================================

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('HR_LEAVE_MANAGE', '11. แก้ไขข้อมูลการลา (ฝ่ายบุคคล)', '/hr/manage/leave', 'setting', 110)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'HR'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level in ('admin', 'assistant_admin'),
  false
from public.program_menus m
join public.programs p on p.id = m.program_id and p.code = 'HR'
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'HR_LEAVE_MANAGE'
on conflict (level, menu_id) do nothing;
