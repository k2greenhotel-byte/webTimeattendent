/**
 * กฎธุรกิจของระบบจัดซื้อจัดจ้างแจ้งซ่อม อยู่ในไฟล์นี้ที่เดียว (pure function ไม่แตะฐานข้อมูล)
 * หน้าเว็บ / server action / db layer / dashboard เรียกฟังก์ชันชุดเดียวกันหมด
 * จะได้ไม่มีกรณีที่ตัวเลขบนจอกับในเอกสารพิมพ์ไม่ตรงกัน
 *
 * ตัวช่วยเรื่องเงินและการนับกลุ่มใช้ของเดิมจาก booking.ts (parseAmount / formatBaht / countByKey)
 */
import { dateRange } from "./datetime";
import {
  APPROVE_STATUS_LABEL,
  JOB_STATUS_LABEL,
  URGENCY_DAYS,
  URGENCY_LABEL,
  type ApprovalInput,
  type ApproveStatus,
  type JobStatus,
  type PayStatus,
  type PaymentItem,
  type PaymentTagRow,
  type PrDocRow,
  type PrAccountInput,
  type PrAccountRow,
  type PrDocStatus,
  type PrTypeInput,
  type PrVendorInput,
  type PurchaseInput,
  type RejectReason,
  type RepairInput,
  type RepairUpdateInput,
  type Urgency,
  type FundMoveInput,
  type PrFundInput,
  type PrFundRow,
} from "./procurement-types";

export { countByKey, formatBaht, parseAmount, shiftMonth } from "./booking";

// ---------- ความเร่งด่วนและกำหนดเสร็จ ----------

/** บวกวันแบบไม่สนเขตเวลา (ทำงานกับสตริง YYYY-MM-DD ล้วน ๆ) */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * วันที่ควรได้รับการแก้ไขตามความเร่งด่วนที่เลือกไว้ (ข้อ 1.1.8 / 1.3.10)
 * ใช้เป็นเส้นตายเมื่อผู้บันทึกไม่ได้ระบุ "วันที่คาดว่าจะซ่อมเสร็จ" มาเอง
 */
export function dueDateOf(startDate: string, urgency: Urgency): string {
  return addDays(startDate, URGENCY_DAYS[urgency]);
}

/**
 * เส้นตายจริงของเอกสารหนึ่งใบ — ถ้าระบุวันที่คาดว่าจะเสร็จไว้ ให้ยึดวันนั้น
 * ถ้าไม่ได้ระบุ ใช้วันครบกำหนดตามความเร่งด่วนแทน
 */
export function deadlineOf(
  row: Pick<PrDocRow, "doc_date" | "urgency" | "expected_done_date">,
): string {
  return row.expected_done_date ?? dueDateOf(row.doc_date, row.urgency);
}

/**
 * งานใบนี้เลยกำหนดแล้วหรือยัง ณ วันที่ today
 * เอกสารที่ยกเลิก ไม่อนุมัติ หรือปิดงานแล้ว ไม่ถือว่าเกินกำหนด
 */
export function isOverdue(
  row: Pick<
    PrDocRow,
    "doc_date" | "urgency" | "expected_done_date" | "done_date" | "doc_status" | "approve_status"
  >,
  today: string,
): boolean {
  if (row.done_date) return false;
  if (row.doc_status === "cancelled") return false;
  if (row.approve_status === "rejected") return false;
  return deadlineOf(row) < today;
}

/** จำนวนวันที่เลยกำหนด (ไม่เลยกำหนดคืน 0) — ใช้เรียงลำดับงานที่ต้องตามด่วนที่สุด */
export function overdueDays(
  row: Pick<
    PrDocRow,
    "doc_date" | "urgency" | "expected_done_date" | "done_date" | "doc_status" | "approve_status"
  >,
  today: string,
): number {
  if (!isOverdue(row, today)) return 0;
  return Math.max(0, dateRange(deadlineOf(row), today).length - 1);
}

// ---------- ยอดเงิน ----------

/** ยอดที่ยังเบิกได้อีกของเอกสารหนึ่งใบ = อนุมัติ − เบิกจริงไปแล้ว (ไม่ต่ำกว่า 0) */
export function remainingToPay(
  doc: Pick<PrDocRow, "approved_amount" | "actual_amount">,
): number {
  return Math.max(0, round2(doc.approved_amount - doc.actual_amount));
}

/** ปัดทศนิยม 2 ตำแหน่ง กันเศษจากการบวกลบเลขทศนิยมของ JavaScript */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** ยอดรวมของรายการที่ใบเบิกจ่ายใบนี้อ้างถึง (ข้อ 4.4) */
export function sumItems(items: Pick<PaymentItem, "amount">[]): number {
  return round2(items.reduce((total, item) => total + (item.amount || 0), 0));
}

// ---------- ผลักสถานะจากใบ update ขึ้นใบขอซ่อม (หน้าจอ 1.2) ----------

export type RepairStatePatch = {
  job_status?: JobStatus;
  expected_done_date?: string | null;
  requested_amount?: number;
  fixed_date?: string | null;
};

