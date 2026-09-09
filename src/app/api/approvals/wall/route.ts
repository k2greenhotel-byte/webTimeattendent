import { NextResponse } from "next/server";
import { buildApprovalWall } from "@/lib/approval-wall";
import { checkPermission } from "@/lib/session";
import { resolvePeriod } from "@/lib/wall-period";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ข้อมูลจอ War Room กล่องอนุมัติรวม — /api/approvals/wall?from=&to=
 *
 * สิทธิ์สองชั้น: ต้องมีสิทธิ์ดูจอนี้ก่อน แล้วในจอยังเห็นเฉพาะโปรแกรมที่ตัวเองมีสิทธิ์
 * คนที่ดูได้แต่ใบลาอย่างเดียวจึงไม่เห็นยอดเงินของฝั่งจัดซื้อ
 */
export async function GET(req: Request) {
  if (!(await checkPermission("APV_WALL", "read"))) {
    return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ดูจอนี้" }, { status: 403 });
  }

  try {
    const q = new URL(req.url).searchParams;
    const [central, procurement, leave, advance] = await Promise.all([
      checkPermission("APV_INBOX", "read"),
      checkPermission("PR_APPROVE", "read"),
      checkPermission("HR_LEAVE_APPROVE", "read"),
      checkPermission("HR_ADV_APPROVE", "read"),
    ]);

    const wall = await buildApprovalWall({
      period: resolvePeriod(q.get("from"), q.get("to")),
      canSee: { central, procurement, leave, advance },
    });
    return NextResponse.json(wall, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "อ่านข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
