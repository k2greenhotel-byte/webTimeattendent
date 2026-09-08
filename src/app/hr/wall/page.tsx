import HrWallBoard from "@/components/hr/HrWallBoard";
import { listBranches } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room — ข้อมูลจาก /api/hr/wall รีเฟรชเองทุก 2 นาที */
export default async function WallPage() {
  await requirePermission("HR_WALL", "read");
  const branches = await listBranches();

  return <HrWallBoard branches={branches.map((b) => ({ id: b.id, name: b.name }))} />;
}