/**
 * ค่าที่ต้องผลักขึ้นใบขอซ่อมเมื่อบันทึกใบ update หนึ่งใบ
 * ช่องไหนใน update เป็น null แปลว่า "ไม่เปลี่ยน" จึงไม่ใส่ลงใน patch
 *
 * กฎเพิ่มเติม: บันทึกสถานะงานเป็น "ได้รับการแก้ไขแล้ว" ให้ถือว่าวันที่ของใบ update
 * คือวันที่ได้รับการแก้ไข (ข้อ 1.1.24) ผู้ใช้จะได้ไม่ต้องกลับไปกรอกซ้ำอีกหน้าจอ
 */
export function applyRepairUpdate(
  repair: Pick<RepairInput, "fixed_date">,
  update: Pick<
    RepairUpdateInput,
    "job_status" | "expected_done_date" | "requested_amount" | "update_date"
  >,
): RepairStatePatch {
  const patch: RepairStatePatch = {};

  if (update.job_status) {
    patch.job_status = update.job_status;

    if (update.job_status === "done") {
      patch.fixed_date = repair.fixed_date ?? update.update_date;
    }
  }

  if (update.expected_done_date) patch.expected_done_date = update.expected_done_date;
  if (update.requested_amount !== null && update.requested_amount !== undefined) {
    patch.requested_amount = update.requested_amount;
  }

  return patch;
}

// ---------- ผลการอนุมัติ (หน้าจอ 3.1) ----------

export type ApprovalPatch = {
  approve_status: ApproveStatus;
  reject_reason: RejectReason | null;
  approved_amount: number;
  pay_status: PayStatus;
};

/**
 * ค่าที่ต้องผลักขึ้นเอกสารต้นทางเมื่อบันทึกใบอนุมัติหนึ่งใบ
 *
 *   อนุมัติ        → สถานะอนุมัติ = อนุมัติ · ยอดที่อนุมัติตามใบอนุมัติ · สถานะเบิกเงินเลื่อนเป็น "อนุมัติ"
 *   ไม่อนุมัติ      → ยอดอนุมัติเป็น 0 · เก็บสาเหตุไว้ · สถานะเบิกเงินกลับไปเป็น "ทำเรื่องตั้งเบิก"
 *   ให้หารายใหม่   → กลับไปสถานะรออนุมัติ เพื่อให้ผู้ขอไปหาราคาใหม่แล้วยื่นเข้ามาอีกรอบ
 *
 * เอกสารที่จ่ายเงินไปแล้ว (settled) จะไม่ถูกย้อนสถานะเบิกเงิน — เงินออกไปแล้วย้อนไม่ได้
 */
export function applyApproval(
  doc: Pick<PrDocRow, "pay_status" | "requested_amount">,
  approval: Pick<ApprovalInput, "decision" | "reject_reason" | "approved_amount">,
): ApprovalPatch {
  const settled = doc.pay_status === "settled";

  if (approval.decision === "approved") {
    const amount = approval.approved_amount > 0 ? approval.approved_amount : doc.requested_amount;
    return {
      approve_status: "approved",
      reject_reason: null,
      approved_amount: round2(amount),
      pay_status: settled ? "settled" : "approved",
    };
  }

  if (approval.decision === "rejected") {
    return {
      approve_status: "rejected",
      reject_reason: approval.reject_reason ?? null,
      approved_amount: 0,
      pay_status: settled ? "settled" : "requested",
    };
  }

  // recheck — ให้ไปตรวจสอบราคาหรือหาผู้ขาย/ผู้ซ่อมรายใหม่มาเทียบ แล้วยื่นใหม่
  return {
    approve_status: "pending",
    reject_reason: approval.reject_reason ?? null,
    approved_amount: 0,
    pay_status: settled ? "settled" : "requested",
  };
}

// ---------- ตรวจค่าก่อนบันทึก (คืนข้อความไทยที่บอกวิธีแก้ ผ่านแล้วคืน null) ----------

const AMOUNT_MAX = 9_999_999_999;

function checkAmount(label: string, value: number): string | null {
  if (Number.isNaN(value)) return `${label}ต้องเป็นตัวเลข`;
  if (value < 0) return `${label}ติดลบไม่ได้`;
  if (value > AMOUNT_MAX) return `${label}สูงเกินไป กรุณาตรวจสอบตัวเลขอีกครั้ง`;
  return null;
}

