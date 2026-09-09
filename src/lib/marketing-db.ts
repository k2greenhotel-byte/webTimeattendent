import "server-only";
import { removePhotos, signedPhotoUrl, uploadPhoto } from "./db";
import { computeFlowStatus, expectedAmount } from "./marketing";
import { getSupabase } from "./supabase-server";
import type {
  MktActiveStatus,
  MktActivity,
  MktActivityRow,
  MktOption,
  MktPhoto,
  MktQuery,
  MktReceipt,
  MktSubmission,
} from "./marketing-types";

/**
 * ทุก query ของโมดูลการตลาดอยู่ในไฟล์นี้ไฟล์เดียว (server-only)
 * หน้าเว็บ/server action ห้ามเรียก supabase ตรง ๆ
 */

export const MKT_MASTER_TABLES = {
  staff: "mkt_staff",
  company: "mkt_companies",
  activityType: "mkt_activity_types",
} as const;

export type MktMasterKind = keyof typeof MKT_MASTER_TABLES;

const MASTER_LABEL: Record<MktMasterKind, string> = {
  staff: "พนักงาน",
  company: "บริษัทที่ขอเบิก",
  activityType: "ประเภทกิจกรรม",
};

// ---------- ข้อมูลหลัก (หน้าจอ 4) ----------

