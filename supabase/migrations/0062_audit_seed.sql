-- ============================================================================
-- 0062 — ข้อมูลตั้งต้นของระบบตรวจสอบบัญชี (โปรแกรม AUD)
--
--   * เอกสารประกอบที่ต้องแนบ (ข้อ 1.b.ii.1) — ผู้ใช้เพิ่ม/ลด/แก้ได้เองที่หน้าตั้งค่า
--   * รายการตรวจสอบตั้งต้น 3 รายการตามข้อ 1-3 (is_builtin = true ลบไม่ได้ แต่ปิดใช้งานได้)
--     รายการที่ผู้ใช้เพิ่มเองภายหลัง (ข้อ 4) จะเป็น kind = 'custom'
--
-- ปลอดภัยถ้ารันซ้ำ: on conflict (code) do update เฉพาะชื่อ/คำอธิบาย
-- ไม่ทับค่าที่ผู้ใช้ปรับเอง (sort_order / is_active / has_*)
-- ============================================================================

insert into public.aud_doc_types (code, name, sort_order) values
  ('IDCARD',   'บัตรประชาชน',                    10),
  ('HOUSEREG', 'ทะเบียนบ้าน',                    20),
  ('APPFACE',  'หน้า App',                        30),
  ('TRACE',    'ลอกลาย',                          40),
  ('REGFORM',  'ฟอร์มเซ็นรับทราบงานทะเบียน',      50),
  ('RECEIPT',  'ใบรับรถ',                         60),
  ('OTHER',    'อื่น ๆ',                          90)
on conflict (code) do update
  set name = excluded.name;

insert into public.aud_check_types
  (code, name, kind, description, has_docs, has_call, has_slip, has_amount,
   ref_label, title_label, party_label, is_builtin, sort_order)
values
  ('SALE', 'ตรวจสอบใบสั่งขาย (จากการขาย)', 'sale',
   'ดึงรายการขายจากระบบขาย (Db2) ตามวันที่/สาขา แล้วบันทึกผลตรวจ เอกสารประกอบ และผลการโทรถามลูกค้า',
   true, true, false, true,
   'เลขที่สัญญาขาย', 'ชื่อลูกค้า', 'พนักงานขาย', true, 10),

  ('PETTY', 'ตรวจสอบใบเบิกเงินสดย่อย', 'payment',
   'ดึงใบเบิกเงินสดย่อยจากระบบขอซ่อมขอซื้อ ตามวันที่/สาขา แล้วบันทึกผลตรวจ เอกสารประกอบ และผลการโทรถามผู้รับเงิน',
   true, true, false, true,
   'เลขที่ใบเบิก', 'รายการค่าใช้จ่าย', 'ผู้รับเงิน', true, 20),

  ('CASH', 'ชนยอดเงินสดคงเหลือและการนำฝากเข้าบัญชี', 'cash',
   'รายงานกระทบยอดรับจ่ายของสาขา พร้อมตรวจสลิปนำฝากเงินและความถูกต้องของยอดเงิน',
   false, false, true, true,
   'เลขที่รายงาน', 'รายงานกระทบยอดรับจ่าย', 'ผู้จัดทำรายงาน', true, 30)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      ref_label   = excluded.ref_label,
      title_label = excluded.title_label,
      party_label = excluded.party_label,
      is_builtin  = true;
