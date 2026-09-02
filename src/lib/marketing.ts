/**
 * กฎธุรกิจของโมดูลกิจกรรมการตลาด — ฟังก์ชันบริสุทธิ์ล้วน (ไม่แตะฐานข้อมูล)
 * ทุกหน้าจอ รายงาน และไฟล์ export ต้องเรียกฟังก์ชันในไฟล์นี้ ห้ามคำนวณเองซ้ำ
 */
import type {
  MktActiveStatus,
  MktActivityRow,
  MktFlowStatus,
  MktQuery,
} from "./marketing-types";
import { MAX_ACTIVITY_PHOTOS } from "./marketing-types";

// ---------- สถานะ ----------

/**
 * สถานะขั้นตอนของใบกิจกรรม คำนวณจากเอกสารที่ผูกอยู่เท่านั้น
 * (ใบส่งเบิก/ใบรับเงินที่ถูกยกเลิกไม่นับ — ถอยสถานะกลับให้อัตโนมัติ)
 */
export function computeFlowStatus(input: {
  hasActiveSubmission: boolean;
  hasActiveReceipt: boolean;
}): MktFlowStatus {
  if (input.hasActiveReceipt) return "received";
  if (input.hasActiveSubmission) return "submitted";
  return "draft";
}

/** ใบกิจกรรมที่ยกเลิกแล้วหรือรับเงินครบแล้ว ห้ามส่งเบิกซ้ำ */
export function canSubmit(row: {
  active_status: MktActiveStatus;
  flow_status: MktFlowStatus;
}): { ok: boolean; reason?: string } {
  if (row.active_status === "cancelled") return { ok: false, reason: "ใบกิจกรรมนี้ถูกยกเลิกแล้ว" };
  if (row.flow_status === "received") {
    return { ok: false, reason: "ใบกิจกรรมนี้รับเงินแล้ว แก้ไขการส่งเบิกไม่ได้" };
  }
  return { ok: true };
}

/** ต้องส่งเบิกก่อนถึงจะบันทึกรับเงินได้ */
export function canReceive(row: {
  active_status: MktActiveStatus;
  flow_status: MktFlowStatus;
}): { ok: boolean; reason?: string } {
  if (row.active_status === "cancelled") return { ok: false, reason: "ใบกิจกรรมนี้ถูกยกเลิกแล้ว" };
  if (row.flow_status === "draft") {
    return { ok: false, reason: "ต้องบันทึกส่งเรื่องเบิกเงินก่อน จึงจะบันทึกรับเงินได้" };
  }
  return { ok: true };
}

// ---------- จำนวนเงิน ----------

/**
 * แปลงข้อความจากช่องกรอกเป็นจำนวนเงิน รองรับเครื่องหมายคั่นหลักพันและช่องว่าง
 * คืน null เมื่อเว้นว่าง และโยน error เมื่อกรอกผิดรูปแบบหรือติดลบ
 */
export function parseAmount(value: unknown, label = "จำนวนเงิน"): number | null {
  const text = String(value ?? "").replace(/[,\s฿]/g, "");
  if (text === "") return null;

  const n = Number(text);
  if (!Number.isFinite(n)) throw new Error(`${label}ต้องเป็นตัวเลข`);
  if (n < 0) throw new Error(`${label}ต้องไม่ติดลบ`);
  return Math.round(n * 100) / 100;
}

/** "12,500.00" — ใช้แสดงผลทุกที่ จะได้เห็นทศนิยมเท่ากันหมด */
export function formatBaht(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ยอดที่ถือว่า "ต้องได้รับ" — ใช้ยอดอนุมัติถ้ามี ไม่งั้นใช้ยอดที่ขอเบิก */
export function expectedAmount(row: {
  request_amount: number;
  approved_amount: number | null;
}): number {
  return row.approved_amount ?? row.request_amount;
}

/** ยอดคงค้าง = ยอดที่ควรได้ − ยอดที่รับมาแล้ว (ใบที่ยกเลิกคิดเป็น 0) */
export function outstandingAmount(row: {
  active_status: MktActiveStatus;
  request_amount: number;
  approved_amount: number | null;
  received_amount: number | null;
  receipt_status?: MktActiveStatus | null;
}): number {
  if (row.active_status === "cancelled") return 0;
  const received = row.receipt_status === "cancelled" ? 0 : (row.received_amount ?? 0);
  return Math.round((expectedAmount(row) - received) * 100) / 100;
}

// ---------- เลขที่เอกสาร ----------

/** ปี พ.ศ. ของวันที่ YYYY-MM-DD */
export function buddhistYearOf(dateStr: string): number {
  const year = Number(dateStr.slice(0, 4));
  if (!Number.isFinite(year) || year === 0) throw new Error("วันที่ไม่ถูกต้อง");
  return year + 543;
}

/** "MK-2569-0007" */
export function formatDocNo(buddhistYear: number, seq: number): string {
  return `MK-${buddhistYear}-${String(seq).padStart(4, "0")}`;
}

// ---------- ตรวจความถูกต้องของฟอร์ม ----------

export function assertValidDate(value: unknown, label: string): string {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`กรุณาเลือก${label}`);
  return text;
}