/** ใบขอซ่อม (หน้าจอ 1.1) */
export function validateRepair(input: RepairInput): string | null {
  if (!input.request_date) return "กรุณาเลือกวันที่แจ้งซ่อม";
  if (!input.item_name.trim()) return "กรุณากรอกรายการที่ต้องซ่อม";
  if (input.item_name.length > 200) return "รายการที่ต้องซ่อมยาวเกินไป (ไม่เกิน 200 ตัวอักษร)";

  for (const [label, value] of [
    ["จำนวนเงินที่ขอเบิก", input.requested_amount],
    ["จำนวนเงินที่อนุมัติเบิก", input.approved_amount],
    ["จำนวนเงินที่เบิกจริง", input.actual_amount],
  ] as const) {
    const problem = checkAmount(label, value);
    if (problem) return problem;
  }

  if (input.approve_status === "rejected" && !input.reject_reason && !input.reject_note?.trim()) {
    return "เอกสารที่ไม่อนุมัติต้องระบุเหตุผลไม่อนุมัติด้วย";
  }
  if (input.job_status === "done" && !input.fixed_date) {
    return "งานที่ได้รับการแก้ไขแล้วต้องระบุวันที่ที่ได้รับการแก้ไข";
  }
  if (
    input.expected_done_date &&
    input.request_date &&
    input.expected_done_date < input.request_date
  ) {
    return "วันที่คาดว่าจะซ่อมเสร็จต้องไม่ก่อนวันที่แจ้งซ่อม";
  }
  if (input.fixed_date && input.request_date && input.fixed_date < input.request_date) {
    return "วันที่ได้รับการแก้ไขต้องไม่ก่อนวันที่แจ้งซ่อม";
  }

  return null;
}

/** ใบ update งานซ่อม (หน้าจอ 1.2) — ต้องมีอย่างน้อยหนึ่งอย่างที่เปลี่ยนจริง */
export function validateRepairUpdate(
  input: RepairUpdateInput & { photoCount?: number },
): string | null {
  if (!input.repair_id) return "กรุณาเลือกใบขอซ่อมที่ต้องการ update";
  if (!input.update_date) return "กรุณาเลือกวันที่บันทึก";

  if (input.requested_amount !== null && input.requested_amount !== undefined) {
    const problem = checkAmount("จำนวนเงินที่ขออนุมัติซ่อม", input.requested_amount);
    if (problem) return problem;
  }

  const hasChange =
    Boolean(input.job_status) ||
    Boolean(input.detail?.trim()) ||
    Boolean(input.expected_done_date) ||
    (input.requested_amount !== null && input.requested_amount !== undefined) ||
    (input.photoCount ?? 0) > 0;

  if (!hasChange) {
    return "ใบ update ต้องมีอย่างน้อยหนึ่งอย่าง: สถานะงาน รายละเอียดเพิ่มเติม วันที่คาดว่าจะเสร็จ ยอดที่ขออนุมัติ หรือรูปภาพ";
  }

  return null;
}

/** ใบขอจัดซื้อ (หน้าจอ 1.3) */
export function validatePurchase(input: PurchaseInput): string | null {
  if (!input.request_date) return "กรุณาเลือกวันที่ขอจัดซื้อ";
  if (!input.item_name.trim()) return "กรุณากรอกรายการที่ขอซื้อ";
  if (input.item_name.length > 200) return "รายการที่ขอซื้อยาวเกินไป (ไม่เกิน 200 ตัวอักษร)";

  for (const [label, value] of [
    ["จำนวนเงินที่ขอเบิก", input.requested_amount],
    ["จำนวนเงินที่อนุมัติเบิก", input.approved_amount],
    ["จำนวนเงินที่เบิกจริง", input.actual_amount],
  ] as const) {
    const problem = checkAmount(label, value);
    if (problem) return problem;
  }

  if (input.approve_status === "rejected" && !input.reject_reason && !input.reject_note?.trim()) {
    return "เอกสารที่ไม่อนุมัติต้องระบุเหตุผลไม่อนุมัติด้วย";
  }
  if (input.received_date && input.request_date && input.received_date < input.request_date) {
    return "วันที่ได้รับวัสดุต้องไม่ก่อนวันที่ขอจัดซื้อ";
  }

  return null;
}

// ---------- ยกเลิกเอกสาร (ใบขอซ่อม 1.1 / ใบขอจัดซื้อ 2.1) ----------

/** คนที่กำลังจะกดยกเลิก — ประกอบขึ้นจาก session + สิทธิ์เมนู ไม่ใช่ค่าที่ส่งมาจากฟอร์ม */
export type CancelActor = {
  userId: string;
  /** สิทธิ์ PR_CANCEL — ตั้งเพิ่มเป็นรายคนได้ (ผู้จัดการ/หัวหน้างาน) */
  canCancelOthers: boolean;
  /** สิทธิ์ PR_APPROVE — ผู้มีอำนาจอนุมัติ */
  isApprover: boolean;
};

type CancelTarget = Pick<
  PrDocRow,
  "created_by" | "doc_status" | "approve_status" | "actual_amount"
>;

/**
 * ตรวจว่าคนนี้ยกเลิกเอกสารใบนี้ได้ไหม — คืนข้อความไทยที่บอกเหตุผล หรือ null ถ้าทำได้
 *
 * ลำดับการกันไล่จากเข้มไปหาอ่อน:
 *   1. จ่ายเงินไปแล้ว ยกเลิกไม่ได้เลย ไม่ว่าใคร เพราะใบเบิกจ่ายยังอ้างเอกสารนี้อยู่
 *      ถ้าปล่อยให้ยกเลิก ยอดในรายงานจะเพี้ยนทันที
 *   2. ตัดสินผลอนุมัติไปแล้ว (อนุมัติ/ไม่อนุมัติ) ต้องเป็นผู้มีอำนาจอนุมัติเท่านั้น
 *      เพราะเลขที่อนุมัติออกไปแล้ว เจ้าของใบถอนเองไม่ได้
 *   3. ยังไม่ตัดสิน (รออนุมัติ/ให้หาราคาใหม่) เจ้าของใบยกเลิกเองได้
 *      หรือคนที่ได้รับสิทธิ์ยกเลิกเอกสารของผู้อื่น
 */
