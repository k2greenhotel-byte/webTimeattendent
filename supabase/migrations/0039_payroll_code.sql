-- ============================================================
-- จับคู่รหัสพนักงานของระบบลงเวลา กับรหัสจากระบบเงินเดือน (payroll)
--
-- ระบบเงินเดือนใช้รหัสคนละชุดกับระบบลงเวลา เช่น
--   เคทูฯ/จีนาย : K2009, K0004, G9055
--   เกรียงไกรฯ  : 002, 012, 069
-- เก็บเป็นคอลัมน์เดียวบน employees เพราะพนักงาน 1 คนสังกัด 1 บริษัท จึงมีรหัสเงินเดือนชุดเดียว
--
-- ไม่ตั้ง unique ระดับตาราง เพราะแต่ละบริษัทมีเลขชุดของตัวเอง (เลข "002" ซ้ำข้ามบริษัทได้)
-- ความซ้ำภายในบริษัทเดียวกันตรวจที่ชั้นแอปตอนบันทึก (ดู setPayrollCodes ใน src/lib/db.ts)
-- ============================================================

alter table public.employees add column if not exists payroll_code text;

create index if not exists idx_employees_payroll_code
  on public.employees (payroll_code)
  where payroll_code is not null;

-- ---------- เมนูใหม่: จับคู่รหัสพนักงาน ----------
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, 'ATT_PAYROLL_MAP', 'จับคู่รหัสเงินเดือน', '/admin/payroll-map', 'entry'::menu_kind, 88
from public.programs p where p.code = 'ATT'
on conflict (code) do update
  set name = excluded.name, path = excluded.path, kind = excluded.kind, sort_order = excluded.sort_order;

-- ค่าเริ่มต้นตามระดับ: admin/ผู้ช่วย จัดการได้ · supervisor ดูได้อย่างเดียว · user ไม่เห็น
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  lvl.level in ('admin', 'assistant_admin', 'supervisor'),
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'ATT_PAYROLL_MAP'
on conflict (level, menu_id) do nothing;
