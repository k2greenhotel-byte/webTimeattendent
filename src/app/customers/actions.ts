"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteCustomer,
  insertCustomer,
  updateCustomer,
  type CustomerInput,
} from "@/lib/customer-db";
import {
  isValidNationalId,
  normalizeFacebook,
  normalizeLine,
  normalizeNationalId,
} from "@/lib/customers";
import { logAudit } from "@/lib/db";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { requirePermission } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function back(path: string, message: string, isError = false): never {
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/** รูปถ่าย: PhotoUploader ส่งค่าว่างมาด้วยเสมอ เอาเฉพาะค่าที่ไม่ว่างค่าแรก */
function readPhoto(form: FormData): string | null {
  return form.getAll("photo_path").map(String).find((p) => p.trim().length > 0) ?? null;
}

function readForm(form: FormData, branchId: string | null, companyId: string | null): CustomerInput {
  const nationalId = normalizeNationalId(str(form, "national_id"));
  const geoCode = Number(str(form, "geo_code"));

  return {
    code: str(form, "code").toUpperCase(),
    full_name: str(form, "full_name"),
    phone: normalizePhone(str(form, "phone")) || null,
    address_detail: optText(form, "address_detail"),
    geo_code: Number.isFinite(geoCode) && geoCode > 0 ? geoCode : null,
    postal_code: optText(form, "postal_code"),
    photo_path: readPhoto(form),
    national_id: nationalId || null,
    birth_date: optText(form, "birth_date"),
    facebook_url: normalizeFacebook(str(form, "facebook_url")),
    line_url: normalizeLine(str(form, "line_url")),
    note: optText(form, "note"),
    branch_id: branchId,
    company_id: companyId,
    is_active: form.get("is_active") !== "off",
    created_by: null,
  };
}

/** ตรวจค่าที่ต้องถูกต้องเสมอ ไม่ว่าจะเพิ่มใหม่หรือแก้ไข */
function validate(row: CustomerInput, path: string): void {
  if (!row.code) back(path, "กรุณากรอกรหัสลูกค้า", true);
  if (!row.full_name) back(path, "กรุณากรอกชื่อลูกค้า", true);
  if (row.phone && !isValidPhone(row.phone)) {
    back(path, "เบอร์โทรไม่ถูกต้อง (ตัวอย่าง 0812345678)", true);
  }
  if (row.national_id && !isValidNationalId(row.national_id)) {
    back(path, "เลขบัตรประชาชนไม่ถูกต้อง — ตรวจว่าครบ 13 หลักและไม่พิมพ์ผิด", true);
  }
}

export async function createCustomerForm(form: FormData): Promise<void> {
  const user = await requirePermission("CUST_FORM", "write");
  const row = {
    ...readForm(form, user.branch_id ?? null, user.company_id ?? null),
    created_by: user.id,
  };
  validate(row, "/customers/new");

  let id: string;
  try {
    id = await insertCustomer(row);
    await logAudit({
      actor_id: user.id,
      action: "create_customer",
      target_table: "customers",
      target_id: id,
      after: { code: row.code, full_name: row.full_name },
    });
  } catch (err) {
    back("/customers/new", err instanceof Error ? err.message : "บันทึกลูกค้าไม่สำเร็จ", true);
  }

  revalidatePath("/customers");
  back(`/customers/${id}`, `บันทึกประวัติลูกค้า ${row.full_name} เรียบร้อยแล้ว`);
}

export async function updateCustomerForm(form: FormData): Promise<void> {
  const user = await requirePermission("CUST_FORM", "edit");
  const id = str(form, "id");
  if (!id) back("/customers", "ไม่พบลูกค้าที่ต้องการแก้ไข", true);

  const path = `/customers/${id}`;
  const row = readForm(form, str(form, "branch_id") || null, str(form, "company_id") || null);
  validate(row, path);

  try {
    // created_by ต้องไม่ถูกเขียนทับตอนแก้ไข (คนแก้กับคนสร้างคนละคนได้)
    const { created_by: _ignored, ...patch } = row;
    await updateCustomer(id, patch);
    await logAudit({
      actor_id: user.id,
      action: "update_customer",
      target_table: "customers",
      target_id: id,
      after: { code: row.code, full_name: row.full_name },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "บันทึกลูกค้าไม่สำเร็จ", true);
  }

  revalidatePath(path);
  revalidatePath("/customers");
  back(path, "บันทึกประวัติลูกค้าเรียบร้อยแล้ว");
}

export async function deleteCustomerForm(form: FormData): Promise<void> {
  const user = await requirePermission("CUST_FORM", "delete");
  const id = str(form, "id");
  const path = `/customers/${id}`;

  if (!id) back("/customers", "ไม่พบลูกค้าที่ต้องการลบ", true);
  if (form.get("confirm") !== "on") {
    back(path, 'ต้องติ๊ก "ยืนยันลบ" ก่อน — ลบแล้วประวัติและรูปถ่ายของลูกค้าจะหายทั้งหมด', true);
  }

  let photoDeleted = false;
  try {
    ({ photoDeleted } = await deleteCustomer(id));
    await logAudit({
      actor_id: user.id,
      action: "delete_customer",
      target_table: "customers",
      target_id: id,
      after: { photoDeleted },
    });
  } catch (err) {
    back(path, err instanceof Error ? err.message : "ลบลูกค้าไม่สำเร็จ", true);
  }

  revalidatePath("/customers");
  back(
    "/customers",
    photoDeleted ? "ลบประวัติลูกค้าและรูปถ่ายเรียบร้อยแล้ว" : "ลบประวัติลูกค้าเรียบร้อยแล้ว",
  );
}
