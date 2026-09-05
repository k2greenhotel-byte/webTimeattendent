import "server-only";
import { applyUpdate, staffNameOf } from "./booking";
import type {
  Booking,
  BookingFile,
  BookingInput,
  BookingQuery,
  BookingRow,
  BookingUpdateInput,
  BookingUpdateRow,
} from "./booking-types";
import { getSupabase, MEMO_BUCKET } from "./supabase-server";

/**
 * ทุก query ของระบบจองรถอยู่ในไฟล์นี้ไฟล์เดียว (server-only)
 * หน้าเว็บ/server action ห้ามเรียก supabase ตรง ๆ
 */

const BOOKING_PREFIX = "BK";
const UPDATE_PREFIX = "BKU";

/** ปี พ.ศ. ของเอกสาร — ใช้ตัดชุดเลขที่รันนิ่ง */
function beYearOf(date: string): number {
  return Number(date.slice(0, 4)) + 543;
}

function toBookingRow(raw: Record<string, unknown>): BookingRow {
  return {
    ...(raw as unknown as BookingRow),
    deposit_amount: Number(raw.deposit_amount ?? 0),
    file_count: Number(raw.file_count ?? 0),
    update_count: Number(raw.update_count ?? 0),
  };
}

// ---------- ใบจอง (หน้าจอ 1.1 / สอบถาม 1.3 / dashboard 1.4) ----------

