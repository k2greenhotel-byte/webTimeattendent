"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { canSeeAllLeads, validateFollowUp, validateLead } from "@/lib/lead";
import {
  countFollowUpsOfLead,
  createFollowUp,
  createLead,
  deleteLead,
  getLead,
  getLeadCustomer,
  updateLead,
} from "@/lib/lead-db";
import {
  CHANCE_ORDER,
  WORK_STATUS_ORDER,
  type Chance,
  type FollowUpInput,
  type LeadInput,
  type LeadRow,
  type WorkStatus,
} from "@/lib/lead-types";
import { normalizePhone } from "@/lib/phone";
import { requirePermission } from "@/lib/session";
import type { SessionUser } from "@/lib/types";

// ---------- ตัวช่วยอ่านค่าจากฟอร์ม ----------

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

/** ค่าที่ต้องอยู่ในชุดตัวเลือกเท่านั้น — ค่านอกชุด (หรือค่าว่าง) คืน null */
function pick<T extends string>(form: FormData, key: string, allowed: readonly T[]): T | null {
  const value = str(form, key);
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function back(path: string, message: string, isError = false): never {
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/**
 * ข้อ 2 — พนักงานขายแตะได้เฉพาะ Lead ของตัวเอง หัวหน้า/ผู้จัดการ/admin แตะได้ทุกใบ
 * ตรวจซ้ำในทุก action ไม่ใช่แค่ตอนแสดงผล เพราะรู้ id ของใบอื่นก็ยิงเข้ามาตรง ๆ ได้
 */
function assertOwnership(lead: LeadRow, user: SessionUser, path: string): void {
  if (canSeeAllLeads(user.level)) return;
  if (lead.owner_id === user.id) return;
  back(path, "ดูหรือแก้ไขได้เฉพาะ Lead ของตัวเองเท่านั้น", true);
}

// ---------- หน้าจอ 1: บันทึกข้อมูล Lead ----------

async function readLead(
  form: FormData,
  context: { owner: { id: string | null; name: string | null }; companyId: string | null; createdBy: string | null },
): Promise<LeadInput> {
  const customer_id = optText(form, "customer_id");
  const customer = await getLeadCustomer(customer_id);
  const work_status = pick(form, "work_status", WORK_STATUS_ORDER) ?? "follow_up";
  const closing = work_status === "closed_won";

  return {
    lead_date: str(form, "lead_date"),
    owner_id: context.owner.id,
    owner_name: context.owner.name,
    customer_id,
    customer_name: customer?.full_name ?? "",
    phone: normalizePhone(str(form, "customer_phone")) || null,
    brand_id: optText(form, "brand_id"),
    model_id: optText(form, "model_id"),
    note: optText(form, "note"),
    channel_id: optText(form, "channel_id"),
    channel_other: optText(form, "channel_other"),
    work_status,
    chance: pick(form, "chance", CHANCE_ORDER) ?? "medium",
    next_follow_date: work_status === "follow_up" ? optText(form, "next_follow_date") : null,
    sale_contract_no: closing ? optText(form, "sale_contract_no") : null,
    sale_date: closing ? optText(form, "sale_date") : null,
    branch_id: optText(form, "branch_id"),
    company_id: context.companyId,
    created_by: context.createdBy,
  };
}

export async function createLeadForm(form: FormData): Promise<void> {
  const user = await requirePermission("LEAD_ENTRY", "write");
  const path = "/leads/leads/new";

  const row = await readLead(form, {
    owner: { id: user.id, name: user.full_name },
    companyId: user.company_id ?? null,
    createdBy: user.id,
  });

  const problem = validateLead(row);
  if (problem) back(path, problem, true);

  let id: string;
  let docNo: string;
  try {
    const created = await createLead(row);
    id = created.id;
    docNo = created.doc_no;
    await logAudit({
      actor_id: user.id,
      action: "create_lead",
      target_table: "ld_leads",
      target_id: id,
      after: { doc_no: docNo, customer_name: row.customer_name, lead_date: row.lead_date },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกข้อมูล Lead ไม่สำเร็จ", true);
  }

  revalidatePath("/leads/leads");
  back(`/leads/leads/${id}`, `บันทึก Lead เลขที่ ${docNo} เรียบร้อยแล้ว`);
}

export async function updateLeadForm(form: FormData): Promise<void> {
  const user = await requirePermission("LEAD_ENTRY", "edit");
  const id = str(form, "id");
  if (!id) back("/leads/leads", "ไม่พบข้อมูล Lead ที่ต้องการแก้ไข", true);

  const path = `/leads/leads/${id}`;
  const current = await getLead(id);
  if (!current) back("/leads/leads", "ไม่พบ Lead นี้ อาจถูกลบไปแล้ว", true);
  assertOwnership(current, user, "/leads/leads");

  // เจ้าของ Lead ไม่เปลี่ยนตามคนที่มาแก้ไข (หัวหน้าแก้ให้ก็ยังเป็นผลงานของพนักงานคนเดิม)
  const row = await readLead(form, {
    owner: { id: current.owner_id, name: current.owner_name },
    companyId: current.company_id,
    createdBy: current.created_by,
  });

  const problem = validateLead(row);
  if (problem) back(path, problem, true);

  try {
    const { created_by: _keep, ...patch } = row;
    await updateLead(id, patch);
    await logAudit({
      actor_id: user.id,
      action: "update_lead",
      target_table: "ld_leads",
      target_id: id,
      after: { doc_no: current.doc_no, work_status: row.work_status, chance: row.chance },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกข้อมูล Lead ไม่สำเร็จ", true);
  }

  revalidatePath(path);
  revalidatePath("/leads/leads");
  back(path, "บันทึกข้อมูล Lead เรียบร้อยแล้ว");
}

export async function deleteLeadForm(form: FormData): Promise<void> {
  const user = await requirePermission("LEAD_ENTRY", "delete");
  const id = str(form, "id");
  const path = `/leads/leads/${id}`;
  if (!id) back("/leads/leads", "ไม่พบข้อมูล Lead ที่ต้องการลบ", true);

  const current = await getLead(id);
  if (!current) back("/leads/leads", "ไม่พบ Lead นี้ อาจถูกลบไปแล้ว", true);

  if (form.get("confirm") !== "on") {
    const follows = await countFollowUpsOfLead(id);
    back(
      path,
      `ต้องติ๊ก "ยืนยันลบ" ก่อน — ลบแล้วประวัติการติดตาม ${follows} ครั้งจะหายตามไปด้วย`,
      true,
    );
  }

  try {
    await deleteLead(id);
    await logAudit({
      actor_id: user.id,
      action: "delete_lead",
      target_table: "ld_leads",
      target_id: id,
      after: { doc_no: current.doc_no, customer_name: current.customer_name },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ลบข้อมูล Lead ไม่สำเร็จ", true);
  }

  revalidatePath("/leads/leads");
  back("/leads/leads", `ลบ Lead เลขที่ ${current.doc_no} เรียบร้อยแล้ว`);
}

// ---------- หน้าจอ 2: บันทึกผลการติดตาม ----------

function readFollowUp(
  form: FormData,
  context: { recordedBy: string | null; recordedByName: string | null },
): FollowUpInput {
  const work_status = pick(form, "work_status", WORK_STATUS_ORDER);
  const closing = work_status === "closed_won";

  return {
    follow_date: str(form, "follow_date"),
    lead_id: str(form, "lead_id"),
    detail: optText(form, "detail"),
    next_follow_date:
      work_status === null || work_status === "follow_up" ? optText(form, "next_follow_date") : null,
    work_status: work_status as WorkStatus | null,
    chance: pick(form, "chance", CHANCE_ORDER) as Chance | null,
    sale_contract_no: closing ? optText(form, "sale_contract_no") : null,
    sale_date: closing ? optText(form, "sale_date") : null,
    recorded_by: context.recordedBy,
    recorded_by_name: context.recordedByName,
  };
}

export async function createFollowUpForm(form: FormData): Promise<void> {
  const user = await requirePermission("LEAD_FOLLOW", "write");
  const leadId = str(form, "lead_id");
  if (!leadId) back("/leads/follow", "ไม่พบ Lead ที่ต้องการติดตาม", true);

  const path = `/leads/follow/${leadId}`;
  const lead = await getLead(leadId);
  if (!lead) back("/leads/follow", "ไม่พบ Lead นี้ อาจถูกลบไปแล้ว", true);
  assertOwnership(lead, user, "/leads/follow");

  const row = readFollowUp(form, { recordedBy: user.id, recordedByName: user.full_name });
  const problem = validateFollowUp(row);
  if (problem) back(path, problem, true);

  let docNo: string;
  try {
    const created = await createFollowUp(row);
    docNo = created.doc_no;
    await logAudit({
      actor_id: user.id,
      action: "create_lead_follow_up",
      target_table: "ld_follow_ups",
      target_id: created.id,
      after: { doc_no: docNo, lead_no: lead.doc_no, work_status: row.work_status },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกผลการติดตามไม่สำเร็จ", true);
  }

  revalidatePath("/leads/follow");
  revalidatePath(path);
  revalidatePath(`/leads/leads/${leadId}`);
  back(path, `บันทึกผลการติดตามเลขที่ ${docNo} เรียบร้อยแล้ว`);
}
