"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseAmount, validateClaim, validateClaimUpdate } from "@/lib/claim";
import {
  claimDeleteImpact,
  createClaim,
  createClaimUpdate,
  deleteClaim,
  deleteClaimUpdate,
  getClaim,
  getClaimUpdate,
  updateClaim,
} from "@/lib/claim-db";
import {
  CLAIM_DOC_STATUS_ORDER,
  CLAIM_JOB_STATUS_ORDER,
  CLAIM_MAX_ITEMS,
  CLAIM_MAX_PHOTOS,
  CLAIM_URGENCY_ORDER,
  LEGACY_MAKER,
  type ClaimInput,
  type ClaimItem,
  type ClaimUpdateInput,
} from "@/lib/claim-types";
import { logAudit } from "@/lib/db";
import { getMaster } from "@/lib/moto-db";
import { normalizePhone } from "@/lib/phone";
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
 * ตัดจำนวนให้ไม่เกินที่สเปกกำหนดไว้ (ข้อ 1.4.14 / 1.5.9)
 */
function readPhotos(form: FormData): string[] {
  return form
    .getAll("photo")
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, CLAIM_MAX_PHOTOS);
}

/** รายการที่ขอเคลม (ข้อ 1.4.10) — สามชุดที่เรียงตรงกันจาก ClaimItemsEditor */
function readItems(form: FormData): ClaimItem[] {
  const names = form.getAll("item_name").map((v) => String(v).trim());
  const qtys = form.getAll("item_qty").map((v) => String(v).trim());
  const notes = form.getAll("item_note").map((v) => String(v).trim());

  return names
    .map((item_name, i) => ({
      item_name,
      qty: qtys[i] ? parseAmount(qtys[i]) : 1,
      note: notes[i] || null,
    }))
    .filter((i) => i.item_name)
    .slice(0, CLAIM_MAX_ITEMS);
}

/**
 * บริษัทผู้ผลิต (1.4.15) — ผู้ใช้เลือกจากทะเบียน "บริษัทรถ / เจ้าหนี้" (mc_vendors)
 * เก็บทั้ง id (ใช้จัดกลุ่ม/กรอง) และชื่อ ณ ตอนบันทึก (ใบเก่าต้องอ่านออกแม้ทะเบียนจะแก้ชื่อ)
 *
 *   ""          → ไม่ระบุ (ล้างทั้งสองช่อง)
 *   LEGACY      → ใบเก่าที่พิมพ์ชื่อเองไว้ก่อนมีทะเบียน — คงข้อความเดิมไว้
 *   <uuid>      → หยิบชื่อจากทะเบียนมาเก็บเป็นสำเนา
 */
async function readMaker(
  form: FormData,
  keepName: string | null,
): Promise<{ maker_vendor_id: string | null; maker_name: string | null }> {
  const value = str(form, "maker_vendor_id");

  if (!value) return { maker_vendor_id: null, maker_name: null };
  if (value === LEGACY_MAKER) return { maker_vendor_id: null, maker_name: keepName };

  const vendor = await getMaster("vendor", value);
  if (!vendor) throw new Error("ไม่พบบริษัทผู้ผลิตที่เลือก อาจถูกลบออกจากทะเบียนไปแล้ว");

  return { maker_vendor_id: vendor.id, maker_name: vendor.name };
}

// ---------- หน้าจอ 1.4 ใบขอเคลม ----------

/**
 * อ่านใบขอเคลมจากฟอร์ม
 * ยอดที่ขออนุมัติ วันที่คาดว่าจะเสร็จ และเลขที่/วันที่ของ job มาจากใบ update (1.5) เท่านั้น
 * ฟอร์มนี้คงค่าเดิมไว้ — กันสถานะสองที่ไม่ตรงกัน
 */
