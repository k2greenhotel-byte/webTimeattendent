-- ============================================================
-- ถังเก็บไฟล์แนบของ Memo
--
-- ถังเดิม attendance-photos ตั้งไว้รับเฉพาะ image/jpeg ขนาดไม่เกิน 3 MB
-- (เพราะใช้เก็บรูปลงเวลาอย่างเดียว) จึงแยกถังใหม่สำหรับไฟล์เอกสาร
-- เพื่อไม่ต้องปลดล็อกชนิดไฟล์ของถังรูปลงเวลา
--
-- ถังนี้เป็น private เหมือนกัน — เข้าถึงผ่าน signed URL ที่ออกโดย server เท่านั้น
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-files',
  'marketing-files',
  false,
  15728640,   -- 15 MB
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'text/plain'
  ]
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
