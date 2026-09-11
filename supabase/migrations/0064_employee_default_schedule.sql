-- กะประจำของพนักงาน (default_schedule_id): ตั้งครั้งเดียว ใช้ได้ทุกเดือนโดยไม่ต้องจัดตารางเวรซ้ำ
-- ใช้กับตำแหน่งที่ทำงานกะเวลาเดิมตลอด ไม่มีการหมุนเวียนกะ (แม่บ้าน, ครัว, สต็อก, บัญชี, คาเฟ่ ฯลฯ)
-- ลำดับความสำคัญตอน resolve: ตารางเวรรายวัน (shift_assignments) > กะประจำของคนนี้ > กะของสาขา > กะเริ่มต้นบริษัท
alter table employees
  add column if not exists default_schedule_id uuid references work_schedules(id) on delete set null;

comment on column employees.default_schedule_id is
  'กะประจำของพนักงานคนนี้ — ใช้ทุกวันที่ไม่มีตารางเวรรายวัน (shift_assignments) มากำหนดไว้เฉพาะ null = ใช้กะของสาขาแทน';

create index if not exists employees_default_schedule_id_idx on employees(default_schedule_id);
