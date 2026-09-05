import "server-only";
import { applyApproval, applyRepairUpdate, round2, sumItems } from "./procurement";
import type {
  Approval,
  ApprovalInput,
  ApprovalRow,
  Payment,
  PaymentFile,
  PaymentInput,
  PaymentItem,
  PaymentRow,
  PrDocQuery,
  PrDocRow,
  PrType,
  PrTypeInput,
  PrTypeKind,
  Purchase,
  PurchaseInput,
  PurchaseRow,
  Repair,
  RepairInput,
  RepairRow,
  RepairUpdateInput,
  RepairUpdateRow,
} from "./procurement-types";
import { getSupabase, MEMO_BUCKET } from "./supabase-server";

/**
 * ทุก query ของระบบจัดซื้อจัดจ้างแจ้งซ่อมอยู่ในไฟล์นี้ไฟล์เดียว (server-only)
 * หน้าเว็บ/server action ห้ามเรียก supabase ตรง ๆ
 */

const REPAIR_PREFIX = "RQ";
const UPDATE_PREFIX = "RU";
const PURCHASE_PREFIX = "PO";
const APPROVAL_PREFIX = "AP";
const PAYMENT_PREFIX = "PV";

/** ปี พ.ศ. ของเอกสาร — ใช้ตัดชุดเลขที่รันนิ่ง */
function beYearOf(date: string): number {
  return Number(date.slice(0, 4)) + 543;
}

