/**
 * กฎธุรกิจของระบบจองรถ อยู่ในไฟล์นี้ที่เดียว (pure function ล้วน ไม่แตะฐานข้อมูล)
 * หน้าเว็บ · server action · dashboard · ไฟล์ export เรียกใช้ชุดเดียวกันหมด
 * ตัวเลขบนจอกับในรายงานจะได้ตรงกันเสมอเมื่อกฎเปลี่ยน
 */
import { dateRange, monthBounds } from "./datetime";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_ORDER,
  CANCEL_REASON_LABEL,
  CANCEL_REASON_ORDER,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_ORDER,
  DOC_STATUS_LABEL,
  DOC_STATUS_ORDER,
  PURCHASE_TYPE_LABEL,
  PURCHASE_TYPE_ORDER,
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_ORDER,
  type Booking,
  type BookingQuery,
  type BookingRow,
  type BookingStatus,
  type BookingUpdate,
  type ContractStatus,
  type DocStatus,
  type VehicleStatus,
} from "./booking-types";

// ---------- ค่าที่รับจากฟอร์ม ----------

/** อ่านจำนวนเงินจากช่องกรอก — รับ "12,000" หรือ "12000.50" ค่าที่อ่านไม่ได้คืน 0 */
export function parseAmount(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const cleaned = String(raw ?? "").replace(/[,\s฿]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/** "12,000 บาท" (ไม่มีทศนิยมถ้าเป็นจำนวนเต็ม) */
export function formatBaht(value: number | null | undefined): string {
  const n = value ?? 0;
  return `${n.toLocaleString("th-TH", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })} บาท`;
}

// ---------- ข้อ 1.2.13: สถานะเอกสารคำนวณจากข้อเท็จจริง ไม่ให้ผู้ใช้ตั้งเอง ----------

/**
 * สถานะเอกสารที่ถูกต้องของใบจองหนึ่งใบ
 *   1. มีเลขที่สัญญาขาย หรือ บันทึกคืนเงินลูกค้าแล้ว → ปิดงาน (จบงานแล้วทั้งสองทาง)
 *   2. สถานะการจองเป็น "ยกเลิกไม่รับรถแล้ว"        → ยกเลิก
 *   3. นอกนั้น                                      → ใช้งาน
 * ฐานข้อมูลมี trigger บังคับข้อ 1 ซ้ำอีกชั้น เผื่อมีใครแก้ข้อมูลนอกหน้าจอ
 */
export function resolveDocStatus(input: {
  booking_status: BookingStatus;
  sale_contract_no?: string | null;
  refunded?: boolean;
}): DocStatus {
  const sold = (input.sale_contract_no ?? "").trim().length > 0;
  if (sold || input.refunded) return "closed";
  if (input.booking_status === "cancelled") return "cancelled";
  return "active";
}

/** ใบจองที่ยังต้องติดตามอยู่ (ยังไม่ปิดงานและไม่ถูกยกเลิก) */
export function isOpenBooking(booking: Pick<Booking, "doc_status">): boolean {
  return booking.doc_status === "active";
}

// ---------- ข้อ 1.2: ใบ update เปลี่ยนสถานะใบจองอย่างไร ----------

/** ส่วนของใบจองที่ใบ update มีสิทธิ์เปลี่ยน */
export type BookingStatePatch = {
  vehicle_status: VehicleStatus;
  contract_status: ContractStatus;
  booking_status: BookingStatus;
  cancel_reason: Booking["cancel_reason"];
  sale_contract_no: string | null;
  sale_date: string | null;
  refunded: boolean;
  doc_status: DocStatus;
};

/**
 * ประกอบสถานะใหม่ของใบจองจากใบ update หนึ่งใบ
 * ช่องที่ผู้ใช้เว้นว่างในใบ update = "ไม่เปลี่ยน" จึงคงค่าเดิมของใบจองไว้
 * เลขที่สัญญาขาย/วันที่ขาย และธงคืนเงิน บันทึกแล้วบันทึกเลย (ใบ update ใหม่ไม่ล้างของเดิม)
 */
export function applyUpdate(
  booking: Pick<
    Booking,
    | "vehicle_status"
    | "contract_status"
    | "booking_status"
    | "cancel_reason"
    | "sale_contract_no"
    | "sale_date"
    | "refunded"
  >,
  update: Pick<
    BookingUpdate,
    | "vehicle_status"
    | "contract_status"
    | "booking_status"
    | "cancel_reason"
    | "sale_contract_no"
    | "sale_date"
    | "refunded"
  >,
): BookingStatePatch {
  const booking_status = update.booking_status ?? booking.booking_status;
  const sale_contract_no =
    (update.sale_contract_no ?? "").trim() || booking.sale_contract_no || null;
  const refunded = update.refunded || booking.refunded;

  // สาเหตุยกเลิกมีความหมายเฉพาะตอนสถานะเป็น "ยกเลิกไม่รับรถแล้ว" เท่านั้น
  const cancel_reason =
    booking_status === "cancelled"
      ? update.cancel_reason ?? booking.cancel_reason ?? null
      : null;

  return {
    vehicle_status: update.vehicle_status ?? booking.vehicle_status,
    contract_status: update.contract_status ?? booking.contract_status,
    booking_status,
    cancel_reason,
    sale_contract_no,
    sale_date: update.sale_date ?? booking.sale_date ?? null,
    refunded,
    doc_status: resolveDocStatus({ booking_status, sale_contract_no, refunded }),
  };
}

// ---------- ตรวจค่าก่อนบันทึก (หน้าเว็บกับ server action ใช้ข้อความชุดเดียวกัน) ----------

/** ตรวจใบจอง — ผ่านคืน null ไม่ผ่านคืนข้อความไทยที่บอกวิธีแก้ */
export function validateBooking(input: {
  booking_date: string;
  customer_id: string | null;
  brand_id: string | null;
  model_id: string | null;
  pickup_date: string | null;
  deposit_amount: number;
  booking_status: BookingStatus;
  cancel_reason: Booking["cancel_reason"];
  sale_contract_no?: string | null;
  sale_date?: string | null;
  taken_by_name?: string | null;
}): string | null {
  if (!input.booking_date) return "กรุณาระบุวันที่รับจอง";
  if (!(input.taken_by_name ?? "").trim()) return "กรุณาระบุชื่อพนักงานที่รับจอง";
  if (!input.customer_id) return "กรุณาเลือกลูกค้า — ถ้ายังไม่มีในระบบให้เพิ่มที่เมนูประวัติลูกค้าก่อน";
  if (!input.brand_id) return "กรุณาเลือกยี่ห้อรถ";
  if (!input.model_id) return "กรุณาเลือกรุ่นรถ";
  if (input.deposit_amount < 0) return "จำนวนเงินมัดจำติดลบไม่ได้";

  if (input.pickup_date && input.pickup_date < input.booking_date) {
    return "วันที่นัดรับรถต้องไม่ก่อนวันที่รับจอง";
  }
  if (input.booking_status === "cancelled" && !input.cancel_reason) {
    return "สถานะการจองเป็น “ยกเลิกไม่รับรถแล้ว” ต้องระบุสาเหตุของการยกเลิกด้วย";
  }
  if (input.sale_date && !(input.sale_contract_no ?? "").trim()) {
    return "กรอกวันที่ขายแล้ว ต้องกรอกเลขที่สัญญาขายด้วย";
  }
  return null;
}

/** ตรวจใบ update — ต้องมีอย่างน้อยหนึ่งอย่างที่เปลี่ยน ไม่งั้นเป็นใบเปล่า */
export function validateUpdate(input: {
  update_date: string;
  booking_id: string;
  vehicle_status: VehicleStatus | null;
  contract_status: ContractStatus | null;
  booking_status: BookingStatus | null;
  cancel_reason: Booking["cancel_reason"];
  sale_contract_no: string | null;
  sale_date: string | null;
  refunded: boolean;
  recorded_by_name: string | null;
  fileCount?: number;
}): string | null {
  if (!input.booking_id) return "กรุณาเลือกใบจองที่ต้องการ update";
  if (!input.update_date) return "กรุณาระบุวันที่บันทึก";
  if (!(input.recorded_by_name ?? "").trim()) return "กรุณาระบุชื่อผู้บันทึก";

  const changed =
    input.vehicle_status ||
    input.contract_status ||
    input.booking_status ||
    (input.sale_contract_no ?? "").trim() ||
    input.refunded ||
    (input.fileCount ?? 0) > 0;
  if (!changed) {
    return "ยังไม่ได้บันทึกอะไรเลย — เลือกสถานะที่เปลี่ยน แนบเอกสาร หรือกรอกเลขที่สัญญาขายอย่างน้อยหนึ่งอย่าง";
  }

  if (input.booking_status === "cancelled" && !input.cancel_reason) {
    return "บันทึกสถานะ “ยกเลิกไม่รับรถแล้ว” ต้องระบุสาเหตุของการยกเลิกด้วย";
  }
  if (input.sale_date && !(input.sale_contract_no ?? "").trim()) {
    return "กรอกวันที่ขายแล้ว ต้องกรอกเลขที่สัญญาขายด้วย";
  }
  return null;
}

// ---------- ข้อความสรุปที่ใช้ซ้ำหลายหน้า ----------

/** "Honda · Wave 110i · ล้อแม็ก ดิสก์เบรก · ดำ-แดง" (ข้ามช่องที่ยังไม่ได้เลือก) */
export function describeVehicle(row: {
  brand_name?: string | null;
  model_name?: string | null;
  variant_name?: string | null;
  color_name?: string | null;
}): string {
  const parts = [row.brand_name, row.model_name, row.variant_name, row.color_name]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join(" · ") : "— ยังไม่ระบุรถ —";
}

/** สรุปสิ่งที่ใบ update หนึ่งใบเปลี่ยนไป เป็นประโยคไทยอ่านง่าย */
export function describeUpdate(update: {
  vehicle_status: VehicleStatus | null;
  contract_status: ContractStatus | null;
  booking_status: BookingStatus | null;
  cancel_reason: Booking["cancel_reason"];
  sale_contract_no: string | null;
  refunded: boolean;
}): string {
  const parts: string[] = [];
  if (update.vehicle_status) parts.push(`สถานะรถ → ${VEHICLE_STATUS_LABEL[update.vehicle_status]}`);
  if (update.contract_status) {
    parts.push(`สถานะสัญญา → ${CONTRACT_STATUS_LABEL[update.contract_status]}`);
  }
  if (update.booking_status) {
    parts.push(`สถานะการจอง → ${BOOKING_STATUS_LABEL[update.booking_status]}`);
  }
  if (update.cancel_reason) parts.push(`สาเหตุยกเลิก: ${CANCEL_REASON_LABEL[update.cancel_reason]}`);
  if ((update.sale_contract_no ?? "").trim()) {
    parts.push(`สัญญาขายเลขที่ ${update.sale_contract_no}`);
  }
  if (update.refunded) parts.push("คืนเงินลูกค้าแล้ว");
  return parts.length > 0 ? parts.join(" · ") : "แนบเอกสารเพิ่มเติม";
}

/** ป้ายสรุปหนึ่งบรรทัดของใบจอง ใช้ในตัวเลือก dropdown ของหน้า update */
export function bookingOptionLabel(row: {
  doc_no: string;
  booking_date: string;
  customer_name?: string | null;
  brand_name?: string | null;
  model_name?: string | null;
  booking_status: BookingStatus;
}): string {
  return [
    row.doc_no,
    row.customer_name ?? "ไม่ระบุลูกค้า",
    [row.brand_name, row.model_name].filter(Boolean).join(" ") || "ไม่ระบุรถ",
    BOOKING_STATUS_LABEL[row.booking_status],
  ].join(" · ");
}

// ---------- สรุปตัวเลขสำหรับ dashboard (1.4) ----------

export type BookingSummary = {
  total: number;
  deposit: number;
  byBookingStatus: Record<BookingStatus, number>;
  byVehicleStatus: Record<VehicleStatus, number>;
  byContractStatus: Record<ContractStatus, number>;
  byDocStatus: Record<DocStatus, number>;
};

function emptyCounts<T extends string>(labels: Record<T, string>): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const key of Object.keys(labels) as T[]) out[key] = 0;
  return out;
}

