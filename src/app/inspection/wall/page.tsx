import InspectionWallBoard from "@/components/inspection/InspectionWallBoard";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { listTemplates } from "@/lib/inspection-db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room — ข้อมูลจาก /api/inspection/wall รีเฟรชเองทุก 5 นาที */
export default async function WallPage() {
  await requirePermission("INSP_WALL", "read");
  const [companies, templates, branches] = await Promise.all([
    listCompanies(true),
    listTemplates(),
    listBranches(),
  ]);

  return (
    <InspectionWallBoard
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      templates={templates.map((t) => ({ id: t.id, name: t.name }))}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
