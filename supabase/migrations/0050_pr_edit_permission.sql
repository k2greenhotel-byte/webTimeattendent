-- ============================================================
-- ให้ผู้ใช้ที่เข้าโปรแกรมจัดซื้อ/แจ้งซ่อมได้ แก้ไขเอกสารของตัวเองได้ (แก้คำที่พิมพ์ผิด)
--
-- เดิมผู้ใช้ทั่วไปได้แค่ อ่าน + เพิ่ม (read/write) บนหน้าแจ้งซ่อมและขอจัดซื้อ
-- พิมพ์ผิดแล้วแก้เองไม่ได้ ต้องรบกวนผู้ดูแลระบบทุกครั้ง
--
-- ให้สิทธิ์ "แก้ไข" เพิ่ม แต่ยังแก้ผลอนุมัติไม่ได้ เพราะสองช่องนั้นถูกกันไว้ที่ชั้นโค้ดอยู่แล้ว:
--   * ฟอร์มแสดง "จำนวนเงินที่อนุมัติเบิก" และ "สถานะอนุมัติ" เป็นช่องอ่านอย่างเดียว
--   * server action (readRepair / readPurchase) ไม่อ่านสองช่องนี้จากฟอร์มเลย
--     แต่คงค่าเดิมจากฐานข้อมูลเสมอ — ต่อให้ปลอมฟอร์มส่งมาก็เปลี่ยนไม่ได้
--   * มีแต่หน้าจออนุมัติ (3.1) ที่เขียนค่าพวกนี้ได้ ซึ่งต้องมีสิทธิ์ PR_APPROVE
--     บวกกับยืนยันรหัสผ่านผู้อนุมัติซ้ำอีกชั้น
--
-- ไม่แตะสิทธิ์ลบ (can_delete) — ลบเอกสารยังเป็นของผู้ดูแลระบบเท่านั้น
-- ไม่แตะ PR_APPROVE — ใครอนุมัติได้ยังเหมือนเดิม
--
-- รันต่อจาก 0049 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- 1) สิทธิ์รายคน (override) ของคนที่อยู่ในโปรแกรมอยู่แล้ว ----------
-- ระบบนี้ให้สิทธิ์ผู้ใช้ทั่วไปผ่าน override รายคนเป็นหลัก (ค่าเริ่มต้นตามระดับปิดไว้หมด)
-- จึงต้องเปิด can_edit ที่ override ไม่ใช่ที่ค่าเริ่มต้นของระดับ
update public.user_menu_permissions ump
set can_edit = true
from public.program_menus m, public.programs p
where m.id = ump.menu_id
  and p.id = m.program_id
  and p.code = 'PR'
  and m.code in ('PR_REPAIR', 'PR_PURCHASE')
  -- เปิดให้เฉพาะคนที่เข้าหน้านั้นได้อยู่แล้ว ไม่ไปเปิดให้คนที่ถูกปิดไว้ตั้งใจ
  and ump.can_read = true
  and ump.can_edit = false;

-- คนที่อยู่ในโปรแกรมแต่ยังไม่มีแถว override ของสองเมนูนี้ ให้สร้างให้ครบ
insert into public.user_menu_permissions (user_id, menu_id, can_read, can_write, can_edit, can_delete)
select up.user_id, m.id, true, true, true, false
from public.user_programs up
join public.programs p      on p.id = up.program_id
join public.program_menus m on m.program_id = p.id
join public.employees e     on e.id = up.user_id
where p.code = 'PR'
  and m.code in ('PR_REPAIR', 'PR_PURCHASE')
  and e.is_active
  and not exists (
    select 1 from public.user_menu_permissions x
    where x.user_id = up.user_id and x.menu_id = m.id
  )
on conflict (user_id, menu_id) do nothing;

-- ---------- 2) ค่าเริ่มต้นตามระดับ ----------
-- เผื่อผู้ใช้ใหม่ที่ยังไม่มี override รายคน จะได้แก้เอกสารได้เลยโดยไม่ต้องมาตั้งค่าซ้ำ
-- (ระดับ user ยังปิด read ไว้ตามที่องค์กรตั้งไว้ ไม่ไปเปลี่ยน — แค่เปิด edit ให้ระดับที่เปิด read อยู่แล้ว)
update public.level_menu_permissions lp
set can_edit = true
from public.program_menus m, public.programs p
where m.id = lp.menu_id
  and p.id = m.program_id
  and p.code = 'PR'
  and m.code in ('PR_REPAIR', 'PR_PURCHASE')
  and lp.can_read = true
  and lp.can_edit = false;
