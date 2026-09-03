"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseAmount, resolveDocStatus, validateBooking, validateUpdate } from "@/lib/booking";
import {
  countUpdatesOfBooking,
  createBooking,
  createUpdate,
  deleteBooking,
  deleteUpdate,
  getBooking,
  updateBooking,
} from "@/lib/booking-db";
import {
  RECEIPT_FILE_KINDS,
  REFUND_FILE_KINDS,
  type BookingFile,
  type BookingFileKind,
  type BookingInput,
  type BookingStatus,
  type BookingUpdateInput,
  type CancelReason,
  type ContractStatus,
  type PurchaseType,
  type VehicleStatus,
} from "@/lib/booking-types";
import { logAudit } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { requirePermission } from "@/lib/session";

const ALL_FILE_KINDS: BookingFileKind[] = [...RECEIPT_FILE_KINDS, ...REFUND_FILE_KINDS];

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
 * เอกสารแนบทุกชนิดจากฟอร์ม — FileUploader ส่งมาเป็น JSON หนึ่งบรรทัดต่อไฟล์
 * (ส่งค่าว่างมาด้วยเสมอ เพื่อให้รู้ว่าผู้ใช้ลบไฟล์ออกหมด)
 */
function readFiles(form: FormData): BookingFile[] {
  const files: BookingFile[] = [];

  for (const kind of ALL_FILE_KINDS) {
    for (const raw of form.getAll(`file_${kind}`)) {
      const text = String(raw).trim();
      if (!text) continue;
      try {
        const parsed = JSON.parse(text) as {
          path?: string;
          filename?: string;
          mime?: string | null;
          size?: number | null;
        };
        if (!parsed.path) continue;
        files.push({
          kind,
          path: parsed.path,
          filename: parsed.filename ?? parsed.path.split("/").pop() ?? "ไฟล์แนบ",
          mime: parsed.mime ?? null,
          size_bytes: parsed.size ?? null,
        });
      } catch {
        // บรรทัดที่อ่านไม่ออกให้ข้ามไป ไม่ควรทำให้บันทึกทั้งใบล้มเหลว
      }
    }
  }
  return files;
}

const PURCHASE_TYPES = ["cash", "installment"] as const satisfies readonly PurchaseType[];
const VEHICLE_STATUSES = ["in_stock", "need_order", "ordered"] as const satisfies readonly VehicleStatus[];
const CONTRACT_STATUSES = ["pending", "approved", "rejected"] as const satisfies readonly ContractStatus[];
const BOOKING_STATUSES = [
  "wait_contract",
  "wait_delivery",
  "delivered",
  "cancelled",
] as const satisfies readonly BookingStatus[];
const CANCEL_REASONS = [
  "got_other",
  "contract_rejected",
  "changed_mind",
] as const satisfies readonly CancelReason[];

// ---------- หน้าจอ 1.1 ใบจองรถ ----------

/** อ่านใบจองจากฟอร์ม — สถานะเอกสาร (1.1.17) คำนวณเอง ไม่รับจากฟอร์ม */
function readBooking(
  form: FormData,
  context: { companyId: string | null; createdBy: string | null },
): BookingInput {
  const booking_status = pick(form, "booking_status", BOOKING_STATUSES) ?? "wait_contract";
  const cancel_reason =
    booking_status === "cancelled" ? pick(form, "cancel_reason", CANCEL_REASONS) : null;
  const sale_contract_no = optText(form, "sale_contract_no");
  const refunded = form.get("refunded") === "on";

  return {
    branch_id: optText(form, "branch_id"),
    ref_no: optText(form, "ref_no"),
    booking_date: str(form, "booking_date"),
    customer_id: optText(form, "customer_id"),
    customer_phone: normalizePhone(str(form, "customer_phone")) || null,
    brand_id: optText(form, "brand_id"),
    model_id: optText(form, "model_id"),
    variant_id: optText(form, "variant_id"),
    color_id: optText(form, "color_id"),
    purchase_type: pick(form, "purchase_type", PURCHASE_TYPES) ?? "installment",
    pickup_date: optText(form, "pickup_date"),
    vehicle_status: pick(form, "vehicle_status", VEHICLE_STATUSES) ?? "in_stock",
    deposit_amount: parseAmount(str(form, "deposit_amount")),
    receipt_no: optText(form, "receipt_no"),
    contract_status: pick(form, "contract_status", CONTRACT_STATUSES) ?? "pending",
    doc_status: resolveDocStatus({ booking_status, sale_contract_no, refunded }),
    booking_status,
    cancel_reason,
    sale_contract_no,
    sale_date: optText(form, "sale_date"),
    refunded,
    note: optText(form, "note"),
    company_id: context.companyId,
    created_by: context.createdBy,
  };
}