/** นับใบจองแยกตามสถานะทุกชุด พร้อมยอดเงินมัดจำรวม */
export function summarize(rows: BookingRow[]): BookingSummary {
  const summary: BookingSummary = {
    total: rows.length,
    deposit: 0,
    byBookingStatus: emptyCounts(BOOKING_STATUS_LABEL),
    byVehicleStatus: emptyCounts(VEHICLE_STATUS_LABEL),
    byContractStatus: emptyCounts(CONTRACT_STATUS_LABEL),
    byDocStatus: emptyCounts(DOC_STATUS_LABEL),
  };

  for (const row of rows) {
    summary.deposit += Number(row.deposit_amount ?? 0);
    summary.byBookingStatus[row.booking_status] += 1;
    summary.byVehicleStatus[row.vehicle_status] += 1;
    summary.byContractStatus[row.contract_status] += 1;
    summary.byDocStatus[row.doc_status] += 1;
  }
  return summary;
}

// ---------- แยกตามพนักงานขาย ----------

export const NO_STAFF = "— ไม่ระบุพนักงาน —";

/**
 * ชื่อพนักงานที่รับจองที่ใช้แสดงและใช้จัดกลุ่ม
 * ใช้ชื่อบนใบ (taken_by_name) ก่อน เพราะเป็นคนที่รับจองจริงตามที่บันทึกไว้
 * ไม่มีจึงถอยไปใช้ชื่อบัญชีที่บันทึก (taken_by_full_name) — ใบเก่าที่ยังไม่มีชื่อบนใบ
 */
