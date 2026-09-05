import "server-only";
import type { Table } from "./export";
import { formatThaiDate, formatTime } from "./datetime";
import { leaveRangeText } from "./leave";
import { LEAVE_STATUS_LABEL, ADVANCE_STATUS_LABEL, type AdvanceRequestRow, type LeaveRequestRow } from "./leave-types";

/**
 * ตาราง Excel/CSV ของหน้าสอบถามข้อมูลการลา
 * ใช้ leaveRangeText ตัวเดียวกับหน้าจอ ตัวเลขในไฟล์จะได้ตรงกับที่เห็นบนเว็บเสมอ
 */
export function leaveRequestsToTable(title: string, rows: LeaveRequestRow[]): Table {
  return {
    title,
    headers: [
      "เลขที่",
      "วันที่แจ้ง",
      "เวลาที่แจ้ง",
      "ชื่อ-สกุล",
      "บริษัท",
      "สาขา",
      "ประเภทการลา",
      "รายละเอียด",
      "ช่วงที่ลา/เวลาที่มาถึง",
      "จำนวนวัน",
      "แจ้งล่วงหน้า (วัน)",
      "ถือเป็นขาดงาน",
      "แจ้งช้า (หักเงิน)",
      "สถานะ",
      "ผู้อนุมัติ",
      "วันที่อนุมัติ",
      "หมายเหตุผู้อนุมัติ",
    ],
    rows: rows.map((r) => [
      r.doc_no,
      formatThaiDate(r.request_date),
      `${formatTime(r.reported_at)} น.`,
      r.employee_name,
      r.company_name ?? "-",
      r.branch_name ?? "-",
      [r.type_icon, r.type_name].filter(Boolean).join(" "),
      r.detail ?? "",
      leaveRangeText(r),
      r.arrival_time ? "-" : r.total_days,
      r.notice_days,
      r.counts_as_absent ? "ใช่" : "-",
      r.is_late_notice ? `ใช่ (${Number(r.penalty_multiplier)}x)` : "-",
      LEAVE_STATUS_LABEL[r.status],
      r.decided_by_name ?? "-",
      r.decided_at ? formatThaiDate(r.decided_at.slice(0, 10)) : "-",
      r.decision_note ?? "",
    ]),
    summary: [
      `จำนวนใบทั้งหมด ${rows.length} ใบ`,
      `รวมจำนวนวันลา ${rows.filter((r) => !r.arrival_time).reduce((s, r) => s + r.total_days, 0)} วัน`,
      `ถือเป็นขาดงาน ${rows.filter((r) => r.counts_as_absent).length} ใบ`,
      `แจ้งช้า (โดนหักเงิน) ${rows.filter((r) => r.is_late_notice).length} ใบ`,
    ],
  };
}

/** ตาราง Excel/CSV ของหน้าสอบถามข้อมูลขอเบิกเงินเดือน */
export function advanceRequestsToTable(title: string, rows: AdvanceRequestRow[]): Table {
  return {
    title,
    headers: [
      "เลขที่",
      "วันที่ขอเบิก",
      "ชื่อ-สกุล",
      "บริษัท",
      "สาขา",
      "ขอเบิกเพื่อ",
      "รายละเอียด",
      "ยอดที่ขอ (บาท)",
      "ยอดที่อนุมัติ (บาท)",
      "สถานะ",
      "ผู้อนุมัติ",
      "วันที่อนุมัติ",
      "หมายเหตุผู้อนุมัติ",
    ],
    rows: rows.map((r) => [
      r.doc_no,
      formatThaiDate(r.request_date),
      r.employee_name,
      r.company_name ?? "-",
      r.branch_name ?? "-",
      r.purpose,
      r.detail ?? "",
      r.amount,
      r.status === "pending" ? "-" : r.approved_amount,
      ADVANCE_STATUS_LABEL[r.status],
      r.decided_by_name ?? "-",
      r.decided_at ? formatThaiDate(r.decided_at.slice(0, 10)) : "-",
      r.decision_note ?? "",
    ]),
    summary: [
      `จำนวนใบทั้งหมด ${rows.length} ใบ`,
      `ยอดที่ขอรวม ${rows.reduce((s, r) => s + r.amount, 0).toLocaleString("th-TH")} บาท`,
      `ยอดที่อนุมัติรวม ${rows.reduce((s, r) => s + r.approved_amount, 0).toLocaleString("th-TH")} บาท`,
    ],
  };
}
