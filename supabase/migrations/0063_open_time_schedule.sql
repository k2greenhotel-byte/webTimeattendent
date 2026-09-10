-- กะ Open Time: ไม่มีเวลาเข้า-ออกตายตัว (เช่น ผู้จัดการ, ช่างซ่อม)
-- แทนที่จะเทียบเวลาเข้างานจริงกับเวลาเริ่มมาตรฐาน ระบบใช้ชั่วโมงทำงานรวม
-- (เวลาออกงาน - เวลาเข้างาน) เทียบกับขั้นต่ำที่กำหนด ถ้าน้อยกว่าถือว่ามาสาย
alter table work_schedules
  add column if not exists is_open_time boolean not null default false,
  add column if not exists open_time_min_minutes integer not null default 540;

alter table work_schedules
  add constraint work_schedules_open_time_min_minutes_check check (open_time_min_minutes > 0);

comment on column work_schedules.is_open_time is
  'กะไม่มีเวลาเข้า-ออกตายตัว — คำนวณ "มาสาย" จากชั่วโมงทำงานรวมแทนเวลาเข้างานเทียบเวลามาตรฐาน';
comment on column work_schedules.open_time_min_minutes is
  'ชั่วโมงทำงานขั้นต่ำ (นาที) สำหรับกะ Open Time — น้อยกว่านี้ถือว่ามาสาย ค่าเริ่มต้น 540 นาที = 9 ชม.';