export function staffNameOf(row: {
  taken_by_name?: string | null;
  taken_by_full_name?: string | null;
}): string {
  const onBill = (row.taken_by_name ?? "").trim();
  if (onBill) return onBill;
  return (row.taken_by_full_name ?? "").trim() || NO_STAFF;
}

/** ยอดจองของพนักงานขายหนึ่งคน */
export type StaffSummary = {
  staff: string;
  total: number;
  deposit: number;
  byBookingStatus: Record<BookingStatus, number>;
  /** ปิดการขายได้จริง (มีเลขที่สัญญาขาย) */
  sold: number;
};

/** ยอดจองแยกตามพนักงานขาย เรียงจากใบมากไปน้อย — ใช้ทั้งหน้าสอบถาม (1.3) และ dashboard (1.4) */
export function summarizeByStaff(rows: BookingRow[]): StaffSummary[] {
  const byStaff = new Map<string, StaffSummary>();

  for (const row of rows) {
    const staff = staffNameOf(row);
    let entry = byStaff.get(staff);
    if (!entry) {
      entry = {
        staff,
        total: 0,
        deposit: 0,
        byBookingStatus: emptyCounts(BOOKING_STATUS_LABEL),
        sold: 0,
      };
      byStaff.set(staff, entry);
    }

    entry.total += 1;
    entry.deposit += Number(row.deposit_amount ?? 0);
    entry.byBookingStatus[row.booking_status] += 1;
    if ((row.sale_contract_no ?? "").trim()) entry.sold += 1;
  }

  return [...byStaff.values()].sort(
    (a, b) => b.total - a.total || a.staff.localeCompare(b.staff, "th"),
  );
}

