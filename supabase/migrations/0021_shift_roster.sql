-- ============================================================
-- ตารางเวร (Shift Roster): ใครอยู่กะไหน วันไหน
--
-- แยกจาก "นิยามกะ" (work_schedules) ที่บอกว่ากะเช้า/บ่าย/ดึก เข้า-ออกกี่โมง
-- ตารางนี้บอกว่า "พนักงานคนนี้ วันนี้ ใช้กะไหน" เก็บทีละคนทีละวัน
-- เพราะโรงแรมสลับ/แลกเวรกันทีละวันบ่อย การแก้ 1 วัน = แก้ 1 แถว
--
-- ลำดับการเลือกกะเพื่อคำนวณสาย/OT:
--   1. shift_assignments ของคนนั้นวันนั้น (หรือ "หยุดเวร" = ไม่นับขาดงาน)
--   2. กะของสาขา (branches.schedule_id) — พนักงานกะประจำไม่ต้องจัดเวร
--   3. กะเริ่มต้นของบริษัท / กะกลาง
-- ============================================================

create table if not exists public.shift_assignments (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  work_date    date not null,
  -- null ได้เฉพาะเมื่อเป็นวันหยุดเวร; ห้ามลบกะที่ยังถูกจัดเวรอยู่
  schedule_id  uuid references public.work_schedules (id) on delete restrict,
  is_day_off   boolean not null default false,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (employee_id, work_date),
  constraint shift_assignment_has_schedule check (is_day_off or schedule_id is not null)
);

create index if not exists idx_shift_assignments_date on public.shift_assignments (work_date);
create index if not exists idx_shift_assignments_emp_date on public.shift_assignments (employee_id, work_date);

drop trigger if exists trg_shift_assignments_updated on public.shift_assignments;
create trigger trg_shift_assignments_updated before update on public.shift_assignments
  for each row execute function public.set_updated_at();

alter table public.shift_assignments enable row level security;
revoke all on public.shift_assignments from anon, authenticated;

-- ---------- เมนูใหม่ในโปรแกรมลงเวลา ----------
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, 'ATT_ROSTER', 'ตารางเวร', '/admin/roster', 'entry'::menu_kind, 85
from public.programs p where p.code = 'ATT'
on conflict (code) do update
  set name = excluded.name, path = excluded.path, kind = excluded.kind, sort_order = excluded.sort_order;