export function validateCancel(target: CancelTarget | null, actor: CancelActor): string | null {
  if (!target) return "ไม่พบเอกสารที่ต้องการยกเลิก อาจถูกลบไปแล้ว";
  if (target.doc_status === "cancelled") return "เอกสารนี้ถูกยกเลิกไปแล้ว";

  if (target.actual_amount > 0) {
    return `เอกสารนี้จ่ายเงินไปแล้ว ${target.actual_amount.toLocaleString("th-TH")} บาท จึงยกเลิกไม่ได้ — ต้องไปลบหรือแก้ใบเบิกจ่ายที่อ้างเอกสารนี้ก่อน`;
  }

  const decided = target.approve_status === "approved" || target.approve_status === "rejected";
  if (decided) {
    return actor.isApprover
      ? null
      : `เอกสารนี้ผ่านการพิจารณาแล้ว (${APPROVE_STATUS_LABEL[target.approve_status]}) ยกเลิกได้เฉพาะผู้มีอำนาจอนุมัติ`;
  }

  if (actor.isApprover || actor.canCancelOthers) return null;
  if (target.created_by && target.created_by === actor.userId) return null;

  return "ยกเลิกได้เฉพาะเอกสารที่ตัวเองเป็นคนบันทึก — ถ้าต้องยกเลิกใบของคนอื่น ขอสิทธิ์เพิ่มจากผู้ดูแลระบบ";
}

/**
 * ตรวจว่าดึงเอกสารที่ยกเลิกแล้วกลับมาใช้งานใหม่ได้ไหม
 * ใช้เกณฑ์คนเดียวกับตอนยกเลิก — ใครยกเลิกได้ ก็กดคืนได้ เผื่อกดผิด
 * จะได้ไม่ต้องเปิดใบใหม่ให้เลขที่เอกสารเดินโดยเปล่าประโยชน์
 */
export function validateRestore(target: CancelTarget | null, actor: CancelActor): string | null {
  if (!target) return "ไม่พบเอกสารที่ต้องการดึงกลับ อาจถูกลบไปแล้ว";
  if (target.doc_status !== "cancelled") return "เอกสารนี้ยังใช้งานอยู่ ไม่ต้องดึงกลับ";

  const decided = target.approve_status === "approved" || target.approve_status === "rejected";
  if (decided && !actor.isApprover) {
    return "เอกสารนี้ผ่านการพิจารณาแล้ว ดึงกลับได้เฉพาะผู้มีอำนาจอนุมัติ";
  }
  if (actor.isApprover || actor.canCancelOthers) return null;
  if (target.created_by && target.created_by === actor.userId) return null;

  return "ดึงกลับได้เฉพาะเอกสารที่ตัวเองเป็นคนบันทึก หรือผู้ที่มีสิทธิ์ยกเลิกเอกสารของผู้อื่น";
}

/** ใบอนุมัติ (หน้าจอ 3.1) */
export function validateApproval(
  input: ApprovalInput,
  target: Pick<PrDocRow, "requested_amount" | "doc_status" | "actual_amount"> | null,
): string | null {
  if (!target) return "ไม่พบเอกสารที่ขออนุมัติ อาจถูกลบไปแล้ว";
  if (target.doc_status === "cancelled") return "เอกสารนี้ถูกยกเลิกแล้ว อนุมัติไม่ได้";
  if (!input.repair_id && !input.purchase_id) return "ไม่พบเอกสารที่ขออนุมัติ";
  if (!input.approve_date) return "กรุณาเลือกวันที่อนุมัติ";
  if (input.decision === "pending") return "กรุณาเลือกผลการพิจารณา";

  if (input.decision === "rejected" && !input.reject_reason) {
    return "กรุณาเลือกสาเหตุของการไม่อนุมัติ";
  }

  /*
   * เปลี่ยนใจได้ตราบใดที่ยังไม่จ่ายเงิน — แต่ถ้าจ่ายไปแล้วต้องกันไว้
   * เพราะการถอนอนุมัติจะทำให้ยอดที่จ่ายจริงค้างอยู่บนเอกสารที่ "ไม่อนุมัติ" ซึ่งอ่านไม่รู้เรื่อง
   * และงบก็ไม่ตรง ต้องไปลบ/แก้ใบเบิกจ่ายให้เรียบร้อยก่อน
   */
  const paid = target.actual_amount;
  if (paid > 0 && (input.decision === "rejected" || input.decision === "recheck")) {
    return `เอกสารนี้จ่ายเงินไปแล้ว ${paid.toLocaleString("th-TH")} บาท จึงเปลี่ยนผลเป็น "${
      APPROVE_STATUS_LABEL[input.decision]
    }" ไม่ได้ — ต้องไปลบหรือแก้ใบเบิกจ่ายที่อ้างเอกสารนี้ก่อน`;
  }

  if (input.decision === "approved") {
    const problem = checkAmount("จำนวนเงินที่อนุมัติเบิก", input.approved_amount);
    if (problem) return problem;
    if (input.approved_amount > target.requested_amount) {
      return "จำนวนเงินที่อนุมัติเบิกต้องไม่เกินจำนวนเงินที่ขอเบิก";
    }
    if (paid > 0 && input.approved_amount < paid) {
      return `ลดยอดที่อนุมัติต่ำกว่ายอดที่จ่ายไปแล้ว (${paid.toLocaleString("th-TH")} บาท) ไม่ได้`;
    }
  }

  return null;
}

