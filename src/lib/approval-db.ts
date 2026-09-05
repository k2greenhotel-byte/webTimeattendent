import "server-only";
import {
  applyDecision,
  AUTO_APPROVER_NAME,
  autoApprovable,
  autoApproveNote,
  type DecisionInput,
} from "./approval";
import type {
  ApvDecisionRow,
  ApvLimit,
  ApvRejectReason,
  ApvRequestRow,
  ApvStatus,
  ApvType,
} from "./approval-types";
import type { AccessLevel } from "./core-types";
import { logAudit } from "./db";
import { getSupabase } from "./supabase-server";

function beYearOf(date: string): number {
  return Number(date.slice(0, 4)) + 543;
}

async function nextDocNo(date: string): Promise<string> {
  // ใช้ตัวนับเลขที่เอกสารร่วมกับโมดูลจัดซื้อ (มีอยู่แล้ว) แค่เปลี่ยน prefix เป็น AV
  const { data, error } = await getSupabase().rpc("pr_next_doc_no", {
    doc_prefix: "AV",
    be_year: beYearOf(date),
  });
  if (error) throw new Error(`ออกเลขที่ใบขออนุมัติไม่สำเร็จ: ${error.message}`);
  return data as string;
}

// ---------- ประเภทเรื่อง ----------

export async function listTypes(activeOnly = false): Promise<ApvType[]> {
  let query = getSupabase().from("apv_types").select("*").order("sort_order").order("code");
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านประเภทเรื่องไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((t) => ({
    ...(t as ApvType),
    auto_approve_limit: t.auto_approve_limit === null ? null : Number(t.auto_approve_limit),
  }));
}