export function assertPhotoPaths(paths: string[]): string[] {
  const clean = paths.map((p) => p.trim()).filter(Boolean);
  if (clean.length > MAX_ACTIVITY_PHOTOS) {
    throw new Error(`แนบรูปได้สูงสุด ${MAX_ACTIVITY_PHOTOS} รูปต่อกิจกรรม`);
  }
  // กันไม่ให้ path หลุดไปโฟลเดอร์อื่นในถัง storage
  for (const p of clean) {
    if (!p.startsWith("mkt/") || p.includes("..")) throw new Error("เส้นทางไฟล์รูปไม่ถูกต้อง");
  }
  return clean;
}

// ---------- สรุปยอด / dashboard ----------

export type MktTotals = {
  count: number;
  request: number;
  approved: number;
  received: number;
  outstanding: number;
};

export function summarize(rows: MktActivityRow[]): MktTotals {
  const totals: MktTotals = { count: 0, request: 0, approved: 0, received: 0, outstanding: 0 };

  for (const r of rows) {
    if (r.active_status === "cancelled") {
      totals.count += 1;
      continue;
    }
    totals.count += 1;
    totals.request += r.request_amount;
    totals.approved += r.approved_amount ?? 0;
    totals.received += r.receipt_status === "cancelled" ? 0 : (r.received_amount ?? 0);
    totals.outstanding += outstandingAmount(r);
  }

  return {
    count: totals.count,
    request: round2(totals.request),
    approved: round2(totals.approved),
    received: round2(totals.received),
    outstanding: round2(totals.outstanding),
  };
}

export function countByFlowStatus(rows: MktActivityRow[]): Record<MktFlowStatus, number> {
  const out: Record<MktFlowStatus, number> = { draft: 0, submitted: 0, received: 0 };
  for (const r of rows) {
    if (r.active_status === "cancelled") continue;
    out[r.flow_status] += 1;
  }
  return out;
}

export type GroupTotal = { key: string; label: string; count: number } & Omit<MktTotals, "count">;

/** จัดกลุ่มยอดตามคีย์ที่เลือก (บริษัท / ประเภทกิจกรรม / เดือน) เรียงจากยอดขอเบิกมากไปน้อย */
export function groupTotals(
  rows: MktActivityRow[],
  keyOf: (row: MktActivityRow) => { key: string; label: string },
): GroupTotal[] {
  const map = new Map<string, GroupTotal>();

  for (const r of rows) {
    if (r.active_status === "cancelled") continue;
    const { key, label } = keyOf(r);
    const acc = map.get(key) ?? { key, label, count: 0, request: 0, approved: 0, received: 0, outstanding: 0 };
    acc.count += 1;
    acc.request += r.request_amount;
    acc.approved += r.approved_amount ?? 0;
    acc.received += r.receipt_status === "cancelled" ? 0 : (r.received_amount ?? 0);
    acc.outstanding += outstandingAmount(r);
    map.set(key, acc);
  }

  return [...map.values()]
    .map((g) => ({
      ...g,
      request: round2(g.request),
      approved: round2(g.approved),
      received: round2(g.received),
      outstanding: round2(g.outstanding),
    }))
    .sort((a, b) => b.request - a.request);
}

/** "2569-08" สำหรับจัดกลุ่มรายเดือน */
export function monthKeyOf(dateStr: string): string {
  return `${buddhistYearOf(dateStr)}-${dateStr.slice(5, 7)}`;
}

/** กรองข้อมูลตามเงื่อนไขหน้าสอบถาม — ใช้ตัวเดียวกันทั้งหน้าจอและไฟล์ export */
export function filterRows(rows: MktActivityRow[], q: MktQuery): MktActivityRow[] {
  const keyword = (q.keyword ?? "").trim().toLowerCase();

  return rows.filter((r) => {
    if (q.flow_status && r.flow_status !== q.flow_status) return false;
    if (q.active_status && r.active_status !== q.active_status) return false;
    if (q.company_id && r.company_id !== q.company_id) return false;
    if (q.activity_type_id && r.activity_type_id !== q.activity_type_id) return false;
    if (q.staff_id && r.created_by_staff_id !== q.staff_id) return false;
    if (q.from && r.activity_date < q.from) return false;
    if (q.to && r.activity_date > q.to) return false;
    if (keyword) {
      const hay = `${r.doc_no} ${r.title} ${r.company_name ?? ""} ${r.memo ?? ""} ${r.postal_no ?? ""} ${r.receipt_no ?? ""}`;
      if (!hay.toLowerCase().includes(keyword)) return false;
    }
    return true;
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
