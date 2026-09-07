-- ============================================================
-- เปิดสิทธิ์ให้คนที่ใช้ระบบจองรถอยู่แล้ว
--
--   1. เข้าโปรแกรม "บันทึกงานประจำวันพนักงานขาย" (SALEWORK) ได้
--   2. เห็นเมนู "สอบถามสต๊อกรถ" (BOOK_STOCK) ของระบบจองรถ
--
-- เหตุผล: คนกลุ่มเดียวกัน (พนักงานขาย) ใช้ทั้งสองระบบคู่กัน — รับจองรถแล้วบันทึกงานประจำวัน
-- และต้องเช็คสต็อกก่อนรับจองอยู่ทุกวัน จึงไม่ควรต้องมาขอสิทธิ์ทีละคน
--
-- ให้สิทธิ์ "เข้าโปรแกรม" เท่านั้น ส่วนทำอะไรได้บ้างในแต่ละเมนูยังคุมด้วย
-- สิทธิ์ตามระดับการทำงานเหมือนเดิม (ระดับ user บันทึกงานของตัวเองได้ แต่แก้ค่าตั้งต้นไม่ได้)
--
-- ผู้ใช้ที่เพิ่มเข้าระบบ "หลังจาก" รัน migration นี้ ต้องกำหนดสิทธิ์เองที่ /core/program-users
-- รันซ้ำได้ ไม่เกิดแถวซ้ำ
-- ============================================================

-- ---------- 1. โปรแกรมบันทึกงานพนักงานขาย ----------
insert into public.user_programs (user_id, program_id)
select up.user_id, sw.id
from public.user_programs up
join public.programs bk on bk.id = up.program_id and bk.code = 'BOOK'
cross join public.programs sw
where sw.code = 'SALEWORK'
on conflict do nothing;

-- ---------- 2. เมนูสอบถามสต๊อกรถ ----------
-- ปกติเปิดให้ทุกระดับอ่านได้อยู่แล้วตั้งแต่ migration 0033 — ใส่ซ้ำกันพลาดกรณีแถวหาย
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select lvl.level::access_level, m.id, true, false, false, false
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'BOOK_STOCK'
on conflict (level, menu_id) do nothing;

-- override รายคนที่เผลอปิดสิทธิ์อ่านเมนูสต็อกไว้ ให้เปิดกลับ (เมนูนี้ไม่มีราคาทุน จึงไม่ต้องหวง)
update public.user_menu_permissions u
   set can_read = true
  from public.program_menus m
 where m.id = u.menu_id
   and m.code = 'BOOK_STOCK'
   and u.can_read = false;