function readClaim(
  form: FormData,
  context: {
    createdBy: string | null;
    keep?: Pick<
      ClaimInput,
      | "requested_amount"
      | "expected_done_date"
      | "job_no"
      | "job_open_date"
      | "job_close_date"
      | "job_deliver_date"
    >;
  },
): ClaimInput {
  const isExternal = str(form, "is_external") === "1";

  return {
    claim_date: str(form, "claim_date"),
    company_id: optText(form, "company_id"),
    branch_id: optText(form, "branch_id"),

    chassis_no: str(form, "chassis_no"),
    engine_no: optText(form, "engine_no"),
    db2_brand_code: optText(form, "db2_brand_code"),
    db2_brand_name: optText(form, "db2_brand_name"),
    db2_model_code: optText(form, "db2_model_code"),
    db2_model_name: optText(form, "db2_model_name"),
    db2_variant_code: optText(form, "db2_variant_code"),
    db2_variant_name: optText(form, "db2_variant_name"),
    db2_color_code: optText(form, "db2_color_code"),
    db2_color_name: optText(form, "db2_color_name"),
    db2_contno: isExternal ? null : optText(form, "db2_contno"),
    db2_locat: isExternal ? null : optText(form, "db2_locat"),
    db2_sale_date: isExternal ? null : optText(form, "db2_sale_date"),

    db2_cuscod: isExternal ? null : optText(form, "db2_cuscod"),
    customer_name: str(form, "customer_name"),
    customer_phone: normalizePhone(str(form, "customer_phone")) || optText(form, "customer_phone"),
    customer_address: optText(form, "customer_address"),
    is_external: isExternal,

    damage_detail: optText(form, "damage_detail"),
    urgency: pick(form, "urgency", CLAIM_URGENCY_ORDER) ?? "d2_5",
    created_by: context.createdBy,
    created_by_name: optText(form, "created_by_name"),

    // 1.4.15 บริษัทผู้ผลิตเลือกจากทะเบียน — ชื่อเติมจากทะเบียนใน createClaimForm/updateClaimForm
    maker_vendor_id: null,
    maker_name: null,
    maker_agent_name: optText(form, "maker_agent_name"),
    maker_phone: normalizePhone(str(form, "maker_phone")) || optText(form, "maker_phone"),

    doc_status: pick(form, "doc_status", CLAIM_DOC_STATUS_ORDER) ?? "active",
    job_status: pick(form, "job_status", CLAIM_JOB_STATUS_ORDER) ?? "wait_notify",
    reject_reason: optText(form, "reject_reason"),
    result_date: optText(form, "result_date"),
    fixed_date: optText(form, "fixed_date"),
    delivered_date: optText(form, "delivered_date"),

    expected_done_date: context.keep?.expected_done_date ?? null,
    requested_amount: context.keep?.requested_amount ?? 0,

    job_no: context.keep?.job_no ?? null,
    job_open_date: context.keep?.job_open_date ?? null,
    job_close_date: context.keep?.job_close_date ?? null,
    job_deliver_date: context.keep?.job_deliver_date ?? null,

    note: optText(form, "note"),
  };
}