/** ใบเบิกจ่าย (หน้าจอ 4) */
export function validatePayment(
  input: {
    pay_date: string;
    paid_amount: number;
    payee_name?: string | null;
    expense_detail?: string | null;
    company_id?: string | null;
    branch_id?: string | null;
  },
  items: PaymentItem[],
  targets: Map<string, Pick<PrDocRow, "doc_no" | "approve_status" | "approved_amount" | "actual_amount">>,
): string | null {
  if (!input.pay_date) return "กรุณาเลือกวันที่ทำจ่าย";
  if (!input.company_id) return "กรุณาเลือกบริษัทที่ทำจ่าย (เลขที่ใบเบิกรันแยกตามบริษัทและสาขา)";
  if (!input.branch_id) return "กรุณาเลือกสาขาที่ทำจ่าย (เลขที่ใบเบิกรันแยกตามบริษัทและสาขา)";
  if (!input.payee_name?.trim()) return "กรุณากรอกชื่อผู้ขายหรือผู้รับเงิน";
  if (!input.expense_detail?.trim()) return "กรุณากรอกรายการค่าใช้จ่าย";

  const problem = checkAmount("จำนวนเงิน", input.paid_amount);
  if (problem) return problem;
  if (input.paid_amount <= 0) return "จำนวนเงินต้องมากกว่า 0";

  /*
   * ใบเบิกหนึ่งใบมีได้หลายบรรทัด และแต่ละบรรทัดเลือกได้ว่าจะผูกกับใบขอซ่อม/ใบขอซื้อที่อนุมัติแล้ว
   * หรือเป็นค่าใช้จ่ายทั่วไปที่ไม่ต้องขออนุมัติ (พิมพ์รายการเอง)
   * บรรทัดที่ไม่ผูกเอกสารจึงต้องมีรายการค่าใช้จ่ายกำกับเสมอ ไม่งั้นใบพิมพ์จะอ่านไม่รู้เรื่อง
   */
  for (const [index, item] of items.entries()) {
    const key = item.repair_id ?? item.purchase_id;
    const where = `รายการที่ ${index + 1}`;

    if (key) {
      const target = targets.get(key);
      if (!target) return "ไม่พบเอกสารที่อ้างถึง อาจถูกลบไปแล้ว";

      const amountProblem = checkAmount(`ยอดเบิกของ ${target.doc_no}`, item.amount);
      if (amountProblem) return amountProblem;
    } else {
      if (!item.detail?.trim()) return `${where}: กรุณากรอกรายการค่าใช้จ่าย`;

      const amountProblem = checkAmount(`จำนวนเงินของ${where}`, item.amount);
      if (amountProblem) return amountProblem;
    }

    if (item.amount <= 0) return `${where}: จำนวนเงินต้องมากกว่า 0`;
  }

  // ถ้าเลือกเอกสารมาอ้าง ยอดที่กระจายลงเอกสารต้องไม่เกินยอดที่จ่ายจริงทั้งใบ
  if (items.length > 0 && sumItems(items) > round2(input.paid_amount)) {
    return "ยอดรวมของเอกสารที่อ้างถึงมากกว่าจำนวนเงินที่จ่ายจริง";
  }

  return null;
}

/** ตรวจค่าของบัญชีในผังบัญชีก่อนบันทึก */
export function validateAccount(
  input: PrAccountInput,
  /** บัญชีคุมที่เลือก (ถ้ามี) — ใช้ตรวจว่าอยู่หมวดเดียวกันไหม */
  parent: Pick<PrAccountRow, "id" | "code" | "category"> | null,
  /** id ของบัญชีที่กำลังแก้ไข — กันเลือกตัวเองเป็นบัญชีคุม */
  selfId?: string,
): string | null {
  if (!input.code.trim()) return "กรุณากรอกรหัสบัญชี";
  if (input.code.length > 20) return "รหัสบัญชียาวเกินไป (ไม่เกิน 20 ตัวอักษร)";
  if (!input.name.trim()) return "กรุณากรอกชื่อบัญชี";
  if (input.name.length > 120) return "ชื่อบัญชียาวเกินไป (ไม่เกิน 120 ตัวอักษร)";

  if (input.parent_id && selfId && input.parent_id === selfId) {
    return "บัญชีคุมต้องไม่ใช่ตัวมันเอง";
  }
  if (input.parent_id && parent && parent.category !== input.category) {
    return `บัญชีย่อยต้องอยู่หมวดเดียวกับบัญชีคุม ${parent.code}`;
  }
  return null;
}

