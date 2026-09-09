import { NextResponse } from "next/server";
import { buildBookingWall } from "@/lib/booking-wall";
import { checkPermission } from "@/lib/session";
import { resolvePeriod } from "@/lib/wall-period";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ข้อมูลจอ War Room ของระบบจองรถ — /api/booking/wall?branch=<id>&from=&to= */
export async function GET(req: Request) {
  if (!(await checkPermission("BOOK_WALL", "read"))) {
    return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ดูจอนี้" }, { status: 403 });
  }

  try {
    const q = new URL(req.url).searchParams;
    const wall = await buildBookingWall({
      branchId: q.get("branch"),
      period: resolvePeriod(q.get("from"), q.get("to")),
    });
    return NextResponse.json(wall, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "อ่านข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
