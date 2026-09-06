import "server-only";
import { applyFollowUp } from "./lead";
import type {
  ChanceInput,
  ChanceOption,
  FollowUpInput,
  FollowUpRow,
  Lead,
  LeadInput,
  LeadOption,
  LeadQuery,
  LeadRow,
  WorkStatusInput,
  WorkStatusOption,
} from "./lead-types";
import { getSupabase } from "./supabase-server";

/**
 * ทุก query ของระบบข้อมูล Lead อยู่ในไฟล์นี้ไฟล์เดียว (server-only)
 * หน้าเว็บ/server action ห้ามเรียก supabase ตรง ๆ
 */

const LEAD_PREFIX = "LD";
const FOLLOW_PREFIX = "LDF";

/** ปี พ.ศ. ของเอกสาร — ใช้ตัดชุดเลขที่รันนิ่ง */
function beYearOf(date: string): number {
  return Number(date.slice(0, 4)) + 543;
}

function toLeadRow(raw: Record<string, unknown>): LeadRow {
  return {
    ...(raw as unknown as LeadRow),
    follow_count: Number(raw.follow_count ?? 0),
  };
}

// ---------- ใบ Lead ----------

/**
 * รายการ Lead ตามเงื่อนไข — ทุกหน้าจอ (รายการ / กระดานติดตาม / สอบถาม / dashboard) ใช้ตัวนี้ตัวเดียว
 *
 * `query.owner_id` คือด่านสิทธิ์ตามข้อ 2: ผู้เรียกที่เป็นพนักงานทั่วไปต้องส่ง id ของตัวเองมาเสมอ
 * (ตัวตัดสินใจอยู่ที่หน้าจอ ผ่าน canSeeAllLeads() — ที่นี่แค่ทำตาม)
 */
