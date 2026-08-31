import "server-only";
import { formatDuration, formatThaiDate, formatTime, toDecimalHours } from "./datetime";
import { buildXlsx } from "./xlsx";
import type { MonthlyEmployeeRow, ReportRow } from "./reports";
import { DAY_STATUS_LABEL } from "./types";

export type Table = {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: string[];
};

/** ตารางมาตรฐานของรายงานรายบุคคล / รายวัน */
export function reportRowsToTable(
  title: string,
  rows: ReportRow[],
  options: { showEmployee?: boolean } = {},
): Table {
  const showEmployee = options.showEmployee ?? true;

  const headers = [
    "วันที่",
    ...(showEmployee ? ["รหัสพนักงาน", "ชื่อ-สกุล", "สาขา", "แผนก"] : []),
    "เข้าเช้า",
    "ออกพัก",
    "เข้าบ่าย",
    "เลิกงาน",
    "สาย (นาที)",
    "กลับก่อน (นาที)",
    "พัก (นาที)",
    "ชั่วโมงทำงาน",
    "OT (นาที)",
    "สถานะ",
    "หมายเหตุ",
  ];

  const body = rows.map((r) => {
    const s = r.summary;
    return [
      formatThaiDate(s.workDate),
      ...(showEmployee ? [r.empCode, r.fullName, r.branchName ?? "-", r.department ?? "-"] : []),
      formatTime(s.checkInAt),
      formatTime(s.breakOutAt),
      formatTime(s.breakInAt),
      formatTime(s.checkOutAt),
      s.lateMinutes,
      s.earlyLeaveMinutes,
      s.breakMinutes,
      toDecimalHours(s.workMinutes),
      s.otMinutes,
      DAY_STATUS_LABEL[s.status],
      [...s.flags, r.hasManual ? "แก้ไขย้อนหลัง" : ""].filter(Boolean).join(", "),
    ];
  });

  const totalWork = rows.reduce((sum, r) => sum + r.summary.workMinutes, 0);
  const totalLate = rows.reduce((sum, r) => sum + r.summary.lateMinutes, 0);
  const totalOt = rows.reduce((sum, r) => sum + r.summary.otMinutes, 0);

  return {
    title,
    headers,
    rows: body,
    summary: [
      `รวมชั่วโมงทำงาน: ${formatDuration(totalWork)} (${toDecimalHours(totalWork)} ชม.)`,
      `รวมสาย: ${totalLate} นาที`,
      `รวม OT: ${totalOt} นาที`,
    ],
  };
}

/** ตารางสรุปรายเดือน (1 แถวต่อพนักงาน) */
export function monthlyToTable(title: string, employees: MonthlyEmployeeRow[]): Table {
  const headers = [
    "รหัสพนักงาน",
    "ชื่อ-สกุล",
    "สาขา",
    "แผนก",
    "วันทำงาน",
    "ครบ 4 ครั้ง",
    "ลงไม่ครบ",
    "ขาดงาน",
    "สาย (วัน)",
    "สาย (นาที)",
    "กลับก่อน (วัน)",
    "พักเกิน (นาที)",
    "ชั่วโมงทำงานรวม",
    "OT (นาที)",
  ];

  const rows = employees.map((e) => [
    e.employee.emp_code,
    e.employee.full_name,
    e.employee.branch_name ?? "-",
    e.employee.department ?? "-",
    e.totals.workedDays,
    e.totals.completeDays,
    e.totals.incompleteDays,
    e.totals.absentDays,
    e.totals.lateDays,
    e.totals.lateMinutes,
    e.totals.earlyLeaveDays,
    e.totals.overBreakMinutes,
    toDecimalHours(e.totals.workMinutes),
    e.totals.otMinutes,
  ]);

  return { title, headers, rows };
}

/** CSV (มี BOM เพื่อให้ Excel อ่านภาษาไทยถูก) */
export function toCsv(table: Table): string {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    table.title,
    table.headers.map(escape).join(","),
    ...table.rows.map((r) => r.map(escape).join(",")),
  ];
  if (table.summary?.length) lines.push("", ...table.summary.map(escape));
  return "﻿" + lines.join("\r\n");
}

/** Excel (.xlsx) — สร้างด้วยตัวเขียน xlsx ของเราเอง ทำงานได้ทั้ง Node และ Cloudflare Workers */
export function toXlsx(table: Table): Uint8Array<ArrayBuffer> {
  return buildXlsx({
    sheetName: "รายงาน",
    title: table.title,
    headers: table.headers,
    rows: table.rows,
    summary: table.summary,
  });
}
