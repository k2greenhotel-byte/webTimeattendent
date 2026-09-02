import { NextResponse } from "next/server";
import { formatThaiDate } from "@/lib/datetime";
import { toCsv, toXlsx, type Table } from "@/lib/export";
import { listActivities } from "@/lib/marketing-db";
import { marketingToTable, memosToTable } from "@/lib/marketing-export";
import { listMemos } from "@/lib/memo-db";
import {
  FLOW_STATUS_LABEL,
  MEMO_STATUS_LABEL,
  type MktFlowStatus,
  type MktMemoStatus,
} from "@/lib/marketing-types";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ดาวน์โหลดผลการสอบถามเป็น Excel หรือ CSV
 * /api/marketing/export?flow_status=submitted&from=...&to=...&format=xlsx
 * /api/marketing/export?kind=memo&status=partial_received&format=csv
 */
export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";
  const kind = sp.get("kind") === "memo" ? "memo" : "activity";

  const range = (from?: string, to?: string) =>
    from || to
      ? `ช่วง ${from ? formatThaiDate(from) : "เริ่มต้น"} - ${to ? formatThaiDate(to) : "ปัจจุบัน"}`
      : null;

  try {
    let table: Table;
    let filename: string;
    const from = sp.get("from") || undefined;
    const to = sp.get("to") || undefined;

    if (kind === "memo") {
      const status = (sp.get("status") || undefined) as MktMemoStatus | undefined;
      const rows = await listMemos({
        status,
        active_status: (sp.get("active_status") || undefined) as "active" | "cancelled" | undefined,
        company_id: sp.get("company_id") || undefined,
        staff_id: sp.get("staff_id") || undefined,
        from,
        to,
        keyword: sp.get("keyword") || undefined,
      });

      const parts = [
        "รายงาน Memo",
        status ? `สถานะ ${MEMO_STATUS_LABEL[status]}` : null,
        range(from, to),
      ].filter(Boolean);

      table = memosToTable(parts.join(" · "), rows);
      filename = `marketing-memo-${from ?? "all"}_${to ?? "all"}`;
    } else {
      const flowStatus = (sp.get("flow_status") || undefined) as MktFlowStatus | undefined;
      const rows = await listActivities({
        flow_status: flowStatus,
        active_status: (sp.get("active_status") || undefined) as "active" | "cancelled" | undefined,
        company_id: sp.get("company_id") || undefined,
        activity_type_id: sp.get("activity_type_id") || undefined,
        staff_id: sp.get("staff_id") || undefined,
        from,
        to,
        keyword: sp.get("keyword") || undefined,
      });

      const parts = [
        "รายงานกิจกรรมการตลาด",
        flowStatus ? `สถานะ ${FLOW_STATUS_LABEL[flowStatus]}` : null,
        range(from, to),
      ].filter(Boolean);

      table = marketingToTable(parts.join(" · "), rows);
      filename = `marketing-${from ?? "all"}_${to ?? "all"}`;
    }

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
