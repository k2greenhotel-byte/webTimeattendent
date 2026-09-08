import { NextResponse } from "next/server";
import { buildProcurementWall } from "@/lib/procurement-wall";
import { checkPermission } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ข้อมูลจอ War Room ของระบบจัดซื้อ/แจ้งซ่อม — /api/procurement/wall?branch=<id> */
export async function GET(req: Request) {
  if (!(await checkPermission("PR_WALL", "read"))) {
    return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ดูจอนี้" }, { status: 403 });
  }

  try {
    const wall = await buildProcurementWall({
      branchId: new URL(req.url).searchParams.get("branch"),
    });
    return NextResponse.json(wall, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "อ่านข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
