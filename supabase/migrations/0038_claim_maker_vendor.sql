-- ============================================================
-- ระบบแจ้งเคลม: ชื่อบริษัทผู้ผลิต (1.4.15) เลือกจากทะเบียน "บริษัทรถ / เจ้าหนี้"
--
-- เดิมช่องนี้พิมพ์เอง ทำให้ชื่อบริษัทเดียวกันสะกดไม่เหมือนกันทุกใบ
-- (dashboard จัดกลุ่ม "แยกตามบริษัทผู้ผลิต" จึงกระจายเป็นหลายกอง)
-- ตอนนี้ให้เลือกจาก mc_vendors ซึ่งเป็นข้อมูลเบื้องต้นของโปรแกรม MC
-- (เมนู "บริษัทรถ / เจ้าหนี้" ที่ /moto/setup/vendors)
--
-- เก็บทั้ง 2 ช่อง เหมือนที่ทำกับรถ/ลูกค้าจาก Db2:
--   maker_vendor_id : FK ไปทะเบียน — ใช้จัดกลุ่มและกรอง (on delete set null)
--   maker_name      : ชื่อ ณ ตอนบันทึก — ใบเก่าต้องอ่านออกแม้ทะเบียนจะแก้ชื่อหรือลบทิ้ง
--                     และใบเก่าที่พิมพ์ชื่อเองไว้ก่อนหน้านี้ยังแสดงได้เหมือนเดิม
--
-- view ต้องสร้างใหม่ เพราะรายชื่อคอลัมน์ของ view ถูกตรึงไว้ตอนสร้าง (v_cl_claims ใช้ c.*)
-- รันต่อจาก 0037 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

alter table public.cl_claims
  add column if not exists maker_vendor_id uuid references public.mc_vendors (id) on delete set null;

create index if not exists idx_cl_claims_maker_vendor on public.cl_claims (maker_vendor_id);

-- ---------- View: ใบขอเคลมพร้อมชื่อที่ join แล้ว ----------
drop view if exists public.v_cl_claims;

create view public.v_cl_claims as
select
  c.*,
  co.name as company_name,
  co.code as company_code,
  br.name as branch_name,
  br.code as branch_code,
  e.full_name as created_by_full_name,
  -- ชื่อบริษัทผู้ผลิตล่าสุดจากทะเบียน (ถ้าใบนี้เลือกจากทะเบียนไว้)
  mv.code as maker_vendor_code,
  mv.name as maker_vendor_name,
  (select count(*) from public.cl_claim_photos  p where p.claim_id = c.id) as photo_count,
  (select count(*) from public.cl_claim_items   i where i.claim_id = c.id) as item_count,
  (select count(*) from public.cl_claim_updates u where u.claim_id = c.id) as update_count,
  -- รายการที่ขอเคลมย่อเป็นบรรทัดเดียว ให้หน้าจอรายการ/สอบถามแสดงได้โดยไม่ต้องยิง query ซ้ำทีละใบ
  (select string_agg(i.item_name, ', ' order by i.sort_order)
     from public.cl_claim_items i where i.claim_id = c.id) as item_summary
from public.cl_claims c
left join public.companies  co on co.id = c.company_id
left join public.branches   br on br.id = c.branch_id
left join public.employees  e  on e.id  = c.created_by
left join public.mc_vendors mv on mv.id = c.maker_vendor_id;

revoke all on public.v_cl_claims from anon, authenticated;

-- ---------- จับคู่ใบเก่าที่พิมพ์ชื่อเองไว้ กับทะเบียนที่ชื่อตรงกันพอดี ----------
-- ตรงกันแบบตัดช่องว่างหัว-ท้ายและไม่สนตัวพิมพ์เล็ก-ใหญ่เท่านั้น (ไม่เดาชื่อคล้าย)
-- ชื่อที่ไม่ตรงกับทะเบียนจะคงเป็นข้อความเดิมไว้ ผู้ใช้เลือกใหม่เองได้ตอนแก้ใบ
update public.cl_claims c
   set maker_vendor_id = v.id
  from public.mc_vendors v
 where c.maker_vendor_id is null
   and c.maker_name is not null
   and lower(btrim(c.maker_name)) = lower(btrim(v.name));
