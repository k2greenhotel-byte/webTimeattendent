import "server-only";
import { formatThaiDate } from "./datetime";
import type { Table } from "./export";
import { channelNameOf, describeVehicle, staffNameOf } from "./lead";
import { CHANCE_LABEL, WORK_STATUS_LABEL, type LeadRow } from "./lead-types";
import { formatPhone } from "./phone";

/**
 * ตาราง Excel/CSV ของผลการสอบถาม Lead
 * ใช้ฟังก์ชันแปลงค่าชุดเดียวกับหน้าจอ (staffNameOf / channelNameOf / describeVehicle)
 * ตัวเลขและข้อความในไฟล์จะได้ตรงกับที่เห็นบนเว็บเสมอ
 */
export function leadsToTable(title: string, rows: LeadRow[]): Table {
  return {
    title,
    headers: [
      "เลขที่ Lead",
      "วันที่",
      "พนักงานขาย",
      "สาขา",
      "ชื่อลูกค้า",
      "เบอร์โทร",
      "รถที่สนใจ",
      "ช่องทางการติดต่อ",
      "สถานะงาน",
      "สถานะโอกาส",
      "นัดติดตามต่อ",
      "ติดตามแล้ว (ครั้ง)",
      "ติดตามล่าสุด",
      "เลขที่สัญญาขาย",
      "วันที่ขาย",
      "หมายเหตุ",
    ],
    rows: rows.map((r) => [
      r.doc_no,
      formatThaiDate(r.lead_date),
      staffNameOf(r),
      r.branch_name ?? "",
      r.customer_name,
      formatPhone(r.phone),
      describeVehicle(r),
      channelNameOf(r),
      WORK_STATUS_LABEL[r.work_status],
      CHANCE_LABEL[r.chance],
      r.next_follow_date ? formatThaiDate(r.next_follow_date) : "",
      r.follow_count,
      r.last_follow_date ? formatThaiDate(r.last_follow_date) : "",
      r.sale_contract_no ?? "",
      r.sale_date ? formatThaiDate(r.sale_date) : "",
      r.note ?? "",
    ]),
    summary: [
      `จำนวน Lead ทั้งหมด ${rows.length} ราย`,
      `ปิดการขายได้ ${rows.filter((r) => r.work_status === "closed_won").length} ราย`,
    ],
  };
}