/** จัดกลุ่มนับจำนวน เรียงจากมากไปน้อย — ใช้กับ "แยกตามยี่ห้อ / รุ่นรถ" (1.4.2) */
export function countByKey(
  rows: BookingRow[],
  pick: (row: BookingRow) => string | null | undefined,
  fallback = "— ไม่ระบุ —",
): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = (pick(row) ?? "").trim() || fallback;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"));
}

/** ยี่ห้อ → รุ่น สองชั้น สำหรับตารางสรุปบน dashboard */
export function countByBrandModel(
  rows: BookingRow[],
): { brand: string; models: { label: string; count: number }[]; count: number }[] {
  const brands = new Map<string, BookingRow[]>();
  for (const row of rows) {
    const key = (row.brand_name ?? "").trim() || "— ไม่ระบุยี่ห้อ —";
    const list = brands.get(key);
    if (list) list.push(row);
    else brands.set(key, [row]);
  }

  return [...brands.entries()]
    .map(([brand, list]) => ({
      brand,
      count: list.length,
      models: countByKey(list, (r) => r.model_name, "— ไม่ระบุรุ่น —"),
    }))
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand, "th"));
}

// ---------- ปฏิทิน (1.4.1) ----------

export type CalendarCell = {
  /** YYYY-MM-DD — null คือช่องว่างเติมหัว/ท้ายสัปดาห์ */
  date: string | null;
  day: number | null;
  inMonth: boolean;
};

