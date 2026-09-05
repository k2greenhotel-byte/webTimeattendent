/**
 * กฎธุรกิจของระบบขอลา / ขอเบิกเงินเดือน อยู่ในไฟล์นี้ที่เดียว (pure function ไม่แตะฐานข้อมูล)
 * หน้าเว็บ · server action · หน้าอนุมัติ · รายงาน เรียกใช้ชุดเดียวกันหมด
 *
 * เงื่อนไขทุกข้อ (แจ้งล่วงหน้ากี่วัน · อายุงานขั้นต่ำ · เวลาตัด · ตัวคูณค่าปรับ · ใบรับรองแพทย์)
 * มาจากแถวใน hr_leave_types ไม่ใช่ค่าคงที่ในโค้ด — ผู้ใช้แก้เองได้จากหน้าตั้งค่าประเภทการลา
 *
 * สิ่งที่ระบบ "บล็อก" มีอย่างเดียวคืออายุงานไม่ถึงเกณฑ์ นอกนั้นให้ยื่นได้แต่ติดธงไว้
 * (แจ้งช้า → ถือเป็นขาดงาน · แจ้งหลังเวลาตัด → หักเงินตามตัวคูณ) เพราะความจริงคือ
 * พนักงานป่วยหรือติดธุระกะทันหันก็ต้องแจ้งได้ ผู้อนุมัติเป็นคนตัดสินผลอีกที
 */
import { addDays, bangkokAt, formatThaiDate } from "./datetime";
import type { Authority } from "./approval-types";
import { withinLimit } from "./approval";
import {
  ADVANCE_DECISION_ORDER,
  ADVANCE_STATUS_ORDER,
  LEAVE_DECISION_ORDER,
  LEAVE_STATUS_ORDER,
  type AdvanceRequestRow,
  type AdvanceStatus,
  type LeaveRequestRow,
  type LeaveStatus,
  type LeaveType,
} from "./leave-types";

