-- ============================================================
-- จอ War Room "งานรออนุมัติ" (APV_WALL) — /approvals/wall
--
-- รวมของค้างรออนุมัติทุกโปรแกรมไว้จอเดียว: เรื่องส่วนกลาง ใบขอซ่อม/จัดซื้อ
-- ใบลา และใบขอเบิกเงิน — เปิดค้างบนทีวีให้เห็นว่ามีงานดองอยู่กี่เรื่อง กี่บาท
-- และเข้าคิวรวมของจอ /wall ด้วย
--
-- เป็นจอดูอย่างเดียว กดอนุมัติจริงยังต้องไปที่ /approvals (APV_INBOX) เหมือนเดิม
-- ข้อมูลในจอยังจำกัดตามสิทธิ์รายโปรแกรมของผู้ดูอีกชั้น คนที่เห็นแต่ใบลา
-- จะไม่เห็นยอดเงินฝั่งจัดซื้อ
--
-- สิทธิ์เริ่มต้น: หัวหน้าขึ้นไป ตามนโยบายเดียวกับจอ War Room อื่นทุกจอ
-- (รหัสลงท้าย _WALL จึงโผล่ในหน้า /core/wall-rights ให้ตั้งรายคนได้เองด้วย)
-- ============================================================

insert into public.program_menus (program_id, code, name, path, kind, sort_order)
select p.id, 'APV_WALL', '7. จอ War Room งานรออนุมัติ', '/approvals/wall', 'dashboard'::menu_kind, 95
from public.programs p
where p.code = 'APV'
on conflict (code) do update
  set name       = excluded.name,
      path       = excluded.path,
      kind       = excluded.kind,
      sort_order = excluded.sort_order;

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
where m.code = 'APV_WALL'
on conflict (level, menu_id) do nothing;