/** รายการใบจองตามเงื่อนไข — หน้าจอสอบถามและ dashboard ใช้ฟังก์ชันเดียวกันนี้ */
export async function listBookings(query: BookingQuery = {}): Promise<BookingRow[]> {
  let q = getSupabase().from("v_bk_bookings").select("*");

  const eq = {
    branch_id: query.branch_id,
    brand_id: query.brand_id,
    model_id: query.model_id,
    variant_id: query.variant_id,
    color_id: query.color_id,
    purchase_type: query.purchase_type,
    vehicle_status: query.vehicle_status,
    contract_status: query.contract_status,
    doc_status: query.doc_status,
    booking_status: query.booking_status,
    cancel_reason: query.cancel_reason,
  };
  for (const [column, value] of Object.entries(eq)) {
    if (value) q = q.eq(column, value);
  }

  if (query.from) q = q.gte("booking_date", query.from);
  if (query.to) q = q.lte("booking_date", query.to);
  if (query.pickup_from) q = q.gte("pickup_date", query.pickup_from);
  if (query.pickup_to) q = q.lte("pickup_date", query.pickup_to);

  // ใบที่จองก่อนขึ้นก่อน — ใบที่ค้างนานที่สุดต้องอยู่บนสุดของทุกหน้าจอ
  const { data, error } = await q
    .order("booking_date", { ascending: true })
    .order("doc_no", { ascending: true })
    .limit(query.limit ?? 500);
  if (error) throw new Error(`อ่านรายการใบจองไม่สำเร็จ: ${error.message}`);

  let rows = (data ?? []).map((r) => toBookingRow(r as Record<string, unknown>));

  // พนักงานที่รับจองกรองฝั่งนี้ เพราะชื่อที่ใช้จัดกลุ่มมาจาก 2 ช่อง (ชื่อบนใบ → ชื่อบัญชี)
  const staff = (query.staff ?? "").trim();
  if (staff) rows = rows.filter((r) => staffNameOf(r) === staff);

  // คำค้นอิสระ (เลขที่ใบจอง เลขที่อ้างอิง ชื่อลูกค้า เบอร์โทร เลขที่ใบเสร็จ เลขที่สัญญาขาย ชื่อพนักงานที่รับจอง)
  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [
      r.doc_no,
      r.ref_no,
      r.customer_name,
      r.customer_code,
      r.customer_phone,
      r.receipt_no,
      r.sale_contract_no,
      r.taken_by_name,
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getBooking(id: string): Promise<BookingRow | null> {
  const { data, error } = await getSupabase()
    .from("v_bk_bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบจองไม่สำเร็จ: ${error.message}`);
  return data ? toBookingRow(data as Record<string, unknown>) : null;
}

export async function listBookingFiles(bookingId: string): Promise<BookingFile[]> {
  const { data, error } = await getSupabase()
    .from("bk_booking_files")
    .select("id, kind, path, filename, mime, size_bytes, sort_order")
    .eq("booking_id", bookingId)
    .order("kind")
    .order("sort_order");
  if (error) throw new Error(`อ่านเอกสารแนบไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as BookingFile[];
}

/** สร้างใบจองใหม่ พร้อมออกเลขที่ใบจองตามปี พ.ศ. ของวันที่จอง (ข้อ 1.1.1) */
export async function createBooking(
  input: BookingInput,
  files: BookingFile[],
): Promise<BookingRow> {
  const supabase = getSupabase();

  const { data: docNo, error: docError } = await supabase.rpc("bk_next_doc_no", {
    doc_prefix: BOOKING_PREFIX,
    be_year: beYearOf(input.booking_date),
  });
  if (docError) throw new Error(`ออกเลขที่ใบจองไม่สำเร็จ: ${docError.message}`);

  const { data, error } = await supabase
    .from("bk_bookings")
    .insert({ ...input, doc_no: docNo })
    .select("*")
    .single();
  if (error) throw new Error(`บันทึกใบจองไม่สำเร็จ: ${error.message}`);

  const booking = data as Booking;
  await replaceFiles("bk_booking_files", "booking_id", booking.id, files);

  return (await getBooking(booking.id)) as BookingRow;
}

export async function updateBooking(
  id: string,
  input: Partial<BookingInput>,
  files: BookingFile[],
): Promise<void> {
  const { error } = await getSupabase().from("bk_bookings").update(input).eq("id", id);
  if (error) throw new Error(`บันทึกใบจองไม่สำเร็จ: ${error.message}`);

  await replaceFiles("bk_booking_files", "booking_id", id, files);
}

/** ลบใบจอง พร้อมไฟล์แนบทั้งของใบจองและของใบ update ที่ผูกอยู่ (ไม่ให้ไฟล์ค้างในถัง) */
export async function deleteBooking(id: string): Promise<{ filesDeleted: number }> {
  const supabase = getSupabase();

  const updates = await listUpdates({ booking_id: id });
  const updateFiles = (
    await Promise.all(updates.map((u) => listUpdateFiles(u.id)))
  ).flat();
  const paths = [...(await listBookingFiles(id)), ...updateFiles].map((f) => f.path);

  await removeBookingFiles(paths);

  const { error } = await supabase.from("bk_bookings").delete().eq("id", id);
  if (error) throw new Error(`ลบใบจองไม่สำเร็จ: ${error.message}`);
  return { filesDeleted: paths.length };
}

/**
 * ชื่อพนักงานที่รับจองที่มีอยู่จริงในใบจอง — ใช้เป็นตัวเลือกของช่องกรองในหน้าสอบถาม/dashboard
 * (ไม่ได้ดึงจากทะเบียนพนักงานทั้งหมด เพราะต้องการเฉพาะคนที่มีใบจองอยู่จริง)
 */
export async function listBookingStaffNames(): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("v_bk_bookings")
    .select("taken_by_name, taken_by_full_name")
    .limit(2000);
  if (error) throw new Error(`อ่านรายชื่อพนักงานที่รับจองไม่สำเร็จ: ${error.message}`);

  const names = new Set<string>();
  for (const row of data ?? []) {
    names.add(staffNameOf(row as { taken_by_name?: string | null; taken_by_full_name?: string | null }));
  }
  return [...names].sort((a, b) => a.localeCompare(b, "th"));
}

/** จำนวนใบ update ที่ผูกกับใบจองนี้ — ใช้เตือนก่อนลบ */
export async function countUpdatesOfBooking(bookingId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("bk_updates")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId);
  if (error) throw new Error(`นับใบ update ไม่สำเร็จ: ${error.message}`);
  return count ?? 0;
}

// ---------- ใบ update สถานะ (หน้าจอ 1.2) ----------

export async function listUpdates(
  query: { booking_id?: string; from?: string; to?: string; keyword?: string; limit?: number } = {},
): Promise<BookingUpdateRow[]> {
  let q = getSupabase().from("v_bk_updates").select("*");

  if (query.booking_id) q = q.eq("booking_id", query.booking_id);
  if (query.from) q = q.gte("update_date", query.from);
  if (query.to) q = q.lte("update_date", query.to);

  const { data, error } = await q
    .order("update_date", { ascending: false })
    .order("doc_no", { ascending: false })
    .limit(query.limit ?? 300);
  if (error) throw new Error(`อ่านรายการ update ไม่สำเร็จ: ${error.message}`);

  const rows = (data ?? []).map((r) => ({
    ...(r as unknown as BookingUpdateRow),
    file_count: Number((r as Record<string, unknown>).file_count ?? 0),
  }));

  const keyword = (query.keyword ?? "").trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((r) =>
    [r.doc_no, r.booking_no, r.booking_ref_no, r.customer_name, r.recorded_by_name]
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

export async function getUpdate(id: string): Promise<BookingUpdateRow | null> {
  const { data, error } = await getSupabase()
    .from("v_bk_updates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`อ่านใบ update ไม่สำเร็จ: ${error.message}`);
  if (!data) return null;
  return {
    ...(data as unknown as BookingUpdateRow),
    file_count: Number((data as Record<string, unknown>).file_count ?? 0),
  };
}

export async function listUpdateFiles(updateId: string): Promise<BookingFile[]> {
  const { data, error } = await getSupabase()
    .from("bk_update_files")
    .select("id, kind, path, filename, mime, size_bytes, sort_order")
    .eq("update_id", updateId)
    .order("kind")
    .order("sort_order");
  if (error) throw new Error(`อ่านเอกสารแนบไม่สำเร็จ: ${error.message}`);
  return (data ?? []) as BookingFile[];
}

/**
 * บันทึกใบ update หนึ่งใบ แล้วผลักสถานะใหม่ขึ้นใบจองในคราวเดียว
 * ฟังก์ชันนี้เป็นผู้เขียนสถานะใบจองจากหน้าจอ 1.2 เพียงตัวเดียว (กันสถานะสองที่ไม่ตรงกัน)
 */
export async function createUpdate(
  input: BookingUpdateInput,
  files: BookingFile[],
): Promise<BookingUpdateRow> {
  const supabase = getSupabase();

  const booking = await getBooking(input.booking_id);
  if (!booking) throw new Error("ไม่พบใบจองที่อ้างถึง อาจถูกลบไปแล้ว");

  const { data: docNo, error: docError } = await supabase.rpc("bk_next_doc_no", {
    doc_prefix: UPDATE_PREFIX,
    be_year: beYearOf(input.update_date),
  });
  if (docError) throw new Error(`ออกเลขที่ update ไม่สำเร็จ: ${docError.message}`);

  const { data, error } = await supabase
    .from("bk_updates")
    .insert({ ...input, doc_no: docNo })
    .select("id")
    .single();
  if (error) throw new Error(`บันทึก update ไม่สำเร็จ: ${error.message}`);

  const updateId = (data as { id: string }).id;
  await replaceFiles("bk_update_files", "update_id", updateId, files);

  // ผลักสถานะใหม่ขึ้นใบจอง (รวมสถานะเอกสารตามข้อ 1.2.13)
  const patch = applyUpdate(booking, input);
  const { error: bookingError } = await supabase
    .from("bk_bookings")
    .update(patch)
    .eq("id", input.booking_id);
  if (bookingError) {
    throw new Error(`บันทึก update แล้ว แต่ปรับสถานะใบจองไม่สำเร็จ: ${bookingError.message}`);
  }

  return (await getUpdate(updateId)) as BookingUpdateRow;
}

/**
 * ลบใบ update พร้อมไฟล์แนบ
 * หมายเหตุ: สถานะบนใบจองไม่ถูกย้อนกลับให้อัตโนมัติ — ถ้าต้องแก้สถานะให้บันทึกใบ update ใหม่
 * (ย้อนอัตโนมัติต้องเดาว่าสถานะก่อนหน้าคืออะไร ซึ่งเดาผิดแล้วข้อมูลเสียหายกว่าเดิม)
 */
export async function deleteUpdate(id: string): Promise<{ filesDeleted: number }> {
  const files = await listUpdateFiles(id);
  await removeBookingFiles(files.map((f) => f.path));

  const { error } = await getSupabase().from("bk_updates").delete().eq("id", id);
  if (error) throw new Error(`ลบใบ update ไม่สำเร็จ: ${error.message}`);
  return { filesDeleted: files.length };
}

// ---------- เอกสารแนบ ----------

/** ตั้งชุดไฟล์แนบใหม่ทั้งชุด — ไฟล์ที่ถูกเอาออกจากฟอร์มจะถูกลบออกจากถังด้วย */
async function replaceFiles(
  table: "bk_booking_files" | "bk_update_files",
  ownerColumn: "booking_id" | "update_id",
  ownerId: string,
  files: BookingFile[],
): Promise<void> {
  const supabase = getSupabase();

  const current =
    table === "bk_booking_files" ? await listBookingFiles(ownerId) : await listUpdateFiles(ownerId);

  const keep = new Set(files.map((f) => f.path));
  const removed = current.filter((f) => !keep.has(f.path)).map((f) => f.path);
  if (removed.length > 0) await removeBookingFiles(removed);

  const { error: delError } = await supabase.from(table).delete().eq(ownerColumn, ownerId);
  if (delError) throw new Error(`อัปเดตเอกสารแนบไม่สำเร็จ: ${delError.message}`);

  if (files.length === 0) return;

  const { error } = await supabase.from(table).insert(
    files.map((f, i) => ({
      [ownerColumn]: ownerId,
      kind: f.kind,
      path: f.path,
      filename: f.filename,
      mime: f.mime,
      size_bytes: f.size_bytes,
      sort_order: i,
    })),
  );
  if (error) throw new Error(`บันทึกเอกสารแนบไม่สำเร็จ: ${error.message}`);
}

/** เส้นทางไฟล์แนบ: book/files/{ปีเดือน}/{สุ่ม}.{นามสกุลเดิม} */
export function newBookingFilePath(originalName: string): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ext = (originalName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = ext ? `.${ext.slice(0, 8)}` : "";
  return `book/files/${ym}/${crypto.randomUUID()}${suffix}`;
}

export async function uploadBookingFile(
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
export async function removeBookingFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await getSupabase()
      .storage.from(MEMO_BUCKET)
      .remove(paths.slice(i, i + 100));
    // ลบไฟล์ไม่สำเร็จไม่ควรบล็อกการลบข้อมูล แค่บันทึกไว้
    if (error) console.error("ลบเอกสารแนบใบจองไม่สำเร็จ:", error.message);
  }
}

/** signed URL ของไฟล์แนบ (ถังนี้เป็น private) */
export async function bookingFileUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await getSupabase().storage.from(MEMO_BUCKET).createSignedUrl(path, 600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
