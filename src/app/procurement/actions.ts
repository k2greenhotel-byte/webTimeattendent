"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { parseAmount, validatePurchase, validateRepair, validateRepairUpdate } from "@/lib/procurement";
import {
  createPurchase,
  createRepair,
  createRepairUpdate,
  deletePurchase,
  deleteRepair,
  deleteRepairUpdate,
  getPurchase,
  getRepair,
  purchaseDeleteImpact,
  repairDeleteImpact,
  updatePurchase,
  updateRepair,
} from "@/lib/procurement-db";
import {
  JOB_STATUS_ORDER,
  MAX_PHOTOS,
  PR_DOC_STATUS_ORDER,
  TECH_KIND_ORDER,
  URGENCY_ORDER,
  type PurchaseInput,
  type RepairInput,
  type RepairUpdateInput,
} from "@/lib/procurement-types";
import { requirePermission } from "@/lib/session";

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
 * เส้นทางรูปที่ PhotoUploader ส่งมา (ส่งค่าว่างมาด้วยเสมอ เพื่อให้รู้ว่าผู้ใช้ลบรูปออกหมด)
 * ตัดจำนวนให้ไม่เกินที่สเปกกำหนดไว้ (ข้อ 1.1.10 / 1.2.9 / 1.3.12)
 */
function readPhotos(form: FormData): string[] {
  return form
    .getAll("photo")
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, MAX_PHOTOS);
}

// ---------- หน้าจอ 1.1 ใบขอซ่อม ----------

/** อ่านใบขอซ่อมจากฟอร์ม — ยอดอนุมัติ/เบิกจริง/สถานะอนุมัติ ไม่รับจากฟอร์มนี้ */
function readRepair(
  form: FormData,
  context: { createdBy: string | null; keep?: Pick<RepairInput, "approved_amount" | "actual_amount" | "pay_status" | "approve_status" | "reject_reason" | "reject_note"> },
): RepairInput {
  const keep = context.keep;

  return {
    request_date: str(form, "request_date"),
    company_id: optText(form, "company_id"),
    branch_id: optText(form, "branch_id"),
    item_name: str(form, "item_name"),
    asset_type_id: optText(form, "asset_type_id"),
    damage_detail: optText(form, "damage_detail"),
    urgency: pick(form, "urgency", URGENCY_ORDER) ?? "d2_5",
    created_by: context.createdBy,
    created_by_name: optText(form, "created_by_name"),
    requested_amount: parseAmount(str(form, "requested_amount")),
    approved_amount: keep?.approved_amount ?? 0,
    actual_amount: keep?.actual_amount ?? 0,
    tech_name: optText(form, "tech_name"),
    tech_phone: normalizePhone(str(form, "tech_phone")) || optText(form, "tech_phone"),
    tech_kind: pick(form, "tech_kind", TECH_KIND_ORDER) ?? "external",
    doc_status: pick(form, "doc_status", PR_DOC_STATUS_ORDER) ?? "active",
    pay_status: keep?.pay_status ?? "requested",
    job_status: pick(form, "job_status", JOB_STATUS_ORDER) ?? "wait_tech",
    approve_status: keep?.approve_status ?? "pending",
    reject_reason: keep?.reject_reason ?? null,
    reject_note: keep?.reject_note ?? null,
    tech_visit_date: optText(form, "tech_visit_date"),
    expected_done_date: optText(form, "expected_done_date"),
    fixed_date: optText(form, "fixed_date"),
    note: optText(form, "note"),
  };
}

