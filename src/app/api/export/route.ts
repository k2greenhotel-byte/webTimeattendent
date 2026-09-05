import { NextResponse } from "next/server";
import { formatThaiDate, formatThaiMonth, monthBounds, workDateOf } from "@/lib/datetime";
import { fieldToTable, monthlyToTable, reportRowsToTable, toCsv, toXlsx, type Table } from "@/lib/export";
import {
  buildDailyReport,
  buildEmployeeReport,
  buildFieldReport,
  buildMonthlyReport,
} from "@/lib/reports";
import { checkPermission, getSessionUser, isAdminAuthed } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ดาวน์โหลดรายงานเป็น Excel หรือ CSV
 * /api/export?kind=employee&employeeId=...&from=YYYY-MM-DD&to=YYYY-MM-DD&format=xlsx
 * /api/export?kind=daily&date=YYYY-MM-DD&format=csv
 * /api/export?kind=monthly&year=2026&month=8&format=xlsx
 */
export async function GET(req: Request) {
  const [user, isAdmin] = await Promise.all([getSessionUser(), isAdminAuthed()]);
  if (!user && !isAdmin) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind") ?? "daily";
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";
  const branchId = sp.get("branch") || undefined;

  let table: Table;
  let filename: string;

  try {
    if (kind === "employee") {
      const employeeId = sp.get("employeeId") ?? user?.id;
      if (!employeeId) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 400 });
      if (!isAdmin && employeeId !== user?.id) {
        return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลผู้อื่น" }, { status: 403 });
      }
      const today = workDateOf();
      const from = sp.get("from") ?? `${today.slice(0, 7)}-01`;
      const to = sp.get("to") ?? today;

      const report = await buildEmployeeReport({ employeeId, from, to });
      const name = report.employee?.full_name ?? "พนักงาน";
      table = reportRowsToTable(
        `รายงานการลงเวลารายบุคคล: ${name} (${formatThaiDate(from)} - ${formatThaiDate(to)})`,
        report.rows,
        { showEmployee: false },
      );
      filename = `attendance-${report.employee?.emp_code ?? employeeId}-${from}_${to}`;
    } else if (kind === "field") {
      // งานนอกสถานที่: แอดมินหรือผู้มีสิทธิ์อ่านรายงานดูได้ทุกคน พนักงานทั่วไปดูได้เฉพาะของตัวเอง
      const canSeeAll = isAdmin || (await checkPermission("ATT_REP_FIELD", "read"));
      const employeeId = sp.get("employeeId") || (canSeeAll ? undefined : user?.id);
      if (!canSeeAll && employeeId !== user?.id) {
        return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลผู้อื่น" }, { status: 403 });
      }
      const today = workDateOf();
      const from = sp.get("from") ?? `${today.slice(0, 7)}-01`;
      const to = sp.get("to") ?? today;
      const report = await buildFieldReport({
        from,
        to,
        companyId: sp.get("company") || undefined,
        branchId,
        employeeId,
        typeId: sp.get("type") || undefined,
      });
      table = fieldToTable(
        `รายงานงานนอกสถานที่ (${formatThaiDate(from)} - ${formatThaiDate(to)})`,
        report.rows,
      );
      filename = `field-work-${from}_${to}`;
    } else if (kind === "monthly") {
      if (!isAdmin) {
        return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
      }
      const today = workDateOf();
      const year = Number(sp.get("year")) || Number(today.slice(0, 4));
      const month = Number(sp.get("month")) || Number(today.slice(5, 7));
      const report = await buildMonthlyReport(year, month, branchId);
      table = monthlyToTable(`สรุปการลงเวลารายเดือน: ${formatThaiMonth(year, month)}`, report.employees);
      const { from } = monthBounds(year, month);
      filename = `attendance-monthly-${from.slice(0, 7)}`;
    } else {
      if (!isAdmin) {
        return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
      }
      const date = sp.get("date") ?? workDateOf();
      const report = await buildDailyReport(date, branchId);
      table = reportRowsToTable(`รายงานการลงเวลารายวัน: ${formatThaiDate(date)}`, report.rows);
      filename = `attendance-daily-${date}`;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "สร้างรายงานไม่สำเร็จ" },
      { status: 500 },
    );
  }

  if (format === "csv") {
    return new NextResponse(toCsv(table), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  // ห่อด้วย Blob เพื่อให้เป็น BodyInit ที่ใช้ได้ทั้ง Node และ Cloudflare Workers
  return new NextResponse(new Blob([toXlsx(table)]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}