export { formatBaht, parseAmount } from "./booking";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toMidnightUtc(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** จำนวนวันจาก `from` ถึง `to` (ลบ = to อยู่ก่อน from) */
export function daysBetween(from: string, to: string): number {
  return Math.round((toMidnightUtc(to) - toMidnightUtc(from)) / 86_400_000);
}

/** จำนวนวันลาที่นับได้จากช่วงวัน (รวมปลายทั้งสองด้าน) */
export function daysInRange(startDate: string, endDate: string): number {
  return daysBetween(startDate, endDate) + 1;
}

/**
 * อายุงานเป็นเดือนเต็ม ณ วันที่กำหนด (null = ยังไม่ได้บันทึกวันเริ่มงานไว้)
 * นับแบบเดียวกับที่คนไทยพูดกัน: เริ่ม 15 ม.ค. ถึง 14 ก.พ. = 0 เดือน · ถึง 15 ก.พ. = 1 เดือน
 */
export function serviceMonths(hireDate: string | null | undefined, onDate: string): number | null {
  if (!hireDate) return null;
  const [hy, hm, hd] = hireDate.split("-").map(Number);
  const [oy, om, od] = onDate.split("-").map(Number);
  if (!hy || !oy) return null;

  let months = (oy - hy) * 12 + (om - hm);
  if (od < hd) months -= 1;
  return months;
}

/** "1 ปี 3 เดือน" */
export function formatServiceMonths(months: number | null): string {
  if (months === null) return "ไม่ได้บันทึกวันเริ่มงาน";
  if (months < 0) return "ยังไม่เริ่มงาน";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} เดือน`;
  if (m === 0) return `${y} ปี`;
  return `${y} ปี ${m} เดือน`;
}

// ---------- ยื่นใบแจ้งลา ----------

export type LeaveInput = {
  typeId: string;
  detail: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  arrivalTime: string | null;
};

export type LeaveContext = {
  /** วันที่ยื่น (วันไทย YYYY-MM-DD) */
  requestDate: string;
  /** เวลาที่แจ้งจริง — ต้องมาจาก server เสมอ ห้ามรับจากเครื่องผู้ใช้ */
  reportedAt: Date;
  /** วันเริ่มงานของพนักงาน (null = ยังไม่ได้บันทึก) */
  hireDate: string | null;
  /** วันลาประเภทนี้ที่ใช้ไปแล้วในปีนี้ — ใช้เตือนเรื่องโควตาเท่านั้น */
  usedDaysThisYear?: number;
};

/** ผลการตรวจเงื่อนไข ณ วันที่ยื่น — ค่าชุดนี้ถูกบันทึกลงใบแจ้งเพื่อไม่ให้เปลี่ยนตามเงื่อนไขที่แก้ทีหลัง */
export type LeaveEvaluation = {
  /** ข้อความไทยเมื่อยื่นไม่ได้เลย (null = ยื่นได้) */
  blocked: string | null;
  /** ยื่นได้ แต่มีผลตามมา — แสดงให้ทั้งผู้แจ้งและผู้อนุมัติเห็น */
  warnings: string[];
  noticeDays: number;
  serviceMonths: number | null;
  countsAsAbsent: boolean;
  isLateNotice: boolean;
  penaltyMultiplier: number;
  certDueDate: string | null;
};

/** ตรวจความครบถ้วนของฟอร์ม — คืนข้อความไทยบอกวิธีแก้ หรือ null เมื่อผ่าน */
export function validateLeaveInput(input: LeaveInput, type: LeaveType | null): string | null {
  if (!type) return "กรุณาเลือกประเภทการลา";
  if (!type.is_active) return `ประเภท "${type.name}" ถูกปิดใช้งานอยู่ — เลือกประเภทอื่นหรือแจ้งผู้ดูแลระบบ`;
  if (!input.detail.trim()) return "กรุณากรอกรายละเอียดว่าลา/หยุด/สายเพราะอะไร";
  if (!input.startDate) return "กรุณาเลือกวันที่เริ่ม";

  if (type.needs_date_range) {
    if (!input.endDate) return "กรุณาเลือกวันที่สิ้นสุด";
    if (input.endDate < input.startDate) return "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม";
    if (input.totalDays <= 0) return "จำนวนวันต้องมากกว่า 0";
    if (input.totalDays > daysInRange(input.startDate, input.endDate)) {
      return "จำนวนวันมากกว่าช่วงวันที่เลือกไว้ — แก้ช่วงวันที่หรือจำนวนวันให้ตรงกัน";
    }
  }

  if (type.needs_arrival_time && !input.arrivalTime) {
    return "กรุณาระบุเวลาที่คาดว่าจะมาถึง";
  }
  return null;
}

/** ตรวจเงื่อนไขการใช้สิทธิ์ตามที่ตั้งไว้ในประเภทการลา */
export function evaluateLeave(
  type: LeaveType,
  input: LeaveInput,
  ctx: LeaveContext,
): LeaveEvaluation {
  const notice = daysBetween(ctx.requestDate, input.startDate);
  const months = serviceMonths(ctx.hireDate, ctx.requestDate);
  const warnings: string[] = [];

  // ---- อายุงานขั้นต่ำ (ข้อเดียวที่บล็อกการยื่น) ----
  let blocked: string | null = null;
  if (type.min_service_months > 0) {
    if (months === null) {
      blocked =
        `สิทธิ์ "${type.name}" ต้องมีอายุงานอย่างน้อย ${formatServiceMonths(type.min_service_months)} ` +
        "แต่ระบบยังไม่มีวันเริ่มงานของคุณ — แจ้งผู้ดูแลระบบให้บันทึกวันเริ่มงานก่อน";
    } else if (months < type.min_service_months) {
      blocked =
        `สิทธิ์ "${type.name}" ต้องมีอายุงานอย่างน้อย ${formatServiceMonths(type.min_service_months)} ` +
        `ตอนนี้คุณมีอายุงาน ${formatServiceMonths(months)}`;
    }
  }

  // ---- แจ้งล่วงหน้าไม่ครบ → ถือเป็นขาดงาน ----
  const countsAsAbsent = type.late_becomes_absent && notice < type.advance_days;
  if (countsAsAbsent) {
    warnings.push(
      `เงื่อนไขกำหนดให้แจ้งล่วงหน้าอย่างน้อย ${type.advance_days} วัน แต่ใบนี้แจ้งล่วงหน้า ` +
        `${notice} วัน — จะถูกบันทึกว่า "ขาดงาน"`,
    );
  }

  // ---- แจ้งหลังเวลาตัดของวันที่เริ่ม → หักเงินตามตัวคูณ ----
  let isLateNotice = false;
  if (type.same_day_cutoff) {
    const cutoff = type.same_day_cutoff.slice(0, 5);
    isLateNotice = ctx.reportedAt.getTime() > bangkokAt(input.startDate, cutoff).getTime();
    if (isLateNotice) {
      warnings.push(
        `ต้องแจ้งก่อน ${cutoff} น. ของวันที่ ${formatThaiDate(input.startDate)} — ` +
          `แจ้งช้ากว่านั้นถูกหักเงิน ${type.late_penalty_multiplier} เท่าของค่าจ้าง`,
      );
    }
  }

  // ---- ใบรับรองแพทย์ ----
  const certDueDate = type.require_medical_cert
    ? addDays(ctx.requestDate, type.cert_within_days)
    : null;
  if (certDueDate) {
    warnings.push(
      `ต้องแนบใบรับรองแพทย์ภายในวันที่ ${formatThaiDate(certDueDate)} ` +
        `(${type.cert_within_days} วันนับจากวันที่แจ้ง)`,
    );
  }

  // ---- โควตาต่อปี (เตือนอย่างเดียว ไม่บล็อก) ----
  if (type.max_days_per_year !== null && ctx.usedDaysThisYear !== undefined) {
    const totalAfter = ctx.usedDaysThisYear + input.totalDays;
    if (totalAfter > type.max_days_per_year) {
      warnings.push(
        `ปีนี้ใช้สิทธิ์ ${type.name} ไปแล้ว ${ctx.usedDaysThisYear} วัน ใบนี้อีก ${input.totalDays} วัน ` +
          `รวม ${totalAfter} วัน เกินโควตา ${type.max_days_per_year} วัน/ปี`,
      );
    }
  }

  return {
    blocked,
    warnings,
    noticeDays: notice,
    serviceMonths: months,
    countsAsAbsent,
    isLateNotice,
    penaltyMultiplier: isLateNotice ? Number(type.late_penalty_multiplier) : 0,
    certDueDate,
  };
}

// ---------- ตัดสินใบแจ้งลา ----------

export type LeaveDecisionInput = {
  status: LeaveStatus;
  note: string;
  reasonId: string | null;
};

/** ใบนี้ยังตัดสินได้ไหม — "อนุมัติแต่ขอหลักฐานเพิ่ม" ยังตัดสินซ้ำได้เมื่อหลักฐานมาครบ */
export function canDecideLeave(status: LeaveStatus): boolean {
  return status === "pending" || status === "need_docs";
}

export function validateLeaveDecision(
  row: LeaveRequestRow,
  input: LeaveDecisionInput,
): string | null {
  if (!canDecideLeave(row.status)) {
    return row.status === "cancelled"
      ? `ใบ ${row.doc_no} ถูกยกเลิกไปแล้ว ตัดสินไม่ได้`
      : `ใบ ${row.doc_no} ตัดสินไปแล้ว ตัดสินซ้ำไม่ได้`;
  }
  if (!LEAVE_DECISION_ORDER.includes(input.status)) return "กรุณาเลือกผลการพิจารณา";
  if (input.status === "rejected" && !input.reasonId) return "กรุณาเลือกเหตุผลที่ไม่อนุมัติ";
  if (input.status === "need_docs" && !input.note.trim()) {
    return "กรุณาระบุในหมายเหตุว่าต้องการหลักฐานอะไรเพิ่ม";
  }
  return null;
}

/** ใบลาป่วยที่เลยกำหนดส่งใบรับรองแพทย์แล้วและยังไม่ได้ส่ง */
export function isCertOverdue(row: LeaveRequestRow, today: string): boolean {
  if (!row.cert_due_date || row.cert_received || row.cert_count > 0) return false;
  if (row.status === "rejected" || row.status === "cancelled") return false;
  return today > row.cert_due_date;
}

/** เหลือกี่วันถึงกำหนดส่งใบรับรองแพทย์ (ลบ = เลยกำหนดมาแล้ว · null = ไม่ต้องส่ง/ส่งแล้ว) */
export function certDaysLeft(row: LeaveRequestRow, today: string): number | null {
  if (!row.cert_due_date || row.cert_received || row.cert_count > 0) return null;
  return daysBetween(today, row.cert_due_date);
}

// ---------- ยื่นใบขอเบิกเงินเดือน ----------

export type AdvanceInput = {
  purpose: string;
  detail: string;
  amount: number;
};

export function validateAdvanceInput(input: AdvanceInput): string | null {
  if (!input.purpose.trim()) return "กรุณากรอกว่าขอเบิกเพื่ออะไร";
  if (input.amount <= 0) return "กรุณากรอกยอดเงินที่ขอเบิกให้มากกว่า 0";
  if (input.amount > 1_000_000) return "ยอดเงินสูงผิดปกติ กรุณาตรวจสอบอีกครั้ง";
  return null;
}

// ---------- ตัดสินใบขอเบิกเงินเดือน ----------

export type AdvanceDecisionInput = {
  status: AdvanceStatus;
  approvedAmount: number;
  note: string;
  reasonId: string | null;
};

export function canDecideAdvance(status: AdvanceStatus): boolean {
  return status === "pending";
}

/** ยอดที่จะบันทึกว่าอนุมัติให้เบิกจริง */
export function resolveApprovedAmount(row: AdvanceRequestRow, input: AdvanceDecisionInput): number {
  if (input.status === "approved") return round2(row.amount);
  if (input.status === "partial") return round2(input.approvedAmount);
  return 0;
}

/**
 * ตรวจว่าตัดสินแบบนี้ได้ไหม
 * `authority` มาจากกฎอำนาจอนุมัติกลาง (apv_limits) ของเรื่อง "ขอเบิกเงินเดือนล่วงหน้า"
 * ส่ง null เข้ามาได้ถ้าไม่ต้องการคุมวงเงิน
 */
export function validateAdvanceDecision(
  row: AdvanceRequestRow,
  input: AdvanceDecisionInput,
  authority: Authority | null,
): string | null {
  if (!canDecideAdvance(row.status)) {
    return row.status === "cancelled"
      ? `ใบ ${row.doc_no} ถูกยกเลิกไปแล้ว ตัดสินไม่ได้`
      : `ใบ ${row.doc_no} ตัดสินไปแล้ว ตัดสินซ้ำไม่ได้`;
  }
  if (!ADVANCE_DECISION_ORDER.includes(input.status)) return "กรุณาเลือกผลการพิจารณา";

  if (input.status === "rejected") {
    if (!input.reasonId) return "กรุณาเลือกเหตุผลที่ไม่อนุมัติ";
    return null;
  }

  if (input.status === "partial") {
    if (input.approvedAmount <= 0) return "กรุณาระบุยอดที่อนุมัติให้มากกว่า 0";
    if (input.approvedAmount >= row.amount) {
      return 'ยอดที่อนุมัติเท่ากับหรือมากกว่าที่ขอ — ถ้าให้เต็มจำนวนให้เลือก "อนุมัติ" แทน';
    }
  }

  if (authority) {
    const amount = resolveApprovedAmount(row, input);
    if (!withinLimit(authority, amount)) {
      const limit = authority.maxAmount ?? 0;
      return (
        `ยอด ${amount.toLocaleString("th-TH")} บาท เกินอำนาจอนุมัติของคุณ ` +
        `(${limit.toLocaleString("th-TH")} บาท) — ให้ผู้มีอำนาจสูงกว่าเป็นผู้ตัดสิน`
      );
    }
  }
  return null;
}

// ---------- ข้อความบนหน้าจอ ----------

/** "จ. 5 ก.ย. 2569" หรือ "5–7 ก.ย." แบบเต็มสองวัน */
export function leaveRangeText(row: {
  start_date: string;
  end_date: string;
  arrival_time: string | null;
  needs_arrival_time?: boolean;
}): string {
  if (row.arrival_time) {
    return `${formatThaiDate(row.start_date)} · มาถึงประมาณ ${row.arrival_time.slice(0, 5)} น.`;
  }
  if (row.start_date === row.end_date) return formatThaiDate(row.start_date);
  return `${formatThaiDate(row.start_date)} – ${formatThaiDate(row.end_date)}`;
}

/** ธงเตือนที่ต้องเห็นทั้งในลิสต์และหน้าอนุมัติ */
export function leaveFlags(row: LeaveRequestRow, today: string): string[] {
  const flags: string[] = [];
  if (row.counts_as_absent) flags.push("ถือเป็นขาดงาน (แจ้งล่วงหน้าไม่ครบ)");
  if (row.is_late_notice) {
    flags.push(`แจ้งช้า — หักเงิน ${Number(row.penalty_multiplier)} เท่าของค่าจ้าง`);
  }
  if (isCertOverdue(row, today)) {
    flags.push(`เลยกำหนดส่งใบรับรองแพทย์ (${formatThaiDate(row.cert_due_date as string)})`);
  } else {
    const left = certDaysLeft(row, today);
    if (left !== null) flags.push(`ต้องส่งใบรับรองแพทย์ภายใน ${left} วัน`);
  }
  return flags;
}

/** จัดกลุ่มรายการตามบริษัท เพื่อให้หน้าอนุมัติแยกดูทีละบริษัทได้ */
export function groupByCompany<T extends { company_id: string | null; company_name: string | null }>(
  rows: T[],
): { companyId: string | null; companyName: string; rows: T[] }[] {
  const groups = new Map<string, { companyId: string | null; companyName: string; rows: T[] }>();

  for (const row of rows) {
    const key = row.company_id ?? "";
    const group = groups.get(key) ?? {
      companyId: row.company_id,
      companyName: row.company_name ?? "ไม่ระบุบริษัท",
      rows: [],
    };
    group.rows.push(row);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => a.companyName.localeCompare(b.companyName, "th"));
}

export type LeaveInboxSummary = {
  pending: number;
  absent: number;
  penalty: number;
  certOverdue: number;
};

export function summarizeLeaveInbox(rows: LeaveRequestRow[], today: string): LeaveInboxSummary {
  return {
    pending: rows.filter((r) => r.status === "pending").length,
    absent: rows.filter((r) => r.counts_as_absent).length,
    penalty: rows.filter((r) => r.is_late_notice).length,
    certOverdue: rows.filter((r) => isCertOverdue(r, today)).length,
  };
}

export type AdvanceInboxSummary = {
  pending: number;
  totalRequested: number;
};

export function summarizeAdvanceInbox(rows: AdvanceRequestRow[]): AdvanceInboxSummary {
  const open = rows.filter((r) => r.status === "pending");
  return {
    pending: open.length,
    totalRequested: round2(open.reduce((sum, r) => sum + r.amount, 0)),
  };
}

// ---------- หน้าจอสอบถาม / รายงาน / Dashboard (ทุกสถานะ ไม่จำกัดแค่ที่รออนุมัติ) ----------

/** กุญแจของหนึ่งกลุ่ม เอาไว้ groupby แบบไหนก็ได้ (บริษัท/สาขา/พนักงาน/ประเภทการลา) */
export type GroupKey = { key: string; label: string };

export function byCompanyKey(row: { company_id: string | null; company_name: string | null }): GroupKey {
  return { key: row.company_id ?? "none", label: row.company_name ?? "ไม่ระบุบริษัท" };
}

export function byBranchKey(row: { branch_id: string | null; branch_name: string | null }): GroupKey {
  return { key: row.branch_id ?? "none", label: row.branch_name ?? "ไม่ระบุสาขา" };
}

export function byEmployeeKey(row: { employee_id: string | null; employee_name: string }): GroupKey {
  return { key: row.employee_id ?? row.employee_name, label: row.employee_name };
}

export function byLeaveTypeKey(row: { type_id: string; type_icon: string | null; type_name: string }): GroupKey {
  return { key: row.type_id, label: [row.type_icon, row.type_name].filter(Boolean).join(" ") };
}

// ---------- ภาพรวมใบแจ้งลา (ทุกสถานะ) ----------

export type LeaveOverview = {
  total: number;
  byStatus: Record<LeaveStatus, number>;
  totalDays: number;
  absentCount: number;
  lateCount: number;
};

export function buildLeaveOverview(rows: LeaveRequestRow[]): LeaveOverview {
  const byStatus = Object.fromEntries(LEAVE_STATUS_ORDER.map((s) => [s, 0])) as Record<
    LeaveStatus,
    number
  >;
  let totalDays = 0;
  let absentCount = 0;
  let lateCount = 0;

  for (const row of rows) {
    byStatus[row.status] += 1;
    if (!row.arrival_time) totalDays += row.total_days;
    if (row.counts_as_absent) absentCount += 1;
    if (row.is_late_notice) lateCount += 1;
  }

  return { total: rows.length, byStatus, totalDays: round2(totalDays), absentCount, lateCount };
}

export type LeaveGroupSummary = GroupKey & {
  total: number;
  byStatus: Record<LeaveStatus, number>;
  totalDays: number;
  absentCount: number;
  lateCount: number;
};

/** จัดกลุ่มใบแจ้งลาตามกุญแจที่กำหนด (บริษัท/สาขา/พนักงาน/ประเภท) แล้วสรุปทีละกลุ่ม */
export function summarizeLeaveByKey(
  rows: LeaveRequestRow[],
  keyOf: (row: LeaveRequestRow) => GroupKey,
): LeaveGroupSummary[] {
  const groups = new Map<string, LeaveGroupSummary>();

  for (const row of rows) {
    const { key, label } = keyOf(row);
    const g =
      groups.get(key) ??
      ({
        key,
        label,
        total: 0,
        byStatus: Object.fromEntries(LEAVE_STATUS_ORDER.map((s) => [s, 0])) as Record<
          LeaveStatus,
          number
        >,
        totalDays: 0,
        absentCount: 0,
        lateCount: 0,
      } satisfies LeaveGroupSummary);

    g.total += 1;
    g.byStatus[row.status] += 1;
    if (!row.arrival_time) g.totalDays += row.total_days;
    if (row.counts_as_absent) g.absentCount += 1;
    if (row.is_late_notice) g.lateCount += 1;
    groups.set(key, g);
  }

  return [...groups.values()]
    .map((g) => ({ ...g, totalDays: round2(g.totalDays) }))
    .sort((a, b) => b.total - a.total);
}

// ---------- ภาพรวมใบขอเบิกเงิน (ทุกสถานะ) ----------

export type AdvanceOverview = {
  total: number;
  byStatus: Record<AdvanceStatus, number>;
  totalRequested: number;
  totalApproved: number;
};

export function buildAdvanceOverview(rows: AdvanceRequestRow[]): AdvanceOverview {
  const byStatus = Object.fromEntries(ADVANCE_STATUS_ORDER.map((s) => [s, 0])) as Record<
    AdvanceStatus,
    number
  >;
  let totalRequested = 0;
  let totalApproved = 0;

  for (const row of rows) {
    byStatus[row.status] += 1;
    totalRequested += row.amount;
    totalApproved += row.approved_amount;
  }

  return {
    total: rows.length,
    byStatus,
    totalRequested: round2(totalRequested),
    totalApproved: round2(totalApproved),
  };
}

export type AdvanceGroupSummary = GroupKey & {
  total: number;
  byStatus: Record<AdvanceStatus, number>;
  totalRequested: number;
  totalApproved: number;
};

/** จัดกลุ่มใบขอเบิกเงินตามกุญแจที่กำหนด แล้วสรุปทีละกลุ่ม */
export function summarizeAdvanceByKey(
  rows: AdvanceRequestRow[],
  keyOf: (row: AdvanceRequestRow) => GroupKey,
): AdvanceGroupSummary[] {
  const groups = new Map<string, AdvanceGroupSummary>();

  for (const row of rows) {
    const { key, label } = keyOf(row);
    const g =
      groups.get(key) ??
      ({
        key,
        label,
        total: 0,
        byStatus: Object.fromEntries(ADVANCE_STATUS_ORDER.map((s) => [s, 0])) as Record<
          AdvanceStatus,
          number
        >,
        totalRequested: 0,
        totalApproved: 0,
      } satisfies AdvanceGroupSummary);

    g.total += 1;
    g.byStatus[row.status] += 1;
    g.totalRequested += row.amount;
    g.totalApproved += row.approved_amount;
    groups.set(key, g);
  }

  return [...groups.values()]
    .map((g) => ({ ...g, totalRequested: round2(g.totalRequested), totalApproved: round2(g.totalApproved) }))
    .sort((a, b) => b.totalRequested - a.totalRequested);
}

/** N อันดับแรกที่เรียงจากมาก→น้อยด้วยคีย์ที่กำหนด (ใช้ทำอันดับพนักงานบน dashboard) */
export function topN<T>(rows: T[], by: (row: T) => number, n: number): T[] {
  return [...rows].sort((a, b) => by(b) - by(a)).slice(0, n);
}
