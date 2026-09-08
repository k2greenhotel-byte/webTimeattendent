import SaleWorkWallBoard from "@/components/salework/SaleWorkWallBoard";
import { listBranches } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room — ข้อมูลจาก /api/salework/wall รีเฟรชเองทุก 2 นาที */
export default async function WallPage() {
  await requirePermission("SW_WALL", "read");
  const branches = await listBranches();

  return <SaleWorkWallBoard branches={branches.map((b) => ({ id: b.id, name: b.name }))} />;
}
