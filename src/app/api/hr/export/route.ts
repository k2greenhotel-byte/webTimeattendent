import { NextResponse } from "next/server";
import { formatThaiDate } from "@/lib/datetime";
import { toCsv, toXlsx } from "@/lib/export";
import { advanceRequestsToTable, leaveRequestsToTable } from "@/lib/leave-export";
import { listAdvanceRequests, listLeaveRequests } from "@/lib/leave-db";
import { ADVANCE_STATUS_ORDER, LEAVE_STATUS_ORDER, type AdvanceStatus, type LeaveStatus } from "@/lib/leave-types";
import { checkPermission, getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** รายงานทั้งหมดในครั้งเดียว ไม่ตัดที่ 300 แถวเหมือนหน้าจอปกติ (แต่กันไม่ให้โหลดหนักเกินไป) */
const EXPORT_LIMIT = 5000;

/**
 * ดาวน์โหลดผลการสอบถามข้อมูลการลา/ขอเบิกเงินเป็น Excel หรือ CSV
 * /api/hr/export?kind=leave&company=...&branch=...&employee=...&from=...&to=...&format=xlsx
 * /api/hr/export?kind=advance&...
 *
 * ใช้เงื่อนไขชุดเดียวกับหน้าสอบถาม และตรวจสิทธิ์ซ้ำอีกครั้ง (คนละคนอาจแก้ URL เอง)
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind") === "advance" ? "advance" : "leave";
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";
  const menuCode = kind === "advance" ? "HR_SEARCH_ADV" : "HR_SEARCH_LEAVE";

  if (!(await checkPermission(menuCode, "read"))) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลนี้" }, { status: 403 });
  }

  const companyId = sp.get("company") || undefined;
  const branchId = sp.get("branch") || undefined;
  const employeeId = sp.get("employee") || undefined;
  const from = sp.get("from") || undefined;
  const to = sp.get("to") || undefined;

  const range =
    from || to
      ? `ช่วง ${from ? formatThaiDate(from) : "เริ่มต้น"} - ${to ? formatThaiDate(to) : "ปัจจุบัน"}`
      : null;

  try {
    let table;
    let filename: string;

    if (kind === "advance") {
      const status = (ADVANCE_STATUS_ORDER as string[]).includes(sp.get("status") ?? "")
        ? [sp.get("status") as AdvanceStatus]
        : undefined;
      const rows = await listAdvanceRequests({
        companyId,
        branchId,
        employeeId,
        from,
        to,
        statuses: status,
        limit: EXPORT_LIMIT,
      });
      table = advanceRequestsToTable(
        ["รายงานข้อมูลขอเบิกเงินเดือน", range].filter(Boolean).join(" · "),
        rows,
      );
      filename = `hr-advance-${from ?? "all"}_${to ?? "all"}`;
    } else {
      const status = (LEAVE_STATUS_ORDER as string[]).includes(sp.get("status") ?? "")
        ? [sp.get("status") as LeaveStatus]
        : undefined;
      const rows = await listLeaveRequests({
        companyId,
        branchId,
        employeeId,
        typeId: sp.get("type") || undefined,
        from,
        to,
        statuses: status,
        limit: EXPORT_LIMIT,
      });
      table = leaveRequestsToTable(["รายงานข้อมูลการลา", range].filter(Boolean).join(" · "), rows);
      filename = `hr-leave-${from ?? "all"}_${to ?? "all"}`;
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
