-- ============================================================
-- ใบจองรถ: เปลี่ยนช่องลูกค้าไปอ้างทะเบียนลูกค้าของระบบขาย (Db2 CUSTMAST)
--
-- เดิมช่องลูกค้าอ้างตาราง customers ของระบบนี้ ซึ่งต้องคีย์ซ้ำกับระบบขาย
-- ตอนนี้ให้เลือกจาก CUSTMAST ตรง ๆ แล้วเก็บ "รหัสลูกค้าของระบบขาย" ไว้
-- ใบจองกับสัญญาขายจะได้อ้างลูกค้าคนเดียวกันจริง ๆ
--
--   db2_cuscod        : CUSTMAST.CUSCOD — รหัสจริงในระบบขาย
--   db2_customer_name : ชื่อ ณ ตอนบันทึก — หน้ารายการจะได้ไม่ต้องยิงถาม Db2 ทีละแถว
--
-- ใบจองเดิมที่อ้าง customers ยังอยู่ครบ ไม่ถูกแตะ — view หยิบชื่อจาก Db2 ก่อน
-- ไม่มีจึงถอยไปใช้ทะเบียนเดิม ทุกหน้าจอที่ใช้ customer_name อยู่แล้วจึงไม่ต้องแก้
-- รันต่อจาก 0033 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

alter table public.bk_bookings
  add column if not exists db2_cuscod        text,
  add column if not exists db2_customer_name text;

create index if not exists idx_bk_bookings_db2_cuscod on public.bk_bookings (db2_cuscod);

-- ---------- View: ชื่อลูกค้าหยิบจาก Db2 ก่อน ไม่มีจึงใช้ทะเบียนเดิม ----------
drop view if exists public.v_bk_bookings;

create view public.v_bk_bookings as
select
  b.*,
  coalesce(nullif(b.db2_cuscod, ''), c.code)        as customer_code,
  coalesce(nullif(b.db2_customer_name, ''), c.full_name) as customer_name,
  br.name      as branch_name,
  coalesce(nullif(b.db2_brand_name, ''),   bd.name) as brand_name,
  coalesce(nullif(b.db2_model_name, ''),   md.name) as model_name,
  coalesce(nullif(b.db2_variant_name, ''), vr.name) as variant_name,
  coalesce(nullif(b.db2_color_name, ''),   cl.name) as color_name,
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