export async function listMaster(
  kind: MktMasterKind,
  options: { includeInactive?: boolean } = {},
): Promise<MktOption[]> {
  const columns = kind === "staff" ? "id, code, name, is_active, employee_id" : "id, code, name, is_active";
  let q = getSupabase().from(MKT_MASTER_TABLES[kind]).select(columns);
  if (!options.includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q.order("code");
  if (error) throw new Error(`อ่าน${MASTER_LABEL[kind]}ไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as unknown as MktOption[];
}

/**
 * หาพนักงานการตลาดที่ผูกกับบัญชีเข้าระบบนี้ — ใช้เลือก "ผู้บันทึก" ให้อัตโนมัติ
 * คืน null ถ้ายังไม่ได้ผูก (ผู้ใช้เลือกเองจาก dropdown ได้ตามปกติ)
 */
export async function getStaffIdForEmployee(employeeId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("mkt_staff")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return null;
  return (data?.id as string) ?? null;
}

/** บัญชีเข้าระบบทั้งหมดที่เลือกผูกได้ (ใช้ใน dropdown หน้าค่าเริ่มต้น) */
export async function listLoginAccounts(): Promise<
  { id: string; emp_code: string; full_name: string }[]
> {
  const { data, error } = await getSupabase()
    .from("employees")
    .select("id, emp_code, full_name")
    .eq("is_active", true)
    .order("emp_code");

  if (error) throw new Error(`อ่านรายชื่อบัญชีเข้าระบบไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as { id: string; emp_code: string; full_name: string }[];
}

export async function insertMaster(
  kind: MktMasterKind,
  row: { code: string; name: string; employee_id?: string | null },
): Promise<void> {
  const { error } = await getSupabase().from(MKT_MASTER_TABLES[kind]).insert(row);
  if (error) {
    throw new Error(
      error.code === "23505"
        ? `รหัส ${row.code} ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`
        : `เพิ่ม${MASTER_LABEL[kind]}ไม่สำเร็จ: ${error.message}`,
    );
  }
}

export async function updateMaster(
  kind: MktMasterKind,
  id: string,
  patch: Partial<MktOption>,
): Promise<void> {
  const { error } = await getSupabase().from(MKT_MASTER_TABLES[kind]).update(patch).eq("id", id);
  if (error) {
    if (error.code === "23505") {
      // มี unique 2 ตัวในตารางพนักงาน: รหัส และบัญชีเข้าระบบ
      throw new Error(
        error.message.includes("employee")
          ? "บัญชีเข้าระบบนี้ถูกผูกกับพนักงานคนอื่นแล้ว กรุณาปลดออกจากคนนั้นก่อน"
          : "รหัสนี้ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น",
      );
    }
    throw new Error(`บันทึก${MASTER_LABEL[kind]}ไม่สำเร็จ: ${error.message}`);
  }
}

/** นับจำนวนเอกสารที่อ้างถึงข้อมูลหลักแถวนี้ — ใช้เตือนก่อนลบ */
export async function countMasterUsage(kind: MktMasterKind, id: string): Promise<number> {
  const supabase = getSupabase();
  const column =
    kind === "company" ? "company_id" : kind === "activityType" ? "activity_type_id" : null;

  if (column) {
    const { count, error } = await supabase
      .from("mkt_activities")
      .select("id", { count: "exact", head: true })
      .eq(column, id);
    if (error) throw new Error(`ตรวจสอบการใช้งานไม่สำเร็จ: ${error.message}`);
    return count ?? 0;
  }

  // พนักงานถูกอ้างได้ 3 ที่ (ผู้จัดทำ / ผู้ส่งเบิก / ผู้รับเงิน)
  const counts = await Promise.all([
    supabase.from("mkt_activities").select("id", { count: "exact", head: true }).eq("created_by_staff_id", id),
    supabase.from("mkt_submissions").select("id", { count: "exact", head: true }).eq("submitted_by_staff_id", id),
    supabase.from("mkt_receipts").select("id", { count: "exact", head: true }).eq("received_by_staff_id", id),
  ]);
  return counts.reduce((sum, r) => sum + (r.count ?? 0), 0);
}

/** ลบข้อมูลหลัก — เอกสารที่อ้างถึงจะเหลือค่าว่าง (on delete set null) */
export async function deleteMaster(kind: MktMasterKind, id: string): Promise<void> {
  const { error } = await getSupabase().from(MKT_MASTER_TABLES[kind]).delete().eq("id", id);
  if (error) throw new Error(`ลบ${MASTER_LABEL[kind]}ไม่สำเร็จ: ${error.message}`);
}

// ---------- ใบกิจกรรม (หน้าจอ 1) ----------

const VIEW_COLUMNS = "*";

function toRow(raw: Record<string, unknown>): MktActivityRow {
  return {
    ...(raw as unknown as MktActivityRow),
    request_amount: Number(raw.request_amount ?? 0),
    approved_amount: raw.approved_amount === null || raw.approved_amount === undefined
      ? null
      : Number(raw.approved_amount),
    received_amount: Number(raw.received_amount ?? 0),
    wht_amount: Number(raw.wht_amount ?? 0),
    receipt_count: Number(raw.receipt_count ?? 0),
    settled_short: Boolean(raw.settled_short),
  };
}

/** อ่านรายการใบกิจกรรมพร้อมข้อมูลส่งเบิก/รับเงิน (ใช้ทั้งหน้ารายการ สอบถาม และ dashboard) */
export async function listActivities(query: MktQuery = {}): Promise<MktActivityRow[]> {
  let q = getSupabase().from("v_mkt_activities").select(VIEW_COLUMNS);

  if (query.flow_status) q = q.eq("flow_status", query.flow_status);
  if (query.active_status) q = q.eq("active_status", query.active_status);
  if (query.company_id) q = q.eq("company_id", query.company_id);
  if (query.activity_type_id) q = q.eq("activity_type_id", query.activity_type_id);
  if (query.staff_id) q = q.eq("created_by_staff_id", query.staff_id);
  if (query.from) q = q.gte("activity_date", query.from);
  if (query.to) q = q.lte("activity_date", query.to);

  const { data, error } = await q.order("activity_date", { ascending: false }).order("doc_no", {
    ascending: false,
  });
  if (error) throw new Error(`อ่านรายการกิจกรรมไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => toRow(r as Record<string, unknown>));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    `${r.doc_no} ${r.title} ${r.company_name ?? ""} ${r.memo ?? ""} ${r.postal_no ?? ""} ${r.last_receipt_no ?? ""}`
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getActivityRow(id: string): Promise<MktActivityRow | null> {
  const { data, error } = await getSupabase()
    .from("v_mkt_activities")
    .select(VIEW_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`อ่านใบกิจกรรมไม่สำเร็จ: ${error.message}`);
  return data ? toRow(data as Record<string, unknown>) : null;
}

export async function listActivityPhotos(activityId: string): Promise<MktPhoto[]> {
  const { data, error } = await getSupabase()
    .from("mkt_activity_photos")
    .select("id, path, sort_order")
    .eq("activity_id", activityId)
    .order("sort_order");

  if (error) throw new Error(`อ่านรูปกิจกรรมไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as MktPhoto[];
}

export type ActivityInput = {
  activity_date: string;
  title: string;
  activity_type_id: string | null;
  company_id: string | null;
  created_by_staff_id: string | null;
  memo: string | null;
  request_amount: number;
  approved_amount: number | null;
  active_status: MktActiveStatus;
};

/** สร้างใบกิจกรรมใหม่ พร้อมออกเลขที่เอกสารรันนิ่งตามปี พ.ศ. */
export async function createActivity(
  input: ActivityInput,
  photoPaths: string[],
): Promise<MktActivity> {
  const supabase = getSupabase();
  const beYear = Number(input.activity_date.slice(0, 4)) + 543;

  const { data: docNo, error: docError } = await supabase.rpc("mkt_next_doc_no", {
    be_year: beYear,
  });
  if (docError) throw new Error(`ออกเลขที่เอกสารไม่สำเร็จ: ${docError.message}`);

  const { data, error } = await supabase
    .from("mkt_activities")
    .insert({ ...input, doc_no: docNo, flow_status: "draft" })
    .select("*")
    .single();

  if (error) throw new Error(`บันทึกใบกิจกรรมไม่สำเร็จ: ${error.message}`);

  await replaceActivityPhotos(data.id as string, photoPaths);
  return data as MktActivity;
}

export async function updateActivity(
  id: string,
  input: ActivityInput,
  photoPaths: string[],
): Promise<void> {
  const { error } = await getSupabase().from("mkt_activities").update(input).eq("id", id);
  if (error) throw new Error(`บันทึกใบกิจกรรมไม่สำเร็จ: ${error.message}`);

  await replaceActivityPhotos(id, photoPaths);
}

/** ตั้งชุดรูปของใบกิจกรรมใหม่ทั้งชุด — รูปที่ถูกเอาออกจะถูกลบออกจาก storage ด้วย */
async function replaceActivityPhotos(activityId: string, paths: string[]): Promise<void> {
  const supabase = getSupabase();
  const current = await listActivityPhotos(activityId);

  const keep = new Set(paths);
  const removed = current.filter((p) => !keep.has(p.path)).map((p) => p.path);
  if (removed.length > 0) await removePhotos(removed);

  const { error: delError } = await supabase
    .from("mkt_activity_photos")
    .delete()
    .eq("activity_id", activityId);
  if (delError) throw new Error(`อัปเดตรูปกิจกรรมไม่สำเร็จ: ${delError.message}`);

  if (paths.length === 0) return;

  const { error } = await supabase.from("mkt_activity_photos").insert(
    paths.map((path, i) => ({ activity_id: activityId, path, sort_order: i })),
  );
  if (error) throw new Error(`บันทึกรูปกิจกรรมไม่สำเร็จ: ${error.message}`);
}

/** ลบใบกิจกรรม พร้อมลบรูปทั้งหมดที่เกี่ยวข้องออกจาก storage */
export async function deleteActivity(id: string): Promise<void> {
  const supabase = getSupabase();

  const [photos, submission] = await Promise.all([listActivityPhotos(id), getSubmission(id)]);

  // ใบรับเงินไม่มีไฟล์แนบ และถูกลบตาม cascade อยู่แล้ว จึงเหลือแค่รูปกิจกรรมกับรูปใบส่งเบิก
  const paths = [
    ...photos.map((photo) => photo.path),
    submission?.letter_photo_path,
    submission?.ack_photo_path,
  ].filter((path): path is string => Boolean(path));

  await removePhotos(paths);

  const { error } = await supabase.from("mkt_activities").delete().eq("id", id);
  if (error) throw new Error(`ลบใบกิจกรรมไม่สำเร็จ: ${error.message}`);
}

export async function setActivityActiveStatus(
  id: string,
  status: MktActiveStatus,
): Promise<void> {
  const { error } = await getSupabase()
    .from("mkt_activities")
    .update({ active_status: status })
    .eq("id", id);
  if (error) throw new Error(`เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`);
}

// ---------- ส่งเรื่องเบิกเงิน (หน้าจอ 2) ----------

export async function getSubmission(activityId: string): Promise<MktSubmission | null> {
  const { data, error } = await getSupabase()
    .from("mkt_submissions")
    .select("*")
    .eq("activity_id", activityId)
    .maybeSingle();

  if (error) throw new Error(`อ่านข้อมูลส่งเบิกไม่สำเร็จ: ${error.message}`);
  return (data as MktSubmission) ?? null;
}

export type SubmissionInput = {
  submitted_by_staff_id: string | null;
  submit_date: string;
  postal_no: string | null;
  letter_photo_path: string | null;
  ack_photo_path: string | null;
  active_status: MktActiveStatus;
};

export async function saveSubmission(
  activityId: string,
  input: SubmissionInput,
): Promise<void> {
  const previous = await getSubmission(activityId);

  const { error } = await getSupabase()
    .from("mkt_submissions")
    .upsert({ activity_id: activityId, ...input }, { onConflict: "activity_id" });
  if (error) throw new Error(`บันทึกการส่งเบิกไม่สำเร็จ: ${error.message}`);

  // รูปเดิมที่ถูกแทนที่ต้องลบออกจาก storage ไม่งั้นไฟล์ค้าง
  const orphans = [
    previous?.letter_photo_path !== input.letter_photo_path ? previous?.letter_photo_path : null,
    previous?.ack_photo_path !== input.ack_photo_path ? previous?.ack_photo_path : null,
  ].filter((p): p is string => Boolean(p));
  if (orphans.length > 0) await removePhotos(orphans);

  await refreshFlowStatus(activityId);
}

// ---------- รับเงิน (หน้าจอ 3) ----------

/** ใบรับเงินทุกงวดของใบกิจกรรม เรียงงวดเก่าไปใหม่ */
export async function listReceipts(activityId: string): Promise<MktReceipt[]> {
  const { data, error } = await getSupabase()
    .from("mkt_receipts")
    .select("*, mkt_staff(name)")
    .eq("activity_id", activityId)
    .order("receive_date")
    .order("created_at");

  if (error) throw new Error(`อ่านข้อมูลรับเงินไม่สำเร็จ: ${error.message}`);

  return (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const staff = r.mkt_staff as { name?: string } | null;
    return {
      id: r.id as string,
      activity_id: r.activity_id as string,
      received_by_staff_id: (r.received_by_staff_id as string) ?? null,
      received_by_name: staff?.name ?? null,
      receive_date: r.receive_date as string,
      receipt_no: (r.receipt_no as string) ?? null,
      received_amount: Number(r.received_amount ?? 0),
      wht_amount: Number(r.wht_amount ?? 0),
      active_status: r.active_status as MktActiveStatus,
      created_at: r.created_at as string,
    };
  });
}

export type ReceiptInput = {
  received_by_staff_id: string | null;
  receive_date: string;
  receipt_no: string | null;
  /** ยอดเต็มก่อนหักภาษี ณ ที่จ่าย */
  received_amount: number;
  wht_amount: number;
  active_status: MktActiveStatus;
};

/** บันทึกรับเงินเพิ่ม 1 งวด (ไม่ทับของเดิม) */
export async function addReceipt(activityId: string, input: ReceiptInput): Promise<void> {
  const { error } = await getSupabase()
    .from("mkt_receipts")
    .insert({ activity_id: activityId, ...input });
  if (error) throw new Error(`บันทึกการรับเงินไม่สำเร็จ: ${error.message}`);

  await refreshFlowStatus(activityId);
}

/** ลบใบรับเงิน 1 งวด (เช่นกรอกผิด) แล้วคิดสถานะใหม่ */
export async function deleteReceipt(receiptId: string, activityId: string): Promise<void> {
  const { error } = await getSupabase().from("mkt_receipts").delete().eq("id", receiptId);
  if (error) throw new Error(`ลบงวดรับเงินไม่สำเร็จ: ${error.message}`);

  await refreshFlowStatus(activityId);
}

/**
 * ปิดยอดเพราะบริษัทรถตัดเงิน — จ่ายน้อยกว่าที่ตกลงและจะไม่จ่ายส่วนที่เหลืออีก
 * ปลดออกได้ถ้ากดผิด แล้วสถานะจะกลับไปเป็น "รับเงินบางส่วน" ตามยอดจริง
 */
export async function setSettledShort(
  activityId: string,
  settled: boolean,
  note: string | null,
): Promise<void> {
  const { error } = await getSupabase()
    .from("mkt_activities")
    .update({ settled_short: settled, settled_note: settled ? note : null })
    .eq("id", activityId);
  if (error) throw new Error(`ปิดยอดไม่สำเร็จ: ${error.message}`);

  await refreshFlowStatus(activityId);
}

// ---------- สถานะขั้นตอน ----------

/**
 * เขียนสถานะขั้นตอนของใบกิจกรรมใหม่จากเอกสารที่ผูกอยู่
 * ฟังก์ชันนี้คือ "ผู้เขียน flow_status" เพียงตัวเดียวของทั้งระบบ
 */
export async function refreshFlowStatus(activityId: string): Promise<void> {
  const supabase = getSupabase();

  const [submission, receipts, { data: activity, error: readError }] = await Promise.all([
    getSubmission(activityId),
    listReceipts(activityId),
    supabase
      .from("mkt_activities")
      .select("request_amount, approved_amount, settled_short")
      .eq("id", activityId)
      .single(),
  ]);
  if (readError) throw new Error(`อ่านใบกิจกรรมไม่สำเร็จ: ${readError.message}`);

  const receivedTotal = receipts
    .filter((r) => r.active_status === "active")
    .reduce((sum, r) => sum + r.received_amount, 0);

  const flow_status = computeFlowStatus({
    hasActiveSubmission: submission?.active_status === "active",
    receivedTotal,
    expected: expectedAmount({
      request_amount: Number(activity.request_amount ?? 0),
      approved_amount:
        activity.approved_amount === null ? null : Number(activity.approved_amount),
    }),
    settledShort: Boolean(activity.settled_short),
  });

  const { error } = await supabase
    .from("mkt_activities")
    .update({ flow_status })
    .eq("id", activityId);
  if (error) throw new Error(`อัปเดตสถานะไม่สำเร็จ: ${error.message}`);
}

// ---------- รูปภาพ ----------

/** เส้นทางไฟล์ในถัง storage: mkt/{ปีเดือน}/{สุ่ม}.jpg */
export function newPhotoPath(prefix = "activity"): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `mkt/${ym}/${prefix}-${crypto.randomUUID()}.jpg`;
}

export async function uploadMarketingPhoto(path: string, bytes: ArrayBuffer): Promise<void> {
  await uploadPhoto(path, bytes);
}

export async function marketingPhotoUrl(path: string | null): Promise<string | null> {
  return signedPhotoUrl(path, 600);
}
