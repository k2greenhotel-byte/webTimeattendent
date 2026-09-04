-- ============================================================
-- ระบบลงเวลา: รองรับหลายบริษัท
--
-- เดิมข้อมูลหลักของระบบลงเวลา (กะทำงาน แผนก ตำแหน่ง วันหยุด ค่าตั้งต้น) ใช้ร่วมกันทั้งระบบ
-- พอมีหลายบริษัทจึงต้องแยกของใครของมัน โดยยังเปิดให้ใช้ร่วมกันได้ถ้าต้องการ
--
--   company_id = NULL  ->  ใช้ร่วมทุกบริษัท (ของกลาง)
--   company_id = <id>  ->  เห็นเฉพาะบริษัทนั้น
--
-- สาขามี company_id อยู่แล้ว (0009) พนักงานผูกบริษัทผ่านสาขาของตัวเอง
-- ปลอดภัยถ้ารันซ้ำ
-- ============================================================

alter table public.work_schedules add column if not exists company_id uuid references public.companies (id) on delete cascade;
alter table public.departments    add column if not exists company_id uuid references public.companies (id) on delete cascade;
alter table public.positions      add column if not exists company_id uuid references public.companies (id) on delete cascade;
alter table public.holidays       add column if not exists company_id uuid references public.companies (id) on delete cascade;

create index if not exists idx_schedules_company on public.work_schedules (company_id);
create index if not exists idx_departments_company on public.departments (company_id);
create index if not exists idx_positions_company on public.positions (company_id);
create index if not exists idx_holidays_company on public.holidays (company_id);

-- ---------- ชื่อซ้ำข้ามบริษัทได้ แต่ห้ามซ้ำในบริษัทเดียวกัน ----------
-- nulls not distinct = ของกลาง (company_id null) ก็ห้ามชื่อซ้ำกันเองเช่นกัน
alter table public.departments drop constraint if exists departments_name_key;
alter table public.positions drop constraint if exists positions_name_key;
alter table public.work_schedules drop constraint if exists work_schedules_name_key;

create unique index if not exists idx_departments_company_name
  on public.departments (company_id, name) nulls not distinct;
create unique index if not exists idx_positions_company_name
  on public.positions (company_id, name) nulls not distinct;
create unique index if not exists idx_schedules_company_name
  on public.work_schedules (company_id, name) nulls not distinct;

-- ---------- กะเริ่มต้น: มีได้บริษัทละหนึ่ง ----------
drop index if exists public.idx_schedule_single_default;
create unique index if not exists idx_schedule_default_per_company
  on public.work_schedules (company_id, is_default) nulls not distinct
  where is_default;

-- ---------- วันหยุด: แยกรายบริษัทได้ ----------
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'holidays' and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.holidays drop constraint holidays_pkey;
  end if;
end
$$;

alter table public.holidays add column if not exists id uuid primary key default gen_random_uuid();

create unique index if not exists idx_holidays_company_date
  on public.holidays (company_id, holiday_date) nulls not distinct;

-- ---------- ค่าตั้งต้นของระบบลงเวลา: หนึ่งชุดต่อหนึ่งบริษัท ----------
-- เดิมเป็นตารางแถวเดียว (id = 1) เปลี่ยนเป็นหนึ่งแถวต่อบริษัท โดยใช้ company_id เป็นคีย์
alter table public.work_settings drop constraint if exists work_settings_singleton;
alter table public.work_settings add column if not exists company_id uuid references public.companies (id) on delete cascade;

do $$
declare
  first_company uuid;
begin
  select id into first_company from public.companies order by created_at limit 1;
  if first_company is null then
    return; -- ยังไม่มีบริษัทในระบบ ค่อยว่ากันตอนสร้างบริษัทแรก
  end if;

  -- ค่าที่ตั้งไว้เดิมกลายเป็นของบริษัทแรก
  update public.work_settings set company_id = first_company where company_id is null;

  -- เลิกใช้คอลัมน์ id (คีย์เดิมของตารางแถวเดียว) แล้วใช้ company_id เป็นคีย์แทน
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_settings' and column_name = 'id'
  ) then
    alter table public.work_settings drop constraint if exists work_settings_pkey;
    alter table public.work_settings drop column id;
  end if;

  alter table public.work_settings alter column company_id set not null;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'work_settings' and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.work_settings add primary key (company_id);
  end if;

  -- บริษัทที่ยังไม่มีค่าตั้งต้น ให้สร้างชุดเริ่มต้นจากชื่อบริษัทและกะเริ่มต้นที่ใช้ได้
  insert into public.work_settings (company_id, org_name, require_gps, radius_m, timezone, default_schedule_id)
  select c.id, c.name, false, 200, 'Asia/Bangkok',
         (select s.id from public.work_schedules s
           where s.is_default and (s.company_id = c.id or s.company_id is null)
           order by (s.company_id = c.id) desc nulls last limit 1)
    from public.companies c
   where not exists (select 1 from public.work_settings w where w.company_id = c.id);
end
$$;
