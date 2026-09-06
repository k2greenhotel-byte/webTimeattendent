-- ============================================================
-- ระบบจัดซื้อจัดจ้างแจ้งซ่อม รอบที่ 2
--
--   1) เลขที่อนุมัติ + วันที่อนุมัติ ขึ้นไปอยู่บนใบขอซ่อม/ใบขอซื้อ
--      เพื่อให้พิมพ์เอกสารประกอบการจ่ายเงินได้ครบโดยไม่ต้อง join ใบอนุมัติทุกครั้ง
--
--   2) ผังบัญชี (pr_accounts) — 5 หมวดตามหลักบัญชี
--      สินทรัพย์ / หนี้สิน / ทุน / ค่าใช้จ่าย / รายได้
--      กำหนดบัญชีคุม (parent) กับบัญชีย่อย (child) ได้ด้วย parent_id
--
--   3) ใบเบิกเงินสดย่อย — ต่อยอดจาก pr_payments เดิม
--      * จ่ายได้โดยไม่ต้องมีใบขออนุมัติ (รายการทั่วไป)
--      * เลขที่เอกสาร run แยกตามบริษัทและสาขาที่ทำจ่าย
--      * เก็บผู้รับเงิน ที่อยู่ เบอร์โทร ประเภทค่าใช้จ่าย (ผังบัญชี) และลายเซ็นดิจิทัล
--
-- รันต่อจาก 0016 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

-- ---------- หมวดบัญชี 5 หมวด ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'pr_account_category') then
    create type pr_account_category as enum ('asset', 'liability', 'equity', 'expense', 'revenue');
  end if;
end
$$;

-- ---------- 1) เลขที่อนุมัติบนเอกสารต้นทาง ----------
alter table public.pr_repairs   add column if not exists approval_no   text;
alter table public.pr_repairs   add column if not exists approved_date date;
alter table public.pr_purchases add column if not exists approval_no   text;
alter table public.pr_purchases add column if not exists approved_date date;

-- เอกสารที่อนุมัติไปแล้วก่อนมีคอลัมน์นี้ ให้ดึงเลขที่จากใบอนุมัติล่าสุดที่ผลเป็น "อนุมัติ"
update public.pr_repairs r
set approval_no   = a.doc_no,
    approved_date = a.approve_date
from (
  select distinct on (repair_id) repair_id, doc_no, approve_date
  from public.pr_approvals
  where repair_id is not null and decision = 'approved'
  order by repair_id, approve_date desc, created_at desc
) a
where a.repair_id = r.id and r.approval_no is null;

update public.pr_purchases p
set approval_no   = a.doc_no,
    approved_date = a.approve_date
from (
  select distinct on (purchase_id) purchase_id, doc_no, approve_date
  from public.pr_approvals
  where purchase_id is not null and decision = 'approved'
  order by purchase_id, approve_date desc, created_at desc
) a
where a.purchase_id = p.id and p.approval_no is null;

-- ---------- 2) ผังบัญชี ----------
create table if not exists public.pr_accounts (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  category   pr_account_category not null,
  -- บัญชีคุม: แถวที่ parent_id เป็น null และมีลูก · บัญชีย่อย: แถวที่มี parent_id
  parent_id  uuid references public.pr_accounts (id) on delete set null,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pr_accounts_category on public.pr_accounts (category, sort_order);
create index if not exists idx_pr_accounts_parent   on public.pr_accounts (parent_id);

-- ---------- 3) ใบเบิกเงินสดย่อย ----------
alter table public.pr_payments add column if not exists ref_no              text;
alter table public.pr_payments add column if not exists payee_name          text;
alter table public.pr_payments add column if not exists payee_address       text;
alter table public.pr_payments add column if not exists payee_phone         text;
alter table public.pr_payments add column if not exists account_id          uuid references public.pr_accounts (id) on delete set null;
alter table public.pr_payments add column if not exists approver_name       text;
alter table public.pr_payments add column if not exists payee_signature     text;
alter table public.pr_payments add column if not exists approver_signature  text;

create index if not exists idx_pr_payments_account on public.pr_payments (account_id);
create index if not exists idx_pr_payments_branch  on public.pr_payments (company_id, branch_id);

-- รายการที่อ้างถึงต้องยอมให้ว่างได้ เพราะรายการทั่วไปไม่มีใบขออนุมัติ
alter table public.pr_payment_items drop constraint if exists pr_payment_items_target_required;

-- ---------- เลขที่เอกสารที่ run แยกตามบริษัท/สาขา ----------
-- pr_next_scoped_doc_no('PV', 'HQ-BKK', 2569) → 'PV-HQ-BKK-2569-0001'
-- ใช้ตัวนับคนละชุดกับ pr_next_doc_no เพราะ key มีรหัสบริษัท-สาขาอยู่ด้วย
create or replace function public.pr_next_scoped_doc_no(doc_prefix text, scope text, be_year int)
returns text
language plpgsql
as $fn$
declare
  key      text := doc_prefix || '-' || scope || '-' || be_year::text;
  next_seq int;
