-- ============================================================
-- งานนอกสถานที่ / งานนอกเวลา (ออกบูธ, ส่งรถ, งานพิเศษ)
--
-- 2 กลไก แยกตามว่างานนั้น "แทน" หรือ "เพิ่มจาก" งานปกติ
--   1. ไปประจำที่อื่นทั้งวัน  → ตารางเวรระบุสถานที่ (shift_assignments.site_id)
--      ลงเวลา 4 ครั้งตามปกติ แค่ GPS ตรวจกับพิกัดสถานที่นั้นแทนสาขา
--   2. ภารกิจนอกสถานที่/นอกเวลา → field_tasks + field_punches (เริ่ม/จบ)
--      แยกจาก attendance_records จึงมีได้หลายงานในวันเดียวโดยไม่ชนกับ 4 punch ปกติ
--
-- สถานที่เก็บที่ work_sites ที่เดียว (ไม่ปนกับ branches) ตารางเวรและภารกิจอ้างถึง
-- ============================================================

-- ---------- สถานที่ปฏิบัติงานนอกสถานที่ ----------
create table if not exists public.work_sites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies (id) on delete cascade,
  code        text,
  name        text not null,
  address     text,
  lat         double precision,
  lng         double precision,
  radius_m    int,                       -- null = ใช้รัศมีเริ่มต้นขององค์กร
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists uq_work_sites_company_name
  on public.work_sites (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

drop trigger if exists trg_work_sites_updated on public.work_sites;
create trigger trg_work_sites_updated before update on public.work_sites
  for each row execute function public.set_updated_at();

-- ---------- ประเภทงานนอกสถานที่ (lookup) ----------
create table if not exists public.field_task_types (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies (id) on delete cascade,  -- null = ของกลาง
  name          text not null,
  counts_hours  boolean not null default true,   -- ค่าเริ่มต้นว่างานประเภทนี้นับเป็นชั่วโมงงานพิเศษไหม
  sort_order    int not null default 100,
  created_at    timestamptz not null default now()
);
create unique index if not exists uq_field_task_types_company_name
  on public.field_task_types (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

insert into public.field_task_types (company_id, name, counts_hours, sort_order)
select null, v.name, v.counts_hours, v.sort_order
from (values
  ('ออกบูธ', true, 10),
  ('ส่งรถ', false, 20),
  ('อบรม/ประชุมนอกสถานที่', true, 30),
  ('อื่น ๆ', true, 90)
) as v(name, counts_hours, sort_order)
where not exists (
  select 1 from public.field_task_types t where t.company_id is null and t.name = v.name
);

-- ---------- ภารกิจ (1 งาน 1 วัน สมาชิกได้หลายคน) ----------
create table if not exists public.field_tasks (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid references public.companies (id) on delete cascade,
  type_id        uuid not null references public.field_task_types (id) on delete restrict,
  title          text not null,
  site_id        uuid references public.work_sites (id) on delete set null,
  place_text     text,                          -- ปลายทางชั่วคราว เช่น บ้านลูกค้า
  work_date      date not null,
  planned_start  time,
  planned_end    time,
  counts_hours   boolean not null default true, -- คัดลอกจากประเภทตอนสร้าง แก้ได้รายงาน
  note           text,
  created_by     uuid references public.employees (id) on delete set null,  -- null = แอดมิน
  is_cancelled   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint field_task_has_place check (site_id is not null or nullif(trim(place_text), '') is not null)
);
create index if not exists idx_field_tasks_date on public.field_tasks (work_date);
create index if not exists idx_field_tasks_company_date on public.field_tasks (company_id, work_date);

drop trigger if exists trg_field_tasks_updated on public.field_tasks;
create trigger trg_field_tasks_updated before update on public.field_tasks
  for each row execute function public.set_updated_at();

create table if not exists public.field_task_members (
  task_id      uuid not null references public.field_tasks (id) on delete cascade,
  employee_id  uuid not null references public.employees (id) on delete cascade,
  primary key (task_id, employee_id)
);
create index if not exists idx_field_task_members_emp on public.field_task_members (employee_id);

-- ---------- การลงเวลาของภารกิจ: เริ่ม/จบ ต่อคนต่อภารกิจ ----------
create table if not exists public.field_punches (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.field_tasks (id) on delete cascade,
  employee_id  uuid not null references public.employees (id) on delete cascade,
  punch_type   text not null check (punch_type in ('start', 'end')),
  punched_at   timestamptz not null,
  photo_path   text,
  lat          double precision,
  lng          double precision,
  accuracy_m   double precision,
  distance_m   double precision,
  device_info  text,
  note         text,
  is_manual    boolean not null default false,
  edited_by    uuid references public.employees (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (task_id, employee_id, punch_type)
);
create index if not exists idx_field_punches_emp on public.field_punches (employee_id);

-- ---------- ตารางเวรระบุสถานที่ได้ + snapshot สถานที่ในการลงเวลาปกติ ----------
alter table public.shift_assignments
  add column if not exists site_id uuid references public.work_sites (id) on delete set null;
-- วันที่ระบุแค่สถานที่ (ใช้กะของสาขาตามเดิม) ก็เป็นแถวที่มีความหมายแล้ว
alter table public.shift_assignments drop constraint if exists shift_assignment_has_schedule;
alter table public.shift_assignments add constraint shift_assignment_has_schedule
  check (is_day_off or schedule_id is not null or site_id is not null);
alter table public.attendance_records
  add column if not exists site_id uuid references public.work_sites (id) on delete set null;

-- ---------- ความปลอดภัย: service role เท่านั้น ----------
alter table public.work_sites          enable row level security;
alter table public.field_task_types    enable row level security;
alter table public.field_tasks         enable row level security;
alter table public.field_task_members  enable row level security;
alter table public.field_punches       enable row level security;
revoke all on public.work_sites, public.field_task_types, public.field_tasks,
              public.field_task_members, public.field_punches from anon, authenticated;

-- ---------- เมนูใหม่ ----------
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from public.programs p
cross join (values
  ('ATT_FIELD',     'งานนอกสถานที่',        '/admin/field',         'entry',  86),
  ('ATT_REP_FIELD', 'รายงานงานนอกสถานที่',  '/admin/reports/field', 'report', 65)
) as m(code, name, path, kind, sort_order)
where p.code = 'ATT'
on conflict (code) do update
  set name = excluded.name, path = excluded.path, kind = excluded.kind, sort_order = excluded.sort_order;
