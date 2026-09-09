import WallRotator, { type WallScreen } from "@/components/wall/WallRotator";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { listTemplates } from "@/lib/inspection-db";
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
  { menu: "APV_WALL", key: "approval", label: "รออนุมัติ" },
  { menu: "ATT_WALL", key: "att", label: "การลงเวลา" },
  { menu: "MKT_WALL", key: "marketing", label: "เงินค่าส่งเสริม" },
  { menu: "BOOK_WALL", key: "booking", label: "จองรถ" },
  { menu: "LEAD_WALL", key: "lead", label: "Lead" },
  { menu: "PR_WALL", key: "procurement", label: "จัดซื้อ/ซ่อม" },
  { menu: "CLM_WALL", key: "claim", label: "เคลม" },
  { menu: "HR_WALL", key: "hr", label: "ลา/เบิกเงิน" },
  { menu: "SW_WALL", key: "salework", label: "งานประจำวัน" },
  { menu: "INSP_WALL", key: "inspection", label: "ตรวจสาขา" },
  { menu: "HTL_WALL", key: "hotel", label: "ตรวจเช็คโรงแรม" },
  { menu: "DB2_WALL", key: "db2", label: "ยอดขาย Db2" },
];

export default async function CombinedWallPage() {
  await requireUser();
  const permissions = await getMyPermissions();
  const readable = new Set(permissions.filter((p) => p.can_read).map((p) => p.menu_code));

  const screens: WallScreen[] = SCREENS.filter((s) => readable.has(s.menu)).map((s) => ({
    key: s.key,
    label: s.label,
  }));

  const [branches, companies, activityTypes, coreCompanies, inspectionTemplates] =
    await Promise.all([
      listBranches(),
      listMaster("company", { includeInactive: true }),
      listMaster("activityType", { includeInactive: true }),
      listCompanies(true),
      listTemplates(),
    ]);

  return (
    <WallRotator
      screens={screens}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      activityTypes={activityTypes.map((t) => ({ id: t.id, name: t.name }))}
      inspectionCompanies={coreCompanies.map((c) => ({ id: c.id, name: c.name }))}
      inspectionTemplates={inspectionTemplates.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
