/**
 * กฎธุรกิจของระบบแจ้งเคลม อยู่ในไฟล์นี้ที่เดียว (pure function ไม่แตะฐานข้อมูล)
 * หน้าเว็บ / server action / db layer / dashboard เรียกฟังก์ชันชุดเดียวกันหมด
 * จะได้ไม่มีกรณีที่ตัวเลขบนจอกับในเอกสารไม่ตรงกัน
 *
 * ตัวช่วยเรื่องเงินและการนับกลุ่มใช้ของเดิมจาก booking.ts (parseAmount / formatBaht / countByKey)
 */
import {
  CLAIM_CLOSED_STATUSES,
  CLAIM_JOB_STATUS_LABEL,
  CLAIM_MAX_ITEMS,
  CLAIM_URGENCY_DAYS,
  CLAIM_URGENCY_LABEL,
  type Claim,
  type ClaimDocStatus,
  type ClaimInput,
  type ClaimItem,
  type ClaimJobStatus,
  type ClaimRow,
  type ClaimUpdateInput,
  type ClaimUrgency,
} from "./claim-types";

export { countByKey, formatBaht, parseAmount, shiftMonth } from "./booking";

// ---------- ความเร่งด่วนและกำหนดเสร็จ ----------

/** บวกวันแบบไม่สนเขตเวลา (ทำงานกับสตริง YYYY-MM-DD ล้วน ๆ) */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * วันที่ควรได้รับการแก้ไขตามความเร่งด่วนที่เลือกไว้ (ข้อ 1.4.12)
 * ใช้เป็นเส้นตายเมื่อยังไม่มีใบ update ระบุ "วันที่คาดว่าจะซ่อมเสร็จ" มา
 */
export function dueDateOf(startDate: string, urgency: ClaimUrgency): string {
  return addDays(startDate, CLAIM_URGENCY_DAYS[urgency]);
}

/** เส้นตายจริงของใบหนึ่งใบ — ยึดวันที่คาดว่าจะเสร็จก่อน ไม่มีจึงใช้ความเร่งด่วน */
export function deadlineOf(
  row: Pick<Claim, "claim_date" | "urgency" | "expected_done_date">,
): string {
  return row.expected_done_date ?? dueDateOf(row.claim_date, row.urgency);
}

/** งานที่ยังไม่จบและเลยกำหนดแล้ว (เอกสารที่ยกเลิกไม่นับ) */
export function isOverdue(
  row: Pick<Claim, "claim_date" | "urgency" | "expected_done_date" | "job_status" | "doc_status">,
  today: string,
): boolean {
  if (row.doc_status === "cancelled") return false;
  if (isClosed(row.job_status)) return false;
  return deadlineOf(row) < today;
}

/** จำนวนวันที่เลยกำหนด (ยังไม่เลยกำหนดคืน 0) — ใช้เรียงงานที่ต้องตามด่วนที่สุด */
export function overdueDays(
  row: Pick<Claim, "claim_date" | "urgency" | "expected_done_date" | "job_status" | "doc_status">,
  today: string,
): number {
  if (!isOverdue(row, today)) return 0;
  const deadline = deadlineOf(row);
  const [dy, dm, dd] = deadline.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(dy, dm - 1, dd)) / 86_400_000);
}

/** งานใบนี้จบแล้วหรือยัง (แก้ไขเรียบร้อย หรือผู้ผลิตไม่อนุมัติ) */
export function isClosed(status: ClaimJobStatus): boolean {
  return CLAIM_CLOSED_STATUSES.includes(status);
}

/** ข้อความบอกว่างานใบนี้เลยกำหนดกี่วัน (ยังไม่เลยกำหนดคืนสตริงว่าง) */
export function overdueText(
  row: Pick<Claim, "claim_date" | "urgency" | "expected_done_date" | "job_status" | "doc_status">,
  today: string,
): string {
  const days = overdueDays(row, today);
  return days > 0 ? `เลยกำหนด ${days} วัน` : "";
}

/** ป้ายความเร่งด่วนพร้อมกำหนดเสร็จ ใช้ในการ์ดบนมือถือ */
export function urgencyText(
  row: Pick<Claim, "claim_date" | "urgency" | "expected_done_date">,
): string {
  return `${CLAIM_URGENCY_LABEL[row.urgency]} (ครบกำหนด ${deadlineOf(row)})`;
}

