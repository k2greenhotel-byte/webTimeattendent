-- ============================================================
-- ลงเวลา "ออกไปทำธุระ" ระหว่างวัน (ออก → กลับ ได้หลายรอบ)
--
-- ทำไมไม่ใช้ attendance_records: ตารางนั้นมี unique (employee_id, work_date, punch_type)
-- คือวันหนึ่งมีได้ประเภทละครั้งเดียว แต่ธุระออก-กลับเกิดได้หลายรอบต่อวัน จึงแยกตารางเหมือน field_punches
--
-- กติกาเวลา (คำนวณใน src/lib/attendance.ts):
--   เวลาส่วนตัวรวม = เวลาพักเที่ยง + เวลาธุระทุกรอบ
--   เกินโควตา (break_allow_minutes ปกติ 60 นาที) = "พักเกินเวลา" นำไปหักค่าจ้างได้
-- ============================================================

create table if not exists public.errand_punches (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  work_date    date not null,
  round        int  not null,                                    -- ครั้งที่ 1, 2, 3 … ของวันนั้น
  punch_type   text not null check (punch_type in ('out', 'in')), -- ออกไปทำธุระ / กลับเข้างาน
  punched_at   timestamptz not null,                             -- เวลาจาก server เท่านั้น
  reason       text,                                             -- เหตุผล (กรอกตอนกดออก)
  photo_path   text,
  lat          double precision,
  lng          double precision,
  accuracy_m   double precision,
  distance_m   double precision,
  device_info  text,
  note         text,
  is_manual    boolean not null default false,                   -- true = แอดมินบันทึก/แก้ให้
  edited_by    uuid references public.employees (id) on delete set null,
  branch_id    uuid references public.branches (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (employee_id, work_date, round, punch_type)
);

create index if not exists idx_errand_punches_date on public.errand_punches (work_date);
create index if not exists idx_errand_punches_emp_date on public.errand_punches (employee_id, work_date);

drop trigger if exists trg_errand_punches_updated on public.errand_punches;
create trigger trg_errand_punches_updated before update on public.errand_punches
  for each row execute function public.set_updated_at();

alter table public.errand_punches enable row level security;
revoke all on public.errand_punches from anon, authenticated;

-- ---------- สรุปเวลาธุระต่อคนต่อวัน (ใช้ในรายงาน) ----------
drop view if exists public.v_errand_days;

create view public.v_errand_days as
select
  r.employee_id,
  r.work_date,
  count(*) filter (where r.out_at is not null)                        as rounds,
  count(*) filter (where r.out_at is not null and r.in_at is not null) as completed_rounds,
  -- นับเฉพาะรอบที่กลับเข้ามาแล้ว (รอบที่ยังไม่กลับ ยังไม่รู้ว่าใช้เวลาไปเท่าไร)
  -- ปัดเศษที่ฝั่งโค้ด ไม่เรียก round() ที่นี่เพราะชนกับชื่อคอลัมน์ round
  coalesce(sum(
    extract(epoch from (r.in_at - r.out_at)) / 60
  ) filter (where r.out_at is not null and r.in_at is not null), 0) as minutes
from (
  select
    employee_id,
    work_date,
    round,
    max(punched_at) filter (where punch_type = 'out') as out_at,
    max(punched_at) filter (where punch_type = 'in')  as in_at
  from public.errand_punches
  group by employee_id, work_date, round
) r
group by r.employee_id, r.work_date;

revoke all on public.v_errand_days from anon, authenticated;
