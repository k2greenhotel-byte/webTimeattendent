-- ============================================================
-- จัดโครงสร้างข้อมูลหลัก (master data) ให้เป็นตารางแยกตามประเภท + ผูกด้วย FK
--
--   employees        : ข้อมูลพนักงาน (ID, ชื่อ, เบอร์โทร, PIN)  → อ้างอิงสาขา/แผนก/ตำแหน่ง
--   branches         : ข้อมูลสาขา (รหัส, ชื่อ, พิกัด)            → อ้างอิงกะทำงาน
--   work_schedules   : กะทำงาน (เข้า/ออกพัก/เข้าบ่าย/เลิกงาน)   ← เวลาทั้งหมดอยู่ที่นี่ที่เดียว
--   departments      : แผนก
--   positions        : ตำแหน่ง
--   work_settings    : ค่าระดับองค์กร (ชื่อร้าน, GPS, กะเริ่มต้น) — เหลือแถวเดียว
--
-- หลักการ: เวลาทำงานเก็บที่ work_schedules ที่เดียว สาขาอ้างถึงกะ ไม่เก็บเวลาซ้ำ
-- รันต่อจาก 0002 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- แผนก / ตำแหน่ง ----------
create table if not exists public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.positions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

alter table public.departments enable row level security;
alter table public.positions enable row level security;

