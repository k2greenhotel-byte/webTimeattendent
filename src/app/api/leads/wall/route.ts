import { NextResponse } from "next/server";
import { buildLeadWall } from "@/lib/lead-wall";
import { checkPermission } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ข้อมูลจอ War Room ของระบบ Lead — /api/leads/wall?branch=<id> */
export async function GET(req: Request) {
  if (!(await checkPermission("LEAD_WALL", "read"))) {
    return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ดูจอนี้" }, { status: 403 });
  }

  try {
    const wall = await buildLeadWall({
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
