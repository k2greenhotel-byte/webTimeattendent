-- ============================================================
-- วงเงินสำรองจ่าย (เงินสำรองที่ให้พนักงานถือไว้จ่ายหน้างาน)
--
-- ตั้งวงเงินให้ผู้ถือเงินเป็นรายคน → เติมเงินเข้ากอง → จ่ายออกจากกอง → ดูยอดคงเหลือ
--
--   ยอดคงเหลือ = เติมเข้า − คืนคืน − ที่จ่ายออกไปแล้ว
--   วงเงิน (limit_amount) คือเพดานของเงินที่ถือได้ ใช้กันไม่ให้เติมเกินที่อนุมัติไว้
--
-- การจ่ายออกใช้ตารางใบเบิกเดิม (pr_payments) โดยเพิ่มแหล่งจ่ายที่สามคือ 'fund'
-- จะได้ใช้ฟอร์ม รายการจ่ายหลายรายการ ป้ายกำกับ ใบเสร็จ และใบพิมพ์ชุดเดียวกันทั้งหมด
-- ต่างกันแค่ชุดเลขที่เอกสารกับการตัดยอดจากกองเงิน
--
-- รันต่อจาก 0067 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- 1) แหล่งจ่ายที่สาม ----------
-- ต้องอยู่นอก DO block เพราะ ADD VALUE รันใน subtransaction ไม่ได้
-- "if not exists" ทำให้รันซ้ำได้เอง
alter type pr_pay_source add value if not exists 'fund';

-- ---------- 2) กองเงินสำรอง แยกตามผู้ถือเงิน ----------
create table if not exists public.pr_funds (
  id           uuid primary key default gen_random_uuid(),
  -- ผู้ถือเงิน: หนึ่งคนหนึ่งกอง จะได้รู้ชัดว่าเงินอยู่ในมือใคร
  holder_id    uuid not null unique references public.employees (id) on delete cascade,
  -- บริษัท/สาขาที่กองนี้สังกัด ใช้เป็นค่าตั้งต้นของใบเบิกและไว้กรองรายงาน
  company_id   uuid references public.companies (id) on delete set null,
  branch_id    uuid references public.branches  (id) on delete set null,
  -- เพดานเงินที่ถือได้ตามที่อนุมัติไว้
  limit_amount numeric(12, 2) not null default 0,
  note         text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_pr_funds_branch on public.pr_funds (company_id, branch_id);

-- ---------- 3) การเคลื่อนไหวของกอง (เติมเข้า / คืนคืน) ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'pr_fund_move_kind') then
    create type pr_fund_move_kind as enum ('topup', 'return');
  end if;
end
$$;

create table if not exists public.pr_fund_moves (
  id              uuid primary key default gen_random_uuid(),
  fund_id         uuid not null references public.pr_funds (id) on delete cascade,
  doc_no          text not null unique,
  move_date       date not null,
  kind            pr_fund_move_kind not null default 'topup',
  amount          numeric(12, 2) not null default 0,
  -- เลขที่อ้างอิงจากฝั่งการเงิน เช่น เลขที่ใบสำคัญจ่าย/เลขที่โอน
  ref_no          text,
  note            text,
  created_by      uuid references public.employees (id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_pr_fund_moves_fund on public.pr_fund_moves (fund_id, move_date desc);

-- ---------- 4) ใบเบิกรู้ว่าตัดจากกองไหน ----------
alter table public.pr_payments
  add column if not exists fund_id uuid references public.pr_funds (id) on delete set null;

create index if not exists idx_pr_payments_fund on public.pr_payments (fund_id);

alter table public.pr_funds      enable row level security;
alter table public.pr_fund_moves enable row level security;

drop trigger if exists trg_pr_funds_updated on public.pr_funds;
create trigger trg_pr_funds_updated before update on public.pr_funds
  for each row execute function public.set_updated_at();

-- ---------- 5) view: กองเงินพร้อมยอดคงเหลือ ----------
-- ยอดคงเหลือคิดจากของจริงทุกครั้งที่อ่าน ไม่เก็บยอดสะสมไว้ในตาราง
-- จะได้ไม่มีทางที่ยอดคงเหลือกับรายการเคลื่อนไหวไม่ตรงกัน
drop view if exists public.v_pr_funds;

