import LeadWallBoard from "@/components/lead/LeadWallBoard";
import { listBranches } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room ระบบ Lead — ข้อมูลจาก /api/leads/wall รีเฟรชเองทุก 2 นาที */
export default async function LeadWallPage() {
  await requirePermission("LEAD_WALL", "read");
  const branches = await listBranches();

  return <LeadWallBoard branches={branches.map((b) => ({ id: b.id, name: b.name }))} />;
}