/** ค่าเบื้องต้น ประเภททรัพย์สิน / ประเภทวัสดุ */
export function validatePrType(input: PrTypeInput, label: string): string | null {
  if (!input.code.trim()) return `กรุณากรอกรหัส${label}`;
  if (input.code.length > 20) return `รหัส${label}ยาวเกินไป (ไม่เกิน 20 ตัวอักษร)`;
  if (!input.name.trim()) return `กรุณากรอกชื่อ${label}`;
  if (input.name.length > 120) return `ชื่อ${label}ยาวเกินไป (ไม่เกิน 120 ตัวอักษร)`;
  return null;
}

// ---------- ข้อความสรุปสำหรับแสดงบนหน้าจอ ----------

/** คำอธิบายสั้น ๆ ของใบ update หนึ่งใบ (ใช้ในไทม์ไลน์บนหน้ารายละเอียด) */
export function describeRepairUpdate(update: {
  job_status: JobStatus | null;
  expected_done_date: string | null;
  requested_amount: number | null;
  detail: string | null;
  photo_count?: number;
}): string {
  const parts: string[] = [];
  if (update.job_status) parts.push(JOB_STATUS_LABEL[update.job_status]);
  if (update.expected_done_date) parts.push(`คาดว่าเสร็จ ${update.expected_done_date}`);
  if (update.requested_amount !== null) {
    parts.push(`ขออนุมัติ ${update.requested_amount.toLocaleString("th-TH")} บาท`);
  }
  if (update.detail?.trim()) parts.push(update.detail.trim());
  if (update.photo_count) parts.push(`แนบรูป ${update.photo_count} รูป`);
  return parts.length > 0 ? parts.join(" · ") : "บันทึกเพิ่มเติม";
}

/** ป้ายกำกับใบขอซ่อม/ใบขอซื้อในกล่องตัวเลือก */
export function docOptionLabel(row: Pick<PrDocRow, "doc_no" | "item_name" | "requested_amount">): string {
  return `${row.doc_no} · ${row.item_name} · ${row.requested_amount.toLocaleString("th-TH")} บาท`;
}

/** เหตุผลที่เอกสารยังเบิกจ่ายไม่ได้ (คืน null = เบิกได้) */
export function payableProblem(
  doc: Pick<PrDocRow, "approve_status" | "doc_status" | "approved_amount" | "actual_amount">,
): string | null {
  if (doc.doc_status === "cancelled") return "เอกสารถูกยกเลิกแล้ว";
  if (doc.approve_status !== "approved") return APPROVE_STATUS_LABEL[doc.approve_status];
  if (remainingToPay(doc) <= 0) return "เบิกจ่ายครบแล้ว";
  return null;
}

// ---------- สรุปสำหรับ dashboard (ข้อ 6) ----------

export type PrSummary = {
  total: number;
  requested: number;
  approved: number;
  actual: number;
  overdue: number;
  byJobStatus: Record<JobStatus, number>;
  byApproveStatus: Record<ApproveStatus, number>;
  byPayStatus: Record<PayStatus, number>;
  byDocStatus: Record<PrDocStatus, number>;
  byUrgency: Record<Urgency, number>;
};

function emptyCount<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>;
}

/** สรุปตัวเลขของเอกสารชุดหนึ่ง — ใช้ทั้ง dashboard และหัวตารางหน้าสอบถาม */
export function summarizeDocs(rows: PrDocRow[], today: string): PrSummary {
  const summary: PrSummary = {
    total: rows.length,
    requested: 0,
    approved: 0,
    actual: 0,
    overdue: 0,
    byJobStatus: emptyCount(["wait_tech", "contacted", "in_progress", "done"] as const),
    byApproveStatus: emptyCount(["pending", "approved", "rejected", "recheck"] as const),
    byPayStatus: emptyCount(["requested", "approved", "settled"] as const),
    byDocStatus: emptyCount(["active", "cancelled"] as const),
    byUrgency: emptyCount(["d1_2", "d2_5", "d5_plus"] as const),
  };

  for (const row of rows) {
    summary.requested += row.requested_amount;
    summary.approved += row.approved_amount;
    summary.actual += row.actual_amount;
    if (isOverdue(row, today)) summary.overdue += 1;

    if (row.job_status) summary.byJobStatus[row.job_status] += 1;
    summary.byApproveStatus[row.approve_status] += 1;
    summary.byPayStatus[row.pay_status] += 1;
    summary.byDocStatus[row.doc_status] += 1;
    summary.byUrgency[row.urgency] += 1;
  }

  summary.requested = round2(summary.requested);
  summary.approved = round2(summary.approved);
  summary.actual = round2(summary.actual);

  return summary;
}

/** ข้อความบอกว่างานใบนี้เลยกำหนดกี่วัน (ยังไม่เลยกำหนดคืนสตริงว่าง) */
export function overdueText(row: PrDocRow, today: string): string {
  const days = overdueDays(row, today);
  return days > 0 ? `เลยกำหนด ${days} วัน` : "";
}

/** ป้ายความเร่งด่วนพร้อมกำหนดเสร็จ ใช้ในการ์ดบนมือถือ */
export function urgencyText(row: PrDocRow): string {
  return `${URGENCY_LABEL[row.urgency]} (ครบกำหนด ${deadlineOf(row)})`;
}

