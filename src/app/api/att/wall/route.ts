import { NextResponse } from "next/server";
import { currentBranchScope } from "@/lib/att-access";
import { buildAttendanceWall } from "@/lib/att-wall";
import { checkPermission, isAdminAuthed } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ข้อมูลจอ War Room ของระบบลงเวลา — หน้าจอเรียกซ้ำทุกนาที
 * /api/att/wall?date=YYYY-MM-DD&company=<id>&branch=<id>
 */
export async function GET(req: Request) {
  const [isAdmin, canRead] = await Promise.all([isAdminAuthed(), checkPermission("ATT_WALL", "read")]);
  if (!isAdmin && !canRead) {
    return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ดูจอนี้" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  try {
    const wall = await buildAttendanceWall({
      date: sp.get("date") ?? undefined,
      companyId: sp.get("company") || null,
      branchId: sp.get("branch") || null,
      branchScope: await currentBranchScope(),
    });
    return NextResponse.json(wall, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "อ่านข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
