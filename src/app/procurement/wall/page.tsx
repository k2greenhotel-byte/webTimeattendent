import ProcurementWallBoard from "@/components/procurement/ProcurementWallBoard";
import { listBranches } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room ระบบจัดซื้อ/แจ้งซ่อม — ข้อมูลจาก /api/procurement/wall รีเฟรชเองทุก 2 นาที */
export default async function ProcurementWallPage() {
  await requirePermission("PR_WALL", "read");
  const branches = await listBranches();

  return <ProcurementWallBoard branches={branches.map((b) => ({ id: b.id, name: b.name }))} />;
}