begin
  insert into public.pr_doc_counters (prefix, seq)
  values (key, 1)
  on conflict (prefix) do update set seq = public.pr_doc_counters.seq + 1
  returning seq into next_seq;

  return key || '-' || lpad(next_seq::text, 4, '0');
end;
$fn$;

-- ---------- RLS + trigger ----------
alter table public.pr_accounts enable row level security;

drop trigger if exists trg_pr_accounts_updated on public.pr_accounts;
create trigger trg_pr_accounts_updated before update on public.pr_accounts
  for each row execute function public.set_updated_at();

-- ---------- View: ผังบัญชีพร้อมชื่อบัญชีคุม ----------
drop view if exists public.v_pr_accounts;

create view public.v_pr_accounts as
select
  a.*,
  p.code as parent_code,
  p.name as parent_name,
  (select count(*) from public.pr_accounts c where c.parent_id = a.id) as child_count
from public.pr_accounts a
left join public.pr_accounts p on p.id = a.parent_id;

revoke all on public.v_pr_accounts from anon, authenticated;

-- ---------- สร้าง view ใหม่ให้มีคอลัมน์เลขที่อนุมัติ ----------
drop view if exists public.v_pr_repairs;

create view public.v_pr_repairs as
select
  r.*,
  co.name as company_name,
  br.name as branch_name,
  at.code as asset_type_code,
  at.name as asset_type_name,
  e.full_name as created_by_full_name,
  (select count(*) from public.pr_repair_photos p  where p.repair_id = r.id) as photo_count,
  (select count(*) from public.pr_repair_updates u where u.repair_id = r.id) as update_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.repair_id = r.id), 0) as paid_total
from public.pr_repairs r
left join public.companies      co on co.id = r.company_id
left join public.branches       br on br.id = r.branch_id
left join public.pr_asset_types at on at.id = r.asset_type_id
left join public.employees      e  on e.id  = r.created_by;

revoke all on public.v_pr_repairs from anon, authenticated;

drop view if exists public.v_pr_purchases;

create view public.v_pr_purchases as
select
  p.*,
  co.name as company_name,
  br.name as branch_name,
  mt.code as material_type_code,
  mt.name as material_type_name,
  e.full_name as created_by_full_name,
  (select count(*) from public.pr_purchase_photos f where f.purchase_id = p.id) as photo_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.purchase_id = p.id), 0) as paid_total
from public.pr_purchases p
left join public.companies         co on co.id = p.company_id
left join public.branches          br on br.id = p.branch_id
left join public.pr_material_types mt on mt.id = p.material_type_id
left join public.employees         e  on e.id  = p.created_by;

revoke all on public.v_pr_purchases from anon, authenticated;

-- v_pr_docs ต้องมีเลขที่อนุมัติด้วย เพราะหน้าเบิกเงินสดย่อยดึงจาก view นี้
drop view if exists public.v_pr_docs;

create view public.v_pr_docs as
select
  'repair'::text     as kind,
  r.id,
  r.doc_no,
  r.request_date     as doc_date,
  r.company_id,
  co.name            as company_name,
  r.branch_id,
  br.name            as branch_name,
  r.item_name,
  at.name            as type_name,
  r.urgency,
  r.requested_amount,
  r.approved_amount,
  r.actual_amount,
  r.doc_status,
  r.pay_status,
  r.approve_status,
  r.reject_reason,
  r.reject_note,
  r.approval_no,
  r.approved_date,
  r.job_status,
  r.expected_done_date,
  r.fixed_date       as done_date,
  r.created_by,
  r.created_by_name,
  r.note,
  r.created_at
from public.pr_repairs r
left join public.companies      co on co.id = r.company_id
left join public.branches       br on br.id = r.branch_id
left join public.pr_asset_types at on at.id = r.asset_type_id
union all
select
  'purchase'::text   as kind,
  p.id,
  p.doc_no,
  p.request_date     as doc_date,
  p.company_id,
  co.name            as company_name,
  p.branch_id,
  br.name            as branch_name,
  p.item_name,
  mt.name            as type_name,
  p.urgency,
  p.requested_amount,
  p.approved_amount,
  p.actual_amount,
  p.doc_status,
  p.pay_status,
  p.approve_status,
  p.reject_reason,
  p.reject_note,
  p.approval_no,
  p.approved_date,
  null::pr_job_status as job_status,
  null::date          as expected_done_date,
  p.received_date     as done_date,
  p.created_by,
  p.created_by_name,
  p.note,
  p.created_at
from public.pr_purchases p
left join public.companies         co on co.id = p.company_id
left join public.branches          br on br.id = p.branch_id
left join public.pr_material_types mt on mt.id = p.material_type_id;

revoke all on public.v_pr_docs from anon, authenticated;

