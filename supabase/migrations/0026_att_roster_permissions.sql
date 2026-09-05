-- ============================================================
-- เปิดหน้าตารางเวร / ตารางบูธ / งานนอกสถานที่ ให้ผู้ใช้ที่ได้รับสิทธิ์รายเมนูเข้าได้โดยไม่ต้องกรอก PIN หลังบ้าน
--
-- เดิมทุกหน้าใต้ /admin ต้องผ่าน PIN ผู้ดูแลระบบ ผู้ใช้จึงให้หัวหน้าสาขาจัดตารางเองไม่ได้
-- ตอนนี้ 3 หน้านี้ตรวจสิทธิ์จากระบบส่วนกลาง (level_menu_permissions / user_menu_permissions) แทน:
--   อ่าน = เปิดดูตาราง · เพิ่ม = จัดเป็นชุด/คัดลอก · แก้ไข = แก้ทีละช่อง/บันทึกเวลาให้ · ลบ = ล้างช่วง/ลบงาน
-- ผู้ที่ผ่าน PIN หลังบ้านยังใช้ได้ทุกอย่างเหมือนเดิม
--
-- เมนู ATT_ROSTER (0021) และ ATT_FIELD/ATT_REP_FIELD (0022) ถูกสร้างหลัง seed สิทธิ์เริ่มต้นใน 0009
-- จึงยังไม่มีแถวใน level_menu_permissions เลย → ต้องเติมค่าเริ่มต้นที่นี่ (รันซ้ำได้ on conflict do nothing)
-- ============================================================

-- เมนูใหม่: ตารางบูธ
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, 'ATT_FIELD_ROSTER', 'ตารางบูธ', '/admin/field/roster', 'entry'::menu_kind, 84
from public.programs p where p.code = 'ATT'
on conflict (code) do update
  set name = excluded.name, path = excluded.path, kind = excluded.kind, sort_order = excluded.sort_order;

-- ค่าเริ่มต้นตามระดับ: admin/ผู้ช่วย ทำได้ทุกอย่าง · supervisor อ่าน/เพิ่ม/แก้ (ไม่ลบ) · user ไม่เห็นหน้าจัดตาราง
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  lvl.level in ('admin', 'assistant_admin', 'supervisor'),
  case when m.code = 'ATT_REP_FIELD' then lvl.level in ('admin', 'assistant_admin')
       else lvl.level in ('admin', 'assistant_admin', 'supervisor') end,
  case when m.code = 'ATT_REP_FIELD' then lvl.level in ('admin', 'assistant_admin')
       else lvl.level in ('admin', 'assistant_admin', 'supervisor') end,
  lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('ATT_ROSTER', 'ATT_FIELD', 'ATT_FIELD_ROSTER', 'ATT_REP_FIELD')
on conflict (level, menu_id) do nothing;
