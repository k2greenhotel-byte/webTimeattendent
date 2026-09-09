import { NextResponse } from "next/server";
import { buildInspectionWall } from "@/lib/inspection-wall";
import { checkPermission } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ข้อมูลจอ War Room — /api/inspection/wall?company=<id>&template=<id> */
export async function GET(req: Request) {
  if (!(await checkPermission("INSP_WALL", "read"))) {
    return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ดูจอนี้" }, { status: 403 });
  }

  try {
    const params = new URL(req.url).searchParams;
    const wall = await buildInspectionWall({
      companyId: params.get("company"),
      templateId: params.get("template"),
    });
    return NextResponse.json(wall, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "อ่านข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
