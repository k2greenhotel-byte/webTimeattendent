-- ============================================================
-- ให้สิทธิ์โปรแกรม LEAD กับ "พนักงานกลุ่มเดียวกับระบบจองรถ (BOOK)"
--
-- ทีมขายที่รับจองรถอยู่แล้ว คือคนกลุ่มเดียวกับที่ต้องบันทึกและติดตาม Lead
-- จึงคัดลอกสิทธิ์จากโปรแกรม BOOK มาให้ครบทั้งสองชั้น:
--   1) user_programs        — ประตูเข้าโปรแกรม
--   2) user_menu_permissions — สิทธิ์รายเมนูที่ตั้งไว้เป็นรายบุคคล (ถ้ามี) โดยจับคู่เมนูที่ทำงานเหมือนกัน
--        BOOK_ENTRY  (รับจองรถ)        → LEAD_ENTRY  (บันทึก Lead)
--        BOOK_UPDATE (update ใบจอง)    → LEAD_FOLLOW (บันทึกผลติดตาม)
--        BOOK_SEARCH (สอบถามใบจอง)     → LEAD_SEARCH (สอบถาม Lead)
--        BOOK_DASH   (dashboard ใบจอง) → LEAD_DASH   (dashboard งานขาย)
--
-- ไม่ลบสิทธิ์ของใคร และรันซ้ำได้ (on conflict do nothing)
-- คนที่ได้สิทธิ์เพิ่ม/ลดภายหลัง ปรับเองได้ที่ /core/program-users
-- รันต่อจาก 0020
-- ============================================================

-- ---------- 1) ประตูเข้าโปรแกรม ----------
insert into public.user_programs (user_id, program_id)
select up.user_id, lead.id
from public.user_programs up
join public.programs book on book.id = up.program_id and book.code = 'BOOK'
cross join public.programs lead
where lead.code = 'LEAD'
on conflict do nothing;

-- ---------- 2) สิทธิ์รายเมนูรายบุคคล (เฉพาะคนที่ตั้งค่าไว้เป็นรายคน) ----------
insert into public.user_menu_permissions (user_id, menu_id, can_read, can_write, can_edit, can_delete)
select
  ump.user_id,
  target.id,
  ump.can_read,
  ump.can_write,
  ump.can_edit,
  ump.can_delete
from public.user_menu_permissions ump
join public.program_menus source on source.id = ump.menu_id
join public.programs book on book.id = source.program_id and book.code = 'BOOK'
join (values
  ('BOOK_ENTRY',  'LEAD_ENTRY'),
  ('BOOK_UPDATE', 'LEAD_FOLLOW'),
  ('BOOK_SEARCH', 'LEAD_SEARCH'),
  ('BOOK_DASH',   'LEAD_DASH')
) as pair(from_code, to_code) on pair.from_code = source.code
join public.program_menus target on target.code = pair.to_code
on conflict (user_id, menu_id) do nothing;
