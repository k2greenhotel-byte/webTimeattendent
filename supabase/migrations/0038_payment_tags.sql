-- ============================================================
-- ป้ายกำกับ (แฮชแท็ก) ของใบเบิกจ่าย
--
-- ใช้ได้ทั้งใบเบิกเงินสดย่อยและใบเบิกจ่ายส่วนกลาง (ตาราง pr_payments เดียวกัน)
-- ติดได้หลายป้ายต่อหนึ่งใบ เพื่อดูรายงานสรุปยอดตามป้าย
--
-- ทำไมแยกตารางแทนที่จะเก็บเป็นข้อความในใบเบิก:
--   ถ้าเก็บเป็นข้อความอิสระ ผู้ใช้พิมพ์ "ค่าน้ำมัน" กับ "ค่าน้ำมัน " กับ "ค่านํ้ามัน"
--   จะกลายเป็นคนละกลุ่มในรายงาน สรุปยอดไม่ตรง
--   จึงเก็บป้ายเป็นแถวในตาราง แล้วเทียบด้วย slug ที่ normalize แล้ว
--
--   pr_tags          : ทะเบียนป้าย (ชื่อที่แสดง + slug สำหรับเทียบซ้ำ)
--   pr_payment_tags  : ใบเบิกใบไหนติดป้ายอะไรบ้าง (หลายต่อหลาย)
--
-- รันต่อจาก 0037 (ปลอดภัยถ้ารันซ้ำ)
-- ============================================================

create table if not exists public.pr_tags (
  id         uuid primary key default gen_random_uuid(),
  -- ชื่อที่ผู้ใช้เห็นและพิมพ์เข้ามา
  name       text not null,
  -- ชื่อที่ normalize แล้ว (ตัดเว้นวรรค ตัด # นำหน้า พิมพ์เล็ก) ใช้กันป้ายซ้ำ
  slug       text not null unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pr_payment_tags (
  payment_id uuid not null references public.pr_payments (id) on delete cascade,
  tag_id     uuid not null references public.pr_tags (id)     on delete cascade,
  created_at timestamptz not null default now(),
  primary key (payment_id, tag_id)
);

create index if not exists idx_pr_payment_tags_tag on public.pr_payment_tags (tag_id);

alter table public.pr_tags         enable row level security;
alter table public.pr_payment_tags enable row level security;

drop trigger if exists trg_pr_tags_updated on public.pr_tags;
create trigger trg_pr_tags_updated before update on public.pr_tags
  for each row execute function public.set_updated_at();

-- ---------- View: ทะเบียนป้ายพร้อมจำนวนที่ถูกใช้ ----------
drop view if exists public.v_pr_tags;

create view public.v_pr_tags as
select
  t.*,
  (select count(*) from public.pr_payment_tags pt where pt.tag_id = t.id) as use_count
from public.pr_tags t;

revoke all on public.v_pr_tags from anon, authenticated;

-- ---------- View: หนึ่งแถวต่อหนึ่งคู่ (ใบเบิก × ป้าย) สำหรับรายงานสรุป ----------
-- ใช้ left join เพื่อให้ใบที่ยังไม่ติดป้ายก็อยู่ในรายงานด้วย (tag_id เป็น null)
-- จะได้เห็นว่ามียอดเท่าไหร่ที่ยังไม่ได้จัดกลุ่ม
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
left join public.pr_accounts     ac on ac.id = pay.account_id;

revoke all on public.v_pr_payment_tag_rows from anon, authenticated;

-- ---------- เมนูรายงานสรุปตามป้ายกำกับ ----------
insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, m.code, m.name, m.path, m.kind::menu_kind, m.sort_order
from (values
  ('PR_TAG_REPORT', '4.3 รายงานสรุปตามป้ายกำกับ', '/procurement/tag-report', 'report', 58)
) as m(code, name, path, kind, sort_order)
join public.programs p on p.code = 'PR'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

-- รายงานเปิดให้ระดับที่ดูรายงานได้อยู่แล้ว (ดูอย่างเดียว)
insert into public.level_menu_permissions (level, menu_id, can_read, can_write, can_edit, can_delete)
select
  lvl.level::access_level,
  m.id,
  lvl.level in ('admin', 'assistant_admin', 'supervisor'),
  false,
  false,
  false
from public.program_menus m
cross join (values ('admin'), ('assistant_admin'), ('supervisor'), ('user')) as lvl(level)
where m.code = 'PR_TAG_REPORT'
on conflict (level, menu_id) do nothing;