export async function listLeads(query: LeadQuery = {}): Promise<LeadRow[]> {
  let q = getSupabase().from("v_ld_leads").select("*");

  const eq = {
    owner_id: query.owner_id,
    branch_id: query.branch_id,
    company_id: query.company_id,
    brand_id: query.brand_id,
    model_id: query.model_id,
    channel_id: query.channel_id,
    work_status: query.work_status,
    chance: query.chance,
  };
  for (const [column, value] of Object.entries(eq)) {
    if (value) q = q.eq(column, value);
  }

  if (query.from) q = q.gte("lead_date", query.from);
  if (query.to) q = q.lte("lead_date", query.to);

  const { data, error } = await q
    .order("lead_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 1000);
  if (error) throw new Error(`อ่านรายการ Lead ไม่สำเร็จ: ${error.message}`);

  let rows = (data ?? []).map((r) => toLeadRow(r as Record<string, unknown>));

  // คำค้นอิสระ (เลขที่ ชื่อลูกค้า เบอร์โทร ยี่ห้อ รุ่น พนักงาน เลขที่สัญญาขาย หมายเหตุ)
  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (keyword) {
    rows = rows.filter((r) =>
      [
        r.doc_no,
        r.customer_name,
        r.customer_code,
        r.phone,
        r.brand_name,
        r.model_name,
        r.owner_name,
        r.owner_full_name,
        r.sale_contract_no,
        r.note,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }

  return rows;
}

export async function getLead(id: string): Promise<LeadRow | null> {
  const { data, error } = await getSupabase()
    .from("v_ld_leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านข้อมูล Lead ไม่สำเร็จ: ${error.message}`);
  return data ? toLeadRow(data as Record<string, unknown>) : null;
}

/** สร้าง Lead ใหม่ พร้อมออกเลขที่ตามปี พ.ศ. ของวันที่รับ Lead (ข้อ 1.1) */
export async function createLead(input: LeadInput): Promise<LeadRow> {
  const supabase = getSupabase();

  const { data: docNo, error: docError } = await supabase.rpc("ld_next_doc_no", {
    doc_prefix: LEAD_PREFIX,
    be_year: beYearOf(input.lead_date),
  });
  if (docError) throw new Error(`ออกเลขที่ Lead ไม่สำเร็จ: ${docError.message}`);

  const { data, error } = await supabase
    .from("ld_leads")
    .insert({ ...input, doc_no: docNo })
    .select("id")
    .single();
  if (error) throw new Error(`บันทึกข้อมูล Lead ไม่สำเร็จ: ${error.message}`);

  return (await getLead((data as { id: string }).id)) as LeadRow;
}

export async function updateLead(id: string, input: Partial<LeadInput>): Promise<void> {
  const { error } = await getSupabase().from("ld_leads").update(input).eq("id", id);
  if (error) throw new Error(`บันทึกข้อมูล Lead ไม่สำเร็จ: ${error.message}`);
}

/** ลบ Lead — ใบติดตามที่ผูกอยู่ถูกลบตามด้วย on delete cascade */
export async function deleteLead(id: string): Promise<void> {
  const { error } = await getSupabase().from("ld_leads").delete().eq("id", id);
  if (error) throw new Error(`ลบข้อมูล Lead ไม่สำเร็จ: ${error.message}`);
}

/** จำนวนใบติดตามที่ผูกกับ Lead นี้ — ใช้เตือนก่อนลบ */
export async function countFollowUpsOfLead(leadId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("ld_follow_ups")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId);
  if (error) throw new Error(`นับใบติดตามไม่สำเร็จ: ${error.message}`);
  return count ?? 0;
}

// ---------- ใบติดตาม (หน้าจอ 2) ----------

export async function listFollowUps(
  options: { lead_id?: string; owner_id?: string | null; limit?: number } = {},
): Promise<FollowUpRow[]> {
  let q = getSupabase().from("v_ld_follow_ups").select("*");
  if (options.lead_id) q = q.eq("lead_id", options.lead_id);
  if (options.owner_id) q = q.eq("lead_owner_id", options.owner_id);

  const { data, error } = await q
    .order("follow_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(options.limit ?? 500);
  if (error) throw new Error(`อ่านประวัติการติดตามไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as FollowUpRow[];
}

/**
 * บันทึกผลการติดตามหนึ่งครั้ง แล้วอัปเดตสถานะล่าสุดบนใบ Lead ให้ตรงกัน
 * (ใบติดตาม = ประวัติ · ใบ Lead = สถานะปัจจุบัน — ต้องเขียนทั้งคู่เสมอ ไม่งั้นกระดานติดตามจะไม่ขยับ)
 */
export async function createFollowUp(input: FollowUpInput): Promise<FollowUpRow> {
  const supabase = getSupabase();

  const { data: docNo, error: docError } = await supabase.rpc("ld_next_doc_no", {
    doc_prefix: FOLLOW_PREFIX,
    be_year: beYearOf(input.follow_date),
  });
  if (docError) throw new Error(`ออกเลขที่การติดตามไม่สำเร็จ: ${docError.message}`);

  const { data, error } = await supabase
    .from("ld_follow_ups")
    .insert({ ...input, doc_no: docNo })
    .select("id")
    .single();
  if (error) throw new Error(`บันทึกผลการติดตามไม่สำเร็จ: ${error.message}`);

  await updateLead(input.lead_id, applyFollowUp(input, await listWorkStatuses(true)));

  const { data: row, error: readError } = await supabase
    .from("v_ld_follow_ups")
    .select("*")
    .eq("id", (data as { id: string }).id)
    .maybeSingle();
  if (readError) throw new Error(`อ่านใบติดตามที่บันทึกไม่สำเร็จ: ${readError.message}`);
  return row as FollowUpRow;
}

export async function deleteFollowUp(id: string): Promise<void> {
  const { error } = await getSupabase().from("ld_follow_ups").delete().eq("id", id);
  if (error) throw new Error(`ลบใบติดตามไม่สำเร็จ: ${error.message}`);
}

// ---------- สถานะงาน / สถานะโอกาส (หน้าจอตั้งค่า 5) ----------

const STATUS_COLUMNS = "code, name, kind, color, sort_order, is_active, is_system";
const CHANCE_COLUMNS = "code, name, color, sort_order, is_active, is_system";

/** สถานะงานทั้งหมด เรียงตามลำดับที่ตั้งไว้ในหน้าตั้งค่า */
export async function listWorkStatuses(includeInactive = false): Promise<WorkStatusOption[]> {
  let q = getSupabase().from("ld_work_statuses").select(STATUS_COLUMNS);
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านรายการสถานะงานไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as unknown as WorkStatusOption[];
}

/** สถานะโอกาสการขายทั้งหมด (ลำดับแรก = โอกาสสูงสุด) */
export async function listChances(includeInactive = false): Promise<ChanceOption[]> {
  let q = getSupabase().from("ld_chances").select(CHANCE_COLUMNS);
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านรายการสถานะโอกาสไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as unknown as ChanceOption[];
}

function duplicateCode(code: string): string {
  return `รหัส ${code} ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`;
}

export async function createWorkStatus(input: WorkStatusInput): Promise<void> {
  const { error } = await getSupabase().from("ld_work_statuses").insert({ ...input, is_system: false });
  if (error) {
    throw new Error(
      error.code === "23505" ? duplicateCode(input.code) : `เพิ่มสถานะงานไม่สำเร็จ: ${error.message}`,
    );
  }
}

/** แก้ไขสถานะงาน — รหัส (code) เปลี่ยนไม่ได้ เพราะเป็นค่าที่บันทึกอยู่บนใบงานเดิมทั้งหมด */
export async function updateWorkStatus(
  code: string,
  input: Omit<WorkStatusInput, "code">,
): Promise<void> {
  const { error } = await getSupabase().from("ld_work_statuses").update(input).eq("code", code);
  if (error) throw new Error(`บันทึกสถานะงานไม่สำเร็จ: ${error.message}`);
}

export async function deleteWorkStatus(code: string): Promise<void> {
  const { error } = await getSupabase()
    .from("ld_work_statuses")
    .delete()
    .eq("code", code)
    .eq("is_system", false);
  if (error) throw new Error(`ลบสถานะงานไม่สำเร็จ: ${error.message}`);
}

export async function createChance(input: ChanceInput): Promise<void> {
  const { error } = await getSupabase().from("ld_chances").insert({ ...input, is_system: false });
  if (error) {
    throw new Error(
      error.code === "23505"
        ? duplicateCode(input.code)
        : `เพิ่มสถานะโอกาสไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function updateChance(
  code: string,
  input: Omit<ChanceInput, "code">,
): Promise<void> {
  const { error } = await getSupabase().from("ld_chances").update(input).eq("code", code);
  if (error) throw new Error(`บันทึกสถานะโอกาสไม่สำเร็จ: ${error.message}`);
}

export async function deleteChance(code: string): Promise<void> {
  const { error } = await getSupabase()
    .from("ld_chances")
    .delete()
    .eq("code", code)
    .eq("is_system", false);
  if (error) throw new Error(`ลบสถานะโอกาสไม่สำเร็จ: ${error.message}`);
}

/** จำนวนใบงานที่ยังใช้สถานะนี้อยู่ — ใช้เตือนก่อนลบ (ลบแล้วใบเก่าจะอ้างสถานะที่หายไป) */
export async function countStatusUsage(
  field: "work_status" | "chance",
  code: string,
): Promise<number> {
  const supabase = getSupabase();
  const [leads, follows] = await Promise.all([
    supabase.from("ld_leads").select("id", { count: "exact", head: true }).eq(field, code),
    supabase.from("ld_follow_ups").select("id", { count: "exact", head: true }).eq(field, code),
  ]);

  if (leads.error) throw new Error(`ตรวจสอบการใช้งานสถานะไม่สำเร็จ: ${leads.error.message}`);
  if (follows.error) throw new Error(`ตรวจสอบการใช้งานสถานะไม่สำเร็จ: ${follows.error.message}`);
  return (leads.count ?? 0) + (follows.count ?? 0);
}

// ---------- ตัวเลือกของช่องกรอง ----------

/**
 * พนักงานขายที่มี Lead อยู่จริง — ใช้เป็นตัวเลือกช่องกรองในหน้าสอบถาม/dashboard
 * (ไม่ได้ดึงทะเบียนพนักงานทั้งหมด เพราะรายชื่อจะยาวเกินจำเป็น)
 */
export async function listLeadOwners(): Promise<LeadOption[]> {
  const { data, error } = await getSupabase()
    .from("v_ld_leads")
    .select("owner_id, owner_name, owner_full_name")
    .limit(5000);
  if (error) throw new Error(`อ่านรายชื่อพนักงานขายไม่สำเร็จ: ${error.message}`);

  const map = new Map<string, string>();
  for (const raw of data ?? []) {
    const row = raw as { owner_id: string | null; owner_name: string | null; owner_full_name: string | null };
    if (!row.owner_id) continue;
    map.set(row.owner_id, (row.owner_name ?? "").trim() || (row.owner_full_name ?? "").trim() || "—");
  }

  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

/** ลูกค้าหนึ่งรายสำหรับเติมชื่อ/เบอร์ลงฟอร์ม (ใช้ตอนแก้ไขใบเดิม) */
export async function getLeadCustomer(
  id: string | null,
): Promise<{ id: string; code: string; full_name: string; phone: string | null } | null> {
  if (!id) return null;
  const { data, error } = await getSupabase()
    .from("customers")
    .select("id, code, full_name, phone")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลลูกค้าไม่สำเร็จ: ${error.message}`);
  return (data as { id: string; code: string; full_name: string; phone: string | null }) ?? null;
}

export type { Lead };