create view public.v_pr_funds as
select
  f.*,
  e.emp_code   as holder_code,
  e.full_name  as holder_name,
  co.name      as company_name,
  br.name      as branch_name,
  coalesce(m.topup_total, 0)  as topup_total,
  coalesce(m.return_total, 0) as return_total,
  coalesce(p.paid_total, 0)   as paid_total,
  coalesce(m.topup_total, 0) - coalesce(m.return_total, 0) - coalesce(p.paid_total, 0) as balance,
  -- เติมได้อีกเท่าไหร่ถึงจะเต็มวงเงินที่อนุมัติไว้
  greatest(
    f.limit_amount - (coalesce(m.topup_total, 0) - coalesce(m.return_total, 0) - coalesce(p.paid_total, 0)),
    0
  ) as topup_room
from public.pr_funds f
left join public.employees e  on e.id  = f.holder_id
left join public.companies co on co.id = f.company_id
left join public.branches  br on br.id = f.branch_id
left join lateral (
  select
    sum(case when mv.kind = 'topup'  then mv.amount else 0 end) as topup_total,
    sum(case when mv.kind = 'return' then mv.amount else 0 end) as return_total
  from public.pr_fund_moves mv
  where mv.fund_id = f.id
) m on true
left join lateral (
  select sum(pay.paid_amount) as paid_total
  from public.pr_payments pay
  where pay.fund_id = f.id
) p on true;

revoke all on public.v_pr_funds from anon, authenticated;

-- ---------- 6) view: ความเคลื่อนไหวของกอง ----------
drop view if exists public.v_pr_fund_moves;

create view public.v_pr_fund_moves as
select
  mv.*,
  f.holder_id,
  e.full_name as holder_name,
  f.company_id,
  f.branch_id
from public.pr_fund_moves mv
left join public.pr_funds  f on f.id = mv.fund_id
left join public.employees e on e.id = f.holder_id;

revoke all on public.v_pr_fund_moves from anon, authenticated;

-- ---------- 7) เมนู ----------
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('PR_FUND_PAY',   '4.4 จ่ายเงินจากเงินสำรอง',   '/procurement/fund-payments', 'entry',   59),
  ('PR_FUND_TOPUP', '4.5 เติมเงินสำรองจ่าย',      '/procurement/fund-topups',   'entry',   60),
  ('PR_FUND',       'ตั้งค่า วงเงินสำรองจ่าย',     '/procurement/setup/funds',   'setting', 96)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'PR'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- จ่ายและเติมเงินสำรอง: ผู้ดูแลกับผู้ช่วยทำได้เต็ม ระดับอื่นต้องให้ผู้ดูแลเปิดสิทธิ์เป็นรายคน
-- (คนถือเงินสำรองมีไม่กี่คน จึงไม่เปิดให้ทุกคนเป็นค่าเริ่มต้น)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code in ('PR_FUND_PAY', 'PR_FUND_TOPUP')
on conflict (level, menu_id) do nothing;

-- ตั้งวงเงิน: ทุกระดับดูได้ (จะได้เห็นยอดคงเหลือของตัวเอง) แต่แก้วงเงินได้เฉพาะผู้ดูแล
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  true,
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level in ('admin', 'assistant_admin'),
  lvl.level = 'admin'
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'PR_FUND'
on conflict (level, menu_id) do nothing;

-- ---------- 8) สร้าง v_pr_payments ใหม่ให้เห็นคอลัมน์ fund_id ----------
-- view เดิมใช้ pay.* ซึ่งขยายรายชื่อคอลัมน์ไว้ตั้งแต่ตอนสร้าง
-- คอลัมน์ที่เพิ่มทีหลังจึงไม่โผล่เอง ต้อง drop แล้วสร้างใหม่
drop view if exists public.v_pr_payments;

create view public.v_pr_payments as
select
  pay.*,
  co.name as company_name,
  co.code as company_code,
  br.name as branch_name,
  br.code as branch_code,
  ac.code as account_code,
  ac.name as account_name,
  ac.category as account_category,
  e.full_name as created_by_full_name,
  fh.full_name as fund_holder_name,
  (select count(*) from public.pr_payment_items i where i.payment_id = pay.id) as item_count,
  (select count(*) from public.pr_payment_files f where f.payment_id = pay.id) as file_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.payment_id = pay.id), 0) as item_total
from public.pr_payments pay
left join public.companies   co on co.id = pay.company_id
left join public.branches    br on br.id = pay.branch_id
left join public.pr_accounts ac on ac.id = pay.account_id
left join public.employees   e  on e.id  = pay.created_by
left join public.pr_funds    fn on fn.id = pay.fund_id
left join public.employees   fh on fh.id = fn.holder_id;

revoke all on public.v_pr_payments from anon, authenticated;
