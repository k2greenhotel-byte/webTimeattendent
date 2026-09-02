import "server-only";
import { formatThaiDate } from "./datetime";
import type { Table } from "./export";
import { formatPeriod, outstandingAmount, summarize, summarizeMemos } from "./marketing";
import {
  ACTIVE_STATUS_LABEL,
  FLOW_STATUS_LABEL,
  MEMO_STATUS_LABEL,
  MEMO_STATUS_ORDER,
  type MktActivityRow,
  type MktMemoRow,
} from "./marketing-types";

/** ตารางมาตรฐานของรายงานกิจกรรมการตลาด — ใช้ทั้ง CSV และ Excel */
export function marketingToTable(title: string, rows: MktActivityRow[]): Table {
  const headers = [
    "เลขที่",
    "วันที่",
    "ชื่อกิจกรรม",
    "ประเภทกิจกรรม",
    "บริษัทที่ขอเบิก",
    "ผู้บันทึกจัดทำ",
    "ขอเบิก",
    "อนุมัติเบิก",
    "ได้รับโอน",
    "คงค้าง",
    "สถานะการเบิก",
    "สถานะเอกสาร",
    "ผู้ส่งเบิก",
    "วันที่ส่งเบิก",
    "เลขที่ไปรษณีย์",
    "ผู้รับเงิน",
    "วันที่รับเงิน",
    "เลขที่ใบเสร็จ",
    "รายละเอียด",
  ];

  const body = rows.map((r) => [
    r.doc_no,
    formatThaiDate(r.activity_date),
    r.title,
    r.activity_type_name ?? "-",
    r.company_name ?? "-",
    r.created_by_name ?? "-",
    r.request_amount,
    r.approved_amount ?? 0,
    r.receipt_status === "cancelled" ? 0 : (r.received_amount ?? 0),
    outstandingAmount(r),
    FLOW_STATUS_LABEL[r.flow_status],
    ACTIVE_STATUS_LABEL[r.active_status],
    r.submitted_by_name ?? "-",
    r.submit_date ? formatThaiDate(r.submit_date) : "-",
    r.postal_no ?? "-",
    r.received_by_name ?? "-",
    r.receive_date ? formatThaiDate(r.receive_date) : "-",
    r.receipt_no ?? "-",
    r.memo ?? "",
  ]);

  const totals = summarize(rows);

  return {
    title,
    headers,
    rows: body,
    summary: [
      `จำนวนใบกิจกรรม: ${totals.count}`,
      `รวมยอดขอเบิก: ${totals.request.toFixed(2)} บาท`,
      `รวมยอดอนุมัติ: ${totals.approved.toFixed(2)} บาท`,
      `รวมยอดที่ได้รับ: ${totals.received.toFixed(2)} บาท`,
      `รวมยอดคงค้าง: ${totals.outstanding.toFixed(2)} บาท`,
      "(ใบที่ยกเลิกไม่ถูกนำมารวมยอด)",
    ],
  };
}

/** ตารางรายงาน Memo — ใช้ทั้ง CSV และ Excel */
export function memosToTable(title: string, rows: MktMemoRow[]): Table {
  const headers = [
    "เลขที่",
    "วันที่",
    "บริษัทที่ขอเบิก",
    "รายละเอียด Memo",
    "ตั้งแต่วันที่",
    "ถึงวันที่",
    "ระยะเวลา",
    "ผู้บันทึก",
    "จำนวนไฟล์แนบ",
    "สถานะ",
    "สถานะเอกสาร",
    "เปลี่ยนสถานะล่าสุด",
    "จำนวนครั้งที่เปลี่ยนสถานะ",
  ];

  const body = rows.map((r) => [
    r.doc_no,
    formatThaiDate(r.memo_date),
    r.company_name ?? "-",
    r.detail ?? "",
    r.period_from ? formatThaiDate(r.period_from) : "-",
    r.period_to ? formatThaiDate(r.period_to) : "-",
    formatPeriod(r.period_from, r.period_to, formatThaiDate),
    r.created_by_name ?? "-",
    r.file_count,
    MEMO_STATUS_LABEL[r.status],
    ACTIVE_STATUS_LABEL[r.active_status],
    r.last_status_changed_on ? formatThaiDate(r.last_status_changed_on) : "-",
    r.status_log_count,
  ]);

  const totals = summarizeMemos(rows);

  return {
    title,
    headers,
    rows: body,
    summary: [
      `จำนวน Memo ที่ใช้งาน: ${totals.count}`,
      ...MEMO_STATUS_ORDER.map((s) => `${MEMO_STATUS_LABEL[s]}: ${totals.byStatus[s]}`),
      "(ใบที่ยกเลิกไม่ถูกนำมานับ)",
    ],
  };
}
