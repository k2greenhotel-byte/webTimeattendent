import "server-only";
import { logAudit } from "./db";
import type { LeaveAdminEdit, LeaveDecisionInput, AdvanceDecisionInput } from "./leave";
import { entitlementKey, resolveApprovedAmount, summarizeEntitlement, type LeaveEntitlementSummary } from "./leave";
import type {
  AdvanceRequestRow,
  AdvanceStatus,
  LeaveFile,
  LeaveFileKind,
  LeaveRequestRow,
  LeaveStatus,
  LeaveType,
} from "./leave-types";
import { getSupabase, MEMO_BUCKET } from "./supabase-server";

function beYearOf(date: string): number {
  return Number(date.slice(0, 4)) + 543;
}

/** ใช้ตัวนับเลขที่เอกสารร่วมกับโมดูลจัดซื้อ/อนุมัติกลาง แค่เปลี่ยน prefix (LV = ใบลา, AD = ใบขอเบิก) */
async function nextDocNo(prefix: "LV" | "AD", date: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("pr_next_doc_no", {
    doc_prefix: prefix,
    be_year: beYearOf(date),
  });
  if (error) throw new Error(`ออกเลขที่เอกสารไม่สำเร็จ: ${error.message}`);
  return data as string;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

// ---------- ประเภทการลา ----------

function toType(raw: Record<string, unknown>): LeaveType {
  return {
    ...(raw as unknown as LeaveType),
    late_penalty_multiplier: num(raw.late_penalty_multiplier),
    max_days_per_year: raw.max_days_per_year === null ? null : num(raw.max_days_per_year),
  };
}

export async function listLeaveTypes(activeOnly = false): Promise<LeaveType[]> {
  let query = getSupabase().from("hr_leave_types").select("*").order("sort_order").order("code");
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(`อ่านประเภทการลาไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map(toType);
}

export async function insertLeaveType(row: Omit<LeaveType, "id">): Promise<void> {
  const { error } = await getSupabase().from("hr_leave_types").insert(row);
  if (error) {
    throw new Error(
      error.code === "23505" ? "รหัสประเภทการลานี้ถูกใช้แล้ว" : `เพิ่มประเภทการลาไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function updateLeaveType(id: string, patch: Partial<LeaveType>): Promise<void> {
  const { error } = await getSupabase().from("hr_leave_types").update(patch).eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23505" ? "รหัสประเภทการลานี้ถูกใช้แล้ว" : `บันทึกประเภทการลาไม่สำเร็จ: ${error.message}`,
    );
  }
}

/** ลบประเภทการลา — มีใบแจ้งอยู่แล้วลบไม่ได้ (ฐานข้อมูลกันไว้ด้วย on delete restrict) */
export async function deleteLeaveType(id: string): Promise<void> {
  const { count } = await getSupabase()
    .from("hr_leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("type_id", id);

  if ((count ?? 0) > 0) {
    throw new Error(
      `ลบไม่ได้ มีใบแจ้งลาของประเภทนี้อยู่ ${count} ใบ — ปิดใช้งานแทนได้ (ติ๊ก "เปิดใช้งาน" ออก)`,
    );
  }

  const { error } = await getSupabase().from("hr_leave_types").delete().eq("id", id);
  if (error) throw new Error(`ลบประเภทการลาไม่สำเร็จ: ${error.message}`);
}

// ---------- ข้อมูลพนักงานที่กฎธุรกิจต้องใช้ ----------

/** วันเริ่มงาน ใช้คำนวณอายุงานตอนตรวจสิทธิ์ลากิจ/ลาพักร้อน */
export async function getHireDate(employeeId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("employees")
    .select("hire_date")
    .eq("id", employeeId)
    .maybeSingle();
  if (error) return null;
  return (data?.hire_date as string | null) ?? null;
}

/** วันลาประเภทนี้ที่ใช้ไปแล้วในปีปฏิทิน (นับเฉพาะใบที่ไม่ถูกปฏิเสธ/ยกเลิก) */
export async function usedLeaveDays(
  employeeId: string,
  typeId: string,
  year: number,
): Promise<number> {
  const { data, error } = await getSupabase()
    .from("hr_leave_requests")
    .select("total_days")
    .eq("employee_id", employeeId)
    .eq("type_id", typeId)
    .in("status", ["pending", "need_docs", "escalated", "approved_hr", "approved_exec"])
    .gte("start_date", `${year}-01-01`)
    .lte("start_date", `${year}-12-31`);
  if (error) return 0;
  return (data ?? []).reduce((sum, r) => sum + num(r.total_days), 0);
}

// ---------- สิทธิ์การลารายบุคคล (โควตา) ----------

/** ค่าที่ตั้งเฉพาะคนของหลายพนักงานพร้อมกัน ปีเดียวกัน (type_id -> วันที่ได้รับ) — ใช้ในหน้าตั้งค่า */
export async function listEntitlementsForEmployees(
  employeeIds: string[],
  year: number,
): Promise<Map<string, Record<string, number>>> {
  const map = new Map<string, Record<string, number>>();
  if (employeeIds.length === 0) return map;

  const { data, error } = await getSupabase()
    .from("hr_leave_entitlements")
    .select("employee_id, type_id, granted_days")
    .in("employee_id", employeeIds)
    .eq("year", year);
  if (error) throw new Error(`อ่านสิทธิ์การลาไม่สำเร็จ: ${error.message}`);

  for (const row of data ?? []) {
    const empId = row.employee_id as string;
    const rec = map.get(empId) ?? {};
    rec[row.type_id as string] = num(row.granted_days);
    map.set(empId, rec);
  }
  return map;
}

/** วันลาที่ใช้ไปแล้วของหลายพนักงานพร้อมกัน ปีเดียวกัน (type_id -> วันที่ใช้ไป) */
export async function usedLeaveDaysBulk(
  employeeIds: string[],
  year: number,
): Promise<Map<string, Record<string, number>>> {
  const map = new Map<string, Record<string, number>>();
  if (employeeIds.length === 0) return map;

  const { data, error } = await getSupabase()
    .from("hr_leave_requests")
    .select("employee_id, type_id, total_days")
    .in("employee_id", employeeIds)
    .in("status", ["pending", "need_docs", "escalated", "approved_hr", "approved_exec"])
    .gte("start_date", `${year}-01-01`)
    .lte("start_date", `${year}-12-31`);
  if (error) throw new Error(`อ่านวันลาที่ใช้ไปไม่สำเร็จ: ${error.message}`);

  for (const row of data ?? []) {
    const empId = row.employee_id as string | null;
    if (!empId) continue;
    const rec = map.get(empId) ?? {};
    const typeId = row.type_id as string;
    rec[typeId] = (rec[typeId] ?? 0) + num(row.total_days);
    map.set(empId, rec);
  }
  return map;
}

/** บันทึกสิทธิ์เฉพาะคน — grantedDays เป็น null = ลบค่าที่ตั้งไว้ กลับไปใช้โควตาเริ่มต้นของประเภท */
export async function upsertEntitlement(
  employeeId: string,
  typeId: string,
  year: number,
  grantedDays: number | null,
): Promise<void> {
  const supabase = getSupabase();

  if (grantedDays === null) {
    const { error } = await supabase
      .from("hr_leave_entitlements")
      .delete()
      .eq("employee_id", employeeId)
      .eq("type_id", typeId)
      .eq("year", year);
    if (error) throw new Error(`ลบสิทธิ์การลาไม่สำเร็จ: ${error.message}`);
    return;
  }

  const { error } = await supabase
    .from("hr_leave_entitlements")
    .upsert(
      { employee_id: employeeId, type_id: typeId, year, granted_days: grantedDays },
      { onConflict: "employee_id,type_id,year" },
    );
  if (error) throw new Error(`บันทึกสิทธิ์การลาไม่สำเร็จ: ${error.message}`);
}

/**
 * สรุปสิทธิ์คงเหลือ (ได้รับ/ใช้ไป/คงเหลือ) ของหลายใบแจ้งลาพร้อมกัน — ใช้ในหน้าอนุมัติ/หน้าฝ่ายบุคคล
 * ที่แสดงหลายใบในหน้าเดียว จึง query รวมทีเดียวแทนการ query ทีละใบ
 * คืนเป็น map คีย์จาก entitlementKey(employeeId, typeId, year)
 */
export async function bulkEntitlementInfo(
  rows: { employeeId: string | null; typeId: string; year: number }[],
  typeDefaults: Record<string, number | null>,
): Promise<Map<string, LeaveEntitlementSummary>> {
  const result = new Map<string, LeaveEntitlementSummary>();

  const employeeIdsByYear = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!r.employeeId) continue;
    const set = employeeIdsByYear.get(r.year) ?? new Set<string>();
    set.add(r.employeeId);
    employeeIdsByYear.set(r.year, set);
  }

  for (const [year, employeeIdSet] of employeeIdsByYear) {
    const employeeIds = [...employeeIdSet];
    const [entitlements, used] = await Promise.all([
      listEntitlementsForEmployees(employeeIds, year),
      usedLeaveDaysBulk(employeeIds, year),
    ]);

    for (const r of rows) {
      if (!r.employeeId || r.year !== year) continue;
      const key = entitlementKey(r.employeeId, r.typeId, r.year);
      if (result.has(key)) continue;
      const granted = entitlements.get(r.employeeId)?.[r.typeId] ?? typeDefaults[r.typeId] ?? null;
      const usedDays = used.get(r.employeeId)?.[r.typeId] ?? 0;
      result.set(key, summarizeEntitlement(granted, usedDays));
    }
  }
  return result;
}

