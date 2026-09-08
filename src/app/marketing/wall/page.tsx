import MarketingWallBoard from "@/components/marketing/MarketingWallBoard";
import { listMaster } from "@/lib/marketing-db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * จอ War Room กิจกรรมการตลาด — เปิดค้างบนจอมอนิเตอร์
 * ข้อมูลมาจาก /api/marketing/wall รีเฟรชเองทุก 2 นาที
 */
export default async function MarketingWallPage() {
  await requirePermission("MKT_WALL", "read");
  const [companies, activityTypes] = await Promise.all([
    listMaster("company", { includeInactive: true }),
    listMaster("activityType", { includeInactive: true }),
  ]);

  return (
    <MarketingWallBoard
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      activityTypes={activityTypes.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
