/**
 * กฎธุรกิจของระบบตรวจสอบบัญชีอยู่ในไฟล์นี้ที่เดียว — pure function ทั้งหมด (ไม่แตะฐานข้อมูล)
 * หน้าเว็บ server action รายงาน และ dashboard เรียกฟังก์ชันชุดเดียวกันหมด
 * ตัวเลขบนจอกับในรายงานจึงตรงกันเสมอ
 */
import {
  AUD_CALL_RESULT_ORDER,
  AUD_DOC_RESULT_ORDER,
  AUD_INFO_RESULT_ORDER,
  AUD_KIND_ORDER,
  AUD_RESULT_ORDER,
  AUD_STATUS_ORDER,
} from "./audit-types";
import type {
  AudAuditInput,
  AudAuditQuery,
  AudAuditRow,
  AudCheckKind,
  AudCheckQuery,
  AudCheckResultInput,
  AudCheckRow,
  AudCheckType,
  AudCheckTypeInput,
  AudDocTypeInput,
  AudInfoResult,
} from "./audit-types";

// ---------- ตรวจความถูกต้องของข้อมูลที่กรอก ----------

/** ใบคุมงาน: ต้องมีวันที่ทำงานและชื่อผู้ตรวจสอบเสมอ */
export function validateAudit(input: AudAuditInput): string | null {
  if (!input.audit_date) return "กรุณาเลือกวันที่ทำงาน";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.audit_date)) return "รูปแบบวันที่ทำงานไม่ถูกต้อง";
  if (!input.auditor_name.trim()) return "ไม่พบชื่อผู้ตรวจสอบ กรุณาออกจากระบบแล้วเข้าใหม่";
  return null;
}

/** ใบคุมงานที่ส่งผลแล้วหรือยกเลิกแล้ว ห้ามแก้ผลตรวจต่อ (ต้องเปิดกลับเป็น "กำลังตรวจ" ก่อน) */
export function isAuditEditable(status: AudAuditRow["status"]): boolean {
  return status === "draft";
}

/**
 * ผลตรวจรายรายการ — ตรวจเฉพาะช่องที่รายการตรวจชนิดนั้นเปิดใช้
 * (รายการที่ผู้ใช้เพิ่มเองอาจไม่มีช่องเอกสาร/ช่องโทร)
 */
export function validateCheckResult(
  input: AudCheckResultInput,
  type: Pick<AudCheckType, "has_docs" | "has_call" | "has_slip">,
): string | null {
  if (input.result === "wrong" && !(input.result_note ?? "").trim()) {
    return "ผลตรวจเป็น “ไม่ถูกต้อง” ต้องกรอกหมายเหตุว่าผิดตรงไหน";
  }

  if (type.has_docs && input.doc_result === "incomplete" && input.missing.length === 0) {
    return "เอกสารไม่ครบ ต้องเลือกอย่างน้อยหนึ่งรายการว่าขาดเอกสารอะไร";
  }

  if (type.has_call) {
    if (input.call_result === "contacted" && input.info_result === "pending") {
      return "ติดต่อลูกค้าได้แล้ว ต้องระบุด้วยว่าข้อมูลตรงหรือไม่ตรง";
    }
    if (input.info_result !== "pending" && input.info_result !== "match" && !(input.call_note ?? "").trim()) {
      return "ข้อมูลไม่ตรง ต้องกรอกหมายเหตุว่าไม่ตรงตรงไหน";
    }
  }

  if (type.has_slip && input.slip_result === "has" && input.slip_amount_result === "pending") {
    return "มีสลิปนำฝากแล้ว ต้องระบุด้วยว่ายอดเงินถูกต้องหรือไม่";
  }

  return null;
}

/** รายการที่ตรวจนี้ถือว่าตรวจเสร็จแล้วหรือยัง (ดูเฉพาะช่องที่เปิดใช้) */
export function isCheckDone(
  row: Pick<AudCheckRow, "result" | "doc_result" | "call_result" | "slip_result">,
  type: Pick<AudCheckType, "has_docs" | "has_call" | "has_slip">,
): boolean {
  if (row.result === "pending") return false;
  if (type.has_docs && row.doc_result === "pending") return false;
  if (type.has_call && row.call_result === "pending") return false;
  if (type.has_slip && row.slip_result === "pending") return false;
  return true;
}

export function validateDocType(input: AudDocTypeInput): string | null {
  if (!input.code.trim()) return "กรุณากรอกรหัสเอกสาร";
  if (!input.name.trim()) return "กรุณากรอกชื่อเอกสาร";
  if (input.code.length > 30) return "รหัสเอกสารยาวเกินไป (ไม่เกิน 30 ตัวอักษร)";
  return null;
}