async function nextDocNo(prefix: string, date: string, what: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("pr_next_doc_no", {
    doc_prefix: prefix,
    be_year: beYearOf(date),
  });
  if (error) throw new Error(`ออกเลขที่${what}ไม่สำเร็จ: ${error.message}`);
  return data as string;
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

// ---------- ข้อมูลเบื้องต้น: ประเภททรัพย์สิน (1.1.6) / ประเภทวัสดุ (1.3.8) ----------

/** ทั้งสองชุดมีโครงตารางเหมือนกัน จึงใช้โค้ดชุดเดียวกันได้ทั้งหมด */
export const PR_TYPE_TABLE: Record<PrTypeKind, string> = {
  asset: "pr_asset_types",
  material: "pr_material_types",
};

export async function listPrTypes(
  kind: PrTypeKind,
  options: { includeInactive?: boolean } = {},
): Promise<PrType[]> {
  let q = getSupabase()
    .from(PR_TYPE_TABLE[kind])
    .select("id, code, name, sort_order, is_active");
  if (!options.includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("sort_order").order("code");
  if (error) throw new Error(`อ่านรายการประเภทไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as PrType[];
}

export async function insertPrType(kind: PrTypeKind, input: PrTypeInput): Promise<void> {
  const { error } = await getSupabase().from(PR_TYPE_TABLE[kind]).insert(input);
  if (error) {
    throw new Error(
      error.code === "23505"
        ? `รหัส ${input.code} มีอยู่แล้ว กรุณาใช้รหัสอื่น`
        : `บันทึกไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function updatePrType(
  kind: PrTypeKind,
  id: string,
  patch: Partial<PrTypeInput>,
): Promise<void> {
  const { error } = await getSupabase().from(PR_TYPE_TABLE[kind]).update(patch).eq("id", id);
  if (error) {
    throw new Error(
      error.code === "23505"
        ? `รหัส ${patch.code} มีอยู่แล้ว กรุณาใช้รหัสอื่น`
        : `บันทึกไม่สำเร็จ: ${error.message}`,
    );
  }
}

/** จำนวนเอกสารที่ยังอ้างถึงประเภทนี้อยู่ — ใช้เตือนก่อนลบ */
export async function countPrTypeUsage(kind: PrTypeKind, id: string): Promise<number> {
  const table = kind === "asset" ? "pr_repairs" : "pr_purchases";
  const column = kind === "asset" ? "asset_type_id" : "material_type_id";

  const { count, error } = await getSupabase()
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, id);
  if (error) throw new Error(`ตรวจสอบการใช้งานไม่สำเร็จ: ${error.message}`);
  return count ?? 0;
}

/** ลบประเภท — เอกสารที่อ้างถึงจะกลายเป็น "ไม่ระบุ" (on delete set null) ไม่หายไปด้วย */
export async function deletePrType(kind: PrTypeKind, id: string): Promise<void> {
  const { error } = await getSupabase().from(PR_TYPE_TABLE[kind]).delete().eq("id", id);
  if (error) throw new Error(`ลบไม่สำเร็จ: ${error.message}`);
}

// ---------- View รวมใบขอซ่อม + ใบขอซื้อ (หน้าอนุมัติ ข้อ 3 / หน้าสอบถาม ข้อ 5) ----------

function toDocRow(raw: Record<string, unknown>): PrDocRow {
  return {
    ...(raw as unknown as PrDocRow),
    requested_amount: num(raw.requested_amount),
    approved_amount: num(raw.approved_amount),
    actual_amount: num(raw.actual_amount),
  };
}

/**
 * รายการเอกสารตามเงื่อนไข — หน้าอนุมัติ หน้าสอบถาม และ dashboard ใช้ฟังก์ชันเดียวกันนี้
 * (query ชุดเดียวจะได้ไม่มีทางที่ตัวเลขสองหน้าจอไม่ตรงกัน)
 */
export async function listDocs(query: PrDocQuery = {}): Promise<PrDocRow[]> {
  let q = getSupabase().from("v_pr_docs").select("*");

  const eq = {
    kind: query.kind,
    company_id: query.company_id,
    branch_id: query.branch_id,
    urgency: query.urgency,
    doc_status: query.doc_status,
    pay_status: query.pay_status,
    approve_status: query.approve_status,
    job_status: query.job_status,
  };
  for (const [column, value] of Object.entries(eq)) {
    if (value) q = q.eq(column, value);
  }

  if (query.from) q = q.gte("doc_date", query.from);
  if (query.to) q = q.lte("doc_date", query.to);

  const { data, error } = await q
    .order("doc_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 500);
  if (error) throw new Error(`อ่านรายการเอกสารไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => toDocRow(r as Record<string, unknown>));

  // คำค้นอิสระ (เลขที่เอกสาร รายการ ประเภท สาขา ผู้บันทึก)
  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [r.doc_no, r.item_name, r.type_name, r.branch_name, r.company_name, r.created_by_name, r.note]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

/** อ่านเอกสารต้นทางหนึ่งใบในรูปแบบรวม (ใช้ตอนอนุมัติและตอนเบิกจ่าย) */
export async function getDoc(id: string): Promise<PrDocRow | null> {
  const { data, error } = await getSupabase()
    .from("v_pr_docs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านเอกสารไม่สำเร็จ: ${error.message}`);
  return data ? toDocRow(data as Record<string, unknown>) : null;
}

/** อ่านหลายใบพร้อมกันเป็น Map ตาม id — ใช้ตรวจสอบตอนบันทึกใบเบิกจ่าย */
export async function getDocsByIds(ids: string[]): Promise<Map<string, PrDocRow>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await getSupabase().from("v_pr_docs").select("*").in("id", ids);
  if (error) throw new Error(`อ่านเอกสารไม่สำเร็จ: ${error.message}`);

  const map = new Map<string, PrDocRow>();
  for (const raw of data ?? []) {
    const row = toDocRow(raw as Record<string, unknown>);
    map.set(row.id, row);
  }
  return map;
}

// ---------- ใบขอซ่อม (หน้าจอ 1.1) ----------

function toRepairRow(raw: Record<string, unknown>): RepairRow {
  return {
    ...(raw as unknown as RepairRow),
    requested_amount: num(raw.requested_amount),
    approved_amount: num(raw.approved_amount),
    actual_amount: num(raw.actual_amount),
    photo_count: num(raw.photo_count),
    update_count: num(raw.update_count),
    paid_total: num(raw.paid_total),
  };
}

export async function listRepairs(query: PrDocQuery = {}): Promise<RepairRow[]> {
  let q = getSupabase().from("v_pr_repairs").select("*");

  const eq = {
    company_id: query.company_id,
    branch_id: query.branch_id,
    urgency: query.urgency,
    doc_status: query.doc_status,
    pay_status: query.pay_status,
    approve_status: query.approve_status,
    job_status: query.job_status,
  };
  for (const [column, value] of Object.entries(eq)) {
    if (value) q = q.eq(column, value);
  }

  if (query.from) q = q.gte("request_date", query.from);
  if (query.to) q = q.lte("request_date", query.to);

  const { data, error } = await q
    .order("request_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 500);
  if (error) throw new Error(`อ่านรายการใบขอซ่อมไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => toRepairRow(r as Record<string, unknown>));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [r.doc_no, r.item_name, r.damage_detail, r.asset_type_name, r.branch_name, r.tech_name]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getRepair(id: string): Promise<RepairRow | null> {
  const { data, error } = await getSupabase()
    .from("v_pr_repairs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบขอซ่อมไม่สำเร็จ: ${error.message}`);
  return data ? toRepairRow(data as Record<string, unknown>) : null;
}

export async function listRepairPhotos(repairId: string): Promise<string[]> {
  return listPhotos("pr_repair_photos", "repair_id", repairId);
}

/** สร้างใบขอซ่อมใหม่ พร้อมออกเลขที่ตามปี พ.ศ. ของวันที่แจ้ง (ข้อ 1.1.1) */
export async function createRepair(input: RepairInput, photos: string[]): Promise<RepairRow> {
  const doc_no = await nextDocNo(REPAIR_PREFIX, input.request_date, "ใบขอซ่อม");

  const { data, error } = await getSupabase()
    .from("pr_repairs")
    .insert({ ...input, doc_no })
    .select("id")
    .single();
  if (error) throw new Error(`บันทึกใบขอซ่อมไม่สำเร็จ: ${error.message}`);

  const id = (data as Pick<Repair, "id">).id;
  await replacePhotos("pr_repair_photos", "repair_id", id, photos);
  return (await getRepair(id)) as RepairRow;
}

export async function updateRepair(
  id: string,
  input: Partial<RepairInput>,
  photos: string[],
): Promise<void> {
  const { error } = await getSupabase().from("pr_repairs").update(input).eq("id", id);
  if (error) throw new Error(`บันทึกใบขอซ่อมไม่สำเร็จ: ${error.message}`);

  await replacePhotos("pr_repair_photos", "repair_id", id, photos);
}

/** ลบใบขอซ่อม พร้อมรูปของใบขอซ่อมและของใบ update ที่ผูกอยู่ (ไม่ให้ไฟล์ค้างในถัง) */
export async function deleteRepair(id: string): Promise<{ filesDeleted: number }> {
  const updates = await listRepairUpdates({ repair_id: id });
  const updatePhotos = (await Promise.all(updates.map((u) => listUpdatePhotos(u.id)))).flat();
  const paths = [...(await listRepairPhotos(id)), ...updatePhotos];

  await removeProcurementFiles(paths);

  const { error } = await getSupabase().from("pr_repairs").delete().eq("id", id);
  if (error) throw new Error(`ลบใบขอซ่อมไม่สำเร็จ: ${error.message}`);
  return { filesDeleted: paths.length };
}

/** สิ่งที่จะหายไปพร้อมใบขอซ่อมใบนี้ — ใช้เตือนก่อนลบ */
export async function repairDeleteImpact(
  id: string,
): Promise<{ updates: number; photos: number; payments: number }> {
  const supabase = getSupabase();
  const [updates, photos, payments] = await Promise.all([
    supabase.from("pr_repair_updates").select("id", { count: "exact", head: true }).eq("repair_id", id),
    supabase.from("pr_repair_photos").select("id", { count: "exact", head: true }).eq("repair_id", id),
    supabase.from("pr_payment_items").select("id", { count: "exact", head: true }).eq("repair_id", id),
  ]);
  return {
    updates: updates.count ?? 0,
    photos: photos.count ?? 0,
    payments: payments.count ?? 0,
  };
}

// ---------- ใบ update งานซ่อม (หน้าจอ 1.2) ----------

export async function listRepairUpdates(
  query: { repair_id?: string; from?: string; to?: string; keyword?: string; limit?: number } = {},
): Promise<RepairUpdateRow[]> {
  let q = getSupabase().from("v_pr_repair_updates").select("*");

  if (query.repair_id) q = q.eq("repair_id", query.repair_id);
  if (query.from) q = q.gte("update_date", query.from);
  if (query.to) q = q.lte("update_date", query.to);

  const { data, error } = await q
    .order("update_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 300);
  if (error) throw new Error(`อ่านรายการ update ไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => ({
    ...(r as unknown as RepairUpdateRow),
    requested_amount:
      (r as Record<string, unknown>).requested_amount === null
        ? null
        : num((r as Record<string, unknown>).requested_amount),
    photo_count: num((r as Record<string, unknown>).photo_count),
  }));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [r.doc_no, r.repair_no, r.repair_item_name, r.detail, r.recorded_by_name]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getRepairUpdate(id: string): Promise<RepairUpdateRow | null> {
  const { data, error } = await getSupabase()
    .from("v_pr_repair_updates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบ update ไม่สำเร็จ: ${error.message}`);
  if (!data) return null;

  const raw = data as Record<string, unknown>;
  return {
    ...(data as unknown as RepairUpdateRow),
    requested_amount: raw.requested_amount === null ? null : num(raw.requested_amount),
    photo_count: num(raw.photo_count),
  };
}

export async function listUpdatePhotos(updateId: string): Promise<string[]> {
  return listPhotos("pr_repair_update_photos", "update_id", updateId);
}

/**
 * บันทึกใบ update หนึ่งใบ แล้วผลักสถานะใหม่ขึ้นใบขอซ่อมในคราวเดียว
 * ฟังก์ชันนี้เป็นผู้เขียนสถานะใบขอซ่อมจากหน้าจอ 1.2 เพียงตัวเดียว (กันสถานะสองที่ไม่ตรงกัน)
 */
export async function createRepairUpdate(
  input: RepairUpdateInput,
  photos: string[],
): Promise<RepairUpdateRow> {
  const supabase = getSupabase();

  const repair = await getRepair(input.repair_id);
  if (!repair) throw new Error("ไม่พบใบขอซ่อมที่อ้างถึง อาจถูกลบไปแล้ว");

  const doc_no = await nextDocNo(UPDATE_PREFIX, input.update_date, "ใบ update");

  const { data, error } = await supabase
    .from("pr_repair_updates")
    .insert({ ...input, doc_no })
    .select("id")
    .single();
  if (error) throw new Error(`บันทึก update ไม่สำเร็จ: ${error.message}`);

  const updateId = (data as { id: string }).id;
  await replacePhotos("pr_repair_update_photos", "update_id", updateId, photos);

  const patch = applyRepairUpdate(repair, input);
  if (Object.keys(patch).length > 0) {
    const { error: repairError } = await supabase
      .from("pr_repairs")
      .update(patch)
      .eq("id", input.repair_id);
    if (repairError) {
      throw new Error(`บันทึก update แล้ว แต่ปรับสถานะใบขอซ่อมไม่สำเร็จ: ${repairError.message}`);
    }
  }

  return (await getRepairUpdate(updateId)) as RepairUpdateRow;
}

/**
 * ลบใบ update พร้อมรูป
 * หมายเหตุ: สถานะบนใบขอซ่อมไม่ย้อนกลับให้อัตโนมัติ — ถ้าต้องแก้สถานะให้บันทึกใบ update ใหม่
 * (ย้อนอัตโนมัติต้องเดาว่าสถานะก่อนหน้าคืออะไร ซึ่งเดาผิดแล้วข้อมูลเสียหายกว่าเดิม)
 */
export async function deleteRepairUpdate(id: string): Promise<{ filesDeleted: number }> {
  const paths = await listUpdatePhotos(id);
  await removeProcurementFiles(paths);

  const { error } = await getSupabase().from("pr_repair_updates").delete().eq("id", id);
  if (error) throw new Error(`ลบใบ update ไม่สำเร็จ: ${error.message}`);
  return { filesDeleted: paths.length };
}

// ---------- ใบขอจัดซื้อ (หน้าจอ 1.3) ----------

function toPurchaseRow(raw: Record<string, unknown>): PurchaseRow {
  return {
    ...(raw as unknown as PurchaseRow),
    requested_amount: num(raw.requested_amount),
    approved_amount: num(raw.approved_amount),
    actual_amount: num(raw.actual_amount),
    photo_count: num(raw.photo_count),
    paid_total: num(raw.paid_total),
  };
}

export async function listPurchases(query: PrDocQuery = {}): Promise<PurchaseRow[]> {
  let q = getSupabase().from("v_pr_purchases").select("*");

  const eq = {
    company_id: query.company_id,
    branch_id: query.branch_id,
    urgency: query.urgency,
    doc_status: query.doc_status,
    pay_status: query.pay_status,
    approve_status: query.approve_status,
  };
  for (const [column, value] of Object.entries(eq)) {
    if (value) q = q.eq(column, value);
  }

  if (query.from) q = q.gte("request_date", query.from);
  if (query.to) q = q.lte("request_date", query.to);

  const { data, error } = await q
    .order("request_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 500);
  if (error) throw new Error(`อ่านรายการใบขอจัดซื้อไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => toPurchaseRow(r as Record<string, unknown>));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [r.doc_no, r.item_name, r.reason, r.material_type_name, r.branch_name, r.supplier_name]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getPurchase(id: string): Promise<PurchaseRow | null> {
  const { data, error } = await getSupabase()
    .from("v_pr_purchases")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบขอจัดซื้อไม่สำเร็จ: ${error.message}`);
  return data ? toPurchaseRow(data as Record<string, unknown>) : null;
}

export async function listPurchasePhotos(purchaseId: string): Promise<string[]> {
  return listPhotos("pr_purchase_photos", "purchase_id", purchaseId);
}

export async function createPurchase(
  input: PurchaseInput,
  photos: string[],
): Promise<PurchaseRow> {
  const doc_no = await nextDocNo(PURCHASE_PREFIX, input.request_date, "ใบขอจัดซื้อ");

  const { data, error } = await getSupabase()
    .from("pr_purchases")
    .insert({ ...input, doc_no })
    .select("id")
    .single();
  if (error) throw new Error(`บันทึกใบขอจัดซื้อไม่สำเร็จ: ${error.message}`);

  const id = (data as Pick<Purchase, "id">).id;
  await replacePhotos("pr_purchase_photos", "purchase_id", id, photos);
  return (await getPurchase(id)) as PurchaseRow;
}

export async function updatePurchase(
  id: string,
  input: Partial<PurchaseInput>,
  photos: string[],
): Promise<void> {
  const { error } = await getSupabase().from("pr_purchases").update(input).eq("id", id);
  if (error) throw new Error(`บันทึกใบขอจัดซื้อไม่สำเร็จ: ${error.message}`);

  await replacePhotos("pr_purchase_photos", "purchase_id", id, photos);
}

export async function deletePurchase(id: string): Promise<{ filesDeleted: number }> {
  const paths = await listPurchasePhotos(id);
  await removeProcurementFiles(paths);

  const { error } = await getSupabase().from("pr_purchases").delete().eq("id", id);
  if (error) throw new Error(`ลบใบขอจัดซื้อไม่สำเร็จ: ${error.message}`);
  return { filesDeleted: paths.length };
}

export async function purchaseDeleteImpact(
  id: string,
): Promise<{ photos: number; payments: number }> {
  const supabase = getSupabase();
  const [photos, payments] = await Promise.all([
    supabase.from("pr_purchase_photos").select("id", { count: "exact", head: true }).eq("purchase_id", id),
    supabase.from("pr_payment_items").select("id", { count: "exact", head: true }).eq("purchase_id", id),
  ]);
  return { photos: photos.count ?? 0, payments: payments.count ?? 0 };
}

// ---------- ใบอนุมัติ (หน้าจอ 3.1) ----------

function toApprovalRow(raw: Record<string, unknown>): ApprovalRow {
  return { ...(raw as unknown as ApprovalRow), approved_amount: num(raw.approved_amount) };
}

export async function listApprovals(
  query: { repair_id?: string; purchase_id?: string; from?: string; to?: string; limit?: number } = {},
): Promise<ApprovalRow[]> {
  let q = getSupabase().from("v_pr_approvals").select("*");

  if (query.repair_id) q = q.eq("repair_id", query.repair_id);
  if (query.purchase_id) q = q.eq("purchase_id", query.purchase_id);
  if (query.from) q = q.gte("approve_date", query.from);
  if (query.to) q = q.lte("approve_date", query.to);

  const { data, error } = await q
    .order("approve_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 300);
  if (error) throw new Error(`อ่านรายการใบอนุมัติไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((r) => toApprovalRow(r as Record<string, unknown>));
}

/** ใบอนุมัติของเอกสารหนึ่งใบ (ใช้แสดงประวัติการพิจารณาบนหน้ารายละเอียด) */
export async function listApprovalsOfDoc(
  kind: "repair" | "purchase",
  id: string,
): Promise<ApprovalRow[]> {
  return listApprovals(kind === "repair" ? { repair_id: id } : { purchase_id: id });
}

/**
 * บันทึกใบอนุมัติหนึ่งใบ แล้วผลักผลขึ้นเอกสารต้นทางในคราวเดียว
 * ฟังก์ชันนี้เป็นผู้เขียนสถานะอนุมัติเพียงตัวเดียว — หน้าจออื่นไม่แตะช่องพวกนี้
 */
export async function createApproval(input: ApprovalInput): Promise<ApprovalRow> {
  const supabase = getSupabase();
  const targetId = input.repair_id ?? input.purchase_id;
  if (!targetId) throw new Error("ไม่พบเอกสารที่ขออนุมัติ");

  const target = await getDoc(targetId);
  if (!target) throw new Error("ไม่พบเอกสารที่ขออนุมัติ อาจถูกลบไปแล้ว");

  const doc_no = await nextDocNo(APPROVAL_PREFIX, input.approve_date, "ใบอนุมัติ");

  const { data, error } = await supabase
    .from("pr_approvals")
    .insert({ ...input, doc_no })
    .select("id")
    .single();
  if (error) throw new Error(`บันทึกใบอนุมัติไม่สำเร็จ: ${error.message}`);

  const approvalId = (data as Pick<Approval, "id">).id;

  const patch = applyApproval(target, input);
  const table = input.repair_id ? "pr_repairs" : "pr_purchases";
  const { error: targetError } = await supabase
    .from(table)
    .update({ ...patch, reject_note: input.note })
    .eq("id", targetId);
  if (targetError) {
    throw new Error(`บันทึกใบอนุมัติแล้ว แต่ปรับสถานะเอกสารไม่สำเร็จ: ${targetError.message}`);
  }

  const { data: row, error: readError } = await supabase
    .from("v_pr_approvals")
    .select("*")
    .eq("id", approvalId)
    .single();
  if (readError) throw new Error(`อ่านใบอนุมัติที่บันทึกไม่สำเร็จ: ${readError.message}`);
  return toApprovalRow(row as Record<string, unknown>);
}

// ---------- ใบเบิกจ่าย (หน้าจอ 4) ----------

function toPaymentRow(raw: Record<string, unknown>): PaymentRow {
  return {
    ...(raw as unknown as PaymentRow),
    paid_amount: num(raw.paid_amount),
    item_count: num(raw.item_count),
    file_count: num(raw.file_count),
    item_total: num(raw.item_total),
  };
}

export async function listPayments(
  query: { from?: string; to?: string; keyword?: string; branch_id?: string | null; limit?: number } = {},
): Promise<PaymentRow[]> {
  let q = getSupabase().from("v_pr_payments").select("*");

  if (query.branch_id) q = q.eq("branch_id", query.branch_id);
  if (query.from) q = q.gte("pay_date", query.from);
  if (query.to) q = q.lte("pay_date", query.to);

  const { data, error } = await q
    .order("pay_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 300);
  if (error) throw new Error(`อ่านรายการใบเบิกจ่ายไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => toPaymentRow(r as Record<string, unknown>));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [r.doc_no, r.note, r.branch_name, r.company_name, r.created_by_name]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getPayment(id: string): Promise<PaymentRow | null> {
  const { data, error } = await getSupabase()
    .from("v_pr_payments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบเบิกจ่ายไม่สำเร็จ: ${error.message}`);
  return data ? toPaymentRow(data as Record<string, unknown>) : null;
}

export async function listPaymentItems(paymentId: string): Promise<PaymentItem[]> {
  const { data, error } = await getSupabase()
    .from("pr_payment_items")
    .select("id, repair_id, purchase_id, amount, sort_order")
    .eq("payment_id", paymentId)
    .order("sort_order");
  if (error) throw new Error(`อ่านรายการที่อ้างถึงไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map((r) => ({
    ...(r as unknown as PaymentItem),
    amount: num((r as Record<string, unknown>).amount),
  }));
}

export async function listPaymentFiles(paymentId: string): Promise<PaymentFile[]> {
  const { data, error } = await getSupabase()
    .from("pr_payment_files")
    .select("id, kind, path, filename, mime, size_bytes, sort_order")
    .eq("payment_id", paymentId)
    .order("kind")
    .order("sort_order");
  if (error) throw new Error(`อ่านไฟล์แนบไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as PaymentFile[];
}

/**
 * ยอดที่เบิกจ่ายไปแล้วของเอกสารต้นทาง — คำนวณจากรายการเบิกจ่ายทั้งหมดที่อ้างเอกสารนั้น
 * (แหล่งความจริงคือ pr_payment_items ส่วนช่อง actual_amount บนเอกสารคือค่าที่สรุปไว้ให้อ่านเร็ว)
 */
async function syncActualAmount(kind: "repair" | "purchase", docId: string): Promise<void> {
  const supabase = getSupabase();
  const column = kind === "repair" ? "repair_id" : "purchase_id";
  const table = kind === "repair" ? "pr_repairs" : "pr_purchases";

  const { data, error } = await supabase
    .from("pr_payment_items")
    .select("amount")
    .eq(column, docId);
  if (error) throw new Error(`รวมยอดเบิกจ่ายไม่สำเร็จ: ${error.message}`);

  const total = round2((data ?? []).reduce((sum, r) => sum + num((r as { amount: unknown }).amount), 0));

  const { data: doc, error: docError } = await supabase
    .from(table)
    .select("approved_amount")
    .eq("id", docId)
    .maybeSingle();
  if (docError) throw new Error(`อ่านเอกสารต้นทางไม่สำเร็จ: ${docError.message}`);
  if (!doc) return;

  // เบิกครบยอดที่อนุมัติแล้วถือว่าจ่ายจบ ถ้ายังไม่ครบ (รวมถึงถอนรายการออกหมด) ค้างสถานะ "อนุมัติ" ไว้
  const approved = num((doc as { approved_amount: unknown }).approved_amount);
  const pay_status = total > 0 && total >= approved ? "settled" : "approved";

  const { error: updateError } = await supabase
    .from(table)
    .update({ actual_amount: total, pay_status })
    .eq("id", docId);
  if (updateError) throw new Error(`ปรับยอดเบิกจริงไม่สำเร็จ: ${updateError.message}`);
}

/** id ของเอกสารต้นทางทั้งหมดที่ชุดรายการนี้อ้างถึง แยกตามชนิด */
function targetsOf(items: PaymentItem[]): { repairs: string[]; purchases: string[] } {
  const repairs = new Set<string>();
  const purchases = new Set<string>();
  for (const item of items) {
    if (item.repair_id) repairs.add(item.repair_id);
    if (item.purchase_id) purchases.add(item.purchase_id);
  }
  return { repairs: [...repairs], purchases: [...purchases] };
}

async function syncTargets(items: PaymentItem[]): Promise<void> {
  const { repairs, purchases } = targetsOf(items);
  await Promise.all([
    ...repairs.map((id) => syncActualAmount("repair", id)),
    ...purchases.map((id) => syncActualAmount("purchase", id)),
  ]);
}

export async function createPayment(
  input: PaymentInput,
  items: PaymentItem[],
  files: PaymentFile[],
): Promise<PaymentRow> {
  const supabase = getSupabase();
  const doc_no = await nextDocNo(PAYMENT_PREFIX, input.pay_date, "ใบเบิกจ่าย");

  const { data, error } = await supabase
    .from("pr_payments")
    .insert({ ...input, paid_amount: sumItems(items), doc_no })
    .select("id")
    .single();
  if (error) throw new Error(`บันทึกใบเบิกจ่ายไม่สำเร็จ: ${error.message}`);

  const id = (data as Pick<Payment, "id">).id;
  await replacePaymentItems(id, items);
  await replacePaymentFiles(id, files);
  await syncTargets(items);

  return (await getPayment(id)) as PaymentRow;
}

export async function updatePayment(
  id: string,
  input: Partial<PaymentInput>,
  items: PaymentItem[],
  files: PaymentFile[],
): Promise<void> {
  // เอกสารที่ถูกเอาออกจากใบนี้ก็ต้องคำนวณยอดเบิกจริงใหม่ด้วย ไม่งั้นจะค้างยอดเก่า
  const before = await listPaymentItems(id);

  const { error } = await getSupabase()
    .from("pr_payments")
    .update({ ...input, paid_amount: sumItems(items) })
    .eq("id", id);
  if (error) throw new Error(`บันทึกใบเบิกจ่ายไม่สำเร็จ: ${error.message}`);

  await replacePaymentItems(id, items);
  await replacePaymentFiles(id, files);
  await syncTargets([...before, ...items]);
}

export async function deletePayment(id: string): Promise<{ filesDeleted: number }> {
  const [items, files] = await Promise.all([listPaymentItems(id), listPaymentFiles(id)]);

  await removeProcurementFiles(files.map((f) => f.path));

  const { error } = await getSupabase().from("pr_payments").delete().eq("id", id);
  if (error) throw new Error(`ลบใบเบิกจ่ายไม่สำเร็จ: ${error.message}`);

  await syncTargets(items);
  return { filesDeleted: files.length };
}

async function replacePaymentItems(paymentId: string, items: PaymentItem[]): Promise<void> {
  const supabase = getSupabase();

  const { error: delError } = await supabase
    .from("pr_payment_items")
    .delete()
    .eq("payment_id", paymentId);
  if (delError) throw new Error(`อัปเดตรายการที่อ้างถึงไม่สำเร็จ: ${delError.message}`);

  if (items.length === 0) return;

  const { error } = await supabase.from("pr_payment_items").insert(
    items.map((item, i) => ({
      payment_id: paymentId,
      repair_id: item.repair_id,
      purchase_id: item.purchase_id,
      amount: item.amount,
      sort_order: i,
    })),
  );
  if (error) throw new Error(`บันทึกรายการที่อ้างถึงไม่สำเร็จ: ${error.message}`);
}

/** ตั้งชุดไฟล์แนบใหม่ทั้งชุด — ไฟล์ที่ถูกเอาออกจากฟอร์มจะถูกลบออกจากถังด้วย */
async function replacePaymentFiles(paymentId: string, files: PaymentFile[]): Promise<void> {
  const supabase = getSupabase();

  const current = await listPaymentFiles(paymentId);
  const keep = new Set(files.map((f) => f.path));
  const removed = current.filter((f) => !keep.has(f.path)).map((f) => f.path);
  if (removed.length > 0) await removeProcurementFiles(removed);

  const { error: delError } = await supabase
    .from("pr_payment_files")
    .delete()
    .eq("payment_id", paymentId);
  if (delError) throw new Error(`อัปเดตไฟล์แนบไม่สำเร็จ: ${delError.message}`);

  if (files.length === 0) return;

  const { error } = await supabase.from("pr_payment_files").insert(
    files.map((f, i) => ({
      payment_id: paymentId,
      kind: f.kind,
      path: f.path,
      filename: f.filename,
      mime: f.mime,
      size_bytes: f.size_bytes,
      sort_order: i,
    })),
  );
  if (error) throw new Error(`บันทึกไฟล์แนบไม่สำเร็จ: ${error.message}`);
}

// ---------- รูปภาพและไฟล์แนบ ----------

type PhotoTable = "pr_repair_photos" | "pr_repair_update_photos" | "pr_purchase_photos";
type PhotoOwner = "repair_id" | "update_id" | "purchase_id";

async function listPhotos(
  table: PhotoTable,
  ownerColumn: PhotoOwner,
  ownerId: string,
): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from(table)
    .select("path, sort_order")
    .eq(ownerColumn, ownerId)
    .order("sort_order");
  if (error) throw new Error(`อ่านรูปภาพไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((r) => (r as { path: string }).path);
}

/** ตั้งชุดรูปใหม่ทั้งชุด — รูปที่ถูกเอาออกจากฟอร์มจะถูกลบออกจากถังด้วย */
async function replacePhotos(
  table: PhotoTable,
  ownerColumn: PhotoOwner,
  ownerId: string,
  paths: string[],
): Promise<void> {
  const supabase = getSupabase();

  const current = await listPhotos(table, ownerColumn, ownerId);
  const keep = new Set(paths);
  const removed = current.filter((p) => !keep.has(p));
  if (removed.length > 0) await removeProcurementFiles(removed);

  const { error: delError } = await supabase.from(table).delete().eq(ownerColumn, ownerId);
  if (delError) throw new Error(`อัปเดตรูปภาพไม่สำเร็จ: ${delError.message}`);

  if (paths.length === 0) return;

  const { error } = await supabase
    .from(table)
    .insert(paths.map((path, i) => ({ [ownerColumn]: ownerId, path, sort_order: i })));
  if (error) throw new Error(`บันทึกรูปภาพไม่สำเร็จ: ${error.message}`);
}

/** เส้นทางไฟล์: pr/{ชนิด}/{ปีเดือน}/{สุ่ม}.{นามสกุลเดิม} */
export function newProcurementFilePath(prefix: string, originalName = ""): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "") || "file";
  const ext = (originalName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = ext ? `.${ext.slice(0, 8)}` : "";
  return `pr/${safePrefix}/${ym}/${crypto.randomUUID()}${suffix}`;
}

export async function uploadProcurementFile(
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(MEMO_BUCKET)
    .upload(path, bytes, { contentType: contentType || "application/octet-stream", upsert: false });
  if (error) throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${error.message}`);
}

/** ลบไฟล์ออกจากถัง (ทีละก้อน) — เรียกก่อนลบแถวในฐานข้อมูลเสมอ */
export async function removeProcurementFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await getSupabase()
      .storage.from(MEMO_BUCKET)
      .remove(paths.slice(i, i + 100));
    // ลบไฟล์ไม่สำเร็จไม่ควรบล็อกการลบข้อมูล แค่บันทึกไว้
    if (error) console.error("ลบไฟล์แนบของระบบจัดซื้อ/แจ้งซ่อมไม่สำเร็จ:", error.message);
  }
}

/** signed URL ของไฟล์แนบ (ถังนี้เป็น private) */
export async function procurementFileUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await getSupabase().storage.from(MEMO_BUCKET).createSignedUrl(path, 600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