// ---------- ชื่อรถ / ลูกค้า ที่ใช้แสดงผลร่วมกันทุกหน้า ----------

/** "YAMAHA FINN 2022 · DT0300 · เขียว" — ช่องที่ว่างจะถูกข้ามไป */
export function vehicleText(
  row: Pick<Claim, "db2_brand_name" | "db2_model_name" | "db2_variant_name" | "db2_color_name">,
): string {
  return [row.db2_brand_name, row.db2_model_name, row.db2_variant_name, row.db2_color_name]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * ชื่อบริษัทผู้ผลิตที่ใช้แสดง (ข้อ 1.4.15)
 * ยึดชื่อล่าสุดจากทะเบียน "บริษัทรถ / เจ้าหนี้" ก่อน — ทะเบียนแก้ชื่อแล้วทุกใบเปลี่ยนตาม
 * ไม่มี (ใบเก่าที่พิมพ์ชื่อเอง หรือทะเบียนถูกลบ) จึงถอยไปใช้ชื่อที่บันทึกไว้บนใบ
 */
export function makerText(
  row: Pick<Claim, "maker_name"> & { maker_vendor_name?: string | null },
): string {
  return (row.maker_vendor_name ?? "").trim() || (row.maker_name ?? "").trim();
}

/** ที่มาของข้อมูลลูกค้า — ใช้เป็นป้ายบนหน้าจอ ให้รู้ว่าใบไหนคีย์เองทั้งใบ */
export function customerSourceText(row: Pick<Claim, "is_external" | "db2_cuscod">): string {
  if (row.is_external) return "ลูกค้าภายนอก (คีย์เอง)";
  return row.db2_cuscod ? `ระบบขาย ${row.db2_cuscod}` : "ระบบขาย";
}

// ---------- ผลของใบ update ที่ต้องผลักขึ้นใบขอเคลม (หน้าจอ 1.5) ----------

export type ClaimStatePatch = {
  job_status?: ClaimJobStatus;
  expected_done_date?: string | null;
  requested_amount?: number;
  reject_reason?: string | null;
  result_date?: string | null;
  fixed_date?: string | null;
  job_no?: string | null;
  job_open_date?: string | null;
  job_close_date?: string | null;
  job_deliver_date?: string | null;
};

/**
 * ค่าที่ต้องผลักขึ้นใบขอเคลมเมื่อบันทึกใบ update หนึ่งใบ
 * ช่องไหนใน update เป็น null แปลว่า "ไม่เปลี่ยน" จึงไม่ใส่ลงใน patch
 *
 * กฎวันที่ที่ระบบเติมให้ (ผู้ใช้จะได้ไม่ต้องกลับไปกรอกซ้ำอีกหน้าจอ):
 *   อนุมัติ / ไม่อนุมัติ → วันที่ของใบ update คือ "วันที่แจ้งผลการอนุมัติ" (ข้อ 1.4.21)
 *   แก้ไขเรียบร้อย      → วันที่ของใบ update คือ "วันที่ซ่อมเสร็จ" (ข้อ 1.4.22)
 * ทั้งสองกรณีเติมเฉพาะตอนที่ใบขอเคลมยังไม่มีค่าเดิม — ค่าที่คนกรอกไว้เองต้องไม่ถูกทับ
 *
 * ส่วนเลขที่ Job และวันที่ของ job (1.5.10-1.5.13) ใช้กฎ "กรอกมาก็ทับ" —
 * เลข job เปลี่ยนได้จริง (เปิด job ใหม่ให้ใบเดิม) และค่าบนใบขอเคลมคือ "ล่าสุด" เสมอ
 */
export function applyClaimUpdate(
  claim: Pick<Claim, "result_date" | "fixed_date">,
  update: Pick<
    ClaimUpdateInput,
    | "job_status"
    | "expected_done_date"
    | "requested_amount"
    | "reject_reason"
    | "update_date"
    | "job_no"
    | "job_open_date"
    | "job_close_date"
    | "job_deliver_date"
  >,
): ClaimStatePatch {
  const patch: ClaimStatePatch = {};

  if (update.job_status) {
    patch.job_status = update.job_status;

    if (update.job_status === "approved" || update.job_status === "rejected") {
      patch.result_date = claim.result_date ?? update.update_date;
    }
    if (update.job_status === "done") {
      patch.fixed_date = claim.fixed_date ?? update.update_date;
    }
  }

  if (update.expected_done_date) patch.expected_done_date = update.expected_done_date;
  if (update.requested_amount !== null && update.requested_amount !== undefined) {
    patch.requested_amount = update.requested_amount;
  }
  if (update.reject_reason?.trim()) patch.reject_reason = update.reject_reason.trim();

  // 1.5.10-1.5.13 เลขที่ job และวันที่ของ job — เว้นว่าง = ไม่เปลี่ยนของเดิม
  if (update.job_no?.trim()) patch.job_no = update.job_no.trim();
  if (update.job_open_date) patch.job_open_date = update.job_open_date;
  if (update.job_close_date) patch.job_close_date = update.job_close_date;
  if (update.job_deliver_date) patch.job_deliver_date = update.job_deliver_date;

  return patch;
}

/** คำอธิบายสั้น ๆ ของใบ update หนึ่งใบ (ใช้ในไทม์ไลน์บนหน้ารายละเอียด) */
export function describeClaimUpdate(update: {
  job_status: ClaimJobStatus | null;
  detail: string | null;
  expected_done_date: string | null;
  requested_amount: number | null;
  job_no?: string | null;
  job_open_date?: string | null;
  job_close_date?: string | null;
  job_deliver_date?: string | null;
  photo_count?: number;
}): string {
  const parts: string[] = [];
  if (update.job_status) parts.push(CLAIM_JOB_STATUS_LABEL[update.job_status]);
  if (update.job_no?.trim()) parts.push(`Job ${update.job_no.trim()}`);
  if (update.job_open_date) parts.push(`เปิด job ${update.job_open_date}`);
  if (update.job_close_date) parts.push(`ปิด job ${update.job_close_date}`);
  if (update.job_deliver_date) parts.push(`ส่งมอบงาน ${update.job_deliver_date}`);
  if (update.expected_done_date) parts.push(`คาดว่าเสร็จ ${update.expected_done_date}`);
  if (update.requested_amount !== null && update.requested_amount !== undefined) {
    parts.push(`ขออนุมัติ ${update.requested_amount.toLocaleString("th-TH")} บาท`);
  }
  if (update.photo_count) parts.push(`รูป ${update.photo_count} รูป`);
  if (update.detail?.trim()) parts.push(update.detail.trim());
  return parts.join(" · ");
}

/** สรุปสถานะ job หนึ่งใบเป็นข้อความสั้น ("JOB-001 · เปิด 8 ก.ย. · ยังไม่ปิด") */
export function jobText(
  row: Pick<Claim, "job_no" | "job_open_date" | "job_close_date" | "job_deliver_date">,
): string {
  if (!row.job_no && !row.job_open_date && !row.job_close_date && !row.job_deliver_date) {
    return "";
  }

  const parts: string[] = [];
  if (row.job_no) parts.push(row.job_no);
  if (row.job_open_date) parts.push(`เปิด ${row.job_open_date}`);
  parts.push(row.job_close_date ? `ปิด ${row.job_close_date}` : "ยังไม่ปิด job");
  if (row.job_deliver_date) parts.push(`ส่งมอบงาน ${row.job_deliver_date}`);
  return parts.join(" · ");
}

// ---------- ตรวจข้อมูลก่อนบันทึก ----------

function checkAmount(label: string, value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return `${label} ต้องเป็นตัวเลข`;
  if (value < 0) return `${label} ต้องไม่ติดลบ`;
  if (value > 99_999_999) return `${label} สูงเกินกว่าที่ระบบรองรับ`;
  return null;
}

/** ใบขอเคลม (หน้าจอ 1.4) */
export function validateClaim(input: ClaimInput, items: ClaimItem[] = []): string | null {
  if (!input.claim_date) return "กรุณาเลือกวันที่แจ้งเคลม";
  if (!input.chassis_no.trim()) {
    return "กรุณาระบุเลขตัวถังรถ — กด “ค้นจากระบบขาย” หรือติ๊กลูกค้าภายนอกแล้วพิมพ์เอง";
  }
  if (input.chassis_no.length > 40) return "เลขตัวถังยาวเกินไป (ไม่เกิน 40 ตัวอักษร)";
  if (!input.customer_name.trim()) return "กรุณาระบุชื่อลูกค้า";
  if (input.customer_name.length > 200) return "ชื่อลูกค้ายาวเกินไป (ไม่เกิน 200 ตัวอักษร)";

  // ลูกค้าภายนอกไม่มีข้อมูลใน Db2 จึงต้องคีย์ให้ครบตามข้อ 1.4.9
  if (input.is_external) {
    if (!input.engine_no?.trim()) return "ลูกค้าภายนอกต้องระบุเลขเครื่องด้วย";
    if (!input.customer_address?.trim()) return "ลูกค้าภายนอกต้องระบุที่อยู่ด้วย";
    if (!input.customer_phone?.trim()) return "ลูกค้าภายนอกต้องระบุเบอร์โทรด้วย";
  }

  const named = items.filter((i) => i.item_name.trim());
  if (named.length === 0) return "กรุณาบันทึกรายการที่ขอเคลมอย่างน้อย 1 รายการ";
  if (named.length > CLAIM_MAX_ITEMS) {
    return `บันทึกรายการที่ขอเคลมได้สูงสุด ${CLAIM_MAX_ITEMS} รายการต่อหนึ่งใบ`;
  }
  for (const item of named) {
    if (item.item_name.length > 200) return "ชื่อรายการที่ขอเคลมยาวเกินไป (ไม่เกิน 200 ตัวอักษร)";
    const problem = checkAmount(`จำนวนของ "${item.item_name}"`, item.qty);
    if (problem) return problem;
  }

  const amountProblem = checkAmount("จำนวนเงินที่ขออนุมัติ", input.requested_amount);
  if (amountProblem) return amountProblem;

  if (input.job_status === "rejected" && !input.reject_reason?.trim()) {
    return "งานที่ผู้ผลิตไม่อนุมัติต้องระบุเหตุผลไม่อนุมัติด้วย";
  }
  if (input.job_status === "done" && !input.fixed_date) {
    return "งานที่แก้ไขเรียบร้อยแล้วต้องระบุวันที่ซ่อมเสร็จ";
  }

  for (const [label, value] of [
    ["วันที่แจ้งผลการอนุมัติ", input.result_date],
    ["วันที่ซ่อมเสร็จ", input.fixed_date],
    ["วันที่ส่งมอบรถคืนลูกค้า", input.delivered_date],
    ["วันที่คาดว่าจะซ่อมเสร็จ", input.expected_done_date],
  ] as const) {
    if (value && value < input.claim_date) return `${label}ต้องไม่ก่อนวันที่แจ้งเคลม`;
  }

  if (input.delivered_date && input.fixed_date && input.delivered_date < input.fixed_date) {
    return "วันที่ส่งมอบรถคืนลูกค้าต้องไม่ก่อนวันที่ซ่อมเสร็จ";
  }

  return null;
}

/** ใบ update งานเคลม (หน้าจอ 1.5) — ต้องมีอย่างน้อยหนึ่งอย่างที่เปลี่ยนจริง */
export function validateClaimUpdate(
  input: ClaimUpdateInput & { photoCount?: number },
): string | null {
  if (!input.claim_id) return "กรุณาเลือกใบขอเคลมที่ต้องการ update";
  if (!input.update_date) return "กรุณาเลือกวันที่บันทึก";

  const problem = checkAmount("จำนวนเงินที่ขออนุมัติ", input.requested_amount);
  if (problem) return problem;

  if (input.job_status === "rejected" && !input.reject_reason?.trim()) {
    return "บันทึกสถานะ “ไม่อนุมัติ” ต้องระบุเหตุผลไม่อนุมัติด้วย";
  }

  // 1.5.10-1.5.13 ลำดับวันที่ของ job ต้องเป็นไปได้จริง
  if (input.job_close_date && input.job_open_date && input.job_close_date < input.job_open_date) {
    return "วันที่ปิด job ต้องไม่ก่อนวันที่เปิด job";
  }
  if (input.job_deliver_date && input.job_open_date && input.job_deliver_date < input.job_open_date) {
    return "วันที่ส่งมอบงานต้องไม่ก่อนวันที่เปิด job";
  }

  const hasChange =
    Boolean(input.job_status) ||
    Boolean(input.detail?.trim()) ||
    Boolean(input.expected_done_date) ||
    (input.requested_amount !== null && input.requested_amount !== undefined) ||
    Boolean(input.job_no?.trim()) ||
    Boolean(input.job_open_date) ||
    Boolean(input.job_close_date) ||
    Boolean(input.job_deliver_date) ||
    (input.photoCount ?? 0) > 0;

  if (!hasChange) {
    return "ใบ update ต้องมีอย่างน้อยหนึ่งอย่าง: สถานะงาน รายละเอียดเพิ่มเติม วันที่คาดว่าจะเสร็จ จำนวนเงินที่ขออนุมัติ เลขที่/วันที่ของ job หรือรูปภาพ";
  }

  return null;
}

// ---------- สรุปตัวเลข (หน้าจอสอบถาม ข้อ 2 และ dashboard ข้อ 3) ----------

export type ClaimSummary = {
  total: number;
  /** งานที่ยังไม่จบ (ไม่นับใบที่ยกเลิก) */
  open: number;
  overdue: number;
  /** รอผลจากผู้ผลิต = แจ้งไปแล้วแต่ยังไม่มีคำตอบ */
  waitingMaker: number;
  /** ซ่อมเสร็จแล้วแต่ยังไม่ได้ส่งมอบรถคืนลูกค้า (ข้อ 1.4.23) */
  waitingDelivery: number;
  delivered: number;
  /** เปิด job ไว้แล้วแต่ยังไม่ได้ปิด job (ข้อ 1.5.11-1.5.12) */
  openJobs: number;
  requested: number;
  byJobStatus: Record<ClaimJobStatus, number>;
  byDocStatus: Record<ClaimDocStatus, number>;
  byUrgency: Record<ClaimUrgency, number>;
};

function emptyCount<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>;
}

