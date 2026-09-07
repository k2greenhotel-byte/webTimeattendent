-- ============================================================
-- ใบจองรถ: เปลี่ยนช่องรถ (ยี่ห้อ/รุ่น/แบบ/สี) ไปอ้างข้อมูลหลักของระบบขาย (Db2)
--
-- เดิมช่องพวกนี้อ้าง mc_brands / mc_models / mc_variants / mc_colors ด้วย uuid
-- ซึ่งเป็นทะเบียนที่พิมพ์เองในระบบนี้ ทำให้ชื่อรุ่น/แบบ ไม่ตรงกับระบบขายจริง
-- ตอนนี้ให้เก็บ "รหัสของ Db2" ตรง ๆ (SETTYPE / SETMODEL / SETBAAB / SETCOLOR)
-- เพื่อให้ map กับสต็อกรถได้ในระดับ Model / Baab / Color
--
-- เก็บทั้งรหัสและชื่อ:
--   *_code : รหัสจริงใน Db2 — ใช้ map กับสต็อกและใช้ค้นต่อ
--   *_name : ชื่อ ณ ตอนบันทึก — หน้าจอรายการจะได้ไม่ต้องยิงถาม Db2 ทีละแถว
--            (และใบเก่ายังอ่านออกแม้ระบบขายจะเปลี่ยนชื่อรุ่นภายหลัง)
--
-- ใบจองเดิมที่อ้าง mc_* ยังอยู่ครบ ไม่ถูกแตะ — view จะหยิบชื่อจาก Db2 ก่อน
-- ถ้าไม่มีจึงถอยไปใช้ชื่อจากทะเบียนเดิม ทุกหน้าจอที่ใช้ brand_name/model_name อยู่แล้วจึงไม่ต้องแก้
-- รันต่อจาก migration ล่าสุด (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

alter table public.bk_bookings
  add column if not exists db2_brand_code   text,
  add column if not exists db2_brand_name   text,
  add column if not exists db2_model_code   text,
  add column if not exists db2_model_name   text,
  add column if not exists db2_variant_code text,
  add column if not exists db2_variant_name text,
  add column if not exists db2_color_code   text,
  add column if not exists db2_color_name   text;

-- ใช้ map ใบจองกับสต็อกในระดับ รุ่น + แบบ + สี
create index if not exists idx_bk_bookings_db2_combo
  on public.bk_bookings (db2_model_code, db2_variant_code, db2_color_code);

-- ---------- View: ชื่อรถหยิบจาก Db2 ก่อน ไม่มีจึงใช้ทะเบียนเดิม ----------
drop view if exists public.v_bk_bookings;

create view public.v_bk_bookings as
select
  b.*,
  c.code       as customer_code,
  c.full_name  as customer_name,
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

-- ---------- เมนูใหม่: สอบถามสต็อกรถ ----------
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('BOOK_STOCK', '1.5 สอบถามสต๊อกรถ', '/booking/stock', 'inquiry', 50)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'BOOK'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- ทุกระดับเปิดดูได้ (ไม่มีราคาทุนในหน้านี้) แต่บันทึก/แก้ไข/ลบ ไม่มีความหมาย จึงปิดไว้
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select lvl.level::access_level, m.id, true, false, false, false
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'BOOK_STOCK'
on conflict (level, menu_id) do nothing;
