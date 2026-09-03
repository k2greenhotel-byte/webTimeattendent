-- ============================================================
-- ลบผู้ใช้งานที่เคยทำรายการไว้ให้ได้ โดยไม่ทิ้งประวัติ audit
--
-- เดิม audit_logs.actor_id อ้างถึง employees แบบไม่มี on delete
-- ทำให้ลบผู้ใช้ที่เคยกดปุ่มอะไรไว้ไม่ได้เลย (ติด foreign key)
-- เปลี่ยนเป็น on delete set null: แถว audit ยังอยู่ครบ แค่ไม่รู้ว่าใครทำ
-- ============================================================

alter table public.audit_logs
  drop constraint if exists audit_logs_actor_id_fkey;

alter table public.audit_logs
  add constraint audit_logs_actor_id_fkey
  foreign key (actor_id) references public.employees (id) on delete set null;

comment on column public.audit_logs.actor_id is
  'ผู้ทำรายการ (null = ผู้ใช้ถูกลบไปแล้ว หรือทำผ่านหน้าหลังบ้านที่เข้าด้วย PIN)';