/** ปัดทศนิยม 2 ตำแหน่ง กันเศษจากการบวกลบเลขทศนิยมของ JavaScript */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function summarizeClaims(rows: ClaimRow[], today: string): ClaimSummary {
  const summary: ClaimSummary = {
    total: rows.length,
    open: 0,
    overdue: 0,
    waitingMaker: 0,
    waitingDelivery: 0,
    delivered: 0,
    openJobs: 0,
    requested: 0,
    byJobStatus: emptyCount([
      "wait_notify",
      "sent_agent",
      "approved",
      "rejected",
      "in_progress",
      "done",
    ] as const),
    byDocStatus: emptyCount(["active", "cancelled"] as const),
    byUrgency: emptyCount(["d1_2", "d2_5", "d5_plus"] as const),
  };

  for (const row of rows) {
    summary.requested += row.requested_amount;
    summary.byJobStatus[row.job_status] += 1;
    summary.byDocStatus[row.doc_status] += 1;
    summary.byUrgency[row.urgency] += 1;

    if (row.doc_status === "cancelled") continue;

    if (!isClosed(row.job_status)) summary.open += 1;
    if (isOverdue(row, today)) summary.overdue += 1;
    if (row.job_status === "wait_notify" || row.job_status === "sent_agent") {
      summary.waitingMaker += 1;
    }
    if (row.delivered_date) summary.delivered += 1;
    else if (row.job_status === "done") summary.waitingDelivery += 1;

    // เปิด job แล้วยังไม่ปิด — งานที่ยังค้างอยู่ที่ศูนย์บริการ
    if ((row.job_no || row.job_open_date) && !row.job_close_date) summary.openJobs += 1;
  }

  summary.requested = round2(summary.requested);
  return summary;
}

/** ป้ายกำกับใบขอเคลมในกล่องตัวเลือก (หน้าจอ 1.5) */
export function claimOptionLabel(
  row: Pick<ClaimRow, "doc_no" | "chassis_no" | "customer_name">,
): string {
  return `${row.doc_no} · ${row.chassis_no} · ${row.customer_name}`;
}