export async function insertType(row: Omit<ApvType, "id">): Promise<void> {
  const { error } = await getSupabase().from("apv_types").insert(row);
  if (error) {
    throw new Error(
      error.code === "23505" ? "รหัสประเภทเรื่องนี้ถูกใช้แล้ว" : `เพิ่มประเภทเรื่องไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function updateType(id: string, patch: Partial<ApvType>): Promise<void> {
  const { error } = await getSupabase().from("apv_types").update(patch).eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23505" ? "รหัสประเภทเรื่องนี้ถูกใช้แล้ว" : `บันทึกประเภทเรื่องไม่สำเร็จ: ${error.message}`,
    );
  }
}

/** ลบประเภทเรื่อง — มีใบขออยู่แล้วลบไม่ได้ (ฐานข้อมูลกันไว้ด้วย on delete restrict) */
export async function deleteType(id: string): Promise<void> {
  const { count } = await getSupabase()
    .from("apv_requests")
    .select("id", { count: "exact", head: true })
    .eq("type_id", id);

  if ((count ?? 0) > 0) {
    throw new Error(
      `ลบไม่ได้ มีใบขออนุมัติของเรื่องนี้อยู่ ${count} ใบ — ปิดใช้งานแทนได้ (ติ๊ก "เปิดใช้งาน" ออก)`,
    );
  }

  const { error } = await getSupabase().from("apv_types").delete().eq("id", id);
  if (error) throw new Error(`ลบประเภทเรื่องไม่สำเร็จ: ${error.message}`);
}

// ---------- เหตุผลไม่อนุมัติ ----------

export async function listRejectReasons(activeOnly = true): Promise<ApvRejectReason[]> {
  let query = getSupabase().from("apv_reject_reasons").select("*").order("sort_order");
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านเหตุผลการไม่อนุมัติไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as ApvRejectReason[];
}

export async function insertRejectReason(row: Omit<ApvRejectReason, "id">): Promise<void> {
  const { error } = await getSupabase().from("apv_reject_reasons").insert(row);
  if (error) {
    throw new Error(
      error.code === "23505" ? "รหัสเหตุผลนี้ถูกใช้แล้ว" : `เพิ่มเหตุผลไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function updateRejectReason(id: string, patch: Partial<ApvRejectReason>): Promise<void> {
  const { error } = await getSupabase().from("apv_reject_reasons").update(patch).eq("id", id);
  if (error) throw new Error(`บันทึกเหตุผลไม่สำเร็จ: ${error.message}`);
}

// ---------- กฎอำนาจอนุมัติ ----------

export async function listLimits(activeOnly = false): Promise<ApvLimit[]> {
  let query = getSupabase().from("apv_limits").select("*").order("created_at");
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านกฎอำนาจอนุมัติไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((l) => ({
    ...(l as ApvLimit),
    max_amount: l.max_amount === null ? null : Number(l.max_amount),
  }));
}

export async function insertLimit(row: Omit<ApvLimit, "id">): Promise<void> {
  const { error } = await getSupabase().from("apv_limits").insert(row);
  if (error) throw new Error(`เพิ่มกฎอำนาจอนุมัติไม่สำเร็จ: ${error.message}`);
}

export async function updateLimit(id: string, patch: Partial<ApvLimit>): Promise<void> {
  const { error } = await getSupabase().from("apv_limits").update(patch).eq("id", id);
  if (error) throw new Error(`บันทึกกฎอำนาจอนุมัติไม่สำเร็จ: ${error.message}`);
}

export async function deleteLimit(id: string): Promise<void> {
  const { error } = await getSupabase().from("apv_limits").delete().eq("id", id);
  if (error) throw new Error(`ลบกฎอำนาจอนุมัติไม่สำเร็จ: ${error.message}`);
}

/** ลบกฎเฉพาะบุคคลทั้งหมดของคนหนึ่งคน (= ถอนอำนาจอนุมัติ กลับไปใช้ค่าตามระดับ) */
export async function deleteLimitsOfUser(userId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from("apv_limits")
    .delete()
    .eq("user_id", userId)
    .select("id");
  if (error) throw new Error(`ถอนอำนาจอนุมัติไม่สำเร็จ: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * บันทึกอำนาจของคนหนึ่งคนทั้งชุด (จากฟอร์มเลือกคน → ติ๊กเรื่อง → ใส่วงเงิน)
 * ล้างกฎเดิมของคนนั้นทิ้งแล้วใส่ชุดใหม่ทั้งหมด จะได้ตรงกับหน้าจอเป๊ะ ไม่มีแถวค้าง
 */
export async function replaceUserLimits(userId: string, rows: Omit<ApvLimit, "id">[]): Promise<void> {
  await deleteLimitsOfUser(userId);
  if (rows.length === 0) return;
  const { error } = await getSupabase().from("apv_limits").insert(rows);
  if (error) throw new Error(`บันทึกอำนาจอนุมัติไม่สำเร็จ: ${error.message}`);
}

// ---------- ใบขออนุมัติ ----------

function toRow(raw: Record<string, unknown>): ApvRequestRow {
  return {
    ...(raw as unknown as ApvRequestRow),
    requested_amount: Number(raw.requested_amount ?? 0),
    approved_amount: Number(raw.approved_amount ?? 0),
  };
}

export type RequestQuery = {
  statuses?: ApvStatus[];
  typeId?: string;
  companyId?: string | null;
  branchId?: string | null;
  requesterId?: string;
  from?: string;
  to?: string;
  keyword?: string;
  limit?: number;
};

export async function listRequests(query: RequestQuery = {}): Promise<ApvRequestRow[]> {
  let q = getSupabase().from("v_apv_requests").select("*");

  if (query.statuses?.length) q = q.in("status", query.statuses);
  if (query.typeId) q = q.eq("type_id", query.typeId);
  if (query.companyId) q = q.eq("company_id", query.companyId);
  if (query.branchId) q = q.eq("branch_id", query.branchId);
  if (query.requesterId) q = q.eq("requester_id", query.requesterId);
  if (query.from) q = q.gte("request_date", query.from);
  if (query.to) q = q.lte("request_date", query.to);

  const keyword = (query.keyword ?? "").trim();
  if (keyword) {
    q = q.or(
      `doc_no.ilike.%${keyword}%,subject.ilike.%${keyword}%,requester_name.ilike.%${keyword}%`,
    );
  }

  const { data, error } = await q
    .order("request_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 300);

  if (error) throw new Error(`อ่านใบขออนุมัติไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map(toRow);
}

export async function getRequest(id: string): Promise<ApvRequestRow | null> {
  const { data, error } = await getSupabase()
    .from("v_apv_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบขออนุมัติไม่สำเร็จ: ${error.message}`);
  return data ? toRow(data) : null;
}

export async function listDecisionsOf(requestId: string): Promise<ApvDecisionRow[]> {
  const { data, error } = await getSupabase()
    .from("apv_decisions")
    .select("*, apv_reject_reasons(name)")
    .eq("request_id", requestId)
    .order("seq");
  if (error) throw new Error(`อ่านประวัติการพิจารณาไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map((d) => ({
    ...(d as unknown as ApvDecisionRow),
    approved_amount: Number(d.approved_amount ?? 0),
    authority_limit: d.authority_limit === null ? null : Number(d.authority_limit),
    reason_name: (d.apv_reject_reasons as { name: string } | null)?.name ?? null,
  }));
}

/** จำนวนเรื่องที่คนนี้เคยเสนอขึ้นไปและยังไม่จบ */
export async function countEndorsedBy(userId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from("apv_decisions")
    .select("request_id, apv_requests!inner(status)")
    .eq("approver_id", userId)
    .eq("decision", "endorse")
    .eq("apv_requests.status", "endorsed");
  if (error) return 0;
  return new Set((data ?? []).map((d: { request_id: string }) => d.request_id)).size;
}

// ---------- API สำหรับโมดูลอื่นเรียกใช้ (จุดเชื่อมในอนาคต) ----------

export type NewRequest = {
  /** รหัสประเภทเรื่องใน apv_types เช่น LEAVE, MOTO_DISC (แอดมินเพิ่มเองได้จากหน้าจอ) */
  typeCode: string;
  subject: string;
  detail?: string | null;
  amount?: number;
  neededBy?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  requesterId: string;
  requesterName: string;
  /** จุดอ้างกลับไปยังเอกสารต้นทางของโมดูลที่เรียก (ไม่บังคับ) */
  sourceTable?: string | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
};

/**
 * สร้างใบขออนุมัติ — โมดูลอื่นเรียกฟังก์ชันนี้ได้เลยเมื่อพัฒนาเสร็จ
 * ไม่ต้องแก้ฐานข้อมูลของระบบอนุมัติ แค่ให้แอดมินเพิ่มประเภทเรื่องในหน้าตั้งค่าก่อน
 *
 *   await createApprovalRequest({
 *     typeCode: "MOTO_DISC", subject: `ส่วนลดใบจอง ${booking.doc_no}`,
 *     amount: 3000, requesterId: user.id, requesterName: user.full_name,
 *     sourceTable: "bk_bookings", sourceId: booking.id, sourceUrl: `/booking/bookings/${booking.id}`,
 *   });
 */
export async function createApprovalRequest(input: NewRequest): Promise<ApvRequestRow> {
  const supabase = getSupabase();

  const { data: type, error: typeError } = await supabase
    .from("apv_types")
    .select("id, is_active, name, has_amount, auto_approve_limit")
    .eq("code", input.typeCode)
    .maybeSingle();
  if (typeError) throw new Error(`อ่านประเภทเรื่องไม่สำเร็จ: ${typeError.message}`);
  if (!type) throw new Error(`ไม่พบประเภทเรื่องรหัส ${input.typeCode} — ให้แอดมินเพิ่มที่เมนูตั้งค่าประเภทเรื่องก่อน`);
  if (!type.is_active) throw new Error(`ประเภทเรื่อง "${type.name}" ถูกปิดใช้งานอยู่`);

  const today = new Date().toISOString().slice(0, 10);
  const row = {
    doc_no: await nextDocNo(today),
    type_id: type.id as string,
    company_id: input.companyId ?? null,
    branch_id: input.branchId ?? null,
    requester_id: input.requesterId,
    requester_name: input.requesterName,
    subject: input.subject,
    detail: input.detail ?? null,
    requested_amount: input.amount ?? 0,
    request_date: today,
    needed_by: input.neededBy ?? null,
    source_table: input.sourceTable ?? null,
    source_id: input.sourceId ?? null,
    source_url: input.sourceUrl ?? null,
  };

  const { data, error } = await supabase.from("apv_requests").insert(row).select("id").single();
  if (error) {
    throw new Error(
      error.code === "23505"
        ? "เอกสารนี้ยื่นขออนุมัติไปแล้ว"
        : `สร้างใบขออนุมัติไม่สำเร็จ: ${error.message}`,
    );
  }

  const created = await getRequest(data.id as string);
  if (!created) throw new Error("สร้างใบขออนุมัติแล้วแต่อ่านกลับไม่ได้");

  // ยอดไม่เกินวงเงินที่ไม่ต้องขออนุมัติ → ระบบอนุมัติให้เลย แต่ยังบันทึกประวัติการพิจารณาไว้
  // เหมือนคนตัดสิน (วันเวลา + ชื่อ "ระบบอนุมัติอัตโนมัติ") จะได้ตรวจย้อนหลังได้ว่าผ่านเพราะอะไร
  const autoLimit = type.auto_approve_limit === null ? null : Number(type.auto_approve_limit);
  if (autoApprovable({ has_amount: type.has_amount, auto_approve_limit: autoLimit }, row.requested_amount)) {
    await writeDecision(
      created,
      { decision: "approve", approvedAmount: 0, reasonId: null, note: autoApproveNote(autoLimit ?? 0) },
      { approverId: null, approverName: AUTO_APPROVER_NAME, approverLevel: null, authorityLimit: autoLimit },
      "apv_auto_approve",
    );
    return (await getRequest(created.id)) ?? created;
  }
  return created;
}

/** โมดูลอื่นอ่านสถานะอนุมัติของเอกสารตัวเองมาแสดง */
export async function getApprovalFor(
  sourceTable: string,
  sourceId: string,
): Promise<ApvRequestRow | null> {
  const { data, error } = await getSupabase()
    .from("v_apv_requests")
    .select("*")
    .eq("source_table", sourceTable)
    .eq("source_id", sourceId)
    .maybeSingle();
  if (error) throw new Error(`อ่านสถานะอนุมัติไม่สำเร็จ: ${error.message}`);
  return data ? toRow(data) : null;
}

/** อ่านทีเดียวหลายเอกสาร สำหรับหน้ารายการของโมดูลอื่น */
export async function listApprovalsFor(
  sourceTable: string,
  sourceIds: string[],
): Promise<Map<string, ApvRequestRow>> {
  if (sourceIds.length === 0) return new Map();

  const { data, error } = await getSupabase()
    .from("v_apv_requests")
    .select("*")
    .eq("source_table", sourceTable)
    .in("source_id", sourceIds);
  if (error) throw new Error(`อ่านสถานะอนุมัติไม่สำเร็จ: ${error.message}`);

  return new Map((data ?? []).map((r) => [String(r.source_id), toRow(r)]));
}

// ---------- ยื่นเรื่อง / ยกเลิก ----------

export async function cancelRequest(id: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("apv_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("requester_id", userId)
    .in("status", ["pending", "endorsed"]);
  if (error) throw new Error(`ยกเลิกเรื่องไม่สำเร็จ: ${error.message}`);
}

// ---------- บันทึกการตัดสิน (ผู้เขียนสถานะเพียงตัวเดียว) ----------

export type DecisionContext = {
  /** null = ระบบตัดสินเอง (อนุมัติอัตโนมัติ) */
  approverId: string | null;
  approverName: string;
  approverLevel: AccessLevel | null;
  authorityLimit: number | null;
};

/**
 * บันทึกการพิจารณาหนึ่งครั้ง แล้วปรับสถานะใบขอตามกฎใน approval.ts
 * ฟังก์ชันนี้เป็นที่เดียวที่เขียน apv_requests.status — ที่อื่นห้ามเขียนเอง
 */
export async function createDecision(
  row: ApvRequestRow,
  input: DecisionInput,
  context: DecisionContext,
): Promise<void> {
  await writeDecision(row, input, context, "apv_decision");
}

async function writeDecision(
  row: ApvRequestRow,
  input: DecisionInput,
  context: DecisionContext,
  auditAction: "apv_decision" | "apv_auto_approve",
): Promise<void> {
  const supabase = getSupabase();
  const seq = (row.decision_count ?? 0) + 1;

  const { error: decisionError } = await supabase.from("apv_decisions").insert({
    request_id: row.id,
    seq,
    decision: input.decision,
    approver_id: context.approverId,
    approver_name: context.approverName,
    approver_level: context.approverLevel,
    approved_amount: input.decision === "partial" ? input.approvedAmount : 0,
    reason_id: input.reasonId,
    note: input.note || null,
    authority_limit: context.authorityLimit,
  });
  if (decisionError) throw new Error(`บันทึกการพิจารณาไม่สำเร็จ: ${decisionError.message}`);

  const patch = applyDecision(row, input, { id: context.approverId, name: context.approverName });
  const { error: updateError } = await supabase.from("apv_requests").update(patch).eq("id", row.id);
  if (updateError) {
    throw new Error(
      `บันทึกการพิจารณาแล้ว แต่ปรับสถานะใบขอไม่สำเร็จ: ${updateError.message} — กรุณาแจ้งผู้ดูแลระบบ`,
    );
  }

  await logAudit({
    actor_id: context.approverId,
    action: auditAction,
    target_table: "apv_requests",
    target_id: row.id,
    after: {
      doc_no: row.doc_no,
      decision: input.decision,
      status: patch.status,
      approved_amount: patch.approved_amount,
      authority_limit: context.authorityLimit,
    },
  });
}

// ---------- ใบขอซ่อม/ขอซื้อจากโมดูลจัดซื้อ (แสดงรวมในกล่องเดียวกัน) ----------

export type PrPendingRow = {
  id: string;
  kind: "repair" | "purchase";
  doc_no: string;
  doc_date: string;
  item_name: string;
  created_by_name: string | null;
  requested_amount: number;
  branch_name: string | null;
};

/**
 * ใบขอซ่อม/ขอซื้อที่ยังรออนุมัติในโมดูล PR (อ่านอย่างเดียว)
 * โมดูล PR เป็นของอีกทีม ถ้าเขาแก้โครงสร้างจนอ่านไม่ได้ ให้คืนลิสต์ว่างแทนที่จะทำทั้งหน้าพัง
 */
export async function listPrPending(): Promise<{ rows: PrPendingRow[]; failed: boolean }> {
  try {
    const { data, error } = await getSupabase()
      .from("v_pr_docs")
      .select("id, kind, doc_no, doc_date, item_name, created_by_name, requested_amount, branch_name")
      .eq("approve_status", "pending")
      .eq("doc_status", "active")
      .order("doc_date", { ascending: false })
      .limit(100);

    if (error) return { rows: [], failed: true };
    return {
      rows: (data ?? []).map((d) => ({
        ...(d as unknown as PrPendingRow),
        requested_amount: Number(d.requested_amount ?? 0),
      })),
      failed: false,
    };
  } catch {
    return { rows: [], failed: true };
  }
}
