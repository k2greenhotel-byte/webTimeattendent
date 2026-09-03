"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteBranch, insertBranch, logAudit, updateBranch } from "@/lib/db";
import { isMapsShortLink, parseLatLng, resolveMapsShortLink } from "@/lib/geo";
import { isAdminAuthed, requireCoreAdmin } from "@/lib/session";
import type { Branch } from "@/lib/types";

/**
 * หน้าจอสาขามีสองทางเข้า: ระบบส่วนกลาง (/core/branches) และหลังบ้านลงเวลา (/admin/branches)
 * ใช้ action ชุดเดียวกัน แล้วส่งกลับไปยังหน้าที่กดมา (ช่อง from)
 */
function basePath(form: FormData): string {
  const from = String(form.get("from") ?? "").trim();
  return from === "/admin/branches" ? from : "/core/branches";
}

/** เปิดให้ทั้งผู้ที่ผ่าน PIN หลังบ้าน และผู้ใช้ระดับ admin/ผู้ช่วย admin */
async function gate(): Promise<string | null> {
  if (await isAdminAuthed()) return null;
  return (await requireCoreAdmin()).id;
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function optNum(form: FormData, key: string): number | null {
  const raw = str(form, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function back(form: FormData, message: string, isError = false): never {
  redirect(`${basePath(form)}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

const COORDS_HELP =
  'อ่านพิกัดไม่ออก — วางเป็น "13.7563, 100.5018" หรือลิงก์ Google Maps ก็ได้ ' +
  "ถ้าเป็นลิงก์ของร้านค้า Google จะไม่ส่งตัวเลขพิกัดมาด้วย ให้เปิดลิงก์ในแอป Google Maps " +
  "→ กดค้างที่หมุดจนขึ้นหมุดสีแดง → แตะแถบด้านล่างจะเห็นตัวเลขพิกัด → คัดลอกมาวาง";

/** ช่องเดียว รับได้ทั้งพิกัด "lat, lng", ลิงก์เต็ม และลิงก์ย่อ (ตามรีไดเรกต์ให้) */
async function readCoords(form: FormData) {
  const raw = str(form, "coords");
  if (!raw) return null;

  const direct = parseLatLng(raw);
  if (direct) return direct;

  if (isMapsShortLink(raw)) {
    const resolved = await resolveMapsShortLink(raw);
    if (resolved) return resolved;
  }

  back(form, COORDS_HELP, true);
}

async function readForm(form: FormData): Promise<Omit<Branch, "id">> {
  const coords = await readCoords(form);

  return {
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    company_id: optText(form, "company_id"),
    address: optText(form, "address"),
    phone: optText(form, "phone"),
    site_lat: coords?.lat ?? null,
    site_lng: coords?.lng ?? null,
    radius_m: optNum(form, "radius_m"),
    schedule_id: optText(form, "schedule_id"),
    is_active: form.get("is_active") === "on",
  };
}

export async function createBranchForm(form: FormData): Promise<void> {
  const actor = await gate();
  const row = { ...(await readForm(form)), is_active: true };

  if (!row.code || !row.name) back(form, "กรุณากรอกรหัสสาขาและชื่อสาขา", true);

  try {
    await insertBranch(row);
    await logAudit({ actor_id: actor, action: "create_branch", target_table: "branches", after: row });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "เพิ่มสาขาไม่สำเร็จ", true);
  }

  revalidatePath(basePath(form));
  back(form, `เพิ่มสาขา ${row.name} เรียบร้อยแล้ว`);
}

export async function updateBranchForm(form: FormData): Promise<void> {
  const actor = await gate();
  const id = str(form, "id");
  const patch = await readForm(form);

  if (!id) back(form, "ไม่พบสาขา", true);
  if (!patch.code || !patch.name) back(form, "กรุณากรอกรหัสสาขาและชื่อสาขา", true);

  try {
    await updateBranch(id, patch);
    await logAudit({
      actor_id: actor,
      action: "update_branch",
      target_table: "branches",
      target_id: id,
      after: patch,
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกสาขาไม่สำเร็จ", true);
  }

  revalidatePath(basePath(form));
  back(form, "บันทึกข้อมูลสาขาเรียบร้อยแล้ว");
}

export async function deleteBranchForm(form: FormData): Promise<void> {
  const actor = await gate();
  const id = str(form, "id");
  const force = form.get("force") === "on";

  let affected = 0;
  try {
    ({ affected } = await deleteBranch(id, force));
    await logAudit({
      actor_id: actor,
      action: "delete_branch",
      target_table: "branches",
      target_id: id,
      after: { forced: force, employeesUnassigned: affected },
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ลบสาขาไม่สำเร็จ", true);
  }

  revalidatePath(basePath(form));
  back(
    form,
    affected > 0
      ? `ลบสาขาเรียบร้อยแล้ว · พนักงาน ${affected} คนกลายเป็นไม่ระบุสาขา`
      : "ลบสาขาเรียบร้อยแล้ว",
  );
}
