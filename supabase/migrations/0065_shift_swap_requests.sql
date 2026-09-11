-- ============================================================
-- ขอสลับกะ/สลับวันหยุด ระหว่างพนักงาน 2 คน
--
-- พนักงานคนหนึ่งขอสลับ (วันที่ของตัวเอง) กับ (วันที่ของเพื่อนร่วมงาน) — การขอถือเป็นการ
-- ยืนยันฝั่งผู้ขอไปในตัว ต้องรออีกฝ่ายกดยืนยันอีกครั้งจึงจะมีผลจริงกับตารางเวร (shift_assignments)
-- ถ้าอีกฝ่ายปฏิเสธ หรือผู้ขอยกเลิกเองก่อนอีกฝ่ายยืนยัน คำขอจะไม่มีผลใด ๆ
--
-- สิ่งที่ถูกสลับ = เนื้อหาที่ resolve ได้จริงของแต่ละคนในวันนั้น (กะ/หยุดเวร/สถานที่)
-- ไม่ใช่แค่แถวที่มีอยู่ใน shift_assignments เพราะคนกะประจำมักไม่มีแถวรายวันอยู่แล้ว
-- ============================================================

create table if not exists public.shift_swap_requests (
  id             uuid primary key default gen_random_uuid(),
  requester_id   uuid not null references public.employees (id) on delete cascade,
  requester_date date not null,
  partner_id     uuid not null references public.employees (id) on delete cascade,
  partner_date   date not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  note           text,
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint shift_swap_requests_not_self check (requester_id <> partner_id)
);

create index if not exists idx_shift_swap_requests_requester on public.shift_swap_requests (requester_id, status);
create index if not exists idx_shift_swap_requests_partner on public.shift_swap_requests (partner_id, status);

drop trigger if exists trg_shift_swap_requests_updated on public.shift_swap_requests;
create trigger trg_shift_swap_requests_updated before update on public.shift_swap_requests
  for each row execute function public.set_updated_at();

alter table public.shift_swap_requests enable row level security;
revoke all on public.shift_swap_requests from anon, authenticated;
