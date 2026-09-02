import { NextResponse } from "next/server";
import { formatThaiDate } from "@/lib/datetime";
import { toCsv, toXlsx } from "@/lib/export";
import { listActivities } from "@/lib/marketing-db";
import { marketingToTable } from "@/lib/marketing-export";
import { FLOW_STATUS_LABEL, type MktFlowStatus } from "@/lib/marketing-types";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ดาวน์โหลดผลการสอบถามเป็น Excel หรือ CSV
 * /api/marketing/export?flow_status=submitted&from=...&to=...&company_id=...&format=xlsx
 */
export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";

  const query = {
    flow_status: (sp.get("flow_status") || undefined) as MktFlowStatus | undefined,
    active_status: (sp.get("active_status") || undefined) as "active" | "cancelled" | undefined,
    company_id: sp.get("company_id") || undefined,
    activity_type_id: sp.get("activity_type_id") || undefined,
    staff_id: sp.get("staff_id") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    keyword: sp.get("keyword") || undefined,
  };

  try {
    const rows = await listActivities(query);

    const parts = [
      "รายงานกิจกรรมการตลาด",
      query.flow_status ? `สถานะ ${FLOW_STATUS_LABEL[query.flow_status]}` : null,
      query.from || query.to
        ? `ช่วง ${query.from ? formatThaiDate(query.from) : "เริ่มต้น"} - ${query.to ? formatThaiDate(query.to) : "ปัจจุบัน"}`
        : null,
    ].filter(Boolean);

    const table = marketingToTable(parts.join(" · "), rows);
    const filename = `marketing-${query.from ?? "all"}_${query.to ?? "all"}`;

    if (format === "csv") {
      return new NextResponse(toCsv(table), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }

    return new NextResponse(new Blob([toXlsx(table)]), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "สร้างรายงานไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
