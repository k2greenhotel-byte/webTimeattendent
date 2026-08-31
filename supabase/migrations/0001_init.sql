-- ============================================================
-- ระบบลงเวลาเข้า-ออกงานด้วยรูปถ่าย : โครงสร้างฐานข้อมูล
-- รันไฟล์นี้ครั้งเดียวใน Supabase > SQL Editor
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- ENUM ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('employee', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'punch_type') then
    create type punch_type as enum ('check_in', 'break_out', 'break_in', 'check_out');
  end if;
  if not exists (select 1 from pg_type where typname = 'break_policy') then
    create type break_policy as enum ('actual', 'fixed');
  end if;
end
$$;

-- ---------- พนักงาน ----------
create table if not exists public.employees (
  id              uuid primary key default gen_random_uuid(),
  emp_code        text not null unique,
  full_name       text not null,
  nickname        text,
  department      text,
  position        text,
  pin_hash        text not null,
  role            user_role not null default 'employee',
  is_active       boolean not null default true,
  hire_date       date,
  failed_attempts int not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_employees_active on public.employees (is_active, emp_code);

-- ---------- ตั้งค่าเวลาทำงานมาตรฐาน (มีแถวเดียว id = 1) ----------
create table if not exists public.work_settings (
  id                     int primary key default 1,
  org_name               text not null default 'บริษัทของฉัน',
  work_start             time not null default '08:00',
  work_end               time not null default '17:00',
  break_start            time not null default '12:00',
  break_end              time not null default '13:00',
  break_allow_minutes    int  not null default 60,   -- โควตาพักกลางวัน (นาที)
  break_policy           break_policy not null default 'actual',
  late_grace_min         int  not null default 5,
  early_leave_grace_min  int  not null default 5,
  count_ot               boolean not null default true,
  ot_grace_min           int  not null default 30,
  workdays               int[] not null default '{1,2,3,4,5,6}',  -- 0=อา,1=จ,...,6=ส
  require_gps            boolean not null default false,
  site_lat               double precision,
  site_lng               double precision,
  radius_m               int not null default 200,
  timezone               text not null default 'Asia/Bangkok',
  updated_at             timestamptz not null default now(),
  constraint work_settings_singleton check (id = 1)
);

-- ---------- บันทึกการลงเวลา ----------
create table if not exists public.attendance_records (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  work_date    date not null,
  punch_type   punch_type not null,
  punched_at   timestamptz not null,           -- เวลาจาก server เท่านั้น
  photo_path   text,                           -- path ใน storage bucket
  lat          double precision,
  lng          double precision,
  accuracy_m   double precision,
  distance_m   double precision,
  device_info  text,
  note         text,
  is_manual    boolean not null default false, -- true = แอดมินบันทึก/แก้ไขเอง
  edited_by    uuid references public.employees (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (employee_id, work_date, punch_type)
);

create index if not exists idx_att_date on public.attendance_records (work_date);
create index if not exists idx_att_emp_date on public.attendance_records (employee_id, work_date);

-- ---------- วันหยุด ----------
create table if not exists public.holidays (
  holiday_date date primary key,
  name         text not null
);

-- ---------- audit log ----------
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.employees (id),
  action       text not null,
  target_table text not null,
  target_id    text,
  before       jsonb,
  after        jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_audit_created on public.audit_logs (created_at desc);

-- ---------- trigger: updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_employees_updated on public.employees;
create trigger trg_employees_updated before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists trg_att_updated on public.attendance_records;
create trigger trg_att_updated before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- ---------- View: รวม 4 punch ของแต่ละวันเป็นแถวเดียว ----------
create or replace view public.v_attendance_days as
select
  a.employee_id,
  e.emp_code,
  e.full_name,
  e.department,
  a.work_date,
  max(a.punched_at) filter (where a.punch_type = 'check_in')   as check_in_at,
  max(a.punched_at) filter (where a.punch_type = 'break_out')  as break_out_at,
  max(a.punched_at) filter (where a.punch_type = 'break_in')   as break_in_at,
  max(a.punched_at) filter (where a.punch_type = 'check_out')  as check_out_at,
  max(a.photo_path) filter (where a.punch_type = 'check_in')   as check_in_photo,
  max(a.photo_path) filter (where a.punch_type = 'break_out')  as break_out_photo,
  max(a.photo_path) filter (where a.punch_type = 'break_in')   as break_in_photo,
  max(a.photo_path) filter (where a.punch_type = 'check_out')  as check_out_photo,
  count(*)                                                     as punch_count,
  bool_or(a.is_manual)                                         as has_manual
from public.attendance_records a
join public.employees e on e.id = a.employee_id
group by a.employee_id, e.emp_code, e.full_name, e.department, a.work_date;

-- ---------- RLS: ปิดทุกทาง เข้าถึงผ่าน server (service role) เท่านั้น ----------
alter table public.employees          enable row level security;
alter table public.work_settings      enable row level security;
alter table public.attendance_records enable row level security;
alter table public.holidays           enable row level security;
alter table public.audit_logs         enable row level security;
-- ไม่สร้าง policy ใด ๆ = anon/authenticated เข้าไม่ได้เลย
-- service_role bypass RLS โดยอัตโนมัติ

-- view ไม่ถูกคุ้มครองด้วย RLS จึงต้องถอนสิทธิ์ออกจาก anon/authenticated ด้วยมือ
revoke all on public.v_attendance_days from anon, authenticated;

-- ---------- Storage bucket (private) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-photos', 'attendance-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;