// ---------- ใบแจ้งลา ----------

function toLeaveRow(raw: Record<string, unknown>): LeaveRequestRow {
  return {
    ...(raw as unknown as LeaveRequestRow),
    total_days: num(raw.total_days),
    penalty_multiplier: num(raw.penalty_multiplier),
    notice_days: num(raw.notice_days),
    service_months: raw.service_months === null ? null : num(raw.service_months),
    file_count: num(raw.file_count),
    cert_count: num(raw.cert_count),
  };
}

export type LeaveQuery = {
  statuses?: LeaveStatus[];
  typeId?: string;
  companyId?: string | null;
  branchId?: string | null;
  employeeId?: string;
  from?: string;
  to?: string;
  keyword?: string;
  limit?: number;
};

export async function listLeaveRequests(query: LeaveQuery = {}): Promise<LeaveRequestRow[]> {
  let q = getSupabase().from("v_hr_leave_requests").select("*");

  if (query.statuses?.length) q = q.in("status", query.statuses);
  if (query.typeId) q = q.eq("type_id", query.typeId);
  if (query.companyId) q = q.eq("company_id", query.companyId);
  if (query.branchId) q = q.eq("branch_id", query.branchId);
  if (query.employeeId) q = q.eq("employee_id", query.employeeId);
  if (query.from) q = q.gte("start_date", query.from);
  if (query.to) q = q.lte("start_date", query.to);

  const keyword = (query.keyword ?? "").trim();
  if (keyword) {
    q = q.or(`doc_no.ilike.%${keyword}%,employee_name.ilike.%${keyword}%,detail.ilike.%${keyword}%`);
  }

  const { data, error } = await q
    .order("request_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 300);

  if (error) throw new Error(`อ่านใบแจ้งลาไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map(toLeaveRow);
}

export async function getLeaveRequest(id: string): Promise<LeaveRequestRow | null> {
  const { data, error } = await getSupabase()
    .from("v_hr_leave_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบแจ้งลาไม่สำเร็จ: ${error.message}`);
  return data ? toLeaveRow(data) : null;
}

export type NewLeaveRequest = {
  typeId: string;
  detail: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  arrivalTime: string | null;
  employeeId: string;
  employeeName: string;
  companyId: string | null;
  branchId: string | null;
  requestDate: string;
  reportedAt: Date;
  noticeDays: number;
  serviceMonths: number | null;
  countsAsAbsent: boolean;
  isLateNotice: boolean;
  penaltyMultiplier: number;
  certDueDate: string | null;
  files: NewLeaveFile[];
};

export type NewLeaveFile = {
  kind: LeaveFileKind;
  path: string;
  filename: string | null;
  mime: string | null;
  size: number | null;
};

export async function createLeaveRequest(input: NewLeaveRequest): Promise<LeaveRequestRow> {
  const supabase = getSupabase();

  const row = {
    doc_no: await nextDocNo("LV", input.requestDate),
    request_date: input.requestDate,
    reported_at: input.reportedAt.toISOString(),
    employee_id: input.employeeId,
    employee_name: input.employeeName,
    company_id: input.companyId,
    branch_id: input.branchId,
    type_id: input.typeId,
    detail: input.detail || null,
    start_date: input.startDate,
    end_date: input.endDate,
    total_days: input.totalDays,
    arrival_time: input.arrivalTime,
    notice_days: input.noticeDays,
    service_months: input.serviceMonths,
    counts_as_absent: input.countsAsAbsent,
    is_late_notice: input.isLateNotice,
    penalty_multiplier: input.penaltyMultiplier,
    cert_due_date: input.certDueDate,
  };

  const { data, error } = await supabase.from("hr_leave_requests").insert(row).select("id").single();
  if (error) throw new Error(`บันทึกใบแจ้งลาไม่สำเร็จ: ${error.message}`);

  const id = data.id as string;
  await addLeaveFiles(id, input.files, input.employeeId);

  const created = await getLeaveRequest(id);
  if (!created) throw new Error("บันทึกใบแจ้งลาแล้วแต่อ่านกลับไม่ได้");
  return created;
}

export async function cancelLeaveRequest(id: string, employeeId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("hr_leave_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("employee_id", employeeId)
    .eq("status", "pending");
  if (error) throw new Error(`ยกเลิกใบแจ้งลาไม่สำเร็จ: ${error.message}`);
}

export type Approver = {
  id: string;
  name: string;
};

/**
 * บันทึกผลการพิจารณาใบแจ้งลา — ที่เดียวที่เขียน hr_leave_requests.status
 * (เขียนสถานะจากที่อื่นจะทำให้ประวัติ audit ไม่ครบ)
 */
export async function decideLeaveRequest(
  row: LeaveRequestRow,
  input: LeaveDecisionInput,
  approver: Approver,
): Promise<void> {
  const patch = {
    status: input.status,
    decided_at: new Date().toISOString(),
    decided_by: approver.id,
    decided_by_name: approver.name,
    decision_note: input.note || null,
    reason_id: input.status === "rejected_hr" || input.status === "rejected_exec" ? input.reasonId : null,
  };

  const { error } = await getSupabase().from("hr_leave_requests").update(patch).eq("id", row.id);
  if (error) throw new Error(`บันทึกผลการพิจารณาไม่สำเร็จ: ${error.message}`);

  await logAudit({
    actor_id: approver.id,
    action: "hr_leave_decision",
    target_table: "hr_leave_requests",
    target_id: row.id,
    before: { status: row.status },
    after: { doc_no: row.doc_no, status: input.status, note: input.note || null },
  });
}

export type LeaveAdminEditPatch = LeaveAdminEdit & {
  note: string;
  noticeDays: number;
  serviceMonths: number | null;
  countsAsAbsent: boolean;
  isLateNotice: boolean;
  penaltyMultiplier: number;
  certDueDate: string | null;
};

/**
 * ฝ่ายบุคคลแก้ไขใบแจ้งลาของพนักงานคนอื่น — กรณีพนักงานบันทึกเข้ามาผิดหรือแจ้งใช้สิทธิ์ผิดประเภท
 * แก้ได้ทุกฟิลด์ ทุกสถานะ (ไม่ใช่แค่ใบที่ยังเปิดอยู่เหมือนหน้าอนุมัติปกติ) — ที่เดียวที่ฝ่ายบุคคล
 * เขียนทับข้อมูลของพนักงานคนอื่นได้โดยตรง จึงเก็บ audit ทั้งค่าก่อน/หลังไว้เสมอ
 */
export async function adminUpdateLeaveRequest(
  row: LeaveRequestRow,
  edit: LeaveAdminEditPatch,
  actor: Approver,
): Promise<void> {
  const isDecision =
    edit.status === "approved_hr" ||
    edit.status === "approved_exec" ||
    edit.status === "rejected_hr" ||
    edit.status === "rejected_exec" ||
    edit.status === "need_docs" ||
    edit.status === "need_type_change" ||
    edit.status === "escalated";

  const patch = {
    type_id: edit.typeId,
    detail: edit.detail || null,
    start_date: edit.startDate,
    end_date: edit.endDate,
    total_days: edit.totalDays,
    arrival_time: edit.arrivalTime,
    status: edit.status,
    notice_days: edit.noticeDays,
    service_months: edit.serviceMonths,
    counts_as_absent: edit.countsAsAbsent,
    is_late_notice: edit.isLateNotice,
    penalty_multiplier: edit.penaltyMultiplier,
    cert_due_date: edit.certDueDate,
    decided_at: isDecision ? new Date().toISOString() : null,
    decided_by: isDecision ? actor.id : null,
    decided_by_name: isDecision ? actor.name : null,
    decision_note: edit.note || null,
    reason_id: edit.status === "rejected_hr" || edit.status === "rejected_exec" ? edit.reasonId : null,
  };

  const { error } = await getSupabase().from("hr_leave_requests").update(patch).eq("id", row.id);
  if (error) throw new Error(`บันทึกการแก้ไขไม่สำเร็จ: ${error.message}`);

  await logAudit({
    actor_id: actor.id,
    action: "hr_leave_admin_edit",
    target_table: "hr_leave_requests",
    target_id: row.id,
    before: {
      type_id: row.type_id,
      detail: row.detail,
      start_date: row.start_date,
      end_date: row.end_date,
      total_days: row.total_days,
      arrival_time: row.arrival_time,
      status: row.status,
    },
    after: { doc_no: row.doc_no, ...patch },
  });
}

/** ผู้อนุมัติกดรับทราบว่าใบรับรองแพทย์มาครบแล้ว */
export async function markCertReceived(
  id: string,
  received: boolean,
  actorId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("hr_leave_requests")
    .update({ cert_received: received })
    .eq("id", id);
  if (error) throw new Error(`บันทึกสถานะใบรับรองแพทย์ไม่สำเร็จ: ${error.message}`);

  await logAudit({
    actor_id: actorId,
    action: "hr_leave_cert",
    target_table: "hr_leave_requests",
    target_id: id,
    after: { cert_received: received },
  });
}

// ---------- ไฟล์แนบของใบแจ้งลา ----------

export async function listLeaveFiles(requestId: string): Promise<LeaveFile[]> {
  const { data, error } = await getSupabase()
    .from("hr_leave_files")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at");
  if (error) throw new Error(`อ่านไฟล์แนบไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as LeaveFile[];
}

export async function addLeaveFiles(
  requestId: string,
  files: NewLeaveFile[],
  uploadedBy: string | null,
): Promise<void> {
  if (files.length === 0) return;

  const { error } = await getSupabase().from("hr_leave_files").insert(
    files.map((f) => ({
      request_id: requestId,
      kind: f.kind,
      file_path: f.path,
      file_name: f.filename,
      mime: f.mime,
      size_bytes: f.size,
      uploaded_by: uploadedBy,
    })),
  );
  if (error) throw new Error(`บันทึกไฟล์แนบไม่สำเร็จ: ${error.message}`);
}

/** ลบไฟล์แนบ — ลบออกจากถังก่อน แล้วค่อยลบแถว ไม่งั้นไฟล์ค้างในถังโดยไม่มีใครรู้ */
export async function deleteLeaveFile(fileId: string, actorId: string): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("hr_leave_files")
    .select("file_path, request_id")
    .eq("id", fileId)
    .maybeSingle();

  if (data?.file_path) await removeHrFiles([data.file_path as string]);

  const { error } = await supabase.from("hr_leave_files").delete().eq("id", fileId);
  if (error) throw new Error(`ลบไฟล์แนบไม่สำเร็จ: ${error.message}`);

  await logAudit({
    actor_id: actorId,
    action: "hr_leave_file_delete",
    target_table: "hr_leave_files",
    target_id: fileId,
    before: { file_path: data?.file_path ?? null, request_id: data?.request_id ?? null },
  });
}

/** เส้นทางไฟล์: hr/{ชนิด}/{ปีเดือน}/{สุ่ม}.{นามสกุลเดิม} */
export function newHrFilePath(prefix: string, originalName = ""): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "") || "file";
  const ext = (originalName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = ext ? `.${ext.slice(0, 8)}` : "";
  return `hr/${safePrefix}/${ym}/${crypto.randomUUID()}${suffix}`;
}

export async function uploadHrFile(
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(MEMO_BUCKET)
    .upload(path, bytes, { contentType: contentType || "application/octet-stream", upsert: false });
  if (error) throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${error.message}`);
}

export async function removeHrFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await getSupabase()
      .storage.from(MEMO_BUCKET)
      .remove(paths.slice(i, i + 100));
    // ลบไฟล์ไม่สำเร็จไม่ควรบล็อกการลบข้อมูล แค่บันทึกไว้
    if (error) console.error("ลบไฟล์แนบของระบบขอลาไม่สำเร็จ:", error.message);
  }
}