export async function createRepairForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_REPAIR", "write");
  const path = "/procurement/repairs/new";

  const row = readRepair(form, { createdBy: user.id });
  if (!row.created_by_name) row.created_by_name = user.full_name;

  const problem = validateRepair(row);
  if (problem) back(path, problem, true);

  let id = "";
  let docNo = "";
  try {
    const created = await createRepair(row, readPhotos(form));
    id = created.id;
    docNo = created.doc_no;
    await logAudit({
      actor_id: user.id,
      action: "create_repair",
      target_table: "pr_repairs",
      target_id: id,
      after: { doc_no: docNo, item_name: row.item_name, requested_amount: row.requested_amount },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกใบขอซ่อมไม่สำเร็จ", true);
  }

  revalidatePath("/procurement/repairs");
  back(`/procurement/repairs/${id}`, `บันทึกใบขอซ่อมเลขที่ ${docNo} เรียบร้อยแล้ว`);
}

export async function updateRepairForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_REPAIR", "edit");
  const id = str(form, "id");
  if (!id) back("/procurement/repairs", "ไม่พบใบขอซ่อมที่ต้องการแก้ไข", true);

  const path = `/procurement/repairs/${id}`;
  const current = await getRepair(id);
  if (!current) back("/procurement/repairs", "ไม่พบใบขอซ่อมนี้ อาจถูกลบไปแล้ว", true);

  // ยอดที่อนุมัติ/เบิกจริง และสถานะอนุมัติ เขียนได้จากหน้าอนุมัติกับหน้าจ่ายเงินเท่านั้น จึงคงค่าเดิม
  const row = readRepair(form, { createdBy: current.created_by, keep: current });

  const problem = validateRepair(row);
  if (problem) back(path, problem, true);

  try {
    const { created_by: _keep, ...patch } = row;
    await updateRepair(id, patch, readPhotos(form));
    await logAudit({
      actor_id: user.id,
      action: "update_repair",
      target_table: "pr_repairs",
      target_id: id,
      after: { doc_no: current.doc_no, job_status: row.job_status },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกใบขอซ่อมไม่สำเร็จ", true);
  }

  revalidatePath(path);
  revalidatePath("/procurement/repairs");
  back(path, "บันทึกใบขอซ่อมเรียบร้อยแล้ว");
}

export async function deleteRepairForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_REPAIR", "delete");
  const id = str(form, "id");
  const path = `/procurement/repairs/${id}`;

  if (!id) back("/procurement/repairs", "ไม่พบใบขอซ่อมที่ต้องการลบ", true);
  if (form.get("confirm") !== "on") {
    const impact = await repairDeleteImpact(id);
    back(
      path,
      `ต้องติ๊ก "ยืนยันลบ" ก่อน — ลบแล้วใบ update ${impact.updates} ใบ รูป ${impact.photos} รูป จะหายตามไปด้วย` +
        (impact.payments > 0
          ? ` และรายการเบิกจ่าย ${impact.payments} รายการที่อ้างใบนี้จะกลายเป็นไม่ระบุเอกสาร`
          : ""),
      true,
    );
  }

  let filesDeleted = 0;
  try {
    ({ filesDeleted } = await deleteRepair(id));
    await logAudit({
      actor_id: user.id,
      action: "delete_repair",
      target_table: "pr_repairs",
      target_id: id,
      after: { filesDeleted },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ลบใบขอซ่อมไม่สำเร็จ", true);
  }

  revalidatePath("/procurement/repairs");
  back("/procurement/repairs", `ลบใบขอซ่อมและรูป ${filesDeleted} รูปเรียบร้อยแล้ว`);
}

// ---------- หน้าจอ 1.2 Update งานซ่อม ----------

export async function createRepairUpdateForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_REPAIR_UPD", "write");
  const repairId = str(form, "repair_id");
  const path = repairId
    ? `/procurement/updates/new?repair=${repairId}`
    : "/procurement/updates/new";

  const rawAmount = str(form, "requested_amount");
  const photos = readPhotos(form);

  const row: RepairUpdateInput = {
    update_date: str(form, "update_date"),
    repair_id: repairId,
    job_status: pick(form, "job_status", JOB_STATUS_ORDER),
    detail: optText(form, "detail"),
    expected_done_date: optText(form, "expected_done_date"),
    // เว้นว่างไว้ = ไม่เปลี่ยนยอดเดิมบนใบขอซ่อม (ต่างจากกรอก 0 ซึ่งแปลว่าตั้งเป็นศูนย์)
    requested_amount: rawAmount ? parseAmount(rawAmount) : null,
    recorded_by: user.id,
    recorded_by_name: str(form, "recorded_by_name") || user.full_name,
  };

  const problem = validateRepairUpdate({ ...row, photoCount: photos.length });
  if (problem) back(path, problem, true);

  let docNo = "";
  try {
    const created = await createRepairUpdate(row, photos);
    docNo = created.doc_no;
    await logAudit({
      actor_id: user.id,
      action: "create_repair_update",
      target_table: "pr_repair_updates",
      target_id: created.id,
      after: { doc_no: docNo, repair_id: row.repair_id, job_status: row.job_status },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึก Update ไม่สำเร็จ", true);
  }

  revalidatePath("/procurement/updates");
  revalidatePath(`/procurement/repairs/${repairId}`);
  back(`/procurement/repairs/${repairId}`, `บันทึก Update เลขที่ ${docNo} เรียบร้อยแล้ว`);
}

export async function deleteRepairUpdateForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_REPAIR_UPD", "delete");
  const id = str(form, "id");
  const repairId = str(form, "repair_id");
  const path = repairId ? `/procurement/repairs/${repairId}` : "/procurement/updates";

  if (!id) back("/procurement/updates", "ไม่พบใบ Update ที่ต้องการลบ", true);
  if (form.get("confirm") !== "on") {
    back(
      path,
      'ต้องติ๊ก "ยืนยันลบ" ก่อน — ลบใบ Update แล้วสถานะบนใบขอซ่อมจะไม่ย้อนกลับให้อัตโนมัติ ต้องบันทึกใบใหม่แทน',
      true,
    );
  }

  try {
    const { filesDeleted } = await deleteRepairUpdate(id);
    await logAudit({
      actor_id: user.id,
      action: "delete_repair_update",
      target_table: "pr_repair_updates",
      target_id: id,
      after: { filesDeleted },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ลบใบ Update ไม่สำเร็จ", true);
  }

  revalidatePath("/procurement/updates");
  revalidatePath(path);
  back(path, "ลบใบ Update เรียบร้อยแล้ว — สถานะบนใบขอซ่อมยังเป็นค่าล่าสุดที่เคยบันทึกไว้");
}

// ---------- หน้าจอ 1.3 ใบขอจัดซื้อ ----------

function readPurchase(
  form: FormData,
  context: {
    createdBy: string | null;
    keep?: Pick<
      PurchaseInput,
      "approved_amount" | "actual_amount" | "pay_status" | "approve_status" | "reject_reason" | "reject_note"
    >;
  },
): PurchaseInput {
  const keep = context.keep;

  return {
    request_date: str(form, "request_date"),
    company_id: optText(form, "company_id"),
    branch_id: optText(form, "branch_id"),
    supplier_name: optText(form, "supplier_name"),
    supplier_phone: normalizePhone(str(form, "supplier_phone")) || optText(form, "supplier_phone"),
    item_name: str(form, "item_name"),
    material_type_id: optText(form, "material_type_id"),
    reason: optText(form, "reason"),
    urgency: pick(form, "urgency", URGENCY_ORDER) ?? "d2_5",
    created_by: context.createdBy,
    created_by_name: optText(form, "created_by_name"),
    requested_amount: parseAmount(str(form, "requested_amount")),
    approved_amount: keep?.approved_amount ?? 0,
    actual_amount: keep?.actual_amount ?? 0,
    doc_status: pick(form, "doc_status", PR_DOC_STATUS_ORDER) ?? "active",
    pay_status: keep?.pay_status ?? "requested",
    approve_status: keep?.approve_status ?? "pending",
    reject_reason: keep?.reject_reason ?? null,
    reject_note: keep?.reject_note ?? null,
    received_date: optText(form, "received_date"),
    note: optText(form, "note"),
  };
}

export async function createPurchaseForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_PURCHASE", "write");
  const path = "/procurement/purchases/new";

  const row = readPurchase(form, { createdBy: user.id });
  if (!row.created_by_name) row.created_by_name = user.full_name;

  const problem = validatePurchase(row);
  if (problem) back(path, problem, true);

  let id = "";
  let docNo = "";
  try {
    const created = await createPurchase(row, readPhotos(form));
    id = created.id;
    docNo = created.doc_no;
    await logAudit({
      actor_id: user.id,
      action: "create_purchase",
      target_table: "pr_purchases",
      target_id: id,
      after: { doc_no: docNo, item_name: row.item_name, requested_amount: row.requested_amount },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกใบขอจัดซื้อไม่สำเร็จ", true);
  }

  revalidatePath("/procurement/purchases");
  back(`/procurement/purchases/${id}`, `บันทึกใบขอจัดซื้อเลขที่ ${docNo} เรียบร้อยแล้ว`);
}

export async function updatePurchaseForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_PURCHASE", "edit");
  const id = str(form, "id");
  if (!id) back("/procurement/purchases", "ไม่พบใบขอจัดซื้อที่ต้องการแก้ไข", true);

  const path = `/procurement/purchases/${id}`;
  const current = await getPurchase(id);
  if (!current) back("/procurement/purchases", "ไม่พบใบขอจัดซื้อนี้ อาจถูกลบไปแล้ว", true);

  const row = readPurchase(form, { createdBy: current.created_by, keep: current });

  const problem = validatePurchase(row);
  if (problem) back(path, problem, true);

  try {
    const { created_by: _keep, ...patch } = row;
    await updatePurchase(id, patch, readPhotos(form));
    await logAudit({
      actor_id: user.id,
      action: "update_purchase",
      target_table: "pr_purchases",
      target_id: id,
      after: { doc_no: current.doc_no, item_name: row.item_name },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกใบขอจัดซื้อไม่สำเร็จ", true);
  }

  revalidatePath(path);
  revalidatePath("/procurement/purchases");
  back(path, "บันทึกใบขอจัดซื้อเรียบร้อยแล้ว");
}

export async function deletePurchaseForm(form: FormData): Promise<void> {
  const user = await requirePermission("PR_PURCHASE", "delete");
  const id = str(form, "id");
  const path = `/procurement/purchases/${id}`;

  if (!id) back("/procurement/purchases", "ไม่พบใบขอจัดซื้อที่ต้องการลบ", true);
  if (form.get("confirm") !== "on") {
    const impact = await purchaseDeleteImpact(id);
    back(
      path,
      `ต้องติ๊ก "ยืนยันลบ" ก่อน — ลบแล้วรูป ${impact.photos} รูปจะหายตามไปด้วย` +
        (impact.payments > 0
          ? ` และรายการเบิกจ่าย ${impact.payments} รายการที่อ้างใบนี้จะกลายเป็นไม่ระบุเอกสาร`
          : ""),
      true,
    );
  }

  let filesDeleted = 0;
  try {
    ({ filesDeleted } = await deletePurchase(id));
    await logAudit({
      actor_id: user.id,
      action: "delete_purchase",
      target_table: "pr_purchases",
      target_id: id,
      after: { filesDeleted },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ลบใบขอจัดซื้อไม่สำเร็จ", true);
  }

  revalidatePath("/procurement/purchases");
  back("/procurement/purchases", `ลบใบขอจัดซื้อและรูป ${filesDeleted} รูปเรียบร้อยแล้ว`);
}
