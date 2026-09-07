import "server-only";
import { applyClaimUpdate } from "./claim";
import type {
  Claim,
  ClaimInput,
  ClaimItem,
  ClaimQuery,
  ClaimRow,
  ClaimUpdateInput,
  ClaimUpdateRow,
} from "./claim-types";
import { getSupabase, MEMO_BUCKET } from "./supabase-server";

/**
 * ทุก query ของระบบแจ้งเคลมอยู่ในไฟล์นี้ไฟล์เดียว (server-only)
 * หน้าเว็บ/server action ห้ามเรียก supabase ตรง ๆ
 */

const CLAIM_PREFIX = "CM";
const UPDATE_PREFIX = "CMU";

/** ปี พ.ศ. ของเอกสาร — ใช้ตัดชุดเลขที่รันนิ่ง */
function beYearOf(date: string): number {
  return Number(date.slice(0, 4)) + 543;
}

async function nextDocNo(prefix: string, date: string, what: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("cl_next_doc_no", {
    doc_prefix: prefix,
    be_year: beYearOf(date),
  });
  if (error) throw new Error(`ออกเลขที่${what}ไม่สำเร็จ: ${error.message}`);
  return data as string;
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function toClaimRow(raw: Record<string, unknown>): ClaimRow {
  return {
    ...(raw as unknown as ClaimRow),
    requested_amount: num(raw.requested_amount),
    photo_count: num(raw.photo_count),
    item_count: num(raw.item_count),
    update_count: num(raw.update_count),
  };
}

// ---------- ใบขอเคลม (หน้าจอ 1.4 / สอบถาม ข้อ 2 / dashboard ข้อ 3) ----------

/** รายการใบขอเคลมตามเงื่อนไข — หน้าจอรายการ สอบถาม และ dashboard ใช้ฟังก์ชันเดียวกันนี้ */
export async function listClaims(query: ClaimQuery = {}): Promise<ClaimRow[]> {
  let q = getSupabase().from("v_cl_claims").select("*");

  const eq = {
    company_id: query.company_id,
    branch_id: query.branch_id,
    urgency: query.urgency,
    doc_status: query.doc_status,
    job_status: query.job_status,
  };
  for (const [column, value] of Object.entries(eq)) {
    if (value) q = q.eq(column, value);
  }

  if (query.external === "1") q = q.eq("is_external", true);
  if (query.external === "0") q = q.eq("is_external", false);
  if (query.from) q = q.gte("claim_date", query.from);
  if (query.to) q = q.lte("claim_date", query.to);

  // ใบที่แจ้งก่อนขึ้นก่อน — ใบที่ค้างนานที่สุดต้องอยู่บนสุดของทุกหน้าจอ
  const { data, error } = await q
    .order("claim_date", { ascending: true })
    .order("doc_no", { ascending: true })
    .limit(query.limit ?? 500);
  if (error) throw new Error(`อ่านรายการใบขอเคลมไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => toClaimRow(r as Record<string, unknown>));

  // คำค้นอิสระ (เลขที่ใบ เลขตัวถัง เลขเครื่อง ชื่อ/เบอร์ลูกค้า รุ่นรถ ผู้ผลิต รายการที่ขอเคลม)
  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [
      r.doc_no,
      r.chassis_no,
      r.engine_no,
      r.customer_name,
      r.customer_phone,
      r.db2_cuscod,
      r.db2_contno,
      r.db2_brand_name,
      r.db2_model_name,
      r.db2_variant_name,
      r.db2_color_name,
      r.maker_name,
      r.maker_agent_name,
      r.item_summary,
      r.created_by_name,
      r.job_no,
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getClaim(id: string): Promise<ClaimRow | null> {
  const { data, error } = await getSupabase()
    .from("v_cl_claims")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบขอเคลมไม่สำเร็จ: ${error.message}`);
  return data ? toClaimRow(data as Record<string, unknown>) : null;
}

export async function listClaimItems(claimId: string): Promise<ClaimItem[]> {
  const { data, error } = await getSupabase()
    .from("cl_claim_items")
    .select("id, item_name, qty, note, sort_order")
    .eq("claim_id", claimId)
    .order("sort_order");
  if (error) throw new Error(`อ่านรายการที่ขอเคลมไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((r) => ({ ...(r as ClaimItem), qty: num((r as ClaimItem).qty) }));
}

export async function listClaimPhotos(claimId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("cl_claim_photos")
    .select("path, sort_order")
    .eq("claim_id", claimId)
    .order("sort_order");
  if (error) throw new Error(`อ่านรูปภาพไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((r) => (r as { path: string }).path);
}

/** สร้างใบขอเคลมใหม่ พร้อมออกเลขที่ตามปี พ.ศ. ของวันที่แจ้ง (ข้อ 1.4.1) */
export async function createClaim(
  input: ClaimInput,
  items: ClaimItem[],
  photos: string[],
): Promise<ClaimRow> {
  const doc_no = await nextDocNo(CLAIM_PREFIX, input.claim_date, "ใบขอเคลม");

  const { data, error } = await getSupabase()
    .from("cl_claims")
    .insert({ ...input, doc_no })
    .select("id")
    .single();
  if (error) throw new Error(`บันทึกใบขอเคลมไม่สำเร็จ: ${error.message}`);

  const id = (data as Pick<Claim, "id">).id;
  await replaceItems(id, items);
  await replacePhotos("cl_claim_photos", "claim_id", id, photos);

  return (await getClaim(id)) as ClaimRow;
}

export async function updateClaim(
  id: string,
  input: Partial<ClaimInput>,
  items: ClaimItem[],
  photos: string[],
): Promise<void> {
  const { error } = await getSupabase().from("cl_claims").update(input).eq("id", id);
  if (error) throw new Error(`บันทึกใบขอเคลมไม่สำเร็จ: ${error.message}`);

  await replaceItems(id, items);
  await replacePhotos("cl_claim_photos", "claim_id", id, photos);
}

/** ลบใบขอเคลม พร้อมรูปของใบและของใบ update ที่ผูกอยู่ (ไม่ให้ไฟล์ค้างในถัง) */
export async function deleteClaim(id: string): Promise<{ filesDeleted: number }> {
  const updates = await listClaimUpdates({ claim_id: id });
  const updatePhotos = (await Promise.all(updates.map((u) => listUpdatePhotos(u.id)))).flat();
  const paths = [...(await listClaimPhotos(id)), ...updatePhotos];

  await removeClaimFiles(paths);

  const { error } = await getSupabase().from("cl_claims").delete().eq("id", id);
  if (error) throw new Error(`ลบใบขอเคลมไม่สำเร็จ: ${error.message}`);
  return { filesDeleted: paths.length };
}

/** สิ่งที่จะหายไปพร้อมใบขอเคลมใบนี้ — ใช้เตือนก่อนลบ */
export async function claimDeleteImpact(
  id: string,
): Promise<{ updates: number; photos: number; items: number }> {
  const supabase = getSupabase();
  const [updates, photos, items] = await Promise.all([
    supabase.from("cl_claim_updates").select("id", { count: "exact", head: true }).eq("claim_id", id),
    supabase.from("cl_claim_photos").select("id", { count: "exact", head: true }).eq("claim_id", id),
    supabase.from("cl_claim_items").select("id", { count: "exact", head: true }).eq("claim_id", id),
  ]);
  return { updates: updates.count ?? 0, photos: photos.count ?? 0, items: items.count ?? 0 };
}

// ---------- ใบ update งานเคลม (หน้าจอ 1.5) ----------

function toUpdateRow(raw: Record<string, unknown>): ClaimUpdateRow {
  return {
    ...(raw as unknown as ClaimUpdateRow),
    requested_amount:
      raw.requested_amount === null || raw.requested_amount === undefined
        ? null
        : num(raw.requested_amount),
    photo_count: num(raw.photo_count),
  };
}

export async function listClaimUpdates(
  query: {
    claim_id?: string;
    company_id?: string | null;
    branch_id?: string | null;
    from?: string | null;
    to?: string | null;
    keyword?: string;
    limit?: number;
  } = {},
): Promise<ClaimUpdateRow[]> {
  let q = getSupabase().from("v_cl_claim_updates").select("*");

  if (query.claim_id) q = q.eq("claim_id", query.claim_id);
  if (query.company_id) q = q.eq("company_id", query.company_id);
  if (query.branch_id) q = q.eq("branch_id", query.branch_id);
  if (query.from) q = q.gte("update_date", query.from);
  if (query.to) q = q.lte("update_date", query.to);

  const { data, error } = await q
    .order("update_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 300);
  if (error) throw new Error(`อ่านรายการ update ไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => toUpdateRow(r as Record<string, unknown>));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [
      r.doc_no,
      r.claim_no,
      r.claim_chassis_no,
      r.claim_customer_name,
      r.detail,
      r.recorded_by_name,
      r.job_no,
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getClaimUpdate(id: string): Promise<ClaimUpdateRow | null> {
  const { data, error } = await getSupabase()
    .from("v_cl_claim_updates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบ update ไม่สำเร็จ: ${error.message}`);
  return data ? toUpdateRow(data as Record<string, unknown>) : null;
}

export async function listUpdatePhotos(updateId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("cl_claim_update_photos")
    .select("path, sort_order")
    .eq("update_id", updateId)
    .order("sort_order");
  if (error) throw new Error(`อ่านรูปภาพไม่สำเร็จ: ${error.message}`);
  return (data ?? []).map((r) => (r as { path: string }).path);
}

/**
 * บันทึกใบ update หนึ่งใบ แล้วผลักสถานะใหม่ขึ้นใบขอเคลมในคราวเดียว
 * ฟังก์ชันนี้เป็นผู้เขียนสถานะใบขอเคลมจากหน้าจอ 1.5 เพียงตัวเดียว (กันสถานะสองที่ไม่ตรงกัน)
 */
export async function createClaimUpdate(
  input: ClaimUpdateInput,
  photos: string[],
): Promise<ClaimUpdateRow> {
  const supabase = getSupabase();

  const claim = await getClaim(input.claim_id);
  if (!claim) throw new Error("ไม่พบใบขอเคลมที่อ้างถึง อาจถูกลบไปแล้ว");

  const doc_no = await nextDocNo(UPDATE_PREFIX, input.update_date, "ใบ update งานเคลม");

  const { data, error } = await supabase
    .from("cl_claim_updates")
    .insert({ ...input, doc_no })
    .select("id")
    .single();
  if (error) throw new Error(`บันทึก update ไม่สำเร็จ: ${error.message}`);

  const updateId = (data as { id: string }).id;
  await replacePhotos("cl_claim_update_photos", "update_id", updateId, photos);

  const patch = applyClaimUpdate(claim, input);
  if (Object.keys(patch).length > 0) {
    const { error: claimError } = await supabase
      .from("cl_claims")
      .update(patch)
      .eq("id", input.claim_id);
    if (claimError) {
      throw new Error(`บันทึก update แล้ว แต่ปรับสถานะใบขอเคลมไม่สำเร็จ: ${claimError.message}`);
    }
  }

  return (await getClaimUpdate(updateId)) as ClaimUpdateRow;
}

/**
 * ลบใบ update พร้อมรูปภาพ
 * หมายเหตุ: สถานะบนใบขอเคลมไม่ถูกย้อนกลับให้อัตโนมัติ — ถ้าต้องแก้สถานะให้บันทึกใบ update ใหม่
 * (ย้อนอัตโนมัติต้องเดาว่าสถานะก่อนหน้าคืออะไร ซึ่งเดาผิดแล้วข้อมูลเสียหายกว่าเดิม)
 */
export async function deleteClaimUpdate(id: string): Promise<{ filesDeleted: number }> {
  const paths = await listUpdatePhotos(id);
  await removeClaimFiles(paths);

  const { error } = await getSupabase().from("cl_claim_updates").delete().eq("id", id);
  if (error) throw new Error(`ลบใบ update ไม่สำเร็จ: ${error.message}`);
  return { filesDeleted: paths.length };
}

// ---------- รายการที่ขอเคลม และรูปภาพ ----------

/** ตั้งชุดรายการที่ขอเคลมใหม่ทั้งชุด (ข้อ 1.4.10) — รายการที่ถูกลบออกจากฟอร์มจะหายไปด้วย */
async function replaceItems(claimId: string, items: ClaimItem[]): Promise<void> {
  const supabase = getSupabase();

  const { error: delError } = await supabase.from("cl_claim_items").delete().eq("claim_id", claimId);
  if (delError) throw new Error(`อัปเดตรายการที่ขอเคลมไม่สำเร็จ: ${delError.message}`);

  const rows = items.filter((i) => i.item_name.trim());
  if (rows.length === 0) return;

  const { error } = await supabase.from("cl_claim_items").insert(
    rows.map((item, i) => ({
      claim_id: claimId,
      item_name: item.item_name.trim(),
      qty: item.qty,
      note: item.note,
      sort_order: i,
    })),
  );
  if (error) throw new Error(`บันทึกรายการที่ขอเคลมไม่สำเร็จ: ${error.message}`);
}

/** ตั้งชุดรูปใหม่ทั้งชุด — รูปที่ถูกเอาออกจากฟอร์มจะถูกลบออกจากถังด้วย */
async function replacePhotos(
  table: "cl_claim_photos" | "cl_claim_update_photos",
  ownerColumn: "claim_id" | "update_id",
  ownerId: string,
  paths: string[],
): Promise<void> {
  const supabase = getSupabase();

  const current =
    table === "cl_claim_photos" ? await listClaimPhotos(ownerId) : await listUpdatePhotos(ownerId);

  const keep = new Set(paths);
  const removed = current.filter((p) => !keep.has(p));
  if (removed.length > 0) await removeClaimFiles(removed);

  const { error: delError } = await supabase.from(table).delete().eq(ownerColumn, ownerId);
  if (delError) throw new Error(`อัปเดตรูปภาพไม่สำเร็จ: ${delError.message}`);

  if (paths.length === 0) return;

  const { error } = await supabase
    .from(table)
    .insert(paths.map((path, i) => ({ [ownerColumn]: ownerId, path, sort_order: i })));
  if (error) throw new Error(`บันทึกรูปภาพไม่สำเร็จ: ${error.message}`);
}

/** เส้นทางไฟล์: claim/{ชนิด}/{ปีเดือน}/{สุ่ม}.{นามสกุลเดิม} */
export function newClaimFilePath(prefix: string, originalName = ""): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "") || "file";
  const ext = (originalName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = ext ? `.${ext.slice(0, 8)}` : "";
  return `claim/${safePrefix}/${ym}/${crypto.randomUUID()}${suffix}`;
}

export async function uploadClaimFile(
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
export async function removeClaimFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await getSupabase()
      .storage.from(MEMO_BUCKET)
      .remove(paths.slice(i, i + 100));
    // ลบไฟล์ไม่สำเร็จไม่ควรบล็อกการลบข้อมูล แค่บันทึกไว้
    if (error) console.error("ลบรูปของระบบแจ้งเคลมไม่สำเร็จ:", error.message);
  }
}

/** signed URL ของรูป (ถังนี้เป็น private) */
export async function claimFileUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await getSupabase().storage.from(MEMO_BUCKET).createSignedUrl(path, 600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