export async function createBookingForm(form: FormData): Promise<void> {
  const user = await requirePermission("BOOK_ENTRY", "write");
  const path = "/booking/bookings/new";

  const row = readBooking(form, { companyId: user.company_id ?? null, createdBy: user.id });
  const problem = validateBooking(row);
  if (problem) back(path, problem, true);

  let id: string;
  let docNo: string;
  try {
    const created = await createBooking(row, readFiles(form));
    id = created.id;
    docNo = created.doc_no;
    await logAudit({
      actor_id: user.id,
      action: "create_booking",
      target_table: "bk_bookings",
      target_id: id,
      after: { doc_no: docNo, customer_id: row.customer_id, booking_date: row.booking_date },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกใบจองไม่สำเร็จ", true);
  }

  revalidatePath("/booking/bookings");
  back(`/booking/bookings/${id}`, `บันทึกใบจองเลขที่ ${docNo} เรียบร้อยแล้ว`);
}

export async function updateBookingForm(form: FormData): Promise<void> {
  const user = await requirePermission("BOOK_ENTRY", "edit");
  const id = str(form, "id");
  if (!id) back("/booking/bookings", "ไม่พบใบจองที่ต้องการแก้ไข", true);

  const path = `/booking/bookings/${id}`;
  const current = await getBooking(id);
  if (!current) back("/booking/bookings", "ไม่พบใบจองนี้ อาจถูกลบไปแล้ว", true);

  // เลขที่สัญญาขาย/วันที่ขาย/ธงคืนเงิน แก้ได้จากหน้าจอ Update (1.2) เท่านั้น จึงคงค่าเดิมไว้
  const row = {
    ...readBooking(form, { companyId: current.company_id, createdBy: current.created_by }),
    sale_contract_no: current.sale_contract_no,
    sale_date: current.sale_date,
    refunded: current.refunded,
  };
  row.doc_status = resolveDocStatus(row);

  const problem = validateBooking(row);
  if (problem) back(path, problem, true);

  try {
    const { created_by: _keep, ...patch } = row;
    await updateBooking(id, patch, readFiles(form));
    await logAudit({
      actor_id: user.id,
      action: "update_booking",
      target_table: "bk_bookings",
      target_id: id,
      after: { doc_no: current.doc_no, booking_status: row.booking_status },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกใบจองไม่สำเร็จ", true);
  }

  revalidatePath(path);
  revalidatePath("/booking/bookings");
  back(path, "บันทึกใบจองเรียบร้อยแล้ว");
}

export async function deleteBookingForm(form: FormData): Promise<void> {
  const user = await requirePermission("BOOK_ENTRY", "delete");
  const id = str(form, "id");
  const path = `/booking/bookings/${id}`;

  if (!id) back("/booking/bookings", "ไม่พบใบจองที่ต้องการลบ", true);
  if (form.get("confirm") !== "on") {
    const updates = await countUpdatesOfBooking(id);
    back(
      path,
      `ต้องติ๊ก "ยืนยันลบ" ก่อน — ลบแล้วใบ update ${updates} ใบและเอกสารแนบทั้งหมดจะหายตามไปด้วย`,
      true,
    );
  }

  let filesDeleted = 0;
  try {
    ({ filesDeleted } = await deleteBooking(id));
    await logAudit({
      actor_id: user.id,
      action: "delete_booking",
      target_table: "bk_bookings",
      target_id: id,
      after: { filesDeleted },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ลบใบจองไม่สำเร็จ", true);
  }

  revalidatePath("/booking/bookings");
  back("/booking/bookings", `ลบใบจองและเอกสารแนบ ${filesDeleted} ไฟล์เรียบร้อยแล้ว`);
}

// ---------- หน้าจอ 1.2 Update สถานะใบจอง ----------

export async function createUpdateForm(form: FormData): Promise<void> {
  const user = await requirePermission("BOOK_UPDATE", "write");
  const bookingId = str(form, "booking_id");
  const path = bookingId ? `/booking/updates/new?booking=${bookingId}` : "/booking/updates/new";

  const booking_status = pick(form, "booking_status", BOOKING_STATUSES);
  const files = readFiles(form);

  const row: BookingUpdateInput = {
    update_date: str(form, "update_date"),
    booking_id: bookingId,
    vehicle_status: pick(form, "vehicle_status", VEHICLE_STATUSES),
    contract_status: pick(form, "contract_status", CONTRACT_STATUSES),
    booking_status,
    cancel_reason: pick(form, "cancel_reason", CANCEL_REASONS),
    recorded_by: user.id,
    recorded_by_name: str(form, "recorded_by_name") || user.full_name,
    sale_contract_no: optText(form, "sale_contract_no"),
    sale_date: optText(form, "sale_date"),
    refunded: form.get("refunded") === "on",
    note: optText(form, "note"),
  };

  const problem = validateUpdate({ ...row, fileCount: files.length });
  if (problem) back(path, problem, true);

  let docNo = "";
  try {
    const created = await createUpdate(row, files);
    docNo = created.doc_no;
    await logAudit({
      actor_id: user.id,
      action: "create_booking_update",
      target_table: "bk_updates",
      target_id: created.id,
      after: { doc_no: docNo, booking_id: row.booking_id },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึก update ไม่สำเร็จ", true);
  }

  revalidatePath("/booking/updates");
  revalidatePath(`/booking/bookings/${bookingId}`);
  back(`/booking/bookings/${bookingId}`, `บันทึก Update เลขที่ ${docNo} เรียบร้อยแล้ว`);
}

export async function deleteUpdateForm(form: FormData): Promise<void> {
  const user = await requirePermission("BOOK_UPDATE", "delete");
  const id = str(form, "id");
  const bookingId = str(form, "booking_id");
  const path = bookingId ? `/booking/bookings/${bookingId}` : "/booking/updates";

  if (!id) back("/booking/updates", "ไม่พบใบ update ที่ต้องการลบ", true);
  if (form.get("confirm") !== "on") {
    back(
      path,
      'ต้องติ๊ก "ยืนยันลบ" ก่อน — ลบใบ update แล้วสถานะบนใบจองจะไม่ย้อนกลับให้อัตโนมัติ ต้องบันทึกใบใหม่แทน',
      true,
    );
  }

  try {
    const { filesDeleted } = await deleteUpdate(id);
    await logAudit({
      actor_id: user.id,
      action: "delete_booking_update",
      target_table: "bk_updates",
      target_id: id,
      after: { filesDeleted },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ลบใบ update ไม่สำเร็จ", true);
  }

  revalidatePath("/booking/updates");
  revalidatePath(path);
  back(path, "ลบใบ update เรียบร้อยแล้ว — สถานะบนใบจองยังเป็นค่าล่าสุดที่เคยบันทึกไว้");
}