export async function createClaimForm(form: FormData): Promise<void> {
  const user = await requirePermission("CLM_CLAIM", "write");
  const path = "/claim/claims/new";

  const row = readClaim(form, { createdBy: user.id });
  if (!row.created_by_name) row.created_by_name = user.full_name;
  const items = readItems(form);

  try {
    Object.assign(row, await readMaker(form, null));
  } catch (err) {
    back(path, err instanceof Error ? err.message : "อ่านบริษัทผู้ผลิตไม่สำเร็จ", true);
  }

  const problem = validateClaim(row, items);
  if (problem) back(path, problem, true);

  let id = "";
  let docNo = "";
  try {
    const created = await createClaim(row, items, readPhotos(form));
    id = created.id;
    docNo = created.doc_no;
    await logAudit({
      actor_id: user.id,
      action: "create_claim",
      target_table: "cl_claims",
      target_id: id,
      after: {
        doc_no: docNo,
        chassis_no: row.chassis_no,
        customer_name: row.customer_name,
        items: items.length,
      },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกใบขอเคลมไม่สำเร็จ", true);
  }

  revalidatePath("/claim/claims");
  back(`/claim/claims/${id}`, `บันทึกใบขอเคลมเลขที่ ${docNo} เรียบร้อยแล้ว`);
}

export async function updateClaimForm(form: FormData): Promise<void> {
  const user = await requirePermission("CLM_CLAIM", "edit");
  const id = str(form, "id");
  if (!id) back("/claim/claims", "ไม่พบใบขอเคลมที่ต้องการแก้ไข", true);

  const path = `/claim/claims/${id}`;
  const current = await getClaim(id);
  if (!current) back("/claim/claims", "ไม่พบใบขอเคลมนี้ อาจถูกลบไปแล้ว", true);

  const row = readClaim(form, { createdBy: current.created_by, keep: current });
  const items = readItems(form);

  try {
    Object.assign(row, await readMaker(form, current.maker_name));
  } catch (err) {
    back(path, err instanceof Error ? err.message : "อ่านบริษัทผู้ผลิตไม่สำเร็จ", true);
  }

  const problem = validateClaim(row, items);
  if (problem) back(path, problem, true);

  try {
    // ผู้บันทึกจัดทำเป็นของคนเปิดใบ — คนที่มาแก้ทีหลังไม่ควรถูกเขียนทับเป็นเจ้าของใบ
    const { created_by: _keep, ...patch } = row;
    await updateClaim(id, patch, items, readPhotos(form));
    await logAudit({
      actor_id: user.id,
      action: "update_claim",
      target_table: "cl_claims",
      target_id: id,
      after: { doc_no: current.doc_no, job_status: row.job_status, items: items.length },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกใบขอเคลมไม่สำเร็จ", true);
  }

  revalidatePath(path);
  revalidatePath("/claim/claims");
  back(path, "บันทึกใบขอเคลมเรียบร้อยแล้ว");
}

export async function deleteClaimForm(form: FormData): Promise<void> {
  const user = await requirePermission("CLM_CLAIM", "delete");
  const id = str(form, "id");
  const path = `/claim/claims/${id}`;

  if (!id) back("/claim/claims", "ไม่พบใบขอเคลมที่ต้องการลบ", true);
  if (form.get("confirm") !== "on") {
    const impact = await claimDeleteImpact(id);
    back(
      path,
      `ต้องติ๊ก "ยืนยันลบ" ก่อน — ลบแล้วใบ update ${impact.updates} ใบ รายการที่ขอเคลม ${impact.items} รายการ และรูป ${impact.photos} รูป จะหายตามไปด้วย`,
      true,
    );
  }

  const current = await getClaim(id);
  if (!current) back("/claim/claims", "ไม่พบใบขอเคลมนี้ อาจถูกลบไปแล้ว", true);

  try {
    await deleteClaim(id);
    await logAudit({
      actor_id: user.id,
      action: "delete_claim",
      target_table: "cl_claims",
      target_id: id,
      before: { doc_no: current.doc_no, chassis_no: current.chassis_no },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ลบใบขอเคลมไม่สำเร็จ", true);
  }

  revalidatePath("/claim/claims");
  back("/claim/claims", `ลบใบขอเคลมเลขที่ ${current.doc_no} แล้ว`);
}

// ---------- หน้าจอ 1.5 ใบ update งานเคลม ----------

function readUpdate(form: FormData, recordedBy: string | null): ClaimUpdateInput {
  const amount = str(form, "requested_amount");

  return {
    update_date: str(form, "update_date"),
    claim_id: str(form, "claim_id"),
    job_status: pick(form, "job_status", CLAIM_JOB_STATUS_ORDER),
    detail: optText(form, "detail"),
    expected_done_date: optText(form, "expected_done_date"),
    // เว้นว่างไว้ = ไม่เปลี่ยนยอดเดิมบนใบขอเคลม
    requested_amount: amount ? parseAmount(amount) : null,
    reject_reason: optText(form, "reject_reason"),
    // 1.5.10-1.5.13 เลขที่ job และวันที่ของ job
    job_no: optText(form, "job_no"),
    job_open_date: optText(form, "job_open_date"),
    job_close_date: optText(form, "job_close_date"),
    job_deliver_date: optText(form, "job_deliver_date"),
    recorded_by: recordedBy,
    recorded_by_name: optText(form, "recorded_by_name"),
  };
}

export async function createClaimUpdateForm(form: FormData): Promise<void> {
  const user = await requirePermission("CLM_UPDATE", "write");
  const claimId = str(form, "claim_id");
  const path = claimId ? `/claim/updates/new?claim=${claimId}` : "/claim/updates/new";

  const row = readUpdate(form, user.id);
  if (!row.recorded_by_name) row.recorded_by_name = user.full_name;
  const photos = readPhotos(form);

  const problem = validateClaimUpdate({ ...row, photoCount: photos.length });
  if (problem) back(path, problem, true);

  let docNo = "";
  try {
    const created = await createClaimUpdate(row, photos);
    docNo = created.doc_no;
    await logAudit({
      actor_id: user.id,
      action: "create_claim_update",
      target_table: "cl_claim_updates",
      target_id: created.id,
      after: { doc_no: docNo, claim_id: row.claim_id, job_status: row.job_status },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึก update ไม่สำเร็จ", true);
  }

  revalidatePath("/claim/updates");
  revalidatePath(`/claim/claims/${row.claim_id}`);
  back(`/claim/claims/${row.claim_id}`, `บันทึก update เลขที่ ${docNo} เรียบร้อยแล้ว`);
}

export async function deleteClaimUpdateForm(form: FormData): Promise<void> {
  const user = await requirePermission("CLM_UPDATE", "delete");
  const id = str(form, "id");
  const claimId = str(form, "claim_id");
  const path = claimId ? `/claim/claims/${claimId}` : "/claim/updates";

  if (!id) back(path, "ไม่พบใบ update ที่ต้องการลบ", true);
  if (form.get("confirm") !== "on") {
    back(path, 'ต้องติ๊ก "ยืนยัน" ก่อนลบใบ update', true);
  }

  const current = await getClaimUpdate(id);
  if (!current) back(path, "ไม่พบใบ update นี้ อาจถูกลบไปแล้ว", true);

  try {
    await deleteClaimUpdate(id);
    await logAudit({
      actor_id: user.id,
      action: "delete_claim_update",
      target_table: "cl_claim_updates",
      target_id: id,
      before: { doc_no: current.doc_no, claim_no: current.claim_no },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ลบใบ update ไม่สำเร็จ", true);
  }

  revalidatePath(path);
  back(
    path,
    `ลบใบ update ${current.doc_no} แล้ว — สถานะบนใบขอเคลมไม่ถูกย้อนกลับอัตโนมัติ ถ้าต้องแก้ให้บันทึก update ใหม่`,
  );
}
