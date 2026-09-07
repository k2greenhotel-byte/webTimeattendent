-- ============================================================
-- ทะเบียนเจ้าหนี้ / ผู้ขาย ที่จ่ายเป็นประจำ
--
-- ใบเบิกจ่ายเลือกเจ้าหนี้จากทะเบียนได้ ระบบเติมชื่อ ที่อยู่ เบอร์โทร ให้อัตโนมัติ
-- ส่วนผู้ขายที่ไม่ประจำยังพิมพ์เองได้เหมือนเดิม (vendor_id เป็น null)
--
-- ทำไมยังเก็บ payee_name/address/phone ไว้บนใบเบิกด้วย ทั้งที่มี vendor_id แล้ว:
--   ข้อมูลเจ้าหนี้เปลี่ยนได้ (ย้ายที่อยู่ เปลี่ยนเบอร์) แต่ใบเบิกที่จ่ายไปแล้ว
--   ต้องคงข้อมูล ณ วันที่จ่ายไว้ตามเดิม ไม่งั้นเอกสารย้อนหลังจะเพี้ยน
--
-- รันต่อจาก 0038 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

create table if not exists public.pr_vendors (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  address    text,
  phone      text,
  note       text,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pr_vendors_active on public.pr_vendors (is_active, sort_order);

alter table public.pr_vendors enable row level security;

drop trigger if exists trg_pr_vendors_updated on public.pr_vendors;
create trigger trg_pr_vendors_updated before update on public.pr_vendors
  for each row execute function public.set_updated_at();

-- ใบเบิกอ้างเจ้าหนี้ในทะเบียน (ไม่บังคับ — ผู้ขายไม่ประจำปล่อยว่าง)
alter table public.pr_payments
  add column if not exists vendor_id uuid references public.pr_vendors (id) on delete set null;

create index if not exists idx_pr_payments_vendor on public.pr_payments (vendor_id);

-- ---------- View: ทะเบียนเจ้าหนี้พร้อมจำนวนครั้งที่จ่าย ----------
drop view if exists public.v_pr_vendors;

create view public.v_pr_vendors as
select
  v.*,
  (select count(*)               from public.pr_payments p where p.vendor_id = v.id) as payment_count,
  (select coalesce(sum(p.paid_amount), 0) from public.pr_payments p where p.vendor_id = v.id) as paid_total
from public.pr_vendors v;

revoke all on public.v_pr_vendors from anon, authenticated;

-- ---------- ใบเบิกต้องมีข้อมูลเจ้าหนี้ที่ join แล้วด้วย ----------
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
  vd.code as vendor_code,
  vd.name as vendor_name,
  e.full_name as created_by_full_name,
  (select count(*) from public.pr_payment_items i where i.payment_id = pay.id) as item_count,
  (select count(*) from public.pr_payment_files f where f.payment_id = pay.id) as file_count,
  coalesce((select sum(i.amount) from public.pr_payment_items i where i.payment_id = pay.id), 0) as item_total
from public.pr_payments pay
left join public.companies   co on co.id = pay.company_id
left join public.branches    br on br.id = pay.branch_id
left join public.pr_accounts ac on ac.id = pay.account_id
left join public.pr_vendors  vd on vd.id = pay.vendor_id
left join public.employees   e  on e.id  = pay.created_by;

revoke all on public.v_pr_payments from anon, authenticated;

-- รายงานป้ายกำกับก็ควรเห็นชื่อเจ้าหนี้ด้วย
drop view if exists public.v_pr_payment_tag_rows;

create view public.v_pr_payment_tag_rows as
select
  pay.id          as payment_id,
  pay.doc_no,
  pay.pay_date,
  pay.paid_amount,
  pay.pay_source,
  pay.company_id,
  co.name         as company_name,
  pay.branch_id,
  br.name         as branch_name,
  pay.payee_name,
  pay.vendor_id,
  vd.name         as vendor_name,
  pay.expense_detail,
  pay.account_id,
  ac.code         as account_code,
  ac.name         as account_name,
  t.id            as tag_id,
  t.name          as tag_name,
  t.slug          as tag_slug
from public.pr_payments pay
left join public.pr_payment_tags pt on pt.payment_id = pay.id
left join public.pr_tags         t  on t.id  = pt.tag_id
left join public.companies       co on co.id = pay.company_id
left join public.branches        br on br.id = pay.branch_id
left join public.pr_accounts     ac on ac.id = pay.account_id
left join public.pr_vendors      vd on vd.id = pay.vendor_id;

revoke all on public.v_pr_payment_tag_rows from anon, authenticated;

-- ---------- เมนูตั้งค่าเจ้าหนี้ ----------
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('PR_VENDOR', 'ตั้งค่า เจ้าหนี้/ผู้ขาย', '/procurement/setup/vendors', 'setting', 95)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'PR'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- ทุกระดับอ่านได้ (ต้องอ่านเพื่อเลือกในใบเบิก) แต่แก้ทะเบียนได้เฉพาะผู้ดูแล
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
where m.code = 'PR_VENDOR'
on conflict (level, menu_id) do nothing;
