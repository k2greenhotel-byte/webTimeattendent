-- ============================================================
-- ใบจองรถ: ระบุว่า "รับจองจากบูธไหน" (กรณีไปออกบูธนอกสถานที่)
--
-- ผูกกับทะเบียนสถานที่นอกสถานที่ (work_sites) ที่ระบบลงเวลาใช้จัดตารางบูธอยู่แล้ว
-- ไม่ทำทะเบียนบูธชุดใหม่ เพราะจะกลายเป็นชื่อบูธสองชุดที่ไม่ตรงกัน
-- และการพิมพ์ชื่อบูธเองจะทำให้ "บูธบิ๊กซี" กับ "บูธ บิ๊กซี" กลายเป็นคนละบูธตอนสรุปยอด
--
--   booth_site_id = null  → รับจองที่สาขาตามปกติ
--   booth_site_id ≠ null  → รับจองจากบูธนั้น (หน้าจอแสดงเป็นแท็ก #ชื่อบูธ)
--
-- ใบจองเดิมทั้งหมดถือว่ารับที่สาขา (null) — ถ้าใบไหนมาจากบูธจริง ให้แก้รายใบทีหลังได้
-- รันต่อจาก migration ล่าสุด (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

alter table public.bk_bookings
  add column if not exists booth_site_id uuid references public.work_sites (id) on delete set null;

create index if not exists idx_bk_bookings_booth on public.bk_bookings (booth_site_id);

-- ---------- View: เพิ่มชื่อบูธ ----------
drop view if exists public.v_bk_bookings;

create view public.v_bk_bookings as
select
  b.*,
  coalesce(nullif(b.db2_cuscod, ''), c.code)             as customer_code,
  coalesce(nullif(b.db2_customer_name, ''), c.full_name) as customer_name,
  br.name      as branch_name,
  ws.name      as booth_name,
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
left join public.work_sites  ws on ws.id = b.booth_site_id
left join public.mc_brands   bd on bd.id = b.brand_id
left join public.mc_models   md on md.id = b.model_id
left join public.mc_variants vr on vr.id = b.variant_id
left join public.mc_colors   cl on cl.id = b.color_id
left join public.employees   e  on e.id  = b.taken_by;

revoke all on public.v_bk_bookings from anon, authenticated;