/** signed URL ของไฟล์แนบ (ถังนี้เป็น private) */
export async function hrFileUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await getSupabase().storage.from(MEMO_BUCKET).createSignedUrl(path, 600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// ---------- ใบขอเบิกเงินเดือน ----------

function toAdvanceRow(raw: Record<string, unknown>): AdvanceRequestRow {
  return {
    ...(raw as unknown as AdvanceRequestRow),
    amount: num(raw.amount),
    approved_amount: num(raw.approved_amount),
  };
}

export type AdvanceQuery = {
  statuses?: AdvanceStatus[];
  companyId?: string | null;
  branchId?: string | null;
  employeeId?: string;
  from?: string;
  to?: string;
  keyword?: string;
  limit?: number;
};

export async function listAdvanceRequests(query: AdvanceQuery = {}): Promise<AdvanceRequestRow[]> {
  let q = getSupabase().from("v_hr_advance_requests").select("*");

  if (query.statuses?.length) q = q.in("status", query.statuses);
  if (query.companyId) q = q.eq("company_id", query.companyId);
  if (query.branchId) q = q.eq("branch_id", query.branchId);
  if (query.employeeId) q = q.eq("employee_id", query.employeeId);
  if (query.from) q = q.gte("request_date", query.from);
  if (query.to) q = q.lte("request_date", query.to);

  const keyword = (query.keyword ?? "").trim();
  if (keyword) {
    q = q.or(`doc_no.ilike.%${keyword}%,employee_name.ilike.%${keyword}%,purpose.ilike.%${keyword}%`);
  }

  const { data, error } = await q
    .order("request_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 300);

  if (error) throw new Error(`อ่านใบขอเบิกเงินไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map(toAdvanceRow);
}

export async function getAdvanceRequest(id: string): Promise<AdvanceRequestRow | null> {
  const { data, error } = await getSupabase()
    .from("v_hr_advance_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบขอเบิกเงินไม่สำเร็จ: ${error.message}`);
  return data ? toAdvanceRow(data) : null;
}

export type NewAdvanceRequest = {
  purpose: string;
  detail: string;
  amount: number;
  employeeId: string;
  employeeName: string;
  companyId: string | null;
  branchId: string | null;
  requestDate: string;
  /**
   * ยอดไม่เกินวงเงินที่ไม่ต้องขออนุมัติ (ตั้งที่ระบบอนุมัติกลาง) → บันทึกเป็นอนุมัติแล้วทันที
   * ผู้ตัดสิน = ระบบ (decided_by ว่าง) แต่ยังลงวันเวลาและหมายเหตุไว้ให้ตรวจย้อนหลังได้
   */
  autoApprove?: { approverName: string; note: string } | null;
};

export async function createAdvanceRequest(input: NewAdvanceRequest): Promise<AdvanceRequestRow> {
  const row = {
    doc_no: await nextDocNo("AD", input.requestDate),
    request_date: input.requestDate,
    requested_at: new Date().toISOString(),
    purpose: input.purpose,
    detail: input.detail || null,
    employee_id: input.employeeId,
    employee_name: input.employeeName,
    company_id: input.companyId,
    branch_id: input.branchId,
    amount: input.amount,
    ...(input.autoApprove
      ? {
          status: "approved" as const,
          approved_amount: input.amount,
          decided_at: new Date().toISOString(),
          decided_by: null,
          decided_by_name: input.autoApprove.approverName,
          decision_note: input.autoApprove.note,
        }
      : {}),
  };

  const { data, error } = await getSupabase()
    .from("hr_advance_requests")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(`บันทึกใบขอเบิกเงินไม่สำเร็จ: ${error.message}`);

  const created = await getAdvanceRequest(data.id as string);
  if (!created) throw new Error("บันทึกใบขอเบิกเงินแล้วแต่อ่านกลับไม่ได้");
  return created;
}

export async function cancelAdvanceRequest(id: string, employeeId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("hr_advance_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("employee_id", employeeId)
    .eq("status", "pending");
  if (error) throw new Error(`ยกเลิกใบขอเบิกเงินไม่สำเร็จ: ${error.message}`);
}

/** บันทึกผลการพิจารณาใบขอเบิกเงิน — ที่เดียวที่เขียน hr_advance_requests.status */
export async function decideAdvanceRequest(
  row: AdvanceRequestRow,
  input: AdvanceDecisionInput,
  approver: Approver,
): Promise<void> {
  const approved = resolveApprovedAmount(row, input);

  const patch = {
    status: input.status,
    approved_amount: approved,
    decided_at: new Date().toISOString(),
    decided_by: approver.id,
    decided_by_name: approver.name,
    decision_note: input.note || null,
    reason_id: input.status === "rejected" ? input.reasonId : null,
  };

  const { error } = await getSupabase().from("hr_advance_requests").update(patch).eq("id", row.id);
  if (error) throw new Error(`บันทึกผลการพิจารณาไม่สำเร็จ: ${error.message}`);

  await logAudit({
    actor_id: approver.id,
    action: "hr_advance_decision",
    target_table: "hr_advance_requests",
    target_id: row.id,
    before: { status: row.status },
    after: {
      doc_no: row.doc_no,
      status: input.status,
      requested: row.amount,
      approved_amount: approved,
    },
  });
}

// ---------- สรุปให้กล่องรออนุมัติกลาง (อ่านอย่างเดียว) ----------

export type HrPending = {
  leave: LeaveRequestRow[];
  advance: AdvanceRequestRow[];
  failed: boolean;
};

/**
 * ใบแจ้งลา/ใบขอเบิกที่ยังรออนุมัติ สำหรับแสดงรวมในกล่องรออนุมัติกลาง
 * โมดูลนี้เป็นเจ้าของสถานะเอง หน้ากลางแค่อ่านมาแสดงและลิงก์กลับมา
 * อ่านไม่ได้ให้คืนลิสต์ว่างแทนที่จะทำหน้ากลางพังทั้งหน้า
 */
export async function listHrPending(): Promise<HrPending> {
  try {
    const [leave, advance] = await Promise.all([
      listLeaveRequests({ statuses: ["pending"], limit: 100 }),
      listAdvanceRequests({ statuses: ["pending"], limit: 100 }),
    ]);
    return { leave, advance, failed: false };
  } catch {
    return { leave: [], advance: [], failed: true };
  }
}
