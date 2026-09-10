import "server-only";
import { beYearOf } from "./audit";
import type {
  AudAuditInput,
  AudAuditQuery,
  AudAuditRow,
  AudCheckKind,
  AudCheckQuery,
  AudCheckResultInput,
  AudCheckRow,
  AudCheckSource,
  AudCheckType,
  AudCheckTypeInput,
  AudCheckTypeRow,
  AudDocType,
  AudDocTypeInput,
  AudStatus,
} from "./audit-types";
import { getSupabase } from "./supabase-server";

/**
 * ทุก query ของระบบตรวจสอบบัญชีอยู่ในไฟล์นี้ไฟล์เดียว (server-only)
 * หน้าเว็บ/server action ห้ามเรียก supabase ตรง ๆ
 */

const DOC_PREFIX = "AUD";

function num(value: unknown): number {
  return Number(value ?? 0);
}

function nullableNum(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function dupMessage(error: { code?: string; message: string }, what: string): string {
  return error.code === "23505"
    ? "รหัสนี้ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น"
    : `บันทึก${what}ไม่สำเร็จ: ${error.message}`;
}

// ---------- ทะเบียนเอกสารประกอบ ----------

export async function listDocTypes(includeInactive = false): Promise<AudDocType[]> {
  let q = getSupabase().from("aud_doc_types").select("*");
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านทะเบียนเอกสารประกอบไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as unknown as AudDocType[];
}

export async function createDocType(input: AudDocTypeInput): Promise<void> {
  const { error } = await getSupabase().from("aud_doc_types").insert(input);
  if (error) throw new Error(dupMessage(error, "เอกสารประกอบ"));
}

export async function updateDocType(id: string, patch: Partial<AudDocTypeInput>): Promise<void> {
  const { error } = await getSupabase().from("aud_doc_types").update(patch).eq("id", id);
  if (error) throw new Error(dupMessage(error, "เอกสารประกอบ"));
}

export async function deleteDocType(id: string): Promise<void> {
  const { error } = await getSupabase().from("aud_doc_types").delete().eq("id", id);
  if (error) throw new Error(`ลบเอกสารประกอบไม่สำเร็จ: ${error.message}`);
}

// ---------- รายการตรวจสอบ (ข้อ 4 เพิ่ม/ลดได้เอง) ----------

function toCheckType(raw: Record<string, unknown>): AudCheckType {
  return raw as unknown as AudCheckType;
}

export async function listCheckTypes(includeInactive = false): Promise<AudCheckType[]> {
  let q = getSupabase().from("aud_check_types").select("*");
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านรายการตรวจสอบไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((r) => toCheckType(r as Record<string, unknown>));
}

export async function getCheckType(id: string): Promise<AudCheckType | null> {
  const { data, error } = await getSupabase()
    .from("aud_check_types")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านรายการตรวจสอบไม่สำเร็จ: ${error.message}`);
  return data ? toCheckType(data as Record<string, unknown>) : null;
}

/** รายการตรวจพร้อมจำนวนครั้งที่เคยใช้ — หน้าตั้งค่าใช้เตือนก่อนลบ */
export async function listCheckTypeRows(includeInactive = true): Promise<AudCheckTypeRow[]> {
  const types = await listCheckTypes(includeInactive);
  if (types.length === 0) return [];

  const { data, error } = await getSupabase()
    .from("aud_checks")
    .select("type_id")
    .in(
      "type_id",
      types.map((t) => t.id),
    );
  if (error) throw new Error(`นับการใช้งานรายการตรวจสอบไม่สำเร็จ: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { type_id: string | null }[]) {
    if (!row.type_id) continue;
    counts.set(row.type_id, (counts.get(row.type_id) ?? 0) + 1);
  }

  return types.map((t) => ({ ...t, use_count: counts.get(t.id) ?? 0 }));
}

export async function createCheckType(input: AudCheckTypeInput): Promise<void> {
  const { error } = await getSupabase().from("aud_check_types").insert(input);
  if (error) throw new Error(dupMessage(error, "รายการตรวจสอบ"));
}

export async function updateCheckType(id: string, patch: Partial<AudCheckTypeInput>): Promise<void> {
  const { error } = await getSupabase().from("aud_check_types").update(patch).eq("id", id);
  if (error) throw new Error(dupMessage(error, "รายการตรวจสอบ"));
}

