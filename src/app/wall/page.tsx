import WallRotator, { type WallScreen } from "@/components/wall/WallRotator";
import { listBranches } from "@/lib/db";
import { listMaster } from "@/lib/marketing-db";
import { getMyPermissions, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * จอรวม War Room ทุกโปรแกรม — สำหรับเปิดค้างบนทีวีจอเดียวในออฟฟิศ
 *
 * สลับจอเองอัตโนมัติทุก 30 วินาที และแสดงเฉพาะจอที่ผู้ใช้คนนี้มีสิทธิ์ดู
 * (ใช้สิทธิ์รายเมนูชุดเดียวกับตอนเปิดจอเดี่ยว จึงไม่มีทางเห็นจอที่ไม่มีสิทธิ์)
 */

const SCREENS: { menu: string; key: WallScreen["key"]; label: string }[] = [
  { menu: "ATT_WALL", key: "att", label: "การลงเวลา" },
  { menu: "MKT_WALL", key: "marketing", label: "เงินค่าส่งเสริม" },
  { menu: "BOOK_WALL", key: "booking", label: "จองรถ" },
  { menu: "LEAD_WALL", key: "lead", label: "Lead" },
  { menu: "PR_WALL", key: "procurement", label: "จัดซื้อ/ซ่อม" },
  { menu: "CLM_WALL", key: "claim", label: "เคลม" },
  { menu: "HR_WALL", key: "hr", label: "ลา/เบิกเงิน" },
  { menu: "SW_WALL", key: "salework", label: "งานประจำวัน" },
];

export default async function CombinedWallPage() {
  await requireUser();
  const permissions = await getMyPermissions();
  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));

  const screens: WallScreen[] = SCREENS.filter((s) => readable.has(s.menu)).map((s) => ({
    key: s.key,
    label: s.label,
  }));

  const [branches, companies] = await Promise.all([
    listBranches(),
    listMaster("company", { includeInactive: true }),
  ]);

  return (
    <WallRotator
      screens={screens}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
