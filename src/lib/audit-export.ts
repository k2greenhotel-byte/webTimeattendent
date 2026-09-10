import "server-only";
import { formatThaiDate } from "./datetime";
import type { Table } from "./export";
import { summarizeChecks } from "./audit";
import {
  AUD_CALL_RESULT_LABEL,
  AUD_DOC_RESULT_LABEL,
  AUD_INFO_RESULT_SHORT,
  AUD_RESULT_LABEL,
  AUD_SLIP_RESULT_LABEL,
  AUD_AMOUNT_RESULT_LABEL,
  type AudCheckRow,
} from "./audit-types";

/**
 * ตารางผลการตรวจสำหรับ Excel/CSV — คอลัมน์เดียวกับหน้าจอสอบถาม
 * บวกคอลัมน์ที่หน้าจอย่อไว้ (สลิปนำฝาก ยอดเงิน และรายละเอียดจากต้นทาง)
 */
export function checksToTable(title: string, rows: AudCheckRow[]): Table {
  const s = summarizeChecks(rows);

  return {
    title,
    headers: [
      "วันที่ตรวจ",
      "เลขที่คุมงาน",
      "ผู้ตรวจสอบ",
      "รายการตรวจ",
      "เลขที่เอกสาร",
      "วันที่เอกสาร",
      "รายละเอียด",
      "ผู้เกี่ยวข้อง",
      "สาขา",
      "จำนวนเงิน",
      "ผลการตรวจ",
      "หมายเหตุผลตรวจ",
      "เอกสารประกอบ",
      "เอกสารที่ขาด",
      "หมายเหตุเอกสาร",
      "การโทรถาม",
      "ผลข้อมูล",
      "หมายเหตุการโทร",
      "สลิปนำฝาก",
      "ยอดบนสลิป",
      "ยอดที่ต้องฝาก",
      "ยอดเงินสลิป",
      "ยี่ห้อ/รุ่น",
      "บริษัทไฟแนนซ์",
      "ผู้จัดทำ",
      "ประเภทการจ่าย",
      "เลขที่ใบอนุมัติ",
    ],
    rows: rows.map((r) => [
      formatThaiDate(r.audit_date),
      r.audit_no,
      r.auditor_name,
      r.type_name,
      r.ref_no ?? "",
      r.ref_date ? formatThaiDate(r.ref_date) : "",
      r.title ?? "",
      r.party ?? "",
      r.branch_label ?? r.branch_name ?? "",
      r.amount ?? "",
      AUD_RESULT_LABEL[r.result],
      r.result_note ?? "",
      AUD_DOC_RESULT_LABEL[r.doc_result],
      (r.missing_docs ?? []).join(" / "),
      r.doc_note ?? "",
      AUD_CALL_RESULT_LABEL[r.call_result],
      AUD_INFO_RESULT_SHORT[r.info_result],
      r.call_note ?? "",
      AUD_SLIP_RESULT_LABEL[r.slip_result],
      r.slip_amount ?? "",
      r.deposit_amount ?? "",
      AUD_AMOUNT_RESULT_LABEL[r.slip_amount_result],
      [r.extra?.brand, r.extra?.model].filter(Boolean).join(" "),
      r.extra?.finance ?? "",
      r.extra?.maker ?? "",
      r.extra?.expense_type ?? "",
      r.extra?.approval_no ?? "",
    ]),
    summary: [
      `รายการที่ตรวจทั้งหมด: ${s.count} · ถูกต้อง ${s.correct} · ไม่ถูกต้อง ${s.wrong} · ยังไม่ลงผล ${s.pending}`,
      `เอกสารไม่ครบ: ${s.docIncomplete} · ติดต่อไม่ได้: ${s.noContact} · ข้อมูลผิดปกติ: ${s.abnormal} · สาขาสื่อสารผิด: ${s.branchError}`,
      `ยอดเงินรวมของรายการที่ตรวจ: ${s.amountTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`,
    ],
  };
}
