import HotelWallBoard from "@/components/hotel/HotelWallBoard";
import { listCompanies } from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room — ข้อมูลจาก /api/hotel/wall รีเฟรชเองทุก 5 นาที */
export default async function HotelWallPage() {
  await requirePermission("HTL_WALL", "read");
  const [companies, branches] = await Promise.all([listCompanies(true), listBranches()]);

  return (
    <HotelWallBoard
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
