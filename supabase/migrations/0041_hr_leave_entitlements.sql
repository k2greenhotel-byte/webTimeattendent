-- ============================================================
-- สิทธิ์การลารายบุคคล (โควตา) — โปรแกรม HR
--
-- hr_leave_entitlements: ตั้งจำนวนวันที่พนักงานแต่ละคนได้รับต่อประเภทการลา ต่อปี
--   - ไม่ได้ตั้งไว้ (ไม่มีแถว) = ใช้โควตาเริ่มต้นของประเภทนั้น (hr_leave_types.max_days_per_year)
--   - ตั้งไว้ = ใช้ค่านี้แทนค่าเริ่มต้น เฉพาะคนนั้น เฉพาะปีนั้น
--   - "ใช้ไปแล้ว" คำนวณสดจาก hr_leave_requests ไม่ได้เก็บซ้ำในตารางนี้
--
-- HR_LEAVE_QUOTA: หน้าจอตั้งค่าโควตารายบุคคล /hr/setup/leave-quota
--   สิทธิ์: เฉพาะ admin/assistant_admin เหมือนเมนูตั้งค่าประเภทการลา (HR_TYPES)
--
-- รันต่อจาก 0040
-- ============================================================

create table if not exists public.hr_leave_entitlements (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  type_id      uuid not null references public.hr_leave_types (id) on delete cascade,
  year         int not null,
  granted_days numeric(6, 1) not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (employee_id, type_id, year)
);

create index if not exists idx_hr_leave_entitlements_employee on public.hr_leave_entitlements (employee_id, year);
create index if not exists idx_hr_leave_entitlements_type on public.hr_leave_entitlements (type_id, year);

alter table public.hr_leave_entitlements enable row level security;

drop trigger if exists trg_hr_leave_entitlements_updated on public.hr_leave_entitlements;
create trigger trg_hr_leave_entitlements_updated before update on public.hr_leave_entitlements
  for each row execute function public.set_updated_at();

-- ---------- เมนู ----------
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('HR_LEAVE_QUOTA', '12. ตั้งค่าสิทธิ์การลารายบุคคล', '/hr/setup/leave-quota', 'setting', 120)
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
where m.code = 'HR_LEAVE_QUOTA'
on conflict (level, menu_id) do nothing;
