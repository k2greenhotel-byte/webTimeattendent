-- ============================================================
-- ใบจองรถ: เพิ่ม "พนักงานที่รับจอง"
--
--   taken_by      : บัญชีผู้ใช้ที่รับจอง (ระบบเติมจากคนที่ล็อกอินอยู่ตอนเปิดใบ)
--   taken_by_name : ชื่อพนักงานที่รับจองตามที่แสดงบนใบ
--
-- เก็บชื่อไว้ด้วยเหมือนใบ update (bk_updates.recorded_by_name) เพราะ 2 เหตุผล:
--   1. บัญชีถูกลบ/เปลี่ยนชื่อภายหลัง ใบเก่าต้องยังบอกได้ว่าตอนนั้นใครรับจอง
--   2. หัวหน้าคีย์แทนพนักงานขายได้ — ชื่อบนใบจึงแก้ได้ แต่ taken_by ยังชี้บัญชีที่บันทึกจริง
--
-- ของเดิม (`created_by`) ยังอยู่เหมือนเดิมในฐานะร่องรอยว่าใครสร้างแถวนี้
-- รันต่อจาก migration ล่าสุด (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

alter table public.bk_bookings
  add column if not exists taken_by      uuid references public.employees (id) on delete set null,
  add column if not exists taken_by_name text;

create index if not exists idx_bk_bookings_taken_by on public.bk_bookings (taken_by);

-- ใบเก่าที่ยังไม่มีชื่อผู้รับจอง เติมจากคนที่สร้างใบให้ (ถ้ารู้)
update public.bk_bookings b
set taken_by      = coalesce(b.taken_by, b.created_by),
    taken_by_name = coalesce(b.taken_by_name, e.full_name)
from public.employees e
where e.id = b.created_by
  and (b.taken_by is null or b.taken_by_name is null);

-- ---------- View: เพิ่มชื่อพนักงานที่รับจองจากบัญชีผู้ใช้ ----------
drop view if exists public.v_bk_bookings;

create view public.v_bk_bookings as
select
  b.*,
  c.code       as customer_code,
  c.full_name  as customer_name,
  br.name      as branch_name,
  bd.name      as brand_name,
  md.name      as model_name,
  vr.name      as variant_name,
  cl.name      as color_name,
  e.full_name  as taken_by_full_name,
  (select count(*) from public.bk_booking_files f where f.booking_id = b.id) as file_count,
  (select count(*) from public.bk_updates u where u.booking_id = b.id)       as update_count
from public.bk_bookings b
left join public.customers   c  on c.id  = b.customer_id
left join public.branches    br on br.id = b.branch_id
left join public.mc_brands   bd on bd.id = b.brand_id
left join public.mc_models   md on md.id = b.model_id
left join public.mc_variants vr on vr.id = b.variant_id
left join public.mc_colors   cl on cl.id = b.color_id
left join public.employees   e  on e.id  = b.taken_by;

revoke all on public.v_bk_bookings from anon, authenticated;