export async function deleteCheckType(id: string): Promise<void> {
  const { error } = await getSupabase().from("aud_check_types").delete().eq("id", id);
  if (error) throw new Error(`ลบรายการตรวจสอบไม่สำเร็จ: ${error.message}`);
}

// ---------- ใบคุมงาน ----------

function toAuditRow(raw: Record<string, unknown>): AudAuditRow {
  return {
    ...(raw as unknown as AudAuditRow),
    check_count: num(raw.check_count),
    wrong_count: num(raw.wrong_count),
    incomplete_count: num(raw.incomplete_count),
    no_contact_count: num(raw.no_contact_count),
    mismatch_count: num(raw.mismatch_count),
    pending_count: num(raw.pending_count),
  };
}

export async function listAudits(query: AudAuditQuery = {}): Promise<AudAuditRow[]> {
  let q = getSupabase().from("v_aud_audits").select("*");

  const eq = {
    company_id: query.company_id,
    branch_id: query.branch_id,
    auditor_id: query.auditor_id,
    status: query.status,
  };
  for (const [column, value] of Object.entries(eq)) {
    if (value) q = q.eq(column, value);
  }

  if (query.from) q = q.gte("audit_date", query.from);
  if (query.to) q = q.lte("audit_date", query.to);

  const { data, error } = await q
    .order("audit_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 500);
  if (error) throw new Error(`อ่านรายการใบคุมงานไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => toAuditRow(r as Record<string, unknown>));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [r.doc_no, r.auditor_name, r.branch_name, r.company_name, r.note]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getAudit(id: string): Promise<AudAuditRow | null> {
  const { data, error } = await getSupabase()
    .from("v_aud_audits")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบคุมงานไม่สำเร็จ: ${error.message}`);
  return data ? toAuditRow(data as Record<string, unknown>) : null;
}

async function nextDocNo(date: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("aud_next_doc_no", {
    doc_prefix: DOC_PREFIX,
    be_year: beYearOf(date),
  });
  if (error) throw new Error(`ออกเลขที่คุมงานไม่สำเร็จ: ${error.message}`);
  return data as string;
}

export async function createAudit(input: AudAuditInput, createdBy: string | null): Promise<string> {
  const doc_no = await nextDocNo(input.audit_date);

  const { data, error } = await getSupabase()
    .from("aud_audits")
    .insert({ ...input, doc_no, created_by: createdBy })
    .select("id")
    .single();
  if (error) throw new Error(`เปิดใบคุมงานไม่สำเร็จ: ${error.message}`);
  return (data as { id: string }).id;
}

export async function updateAudit(id: string, patch: Partial<AudAuditInput>): Promise<void> {
  const { error } = await getSupabase().from("aud_audits").update(patch).eq("id", id);
  if (error) throw new Error(`บันทึกใบคุมงานไม่สำเร็จ: ${error.message}`);
}

export async function setAuditStatus(id: string, status: AudStatus): Promise<void> {
  const { error } = await getSupabase().from("aud_audits").update({ status }).eq("id", id);
  if (error) throw new Error(`เปลี่ยนสถานะใบคุมงานไม่สำเร็จ: ${error.message}`);
}

export async function deleteAudit(id: string): Promise<void> {
  // aud_checks และ aud_check_missing_docs ผูก on delete cascade ไว้แล้ว
  const { error } = await getSupabase().from("aud_audits").delete().eq("id", id);
  if (error) throw new Error(`ลบใบคุมงานไม่สำเร็จ: ${error.message}`);
}

// ---------- รายการที่ตรวจ ----------

function toCheckRow(raw: Record<string, unknown>): AudCheckRow {
  return {
    ...(raw as unknown as AudCheckRow),
    amount: nullableNum(raw.amount),
    slip_amount: nullableNum(raw.slip_amount),
    deposit_amount: nullableNum(raw.deposit_amount),
    missing_count: num(raw.missing_count),
    missing_docs: (raw.missing_docs as string[] | null) ?? [],
    extra: (raw.extra as AudCheckRow["extra"]) ?? {},
  };
}

/** รายการที่ตรวจของใบคุมงานหนึ่งใบ (หน้าจอบันทึก) */
export async function listChecks(auditId: string): Promise<AudCheckRow[]> {
  const { data, error } = await getSupabase()
    .from("v_aud_checks")
    .select("*")
    .eq("audit_id", auditId)
    .order("sort_order")
    .order("ref_no");
  if (error) throw new Error(`อ่านรายการที่ตรวจไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((r) => toCheckRow(r as Record<string, unknown>));
}

export async function getCheck(id: string): Promise<AudCheckRow | null> {
  const { data, error } = await getSupabase()
    .from("v_aud_checks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านรายการที่ตรวจไม่สำเร็จ: ${error.message}`);
  return data ? toCheckRow(data as Record<string, unknown>) : null;
}

/** รายการที่ตรวจตามเงื่อนไข — หน้าสอบถาม รายงาน และ dashboard ใช้ตัวนี้ตัวเดียว */
export async function listCheckRows(query: AudCheckQuery = {}): Promise<AudCheckRow[]> {
  let q = getSupabase().from("v_aud_checks").select("*");

  const eq = {
    company_id: query.company_id,
    branch_id: query.branch_id,
    auditor_id: query.auditor_id,
    type_id: query.type_id,
    kind: query.kind,
    result: query.result,
    doc_result: query.doc_result,
    call_result: query.call_result,
    info_result: query.info_result,
    audit_status: query.audit_status,
  };
  for (const [column, value] of Object.entries(eq)) {
    if (value) q = q.eq(column, value);
  }

  if (query.from) q = q.gte("audit_date", query.from);
  if (query.to) q = q.lte("audit_date", query.to);

  const { data, error } = await q
    .order("audit_date", { ascending: false })
    .order("audit_no", { ascending: false })
    .order("sort_order")
    .limit(query.limit ?? 2000);
  if (error) throw new Error(`อ่านผลการตรวจไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => toCheckRow(r as Record<string, unknown>));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [r.ref_no, r.title, r.party, r.branch_label, r.type_name, r.audit_no, r.auditor_name, r.result_note, r.call_note]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

/**
 * เอกสารต้นทางใบไหนถูกตรวจไปแล้วบ้าง (คู่ขนานกับตารางต้นทาง)
 * คืน map: เลขที่เอกสาร → เลขที่ใบคุมงานที่ตรวจไว้ — ใช้กันดึงซ้ำและบอกผู้ใช้ว่าตรวจแล้วที่ใบไหน
 */
export async function findCheckedRefs(
  kind: AudCheckKind,
  refs: string[],
): Promise<Map<string, string>> {
  const wanted = refs.filter(Boolean);
  if (wanted.length === 0) return new Map();

  const { data, error } = await getSupabase()
    .from("v_aud_checks")
    .select("ref_no, audit_no")
    .eq("kind", kind)
    .in("ref_no", wanted);
  if (error) throw new Error(`ตรวจรายการที่เคยตรวจแล้วไม่สำเร็จ: ${error.message}`);

  const map = new Map<string, string>();
  for (const row of (data ?? []) as { ref_no: string | null; audit_no: string }[]) {
    if (row.ref_no) map.set(row.ref_no, row.audit_no);
  }
  return map;
}

/**
 * เพิ่มรายการที่ต้องตรวจเข้าใบคุมงาน (ดึงจากระบบต้นทาง หรือผู้ใช้กรอกเอง)
 * ข้ามใบที่เคยตรวจไปแล้วให้เอง แล้วรายงานกลับว่าเพิ่มกี่ใบ ข้ามกี่ใบ
 */
export async function addChecks(
  auditId: string,
  sources: AudCheckSource[],
  checkedBy: string | null,
): Promise<{ added: number; skipped: string[] }> {
  if (sources.length === 0) return { added: 0, skipped: [] };

  const supabase = getSupabase();
  const skipped: string[] = [];

  // กันดึงซ้ำสำหรับชนิดที่ยึดเลขที่เอกสารต้นทาง (ขาย/เงินสดย่อย)
  const pullable = sources.filter((s) => s.ref_no && (s.kind === "sale" || s.kind === "payment"));
  const taken = new Map<string, string>();
  for (const kind of new Set(pullable.map((s) => s.kind))) {
    const refs = pullable.filter((s) => s.kind === kind).map((s) => s.ref_no as string);
    for (const [ref, auditNo] of await findCheckedRefs(kind, refs)) taken.set(`${kind}:${ref}`, auditNo);
  }

  const { data: last } = await supabase
    .from("aud_checks")
    .select("sort_order")
    .eq("audit_id", auditId)
    .order("sort_order", { ascending: false })
    .limit(1);
  let sortOrder = num((last?.[0] as { sort_order?: number } | undefined)?.sort_order) || 0;

  const rows = [];
  for (const s of sources) {
    const key = `${s.kind}:${s.ref_no}`;
    if (s.ref_no && taken.has(key)) {
      skipped.push(`${s.ref_no} (ตรวจแล้วในใบ ${taken.get(key)})`);
      continue;
    }
    sortOrder += 10;
    rows.push({
      audit_id: auditId,
      type_id: s.type_id,
      type_code: s.type_code,
      type_name: s.type_name,
      kind: s.kind,
      ref_no: s.ref_no,
      ref_date: s.ref_date,
      title: s.title,
      party: s.party,
      branch_label: s.branch_label,
      amount: s.amount,
      extra: s.extra,
      payment_id: s.payment_id,
      sort_order: sortOrder,
      checked_by: checkedBy,
    });
  }

  if (rows.length === 0) return { added: 0, skipped };

  const { error } = await supabase.from("aud_checks").insert(rows);
  if (error) {
    if (error.code === "23505") {
      throw new Error("มีเอกสารบางใบถูกตรวจไปแล้วในใบคุมงานอื่น กรุณากดดึงรายการใหม่อีกครั้ง");
    }
    throw new Error(`เพิ่มรายการที่ต้องตรวจไม่สำเร็จ: ${error.message}`);
  }

  return { added: rows.length, skipped };
}

/** บันทึกผลตรวจของหนึ่งรายการ พร้อมรายการเอกสารที่ขาด (เขียนทับของเดิมทั้งชุด) */
export async function saveCheckResult(
  id: string,
  input: AudCheckResultInput,
  checkedBy: string | null,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("aud_checks")
    .update({
      result: input.result,
      result_note: input.result_note,
      doc_result: input.doc_result,
      doc_note: input.doc_note,
      call_result: input.call_result,
      info_result: input.info_result,
      call_note: input.call_note,
      slip_result: input.slip_result,
      slip_amount_result: input.slip_amount_result,
      slip_amount: input.slip_amount,
      deposit_amount: input.deposit_amount,
      checked_by: checkedBy,
    })
    .eq("id", id);
  if (error) throw new Error(`บันทึกผลการตรวจไม่สำเร็จ: ${error.message}`);

  const { error: delError } = await supabase
    .from("aud_check_missing_docs")
    .delete()
    .eq("check_id", id);
  if (delError) throw new Error(`ล้างรายการเอกสารที่ขาดเดิมไม่สำเร็จ: ${delError.message}`);

  // เอกสารครบแล้วไม่ต้องเก็บรายการที่ขาด (ผู้ใช้เปลี่ยนใจกลับมาเป็น "ครบ" ได้)
  if (input.doc_result !== "incomplete" || input.missing.length === 0) return;

  const { error: insError } = await supabase.from("aud_check_missing_docs").insert(
    input.missing.map((m, index) => ({
      check_id: id,
      doc_type_id: m.doc_type_id,
      doc_name: m.doc_name,
      sort_order: index,
    })),
  );
  if (insError) throw new Error(`บันทึกรายการเอกสารที่ขาดไม่สำเร็จ: ${insError.message}`);
}

export async function updateCheckSource(
  id: string,
  patch: Partial<Pick<AudCheckSource, "ref_no" | "ref_date" | "title" | "party" | "branch_label" | "amount">>,
): Promise<void> {
  const { error } = await getSupabase().from("aud_checks").update(patch).eq("id", id);
  if (error) throw new Error(`แก้ไขข้อมูลรายการที่ตรวจไม่สำเร็จ: ${error.message}`);
}

export async function deleteCheck(id: string): Promise<void> {
  const { error } = await getSupabase().from("aud_checks").delete().eq("id", id);
  if (error) throw new Error(`ลบรายการที่ตรวจไม่สำเร็จ: ${error.message}`);
}