-- ใบเบิกเงินสดย่อยพร้อมชื่อบัญชีและผู้เกี่ยวข้อง
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
  (select count(*) from public.pr_payment_items i where i.payment_id = pay.id) as item_count,
  (select count(*) from public.pr_payment_files f where f.payment_id = pay.id) as file_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.payment_id = pay.id), 0) as item_total
from public.pr_payments pay
left join public.companies  co on co.id = pay.company_id
left join public.branches   br on br.id = pay.branch_id
left join public.pr_accounts ac on ac.id = pay.account_id
left join public.employees  e  on e.id  = pay.created_by;

revoke all on public.v_pr_payments from anon, authenticated;

-- ---------- ผังบัญชีตั้งต้น ----------
-- บัญชีคุมระดับหมวด แล้วค่อยแตกบัญชีย่อยที่ใช้บ่อยในงานซ่อม/จัดซื้อ
insert into public.pr_accounts (code, name, category, sort_order) values
  ('1000', 'สินทรัพย์',  'asset',     100),
  ('2000', 'หนี้สิน',    'liability', 200),
  ('3000', 'ส่วนของทุน', 'equity',    300),
  ('4000', 'รายได้',     'revenue',   400),
  ('5000', 'ค่าใช้จ่าย', 'expense',   500)
on conflict (code) do update
  set name       = excluded.name,
      category   = excluded.category,
      sort_order = excluded.sort_order;

-- บัญชีย่อยของหมวดสินทรัพย์ (เงินสดย่อยและทรัพย์สินที่ซื้อเข้ามา)
insert into public.pr_accounts (code, name, category, parent_id, sort_order)
select v.code, v.name, v.category::pr_account_category, p.id, v.sort_order
from (values
  ('1010', 'เงินสดย่อย',                   'asset', 110),
  ('1510', 'อุปกรณ์และเครื่องใช้สำนักงาน', 'asset', 120),
  ('1520', 'เครื่องมือและอุปกรณ์ซ่อมรถ',   'asset', 130)
) as v(code, name, category, sort_order)
join public.pr_accounts p on p.code = '1000'
on conflict (code) do update
  set name       = excluded.name,
      category   = excluded.category,
      parent_id  = excluded.parent_id,
      sort_order = excluded.sort_order;

-- บัญชีย่อยของหมวดค่าใช้จ่าย (ประเภทค่าใช้จ่ายที่เลือกในใบเบิกเงินสดย่อย)
insert into public.pr_accounts (code, name, category, parent_id, sort_order)
select v.code, v.name, v.category::pr_account_category, p.id, v.sort_order
from (values
  ('5110', 'ค่าซ่อมแซมและบำรุงรักษาอาคาร',     'expense', 510),
  ('5120', 'ค่าซ่อมแซมเครื่องใช้ไฟฟ้า',        'expense', 520),
  ('5130', 'ค่าซ่อมแซมเครื่องปรับอากาศ',       'expense', 530),
  ('5140', 'ค่าซ่อมแซมเครื่องคอมพิวเตอร์',     'expense', 540),
  ('5150', 'ค่าซ่อมแซมยานพาหนะ',               'expense', 550),
  ('5210', 'ค่าวัสดุสิ้นเปลืองสำนักงาน',       'expense', 560),
  ('5220', 'ค่าวัสดุในครัวและคาเฟ่',           'expense', 570),
  ('5230', 'ค่าวัสดุก่อสร้าง',                 'expense', 580),
  ('5310', 'ค่าอุปกรณ์การตลาดและส่งเสริมการขาย', 'expense', 590),
  ('5410', 'ค่าน้ำมันเชื้อเพลิงและค่าเดินทาง', 'expense', 600),
  ('5420', 'ค่าขนส่ง',                         'expense', 610),
  ('5430', 'ค่าจ้างเหมาบริการ',                'expense', 620),
  ('5910', 'ค่าใช้จ่ายเบ็ดเตล็ด',              'expense', 630)
) as v(code, name, category, sort_order)
join public.pr_accounts p on p.code = '5000'
on conflict (code) do update
  set name       = excluded.name,
      category   = excluded.category,
      parent_id  = excluded.parent_id,
      sort_order = excluded.sort_order;

-- ---------- เมนูใหม่: ผังบัญชี + เปลี่ยนชื่อหน้าจ่ายเงิน ----------
update public.program_menus
set name = '4.1 จ่ายเงินจากเงินสดย่อย'
where code = 'PR_PAYMENT';

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('PR_ACCOUNT', 'ตั้งค่า ผังบัญชี', '/procurement/setup/accounts', 'setting', 100)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'PR'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- ผังบัญชีให้ admin/ผู้ช่วย admin แก้ได้ ระดับอื่นดูอย่างเดียว (ต้องอ่านได้เพื่อเลือกในใบเบิก)
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
where m.code = 'PR_ACCOUNT'
on conflict (level, menu_id) do nothing;