-- ---------- กะทำงาน ----------
create table if not exists public.work_schedules (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null unique,
  work_start            time not null default '08:00',   -- เวลาเข้างาน
  break_start           time not null default '12:00',   -- เวลาออกพักเที่ยง
  break_end             time not null default '13:00',   -- เวลาเข้างานช่วงบ่าย
  work_end              time not null default '17:00',   -- เวลาออกงาน
  break_allow_minutes   int  not null default 60,
  break_policy          break_policy not null default 'actual',
  late_grace_min        int  not null default 5,
  early_leave_grace_min int  not null default 5,
  count_ot              boolean not null default true,
  ot_grace_min          int  not null default 30,
  workdays              int[] not null default '{1,2,3,4,5,6}',
  is_default            boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.work_schedules enable row level security;

-- มีกะเริ่มต้นได้แค่กะเดียว
create unique index if not exists idx_schedule_single_default
  on public.work_schedules (is_default) where is_default;

drop trigger if exists trg_schedules_updated on public.work_schedules;
create trigger trg_schedules_updated before update on public.work_schedules
  for each row execute function public.set_updated_at();

-- ---------- เพิ่มคอลัมน์ใหม่ให้ employees / branches ----------
alter table public.employees add column if not exists phone text;
alter table public.employees add column if not exists department_id uuid references public.departments (id) on delete set null;
alter table public.employees add column if not exists position_id   uuid references public.positions (id) on delete set null;
alter table public.branches  add column if not exists schedule_id   uuid references public.work_schedules (id) on delete set null;
alter table public.work_settings add column if not exists default_schedule_id uuid references public.work_schedules (id) on delete set null;

-- ต้องทิ้ง view ก่อน เพราะ view อ้างถึงคอลัมน์เดิมที่กำลังจะถูกลบ (สร้างใหม่ท้ายไฟล์)
drop view if exists public.v_attendance_days;

-- ---------- ย้ายข้อมูลเดิมเข้าตารางใหม่ แล้วลบคอลัมน์ที่ซ้ำซ้อน ----------
do $$
declare
  b record;
  new_id uuid;
  def public.work_schedules%rowtype;
begin
  -- 1) สร้างกะเริ่มต้นจากค่าที่เคยตั้งไว้ใน work_settings
  if not exists (select 1 from public.work_schedules where is_default) then
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'work_settings' and column_name = 'work_start') then
      execute $q$
        insert into public.work_schedules
          (name, work_start, break_start, break_end, work_end, break_allow_minutes,
           break_policy, late_grace_min, early_leave_grace_min, count_ot, ot_grace_min, workdays, is_default)
        select 'กะมาตรฐาน', ws.work_start, ws.break_start, ws.break_end, ws.work_end, ws.break_allow_minutes,
               ws.break_policy, ws.late_grace_min, ws.early_leave_grace_min, ws.count_ot, ws.ot_grace_min,
               ws.workdays, true
        from public.work_settings ws where ws.id = 1
        on conflict (name) do nothing
      $q$;
    else
      insert into public.work_schedules (name, is_default) values ('กะมาตรฐาน', true)
      on conflict (name) do nothing;
    end if;
  end if;

  select * into def from public.work_schedules where is_default limit 1;
  update public.work_settings set default_schedule_id = def.id where id = 1 and default_schedule_id is null;

  -- 2) แผนก: ข้อความเดิม -> ตาราง departments
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'employees' and column_name = 'department') then
    insert into public.departments (name)
      select distinct btrim(department) from public.employees
      where department is not null and btrim(department) <> ''
      on conflict (name) do nothing;
    update public.employees e set department_id = d.id
      from public.departments d where btrim(e.department) = d.name and e.department_id is null;
    alter table public.employees drop column department;
  end if;

  -- 3) ตำแหน่ง: ข้อความเดิม -> ตาราง positions
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'employees' and column_name = 'position') then
    insert into public.positions (name)
      select distinct btrim(position) from public.employees
      where position is not null and btrim(position) <> ''
      on conflict (name) do nothing;
    update public.employees e set position_id = p.id
      from public.positions p where btrim(e.position) = p.name and e.position_id is null;
    alter table public.employees drop column position;
  end if;

  -- 4) เวลาที่เคยตั้งไว้รายสาขา -> สร้างเป็นกะของสาขานั้น แล้วลบคอลัมน์เวลาออกจาก branches
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'branches' and column_name = 'work_start') then
    for b in execute 'select id, code, name, work_start, work_end from public.branches
                      where work_start is not null or work_end is not null' loop
      insert into public.work_schedules
        (name, work_start, break_start, break_end, work_end, break_allow_minutes,
         break_policy, late_grace_min, early_leave_grace_min, count_ot, ot_grace_min, workdays)
      values
        ('กะ ' || b.code, coalesce(b.work_start, def.work_start), def.break_start, def.break_end,
         coalesce(b.work_end, def.work_end), def.break_allow_minutes, def.break_policy,
         def.late_grace_min, def.early_leave_grace_min, def.count_ot, def.ot_grace_min, def.workdays)
      on conflict (name) do nothing
      returning id into new_id;

      if new_id is null then
        select id into new_id from public.work_schedules where name = 'กะ ' || b.code;
      end if;
      update public.branches set schedule_id = new_id where id = b.id;
      new_id := null;
    end loop;

    alter table public.branches drop column work_start;
    alter table public.branches drop column work_end;
  end if;

  -- 5) เวลาและกฎการคำนวณย้ายไป work_schedules หมดแล้ว ลบออกจาก work_settings
  alter table public.work_settings drop column if exists work_start;
  alter table public.work_settings drop column if exists work_end;
  alter table public.work_settings drop column if exists break_start;
  alter table public.work_settings drop column if exists break_end;
  alter table public.work_settings drop column if exists break_allow_minutes;
  alter table public.work_settings drop column if exists break_policy;
  alter table public.work_settings drop column if exists late_grace_min;
  alter table public.work_settings drop column if exists early_leave_grace_min;
  alter table public.work_settings drop column if exists count_ot;
  alter table public.work_settings drop column if exists ot_grace_min;
  alter table public.work_settings drop column if exists workdays;
  -- พิกัดเก็บที่สาขาแทน
  alter table public.work_settings drop column if exists site_lat;
  alter table public.work_settings drop column if exists site_lng;
end
$$;

create index if not exists idx_employees_department on public.employees (department_id);
create index if not exists idx_employees_position on public.employees (position_id);

-- ---------- View: รวม 4 punch ของวัน + สาขา + แผนก ----------
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
  dep.name as department,
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
left join public.departments dep on dep.id = e.department_id
left join public.branches b on b.id = coalesce(d.record_branch_id, e.branch_id);

revoke all on public.v_attendance_days from anon, authenticated;
revoke all on public.departments, public.positions, public.work_schedules from anon, authenticated;
