import BookingWallBoard from "@/components/booking/BookingWallBoard";
import { listBranches } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room ระบบจองรถ — ข้อมูลจาก /api/booking/wall รีเฟรชเองทุก 2 นาที */
export default async function BookingWallPage() {
  await requirePermission("BOOK_WALL", "read");
  const branches = await listBranches();

  return <BookingWallBoard branches={branches.map((b) => ({ id: b.id, name: b.name }))} />;
}