export function validateCheckType(input: AudCheckTypeInput): string | null {
  if (!input.code.trim()) return "กรุณากรอกรหัสรายการตรวจ";
  if (!input.name.trim()) return "กรุณากรอกชื่อรายการตรวจ";
  if (input.code.length > 30) return "รหัสรายการตรวจยาวเกินไป (ไม่เกิน 30 ตัวอักษร)";
  if (!input.ref_label.trim() || !input.title_label.trim()) {
    return "กรุณากรอกชื่อช่องเลขที่เอกสารและช่องรายละเอียด";
  }
  return null;
}

// ---------- สรุปผลสำหรับหน้าจอสอบถาม รายงาน และ dashboard ----------

export type AudSummary = {
  /** จำนวนรายการที่ตรวจทั้งหมด */
  count: number;
  correct: number;
  wrong: number;
  pending: number;
  docComplete: number;
  docIncomplete: number;
  contacted: number;
  noContact: number;
  infoMatch: number;
  abnormal: number;
  branchError: number;
  slipHas: number;
  slipNone: number;
  slipAmountWrong: number;
  amountTotal: number;
  /** % ของรายการที่ตรวจแล้วและถูกต้อง (ไม่นับรายการที่ยังไม่ตรวจ) */
  correctPct: number;
};

const EMPTY_SUMMARY: AudSummary = {
  count: 0,
  correct: 0,
  wrong: 0,
  pending: 0,
  docComplete: 0,
  docIncomplete: 0,
  contacted: 0,
  noContact: 0,
  infoMatch: 0,
  abnormal: 0,
  branchError: 0,
  slipHas: 0,
  slipNone: 0,
  slipAmountWrong: 0,
  amountTotal: 0,
  correctPct: 0,
};

/** รวมยอดของรายการที่ตรวจหนึ่งชุด — ใช้ทั้งหน้าสอบถาม รายงาน และ dashboard */
export function summarizeChecks(rows: AudCheckRow[]): AudSummary {
  const s: AudSummary = { ...EMPTY_SUMMARY, count: rows.length };

  for (const r of rows) {
    if (r.result === "correct") s.correct += 1;
    else if (r.result === "wrong") s.wrong += 1;
    else s.pending += 1;

    if (r.doc_result === "complete") s.docComplete += 1;
    else if (r.doc_result === "incomplete") s.docIncomplete += 1;

    if (r.call_result === "contacted") s.contacted += 1;
    else if (r.call_result === "no_contact") s.noContact += 1;

    if (r.info_result === "match") s.infoMatch += 1;
    else if (r.info_result === "abnormal") s.abnormal += 1;
    else if (r.info_result === "branch_error") s.branchError += 1;

    if (r.slip_result === "has") s.slipHas += 1;
    else if (r.slip_result === "none") s.slipNone += 1;
    if (r.slip_amount_result === "wrong") s.slipAmountWrong += 1;

    s.amountTotal += r.amount ?? 0;
  }

  const judged = s.correct + s.wrong;
  s.correctPct = judged === 0 ? 0 : (s.correct / judged) * 100;
  return s;
}

/** สรุปใบคุมงานหนึ่งชุด (หน้ารายการและหน้าสอบถาม) */
export function summarizeAudits(rows: AudAuditRow[]): {
  count: number;
  draft: number;
  submitted: number;
  cancelled: number;
  checks: number;
  wrong: number;
  incomplete: number;
  mismatch: number;
} {
  const out = {
    count: rows.length,
    draft: 0,
    submitted: 0,
    cancelled: 0,
    checks: 0,
    wrong: 0,
    incomplete: 0,
    mismatch: 0,
  };

  for (const r of rows) {
    if (r.status === "draft") out.draft += 1;
    else if (r.status === "submitted") out.submitted += 1;
    else out.cancelled += 1;

    out.checks += r.check_count;
    out.wrong += r.wrong_count;
    out.incomplete += r.incomplete_count;
    out.mismatch += r.mismatch_count;
  }

  return out;
}

/** จัดกลุ่มรายการที่ตรวจตามคีย์ที่เลือก แล้วสรุปยอดของแต่ละกลุ่ม (เรียงมีปัญหามากสุดก่อน) */
export function groupChecks(
  rows: AudCheckRow[],
  keyOf: (row: AudCheckRow) => string | null | undefined,
  fallback = "— ไม่ระบุ —",
): { label: string; summary: AudSummary }[] {
  const buckets = new Map<string, AudCheckRow[]>();

  for (const row of rows) {
    const label = (keyOf(row) ?? "").trim() || fallback;
    const list = buckets.get(label);
    if (list) list.push(row);
    else buckets.set(label, [row]);
  }

  return [...buckets.entries()]
    .map(([label, list]) => ({ label, summary: summarizeChecks(list) }))
    .sort((a, b) => {
      const problemA = a.summary.wrong + a.summary.abnormal + a.summary.branchError;
      const problemB = b.summary.wrong + b.summary.abnormal + b.summary.branchError;
      if (problemB !== problemA) return problemB - problemA;
      return b.summary.count - a.summary.count;
    });
}

