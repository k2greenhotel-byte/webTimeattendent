-- ============================================================
-- จ่ายเงินจากส่วนกลาง
--
-- ใช้ตาราง pr_payments ร่วมกับใบเบิกเงินสดย่อย แล้วแยกด้วยคอลัมน์ pay_source
-- เพราะทั้งสองแหล่งจ่ายมีช่องข้อมูล กฎ และเอกสารพิมพ์เหมือนกันทุกอย่าง
-- ต่างกันแค่ 3 เรื่อง: ชุดเลขที่เอกสาร · เมนู/สิทธิ์ · ชื่อที่แสดง
-- (แยกตารางจะต้องดูแลโค้ดสองชุดที่เหมือนกันไปตลอด)
--
--   เลขที่เงินสดย่อย  PV-<บริษัท>-<สาขา>-2569-0001
--   เลขที่ส่วนกลาง    CV-<บริษัท>-<สาขา>-2569-0001   ← คนละชุดตัวนับ
--
-- รันต่อจาก 0031 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pr_pay_source') then
    create type pr_pay_source as enum ('petty', 'central');
  end if;
end
$$;

alter table public.pr_payments
  add column if not exists pay_source pr_pay_source not null default 'petty';

create index if not exists idx_pr_payments_source on public.pr_payments (pay_source, pay_date);

-- view ต้องสร้างใหม่ เพราะรายชื่อคอลัมน์ของ view ถูกตรึงไว้ตอนสร้าง
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
left join public.companies   co on co.id = pay.company_id
left join public.branches    br on br.id = pay.branch_id
left join public.pr_accounts ac on ac.id = pay.account_id
left join public.employees   e  on e.id  = pay.created_by;

revoke all on public.v_pr_payments from anon, authenticated;

-- ---------- เมนูใหม่ ----------
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('PR_CENTRAL_PAY', '4.2 จ่ายเงินจากส่วนกลาง', '/procurement/central-payments', 'entry', 55)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'PR'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- จ่ายจากส่วนกลางเป็นเงินก้อนใหญ่กว่าเงินสดย่อย จึงจำกัดเฉพาะผู้ดูแลระบบ
-- ระดับอื่นไม่เห็นเมนูนี้เลย (เปิดให้ทีหลังรายคนได้ที่ /core/users)
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
where m.code = 'PR_CENTRAL_PAY'
on conflict (level, menu_id) do nothing;
