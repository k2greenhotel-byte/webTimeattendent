import { NextResponse } from "next/server";
import { buildHrWall } from "@/lib/hr-wall";
import { checkPermission } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ข้อมูลจอ War Room — /api/hr/wall?branch=<id> */
export async function GET(req: Request) {
  if (!(await checkPermission("HR_WALL", "read"))) {
    return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ดูจอนี้" }, { status: 403 });
  }

  try {
    const wall = await buildHrWall({
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
