import ClaimWallBoard from "@/components/claim/ClaimWallBoard";
import { listBranches } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room — ข้อมูลจาก /api/claim/wall รีเฟรชเองทุก 2 นาที */
export default async function WallPage() {
  await requirePermission("CLM_WALL", "read");
  const branches = await listBranches();

  return <ClaimWallBoard branches={branches.map((b) => ({ id: b.id, name: b.name }))} />;
}
