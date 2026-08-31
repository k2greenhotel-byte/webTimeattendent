-- ============================================================
-- เพิ่มระบบหลายสาขา (branches) + ผูกพนักงานและการลงเวลาเข้ากับสาขา
-- รันต่อจาก 0001_init.sql (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

create table if not exists public.branches (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  address     text,
  phone       text,
  -- ถ้าเว้นว่าง = ใช้ค่ากลางจาก work_settings
  work_start  time,
  work_end    time,
  site_lat    double precision,
  site_lng    double precision,
  radius_m    int,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.employees
  add column if not exists branch_id uuid references public.branches (id) on delete set null;

-- เก็บสาขา ณ เวลาที่ลงเวลา เพื่อให้รายงานย้อนหลังถูกต้องแม้พนักงานย้ายสาขา
alter table public.attendance_records
  add column if not exists branch_id uuid references public.branches (id) on delete set null;

create index if not exists idx_employees_branch on public.employees (branch_id);
create index if not exists idx_att_branch_date on public.attendance_records (branch_id, work_date);

drop trigger if exists trg_branches_updated on public.branches;
create trigger trg_branches_updated before update on public.branches
  for each row execute function public.set_updated_at();

alter table public.branches enable row level security;

-- ---------- สาขาเริ่มต้น + ย้ายพนักงานเดิมเข้าสาขาหลัก ----------
insert into public.branches (code, name)
values ('MAIN', 'สาขาหลัก')
on conflict (code) do nothing;

update public.employees
set branch_id = (select id from public.branches where code = 'MAIN')
where branch_id is null;

-- ---------- View: รวม 4 punch ของวัน + ข้อมูลสาขา ----------
drop view if exists public.v_attendance_days;

create view public.v_attendance_days as
with days as (
  select
    a.employee_id,
    a.work_date,
    max(a.punched_at) filter (where a.punch_type = 'check_in')   as check_in_at,
    max(a.punched_at) filter (where a.punch_type = 'break_out')  as break_out_at,
    max(a.punched_at) filter (where a.punch_type = 'break_in')   as break_in_at,
    max(a.punched_at) filter (where a.punch_type = 'check_out')  as check_out_at,
    max(a.photo_path) filter (where a.punch_type = 'check_in')   as check_in_photo,
    max(a.photo_path) filter (where a.punch_type = 'break_out')  as break_out_photo,
    max(a.photo_path) filter (where a.punch_type = 'break_in')   as break_in_photo,
    max(a.photo_path) filter (where a.punch_type = 'check_out')  as check_out_photo,
    count(*)             as punch_count,
    bool_or(a.is_manual) as has_manual,
    (array_agg(a.branch_id) filter (where a.branch_id is not null))[1] as record_branch_id
  from public.attendance_records a
  group by a.employee_id, a.work_date
)
select
  d.employee_id,
  e.emp_code,
  e.full_name,
  e.department,
  d.work_date,
  d.check_in_at,
  d.break_out_at,
  d.break_in_at,
  d.check_out_at,
  d.check_in_photo,
  d.break_out_photo,
  d.break_in_photo,
  d.check_out_photo,
  d.punch_count,
  d.has_manual,
  coalesce(d.record_branch_id, e.branch_id) as branch_id,
  b.code as branch_code,
  b.name as branch_name
from days d
join public.employees e on e.id = d.employee_id
left join public.branches b on b.id = coalesce(d.record_branch_id, e.branch_id);

revoke all on public.v_attendance_days from anon, authenticated;
