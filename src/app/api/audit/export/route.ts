import { NextResponse } from "next/server";
import { checkQueryFromParams, rangeLabel } from "@/lib/audit";
import { listCheckRows } from "@/lib/audit-db";
import { checksToTable } from "@/lib/audit-export";
import { toCsv, toXlsx } from "@/lib/export";
import { checkPermission, getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ดาวน์โหลดผลการตรวจสอบเป็น Excel หรือ CSV
 * /api/audit/export?from=…&to=…&branch_id=…&format=xlsx
 *
 * ใช้เงื่อนไขชุดเดียวกับหน้าสอบถาม/รายงาน และตรวจสิทธิ์ซ้ำอีกครั้งที่นี่
 */
export async function GET(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  const allowed =
    (await checkPermission("AUD_REPORT", "read")) || (await checkPermission("AUD_SEARCH", "read"));
  if (!allowed) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดูรายงานการตรวจสอบ" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const params = Object.fromEntries(sp.entries());
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";

  try {
    const query = checkQueryFromParams(params);
    const rows = await listCheckRows(query);

    const table = checksToTable(
      `รายงานผลการตรวจสอบบัญชี · ${rangeLabel(query.from, query.to)}`,
      rows,
    );
    const filename = `audit-${query.from ?? "all"}_${query.to ?? "all"}`;

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
