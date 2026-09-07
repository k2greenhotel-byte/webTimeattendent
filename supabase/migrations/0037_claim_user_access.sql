-- ============================================================
-- ระบบแจ้งเคลม: ให้สิทธิ์ผู้ใช้ "ชุดเดียวกับระบบแจ้งซ่อม"
--
-- migration 0035 เปิดสิทธิ์ CLM ให้เฉพาะ admin / ผู้ช่วย admin ไว้ก่อน
-- แต่คนที่ใช้งานจริงคือกลุ่มเดียวกับที่แจ้งซ่อม (โปรแกรม PR) — 40 คน
-- ไฟล์นี้จึงคัดลอกสิทธิ์จาก PR มา CLM 2 ชั้น:
--
--   1. สิทธิ์เข้าโปรแกรม (user_programs)   — ใครเข้า PR ได้ ก็เข้า CLM ได้
--   2. สิทธิ์รายเมนูเฉพาะราย (user_menu_permissions) — คัดลอกตามเมนูที่ทำงานคู่กัน
--        PR_REPAIR      (1.1 บันทึกแจ้งซ่อม)  → CLM_CLAIM   (1.4 บันทึกแจ้งเคลม)
--        PR_REPAIR_UPD  (1.2 Update งานซ่อม) → CLM_UPDATE  (1.5 Update งานเคลม)
--        PR_SEARCH      (5. สอบถาม)          → CLM_SEARCH  (2. สอบถาม)
--        PR_DASH        (6. Dashboard)       → CLM_DASH    (3. Dashboard)
--
-- ทำไมต้องคัดลอก override ด้วย: ผู้ใช้ส่วนใหญ่ถูกตั้งค่าเฉพาะรายไว้แล้วในหน้าจอ
-- /core/program-users (เช่น แจ้งซ่อมได้แต่แก้ใบเดิมไม่ได้) ถ้าคัดลอกแค่สิทธิ์เข้าโปรแกรม
-- สิทธิ์รายเมนูจะถอยไปใช้ค่าเริ่มต้นของระดับ ซึ่งกว้างกว่าที่ตั้งไว้ฝั่งแจ้งซ่อม
--
-- ไม่ทับของเดิม: แถวไหนมีอยู่แล้วฝั่ง CLM จะข้ามไป (แอดมินปรับเองภายหลังได้ที่ /core)
-- เมนูจ่ายเงิน/อนุมัติ/ตั้งค่าของ PR ไม่มีคู่ในระบบเคลม จึงไม่ถูกคัดลอก
-- รันต่อจาก 0036 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- 1. สิทธิ์เข้าโปรแกรม ----------
insert into public.user_programs (user_id, program_id)
select up.user_id, clm.id
from public.user_programs up
join public.programs pr  on pr.id  = up.program_id and pr.code  = 'PR'
join public.programs clm on clm.code = 'CLM'
join public.employees e  on e.id   = up.user_id
on conflict do nothing;

-- ---------- 2. สิทธิ์รายเมนูเฉพาะราย ----------
insert into public.user_menu_permissions (user_id, menu_id, can_read, can_write, can_edit, can_delete)
select
  u.user_id,
  target.id,
  u.can_read,
  u.can_write,
  u.can_edit,
  u.can_delete
from public.user_menu_permissions u
join public.program_menus src on src.id = u.menu_id
join (values
  ('PR_REPAIR',     'CLM_CLAIM'),
  ('PR_REPAIR_UPD', 'CLM_UPDATE'),
  ('PR_SEARCH',     'CLM_SEARCH'),
  ('PR_DASH',       'CLM_DASH')
) as pair(from_code, to_code) on pair.from_code = src.code
join public.program_menus target on target.code = pair.to_code
on conflict (user_id, menu_id) do nothing;
