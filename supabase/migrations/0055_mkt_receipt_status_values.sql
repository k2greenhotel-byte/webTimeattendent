-- ============================================================
-- เพิ่มสถานะการเบิกอีก 2 สถานะ สำหรับกรณีรับเงินไม่ครบ
--
--   partial_received  รับเงินบางส่วน (ค้างชำระ) — ยังรอรับเงินงวดถัดไป
--   received_short    ได้รับครบแล้ว (ถูกตัดเงิน) — บริษัทรถจ่ายน้อยกว่าที่ตกลง
--                     และจะไม่จ่ายส่วนที่เหลืออีกแล้ว จึงถือว่าจบเรื่อง
--
-- แยกไฟล์ไว้ต่างหากเพราะ Postgres ไม่ยอมให้ใช้ค่า enum ที่เพิ่งเพิ่ม
-- ภายใน transaction เดียวกับที่เพิ่ม — migration 0056 ถึงจะเอาไปใช้ได้
-- ============================================================

alter type mkt_flow_status add value if not exists 'partial_received' after 'submitted';
alter type mkt_flow_status add value if not exists 'received_short' after 'received';