/**
 * ตารางปฏิทินหนึ่งเดือน แบ่งเป็นสัปดาห์ละ 7 ช่อง เริ่มวันอาทิตย์
 * (คำนวณด้วย UTC ล้วน — วันที่เป็นสตริง YYYY-MM-DD อยู่แล้วจึงไม่มีปัญหาโซนเวลา)
 */
export function buildCalendar(year: number, month1to12: number): CalendarCell[][] {
  const { from, to } = monthBounds(year, month1to12);
  const days = dateRange(from, to);
  const firstDow = new Date(`${from}T00:00:00Z`).getUTCDay();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstDow; i += 1) cells.push({ date: null, day: null, inMonth: false });
  for (const date of days) {
    cells.push({ date, day: Number(date.slice(8, 10)), inMonth: true });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null, inMonth: false });

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** จัดใบจองเข้าช่องปฏิทินตามวันที่ที่เลือก (วันที่นัดรับรถ หรือวันที่จอง) */
export function groupByDate(
  rows: BookingRow[],
  field: "pickup_date" | "booking_date",
): Map<string, BookingRow[]> {
  const map = new Map<string, BookingRow[]>();
  for (const row of rows) {
    const date = row[field];
    if (!date) continue;
    const list = map.get(date);
    if (list) list.push(row);
    else map.set(date, [row]);
  }
  return map;
}

/** เดือนก่อนหน้า/ถัดไป (คืนค่าเป็นคู่ปี-เดือน ใช้ทำลิงก์เลื่อนเดือนบนปฏิทิน) */
export function shiftMonth(
  year: number,
  month1to12: number,
  delta: number,
): { year: number; month: number } {
  const zero = year * 12 + (month1to12 - 1) + delta;
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 };
}

// ---------- ตัวช่วยสำหรับหน้าจอสอบถาม ----------

/** ค่าที่รับได้จาก URL ของหน้าจอสอบถาม/dashboard */
export type BookingSearchParams = Record<string, string | undefined>;

function one<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * แปลงเงื่อนไขจาก query string เป็น BookingQuery
 * ค่าที่ไม่อยู่ในชุดตัวเลือก (พิมพ์มาเอง/ของเก่า) จะถูกตัดทิ้ง ไม่ส่งต่อไปให้ฐานข้อมูล
 */
export function queryFromParams(params: BookingSearchParams): BookingQuery {
  return {
    keyword: (params.q ?? "").trim() || undefined,
    branch_id: params.branch || null,
    brand_id: params.brand || null,
    model_id: params.model || null,
    variant_id: params.variant || null,
    color_id: params.color || null,
    purchase_type: one(params.purchase, PURCHASE_TYPE_ORDER),
    vehicle_status: one(params.vehicle, VEHICLE_STATUS_ORDER),
    contract_status: one(params.contract, CONTRACT_STATUS_ORDER),
    doc_status: one(params.doc, DOC_STATUS_ORDER),
    booking_status: one(params.status, BOOKING_STATUS_ORDER),
    cancel_reason: one(params.cancel, CANCEL_REASON_ORDER),
    staff: (params.staff ?? "").trim() || null,
    from: params.from || null,
    to: params.to || null,
    pickup_from: params.pickup_from || null,
    pickup_to: params.pickup_to || null,
  };
}

/** ชื่อไทยของค่าตัวเลือกใด ๆ ใช้ตอนทำหัวรายงาน/ไฟล์ export */
export const LABEL_OF = {
  purchase_type: PURCHASE_TYPE_LABEL,
  vehicle_status: VEHICLE_STATUS_LABEL,
  contract_status: CONTRACT_STATUS_LABEL,
  doc_status: DOC_STATUS_LABEL,
  booking_status: BOOKING_STATUS_LABEL,
  cancel_reason: CANCEL_REASON_LABEL,
} as const;
