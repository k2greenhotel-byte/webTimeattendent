/**
 * กฎการอนุมัติทั้งหมดอยู่ในไฟล์นี้ที่เดียว (pure function ไม่แตะฐานข้อมูล)
 * หน้าเว็บ / server action / รายงาน เรียกใช้ชุดเดียวกันหมด
 *
 * อำนาจอนุมัติแยกเป็น 2 ชั้น อย่าสับสนกัน:
 *   1. สิทธิ์เมนู (APV_INBOX) — เข้าหน้ากล่องรออนุมัติได้ไหม  → คุมที่ระบบส่วนกลาง
 *   2. วงเงินอนุมัติ (apv_limits) — ตัดสินได้ถึงจำนวนเท่าไร   → คุมที่ไฟล์นี้
 *
 * ลำดับการตัดสินอำนาจของหนึ่งคนต่อหนึ่งเรื่อง (เฉพาะเจาะจงมากกว่าชนะ):
 *   1. ระดับ admin                 → ไม่จำกัดวงเงิน + ตัดสินขั้นสุดท้ายได้เสมอ
 *   2. กฎเจาะจงคน + เจาะจงประเภทเรื่อง
 *   3. กฎเจาะจงคน (ทุกประเภทเรื่อง)
 *   4. กฎตามระดับ + เจาะจงประเภทเรื่อง
 *   5. กฎตามระดับ (ทุกประเภทเรื่อง)
 *   6. ไม่มีกฎเลย                  → อนุมัติไม่ได้
 * ถ้ากฎระบุบริษัทไว้ ต้องตรงกับบริษัทของใบขอด้วย (null = ใช้ได้ทุกบริษัท)
 */
import type { AccessLevel } from "./core-types";
import {
  isOpen,
  type ApvDecision,
  type ApvLimit,
  type ApvRequestRow,
  type ApvStatus,
  type Authority,
  type InboxSummary,
} from "./approval-types";

export { formatBaht, parseAmount } from "./booking";