// ---------- ป้ายกำกับ (แฮชแท็ก) ----------

/**
 * แปลงข้อความที่ผู้ใช้พิมพ์ให้เป็น slug ที่ใช้เทียบป้ายซ้ำ
 * ตัด # นำหน้า ตัดช่องว่างหัวท้าย ยุบช่องว่างซ้อน และเทียบแบบไม่สนตัวพิมพ์
 * (ป้ายไทยไม่มีตัวพิมพ์เล็กใหญ่ แต่ป้ายอังกฤษมี — "Fuel" กับ "fuel" ต้องเป็นป้ายเดียวกัน)
 */
export function tagSlug(raw: string): string {
  return raw
    .replace(/^#+/, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** ชื่อป้ายที่จะเก็บไว้แสดง — เก็บตัวพิมพ์ตามที่ผู้ใช้พิมพ์ครั้งแรก แต่ตัดขยะออก */
export function tagDisplayName(raw: string): string {
  return raw.replace(/^#+/, "").trim().replace(/\s+/g, " ");
}

/**
 * แยกข้อความช่องป้ายกำกับออกเป็นรายป้าย
 * รับได้ทั้ง "#ค่าน้ำมัน #ซ่อมด่วน" และ "ค่าน้ำมัน, ซ่อมด่วน"
 * คืนเฉพาะป้ายที่ไม่ซ้ำกัน (เทียบด้วย slug) และไม่เกินจำนวนที่กำหนด
 */
export function parseTags(raw: string, max = 10): { name: string; slug: string }[] {
  const out: { name: string; slug: string }[] = [];
  const seen = new Set<string>();

  for (const piece of raw.split(/[,\n]|\s(?=#)/)) {
    const name = tagDisplayName(piece);
    const slug = tagSlug(piece);
    if (!name || !slug || seen.has(slug)) continue;
    if (name.length > 60) continue;

    seen.add(slug);
    out.push({ name, slug });
    if (out.length >= max) break;
  }
  return out;
}

export type TagSummaryLine = {
  tag_id: string | null;
  tag_name: string;
  count: number;
  amount: number;
};

export type TagSummary = {
  lines: TagSummaryLine[];
  /** จำนวนใบเบิกทั้งหมด (นับใบไม่ซ้ำ ไม่ใช่นับคู่ใบ-ป้าย) */
  totalPayments: number;
  /** ยอดเงินรวมทั้งหมด (นับใบละครั้ง แม้ใบนั้นจะติดหลายป้าย) */
  totalAmount: number;
};

const UNTAGGED = "— ยังไม่ติดป้าย —";

/**
 * สรุปยอดตามป้ายกำกับ จากแถวคู่ (ใบเบิก × ป้าย)
 *
 * ระวัง: ใบเบิกที่ติดหลายป้ายจะปรากฏหลายแถว ยอดของใบนั้นจึงถูกนับซ้ำในแต่ละป้าย
 * ซึ่งถูกต้องสำหรับ "ยอดต่อป้าย" แต่ผลรวมของทุกป้ายจะมากกว่ายอดจริง
 * ตัวเลขรวมทั้งหมด (totalAmount) จึงนับจากใบที่ไม่ซ้ำแทน
 */
export function summarizeByTag(
  rows: (Pick<PaymentTagRow, "payment_id" | "paid_amount" | "tag_id" | "tag_name"> & {
    /** id ของรายการจ่าย — ใบเก่าที่ยังไม่มีรายการจะไม่มีค่านี้ */
    item_id?: string | null;
  })[],
): TagSummary {
  const byTag = new Map<
    string,
    TagSummaryLine & { payments: Set<string>; items: Set<string> }
  >();
  const allItems = new Map<string, number>();
  const allPayments = new Set<string>();

  for (const row of rows) {
    /*
     * หนึ่งแถวคือหนึ่งรายการจ่าย (ไม่ใช่ทั้งใบ) เพราะป้ายกำกับติดได้รายรายการแล้ว
     * ยอดจึงต้องรวมแบบไม่ซ้ำรายการ ส่วนจำนวนยังนับเป็น "ใบ" ตามที่หน้าจอแสดง
     * ใบเก่าที่ไม่มีรายการ ใช้ id ของใบแทนเพื่อให้ยังนับได้เหมือนเดิม
     */
    const unit = row.item_id ?? row.payment_id;
    allItems.set(unit, row.paid_amount);
    allPayments.add(row.payment_id);

    const key = row.tag_id ?? "";
    let line = byTag.get(key);
    if (!line) {
      line = {
        tag_id: row.tag_id,
        tag_name: row.tag_name ?? UNTAGGED,
        count: 0,
        amount: 0,
        payments: new Set<string>(),
        items: new Set<string>(),
      };
      byTag.set(key, line);
    }

    // รายการเดิมที่มาซ้ำในป้ายเดียวกันไม่ควรนับยอดสองรอบ
    if (line.items.has(unit)) continue;
    line.items.add(unit);
    line.amount = round2(line.amount + row.paid_amount);

    // จำนวนนับเป็นใบ ใบเดียวที่มีหลายรายการในป้ายเดียวกันจึงนับครั้งเดียว
    if (!line.payments.has(row.payment_id)) {
      line.payments.add(row.payment_id);
      line.count += 1;
    }
  }

  const lines = [...byTag.values()]
    .map(({ payments: _payments, items: _items, ...line }) => line)
    // ยอดมากขึ้นก่อน ป้ายที่ยังไม่ติดไว้ท้ายสุดเสมอ
    .sort((a, b) => {
      if (!a.tag_id) return 1;
      if (!b.tag_id) return -1;
      return b.amount - a.amount;
    });

  return {
    lines,
    totalPayments: allPayments.size,
    totalAmount: round2([...allItems.values()].reduce((sum, v) => sum + v, 0)),
  };
}

/** ตรวจค่าของเจ้าหนี้/ผู้ขายก่อนบันทึก */
export function validateVendor(input: PrVendorInput): string | null {
  if (!input.code.trim()) return "กรุณากรอกรหัสเจ้าหนี้";
  if (input.code.length > 20) return "รหัสเจ้าหนี้ยาวเกินไป (ไม่เกิน 20 ตัวอักษร)";
  if (!input.name.trim()) return "กรุณากรอกชื่อเจ้าหนี้หรือผู้ขาย";
  if (input.name.length > 200) return "ชื่อเจ้าหนี้ยาวเกินไป (ไม่เกิน 200 ตัวอักษร)";
  if ((input.address ?? "").length > 500) return "ที่อยู่ยาวเกินไป (ไม่เกิน 500 ตัวอักษร)";
  return null;
}

// ---------- วงเงินสำรองจ่าย ----------

/** ตรวจค่าของกองเงินสำรองก่อนบันทึก */
export function validateFund(input: PrFundInput): string | null {
  if (!input.holder_id) return "กรุณาเลือกผู้ถือเงินสำรอง";

  const problem = checkAmount("วงเงินสำรองจ่าย", input.limit_amount);
  if (problem) return problem;
  if (input.limit_amount <= 0) return "วงเงินสำรองจ่ายต้องมากกว่า 0";

  return null;
}

/**
 * ตรวจการเติมเงิน/คืนเงินของกอง
 *
 * เติมแล้วยอดคงเหลือต้องไม่เกินวงเงินที่อนุมัติไว้ — นั่นคือความหมายของการตั้งวงเงิน
 * ส่วนการคืนเงินกลับบริษัท คืนได้ไม่เกินที่ถืออยู่จริง
 */
export function validateFundMove(
  input: Pick<FundMoveInput, "move_date" | "kind" | "amount">,
  fund: Pick<PrFundRow, "limit_amount" | "balance" | "is_active"> | null,
): string | null {
  if (!fund) return "ไม่พบกองเงินสำรองที่เลือก";
  if (!fund.is_active) return "กองเงินสำรองนี้ถูกปิดใช้งานแล้ว";
  if (!input.move_date) return "กรุณาเลือกวันที่";

  const problem = checkAmount("จำนวนเงิน", input.amount);
  if (problem) return problem;
  if (input.amount <= 0) return "จำนวนเงินต้องมากกว่า 0";

  if (input.kind === "topup") {
    const room = round2(fund.limit_amount - fund.balance);
    if (input.amount > room) {
      return `เติมได้อีกไม่เกิน ${room.toLocaleString("th-TH")} บาท (วงเงิน ${fund.limit_amount.toLocaleString("th-TH")} บาท · ถืออยู่ ${fund.balance.toLocaleString("th-TH")} บาท)`;
    }
    return null;
  }

  if (input.amount > fund.balance) {
    return `คืนเงินเกินยอดที่ถืออยู่ไม่ได้ (คงเหลือ ${fund.balance.toLocaleString("th-TH")} บาท)`;
  }
  return null;
}

/**
 * ตรวจว่าจ่ายออกจากกองได้ไหม — จ่ายเกินยอดคงเหลือไม่ได้ เพราะเงินไม่มีอยู่จริงในมือ
 *
 * ตอนแก้ใบเดิม ยอดที่ใบนั้นเคยตัดไปแล้วต้องบวกกลับเข้ายอดคงเหลือก่อนเทียบ
 * ไม่งั้นแค่เปิดเข้าไปกดบันทึกซ้ำก็จะฟ้องว่าเงินไม่พอ
 */
export function validateFundPayment(
  amount: number,
  fund: Pick<PrFundRow, "balance" | "is_active" | "holder_name"> | null,
  alreadyOnThisPayment = 0,
): string | null {
  if (!fund) return "กรุณาเลือกกองเงินสำรองที่จะจ่ายออก";
  if (!fund.is_active) return "กองเงินสำรองนี้ถูกปิดใช้งานแล้ว";

  const available = round2(fund.balance + alreadyOnThisPayment);
  if (amount > available) {
    return `ยอดคงเหลือในกองไม่พอ — คงเหลือ ${available.toLocaleString("th-TH")} บาท แต่ใบนี้จ่าย ${amount.toLocaleString("th-TH")} บาท`;
  }
  return null;
}
