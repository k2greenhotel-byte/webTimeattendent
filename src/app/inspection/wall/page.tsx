import InspectionWallBoard from "@/components/inspection/InspectionWallBoard";
import { listCompanies } from "@/lib/core-db";
import { listTemplates } from "@/lib/inspection-db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room — ข้อมูลจาก /api/inspection/wall รีเฟรชเองทุก 5 นาที */
export default async function WallPage() {
  await requirePermission("INSP_WALL", "read");
  const [companies, templates] = await Promise.all([listCompanies(true), listTemplates()]);

  return (
    <InspectionWallBoard
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      templates={templates.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
