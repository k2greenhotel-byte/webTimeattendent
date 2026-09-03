-- ============================================================
-- เพิ่มเมนู "กำหนดผู้ใช้งานโปรแกรม" (/core/program-users)
--
-- มองจากฝั่งโปรแกรม: เลือกโปรแกรมหนึ่ง แล้วเพิ่ม-ลด user ที่ใช้โปรแกรมนั้นได้ทีเดียวทั้งชุด
-- (ตรงข้ามกับหน้ากำหนดผู้ใช้งาน ที่มองจากฝั่งคนแล้วติ๊กว่าคนนี้ใช้โปรแกรมไหนได้)
-- ข้อมูลลงตาราง user_programs เหมือนกัน ไม่มีตารางใหม่
-- ============================================================

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, 'CORE_PROG_USERS', 'กำหนดผู้ใช้งานโปรแกรม', '/core/program-users', 'setting', 45
from public.programs p
where p.code = 'CORE'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- สิทธิ์เริ่มต้นของเมนูใหม่ ใช้กฎเดียวกับเมนูอื่นของระบบส่วนกลาง
-- (admin/ผู้ช่วย admin ใช้ได้ · หัวหน้างานเปิดดูได้อย่างเดียว · ผู้ใช้ทั่วไปไม่เห็นเลย)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  lvl.level <> 'user',
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'CORE_PROG_USERS'
on conflict (level, menu_id) do nothing;