/** นับว่าเอกสารแต่ละชนิดขาดกี่ครั้ง (ข้อ 1.b.ii.1 — ใช้ในรายงานและ dashboard) */
export function countMissingDocs(rows: AudCheckRow[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const name of row.missing_docs ?? []) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
}

/** รายการที่ต้องตามต่อ = ตรวจแล้วผิด เอกสารไม่ครบ ติดต่อไม่ได้ หรือข้อมูลไม่ตรง */
export function isProblem(row: AudCheckRow): boolean {
  return (
    row.result === "wrong" ||
    row.doc_result === "incomplete" ||
    row.call_result === "no_contact" ||
    row.info_result === "abnormal" ||
    row.info_result === "branch_error" ||
    row.slip_result === "none" ||
    row.slip_amount_result === "wrong"
  );
}

/** สีพื้นของแถวในตาราง — ผิดปกติแดง สาขาสื่อสารผิดเหลือง ผลตรวจผิดแดงอ่อน */
export function rowTone(row: Pick<AudCheckRow, "info_result" | "result">): string {
  const byInfo: Record<AudInfoResult, string> = {
    abnormal: "bg-rose-50",
    branch_error: "bg-amber-50",
    match: "",
    pending: "",
  };
  if (byInfo[row.info_result]) return byInfo[row.info_result];
  return row.result === "wrong" ? "bg-rose-50" : "";
}

// ---------- จัดรูปตัวเลข ----------

export function formatBaht(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

/** ปี พ.ศ. ของเอกสาร — ใช้ตัดชุดเลขที่คุมงานรายปี */
export function beYearOf(date: string): number {
  return Number(date.slice(0, 4)) + 543;
}

/** ชื่อช่วงวันที่แบบอ่านง่ายสำหรับหัวรายงาน */
export function rangeLabel(from: string | null | undefined, to: string | null | undefined): string {
  if (from && to) return from === to ? from : `${from} ถึง ${to}`;
  if (from) return `ตั้งแต่ ${from}`;
  if (to) return `ถึง ${to}`;
  return "ทุกช่วงเวลา";
}

/** ชนิดของรายการตรวจนี้ดึงข้อมูลจากระบบอื่นได้หรือไม่ */
export function isPullable(kind: AudCheckKind): boolean {
  return kind === "sale" || kind === "payment";
}

// ---------- อ่านเงื่อนไขค้นหาจาก query string ----------

/** ค่าที่มาจาก query string ของหน้าจอ (ทุกค่าเป็นข้อความหรือไม่มี) */
export type AudParams = Record<string, string | undefined>;

function pickEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** เงื่อนไขค้นหาใบคุมงาน — หน้ารายการและหน้าสอบถามใช้ตัวเดียวกัน */
export function auditQueryFromParams(params: AudParams): AudAuditQuery {
  return {
    keyword: params.q?.trim() || undefined,
    company_id: params.company_id || null,
    branch_id: params.branch_id || null,
    auditor_id: params.auditor_id || null,
    status: pickEnum(params.status, AUD_STATUS_ORDER),
    from: params.from || null,
    to: params.to || null,
  };
}

/** เงื่อนไขค้นหารายเอกสารที่ตรวจ — หน้าสอบถาม รายงาน dashboard และไฟล์ export ใช้ตัวเดียวกัน */
export function checkQueryFromParams(params: AudParams): AudCheckQuery {
  return {
    keyword: params.q?.trim() || undefined,
    company_id: params.company_id || null,
    branch_id: params.branch_id || null,
    auditor_id: params.auditor_id || null,
    type_id: params.type_id || null,
    kind: pickEnum(params.kind, AUD_KIND_ORDER),
    result: pickEnum(params.result, AUD_RESULT_ORDER),
    doc_result: pickEnum(params.doc_result, AUD_DOC_RESULT_ORDER),
    call_result: pickEnum(params.call_result, AUD_CALL_RESULT_ORDER),
    info_result: pickEnum(params.info_result, AUD_INFO_RESULT_ORDER),
    audit_status: pickEnum(params.audit_status, AUD_STATUS_ORDER),
    from: params.from || null,
    to: params.to || null,
  };
}
