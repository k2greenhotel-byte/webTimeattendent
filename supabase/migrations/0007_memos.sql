-- ============================================================
-- Memo โครงการ/ข้อตกลงกับบริษัทรถ (หน้าจอ 7) + ประวัติการเปลี่ยนสถานะ (หน้าจอ 8)
--
--   mkt_memos             : ใบ Memo — เลขที่, วันที่, บริษัท, รายละเอียด, ช่วงเวลา, ผู้บันทึก, สถานะ
--   mkt_memo_files        : ไฟล์แนบ (เอกสาร/รูปภาพ/รูปถ่าย) หลายไฟล์ต่อ 1 Memo
--   mkt_memo_status_logs  : ประวัติการเปลี่ยนสถานะ ทุกครั้งที่เปลี่ยนเก็บไว้หมด ไม่ทับของเดิม
--
-- หลักการ:
--   * สถานะปัจจุบันอยู่ที่ mkt_memos.status ส่วน mkt_memo_status_logs เก็บ "ประวัติ"
--     ทั้งสองเขียนพร้อมกันจากฟังก์ชันเดียวใน db layer (changeMemoStatus)
--   * เปิด RLS ทุกตารางและไม่สร้าง policy ให้ anon — เข้าถึงผ่าน service role เท่านั้น
-- ============================================================

do $$ begin
  create type mkt_memo_status as enum (
    'not_requested',      -- ยังไม่ได้ตั้งเบิก
    'partial_requested',  -- ทำเรื่องตั้งเบิกแล้วบางส่วน
    'partial_received',   -- ได้รับเงินบางส่วน
    'fully_received',     -- ได้รับครบแล้ว
    'closed'              -- จบโครงการแล้ว
  );
exception when duplicate_object then null; end $$;

-- ---------- เลขที่ Memo แบบรันนิ่ง (MEMO-2569-0001) ----------

create or replace function public.mkt_next_memo_no(be_year int)
returns text
language plpgsql
as $fn$
declare
  key      text := 'MEMO-' || be_year::text;
  next_seq int;
begin
  insert into public.mkt_doc_counters (prefix, seq)
  values (key, 1)
  on conflict (prefix) do update set seq = public.mkt_doc_counters.seq + 1
  returning seq into next_seq;

  return 'MEMO-' || be_year::text || '-' || lpad(next_seq::text, 4, '0');
end;
$fn$;

-- ---------- ใบ Memo (หน้าจอ 7) ----------

create table if not exists public.mkt_memos (
  id                  uuid primary key default gen_random_uuid(),
  doc_no              text not null unique,
  memo_date           date not null,                                   -- วันที่ของ Memo
  company_id          uuid references public.mkt_companies(id) on delete set null,
  detail              text,                                            -- รายละเอียด memo
  period_from         date,                                            -- กำหนดระยะเวลา ตั้งแต่
  period_to           date,                                            -- ถึง
  created_by_staff_id uuid references public.mkt_staff(id) on delete set null,
  status              mkt_memo_status  not null default 'not_requested',
  active_status       mkt_active_status not null default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint mkt_memos_period_order check (
    period_from is null or period_to is null or period_to >= period_from
  )
);

create index if not exists idx_mkt_memos_date    on public.mkt_memos (memo_date desc);
create index if not exists idx_mkt_memos_company on public.mkt_memos (company_id);
create index if not exists idx_mkt_memos_status  on public.mkt_memos (status);

drop trigger if exists trg_mkt_memos_updated on public.mkt_memos;
create trigger trg_mkt_memos_updated before update on public.mkt_memos
  for each row execute function public.set_updated_at();

-- ---------- ไฟล์แนบ (เอกสาร / รูปภาพ / รูปถ่าย) ----------

create table if not exists public.mkt_memo_files (
  id         uuid primary key default gen_random_uuid(),
  memo_id    uuid not null references public.mkt_memos(id) on delete cascade,
  path       text not null,          -- เส้นทางไฟล์ในถัง storage (ขึ้นต้นด้วย mkt/)
  filename   text not null,          -- ชื่อไฟล์เดิมที่ผู้ใช้อัปโหลด
  mime       text,
  size_bytes int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_mkt_memo_files on public.mkt_memo_files (memo_id, sort_order);

-- ---------- ประวัติการเปลี่ยนสถานะ (หน้าจอ 8) ----------

create table if not exists public.mkt_memo_status_logs (
  id                 uuid primary key default gen_random_uuid(),
  memo_id            uuid not null references public.mkt_memos(id) on delete cascade,
  status             mkt_memo_status not null,
  changed_on         date not null,          -- วันที่เปลี่ยนสถานะ (ผู้ใช้กรอก)
  changed_by_staff_id uuid references public.mkt_staff(id) on delete set null,
  note               text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_mkt_memo_logs on public.mkt_memo_status_logs (memo_id, changed_on desc, created_at desc);

-- ---------- RLS ----------

alter table public.mkt_memos            enable row level security;
alter table public.mkt_memo_files       enable row level security;
alter table public.mkt_memo_status_logs enable row level security;

-- ---------- view สำหรับหน้ารายการ / สอบถาม / dashboard ----------

create or replace view public.v_mkt_memos as
select
  m.id,
  m.doc_no,
  m.memo_date,
  m.detail,
  m.period_from,
  m.period_to,
  m.status,
  m.active_status,
  m.company_id,
  c.name as company_name,
  m.created_by_staff_id,
  s.name as created_by_name,
  (select count(*) from public.mkt_memo_files f where f.memo_id = m.id)       as file_count,
  (select count(*) from public.mkt_memo_status_logs l where l.memo_id = m.id) as status_log_count,
  (
    select l.changed_on
    from public.mkt_memo_status_logs l
    where l.memo_id = m.id
    order by l.changed_on desc, l.created_at desc
    limit 1
  ) as last_status_changed_on,
  m.created_at,
  m.updated_at
from public.mkt_memos m
left join public.mkt_companies c on c.id = m.company_id
left join public.mkt_staff     s on s.id = m.created_by_staff_id;