/** ไม่มีอำนาจอนุมัติเลย */
export const NO_AUTHORITY: Authority = {
  maxAmount: 0,
  canReject: false,
  isFinal: false,
  fromLimitId: null,
  reason: "ยังไม่ได้ตั้งอำนาจอนุมัติให้บัญชีนี้",
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------- อำนาจอนุมัติ ----------

/** คะแนนความเฉพาะเจาะจงของกฎ — มากกว่าชนะ */
function specificity(limit: ApvLimit): number {
  return (limit.user_id ? 4 : 0) + (limit.type_id ? 2 : 0) + (limit.company_id ? 1 : 0);
}

function matches(
  limit: ApvLimit,
  target: { userId: string; level: AccessLevel; typeId: string; companyId: string | null },
): boolean {
  if (!limit.is_active) return false;
  if (limit.user_id) {
    if (limit.user_id !== target.userId) return false;
  } else if (limit.level !== target.level) {
    return false;
  }
  if (limit.type_id && limit.type_id !== target.typeId) return false;
  if (limit.company_id && limit.company_id !== target.companyId) return false;
  return true;
}

function describe(limit: ApvLimit): string {
  const who = limit.user_id ? "กฎเฉพาะบุคคล" : "กฎตามระดับการทำงาน";
  const scope = limit.type_id ? "เฉพาะเรื่องนี้" : "ทุกประเภทเรื่อง";
  const amount =
    limit.max_amount === null ? "ไม่จำกัดวงเงิน" : `วงเงิน ${limit.max_amount.toLocaleString("th-TH")} บาท`;
  return `${who} · ${scope} · ${amount}${limit.is_final ? " · ตัดสินขั้นสุดท้ายได้" : ""}`;
}

/** หาอำนาจอนุมัติที่มีผลจริงของคนหนึ่งคน ต่อเรื่องหนึ่งประเภท ในบริษัทหนึ่ง */
export function resolveAuthority(
  limits: ApvLimit[],
  target: { userId: string; level: AccessLevel; typeId: string; companyId?: string | null },
): Authority {
  // ผู้ดูแลระบบต้องตัดสินได้เสมอ ไม่งั้นตั้งกฎพลาดแล้วไม่มีใครปลดล็อกให้ได้
  if (target.level === "admin") {
    return {
      maxAmount: null,
      canReject: true,
      isFinal: true,
      fromLimitId: null,
      reason: "ระดับผู้ดูแลระบบ — อนุมัติได้ทุกจำนวน",
    };
  }

  const scope = { ...target, companyId: target.companyId ?? null };
  let best: ApvLimit | null = null;
  for (const limit of limits) {
    if (!matches(limit, scope)) continue;
    if (!best || specificity(limit) > specificity(best)) best = limit;
  }

  if (!best) return { ...NO_AUTHORITY };
  return {
    maxAmount: best.max_amount,
    canReject: best.can_reject,
    isFinal: best.is_final,
    fromLimitId: best.id,
    reason: describe(best),
  };
}

/** อยู่ในวงเงินไหม (เรื่องที่ไม่มีจำนวนเงิน ถือว่าอยู่ในวงเงินเสมอถ้ามีอำนาจอยู่บ้าง) */
export function withinLimit(authority: Authority, amount: number, hasAmount = true): boolean {
  if (authority.isFinal || authority.maxAmount === null) return true;
  if (!hasAmount) return authority.maxAmount > 0;
  return amount <= authority.maxAmount;
}

/** ตัดสินขั้นสุดท้ายเรื่องนี้ได้เลยไหม (ไม่ต้องเสนอต่อ) */
export function canDecideFinal(authority: Authority, row: ApvRequestRow): boolean {
  return withinLimit(authority, row.requested_amount, row.has_amount);
}

/** อย่างน้อยต้องมีอำนาจบ้าง ถึงจะเห็นเรื่องในกล่องรออนุมัติ */
export function hasAnyAuthority(authority: Authority): boolean {
  return authority.isFinal || authority.maxAmount === null || authority.maxAmount > 0;
}

// ---------- ตรวจก่อนบันทึก ----------

export type DecisionInput = {
  decision: ApvDecision;
  approvedAmount: number;
  reasonId: string | null;
  note: string;
};

/**
 * ตรวจว่าตัดสินแบบนี้ได้ไหม — คืนข้อความไทยบอกวิธีแก้ หรือ null เมื่อผ่าน
 * (แบบเดียวกับ validate* ของโมดูลจัดซื้อ)
 */
export function validateDecision(
  row: ApvRequestRow,
  authority: Authority,
  input: DecisionInput,
): string | null {
  if (!isOpen(row.status)) {
    return `เรื่องนี้ปิดไปแล้ว (${row.status === "cancelled" ? "ถูกยกเลิก" : "ตัดสินไปแล้ว"}) ตัดสินซ้ำไม่ได้`;
  }
  if (!hasAnyAuthority(authority)) {
    return "บัญชีของคุณยังไม่ได้รับอำนาจอนุมัติ — ให้ผู้ดูแลระบบตั้งค่าที่เมนูตั้งค่าอำนาจอนุมัติก่อน";
  }

  if (input.decision === "endorse") {
    if (!input.note.trim()) return "กรุณาใส่ความเห็นสั้น ๆ ให้ผู้บริหารที่จะตัดสินต่อ";
    return null;
  }

  if (input.decision === "reject") {
    if (!authority.canReject) return "บัญชีของคุณไม่มีอำนาจปฏิเสธเรื่อง — เสนอขึ้นผู้มีอำนาจสูงกว่าแทน";
    if (!input.reasonId) return "กรุณาเลือกเหตุผลที่ไม่อนุมัติ";
    if (!canDecideFinal(authority, row)) {
      return overLimitMessage(row, authority, "ปฏิเสธ");
    }
    return null;
  }

  // approve / partial
  if (!canDecideFinal(authority, row)) {
    return overLimitMessage(row, authority, "อนุมัติ");
  }

  if (input.decision === "partial") {
    if (!row.allow_partial) return "เรื่องประเภทนี้อนุมัติบางส่วนไม่ได้ — เลือกอนุมัติตามที่ขอ หรือไม่อนุมัติ";
    if (!row.has_amount) return "เรื่องประเภทนี้ไม่มีจำนวนให้อนุมัติบางส่วน";
    if (input.approvedAmount <= 0) return "กรุณาระบุจำนวนที่อนุมัติให้มากกว่า 0";
    if (input.approvedAmount > row.requested_amount) {
      return "จำนวนที่อนุมัติต้องไม่เกินจำนวนที่ขอมา";
    }
    if (!withinLimit(authority, input.approvedAmount, row.has_amount)) {
      return overLimitMessage(row, authority, "อนุมัติ");
    }
  }

  return null;
}

function overLimitMessage(row: ApvRequestRow, authority: Authority, verb: string): string {
  const limit = authority.maxAmount ?? 0;
  return (
    `เรื่องนี้ ${row.requested_amount.toLocaleString("th-TH")} บาท เกินอำนาจ${verb}ของคุณ ` +
    `(${limit.toLocaleString("th-TH")} บาท) — กด "เสนอผู้มีอำนาจสูงกว่า" แทน`
  );
}

// ---------- ผลของการตัดสิน ----------

export type RequestPatch = {
  status: ApvStatus;
  approved_amount: number;
  decided_at: string | null;
  decided_by: string | null;
  decided_by_name: string | null;
};

/**
 * แปลงการตัดสินหนึ่งครั้ง เป็นสถานะใหม่ของใบขอ
 * endorse = ยังไม่จบ ส่งต่อขึ้นไป · ที่เหลือ = จบเรื่อง บันทึกวันเวลาและชื่อผู้ตัดสิน
 */
export function applyDecision(
  row: ApvRequestRow,
  input: DecisionInput,
  approver: { id: string; name: string },
  now: Date = new Date(),
): RequestPatch {
  const at = now.toISOString();

  if (input.decision === "endorse") {
    return {
      status: "endorsed",
      approved_amount: 0,
      decided_at: null,
      decided_by: null,
      decided_by_name: null,
    };
  }

  if (input.decision === "reject") {
    return {
      status: "rejected",
      approved_amount: 0,
      decided_at: at,
      decided_by: approver.id,
      decided_by_name: approver.name,
    };
  }

  const amount =
    input.decision === "partial" ? round2(input.approvedAmount) : round2(row.requested_amount);

  return {
    status: input.decision === "partial" ? "partial" : "approved",
    approved_amount: row.has_amount ? amount : 0,
    decided_at: at,
    decided_by: approver.id,
    decided_by_name: approver.name,
  };
}

// ---------- ใบขอ ----------

export type RequestInput = {
  typeId: string;
  subject: string;
  detail: string;
  requestedAmount: number;
  neededBy: string | null;
};

export function validateRequest(
  input: RequestInput,
  type: { has_amount: boolean; form_enabled: boolean; name: string } | null,
): string | null {
  if (!type) return "กรุณาเลือกประเภทเรื่องที่ขออนุมัติ";
  if (!type.form_enabled) {
    return `เรื่อง "${type.name}" ต้องยื่นจากโปรแกรมต้นทาง ไม่ได้เปิดให้ยื่นจากฟอร์มกลาง`;
  }
  if (!input.subject.trim()) return "กรุณากรอกเรื่องที่ขออนุมัติ";
  if (type.has_amount && input.requestedAmount <= 0) {
    return "กรุณากรอกจำนวนที่ขอให้มากกว่า 0";
  }
  return null;
}

// ---------- กล่องรออนุมัติ ----------

/** เรื่องนี้ควรอยู่ในกล่องของคนนี้ไหม (เห็นได้ = มีอำนาจบ้าง และเรื่องยังไม่ปิด) */
export function isInInbox(row: ApvRequestRow, authority: Authority): boolean {
  return isOpen(row.status) && hasAnyAuthority(authority);
}

/** แยกเรื่องเป็น 2 กอง: ตัดสินได้เลย กับ เกินอำนาจ (ได้แค่เสนอต่อ) */
export function splitByAuthority(
  rows: ApvRequestRow[],
  authorityOf: (row: ApvRequestRow) => Authority,
): { canDecide: ApvRequestRow[]; overLimit: ApvRequestRow[] } {
  const canDecide: ApvRequestRow[] = [];
  const overLimit: ApvRequestRow[] = [];

  for (const row of rows) {
    const authority = authorityOf(row);
    if (!isInInbox(row, authority)) continue;
    if (canDecideFinal(authority, row)) canDecide.push(row);
    else overLimit.push(row);
  }
  return { canDecide, overLimit };
}

/** เลยวันที่ต้องการแล้วหรือยัง */
export function isOverdue(row: ApvRequestRow, today: string): boolean {
  return Boolean(row.needed_by && isOpen(row.status) && row.needed_by < today);
}

export function summarizeInbox(
  canDecide: ApvRequestRow[],
  overLimit: ApvRequestRow[],
  endorsedByMe: number,
  today: string,
): InboxSummary {
  const all = [...canDecide, ...overLimit];
  return {
    mine: canDecide.length,
    overLimit: overLimit.length,
    endorsedByMe,
    overdue: all.filter((r) => isOverdue(r, today)).length,
    totalAmount: round2(all.reduce((sum, r) => sum + (r.has_amount ? r.requested_amount : 0), 0)),
  };
}

/** เรียงเรื่องด่วนขึ้นก่อน: เลยกำหนด → ใกล้กำหนด → ไม่มีกำหนด → ยื่นก่อน */
export function sortByUrgency(rows: ApvRequestRow[]): ApvRequestRow[] {
  return [...rows].sort((a, b) => {
    if (a.needed_by && b.needed_by) return a.needed_by.localeCompare(b.needed_by);
    if (a.needed_by) return -1;
    if (b.needed_by) return 1;
    return a.request_date.localeCompare(b.request_date);
  });
}

/** ข้อความสรุปจำนวนเงินบนหน้าจอ — เรื่องที่ไม่มีจำนวนเงินไม่ต้องโชว์เลข 0 */
export function amountText(row: ApvRequestRow): string {
  if (!row.has_amount) return "-";
  const requested = row.requested_amount.toLocaleString("th-TH");
  if (row.status === "partial") {
    return `${row.approved_amount.toLocaleString("th-TH")} / ${requested}`;
  }
  return requested;
}
