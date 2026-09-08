import { NextResponse } from "next/server";
import { buildMarketingWall } from "@/lib/marketing-wall";
import { checkPermission } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ข้อมูลจอ War Room ของกิจกรรมการตลาด — หน้าจอเรียกซ้ำเองทุก 2 นาที
 * /api/marketing/wall?from=YYYY-MM-DD&to=YYYY-MM-DD&company=<id>&type=<id>
 */
export async function GET(req: Request) {
  if (!(await checkPermission("MKT_WALL", "read"))) {
    return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ดูจอนี้" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  try {
    const wall = await buildMarketingWall({
      from: sp.get("from"),
      to: sp.get("to"),
      companyId: sp.get("company"),
      activityTypeId: sp.get("type"),
    });
    return NextResponse.json(wall, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "อ่านข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
