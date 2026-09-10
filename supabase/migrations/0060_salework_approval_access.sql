-- ============================================================
-- เปิดให้พนักงานขายยื่นเรื่องขออนุมัติได้เอง จากในระบบบันทึกงานประจำวัน
--
--   1. คนที่ใช้โปรแกรม SALEWORK อยู่แล้ว ได้สิทธิ์เข้าโปรแกรม APV (ระบบอนุมัติกลาง) ด้วย
--   2. ระดับ "ผู้ใช้งานทั่วไป" ในกลุ่มนั้น: เมนู "ยื่นเรื่องขออนุมัติ" อ่าน/เพิ่ม ได้ แต่แก้ไข/ลบ ไม่ได้
--
-- เหตุผล: หน้า /salework จะมีลิงก์ไปหน้ายื่นเรื่องขออนุมัติ พนักงานขายจึงต้องมีสิทธิ์เข้าถึง
-- ตรวจข้อมูลจริงก่อนเขียน (2026-09-10): พนักงานขายระดับ user 25 คน มีสิทธิ์เข้า APV แค่ 3 คน
-- อีก 22 คนกดลิงก์แล้วจะเด้งออกทันที เพราะ "สิทธิ์เข้าโปรแกรม" เป็นประตูด่านแรกของทุกสิทธิ์
--
-- ทำไมต้อง override รายคน ไม่แก้ค่าเริ่มต้นของระดับ:
--   ค่าเริ่มต้นของระดับ user บน APV_NEW คือ อ่าน/เพิ่ม/แก้ไข (ตั้งไว้ตั้งแต่ 0023)
--   ถ้าไปแก้ค่าเริ่มต้นจะกระทบผู้ใช้ระดับเดียวกันทั้งองค์กร ไม่ใช่แค่พนักงานขายตามที่สั่ง
--   จึงตั้งเป็นค่าเฉพาะราย (override) เฉพาะคนที่อยู่ในโปรแกรม SALEWORK เท่านั้น
--
-- หมายเหตุ: เมนู "เรื่องของฉัน" (APV_MINE) ได้สิทธิ์อ่านมาจากค่าเริ่มต้นของระดับอยู่แล้ว
-- จึงไม่ต้องตั้งอะไรเพิ่ม — พอเปิดสิทธิ์เข้าโปรแกรมให้ ก็ติดตามผลเรื่องที่ยื่นไปได้เลย
-- ส่วนกล่องรออนุมัติ/สอบถาม/ตั้งค่า ระดับ user ปิดอยู่แล้ว การเปิดโปรแกรมนี้จึงไม่ทำให้เห็นเพิ่ม
--
-- ผู้ใช้ที่เพิ่มเข้าระบบ "หลังจาก" รัน migration นี้ ต้องกำหนดสิทธิ์เองที่ /core/program-users
-- รันซ้ำได้ ไม่เกิดแถวซ้ำ
-- ============================================================

-- ---------- 1. สิทธิ์เข้าโปรแกรมระบบอนุมัติกลาง ----------
insert into public.user_programs (user_id, program_id)
select up.user_id, apv.id
from public.user_programs up
join public.programs sw on sw.id = up.program_id and sw.code = 'SALEWORK'
cross join public.programs apv
where apv.code = 'APV'
on conflict do nothing;

-- ---------- 2. ยื่นเรื่องขออนุมัติ: อ่าน/เพิ่ม ได้ · แก้ไข/ลบ ไม่ได้ ----------
insert into public.user_menu_permissions (user_id, menu_id, can_read, can_write, can_edit, can_delete)
select e.id, m.id, true, true, false, false
from public.employees e
join public.user_programs up on up.user_id = e.id
join public.programs sw on sw.id = up.program_id and sw.code = 'SALEWORK'
cross join public.program_menus m
where m.code = 'APV_NEW'
  and e.access_level = 'user'
on conflict (user_id, menu_id) do update
  set can_read   = true,
      can_write  = true,
      can_edit   = false,
      can_delete = false,
      updated_at = now();
