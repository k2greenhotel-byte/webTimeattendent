"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteBranch, insertBranch, logAudit, updateBranch } from "@/lib/db";
import { isMapsShortLink, parseLatLng, resolveMapsShortLink } from "@/lib/geo";
import { requireAdmin } from "@/lib/session";
import type { Branch } from "@/lib/types";

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

function back(message: string, isError = false): never {
  redirect(`/admin/branches?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
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

  back(COORDS_HELP, true);
}

async function readForm(form: FormData): Promise<Omit<Branch, "id">> {
  const coords = await readCoords(form);

  return {
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
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
  await requireAdmin();
  const row = { ...(await readForm(form)), is_active: true };

  if (!row.code || !row.name) back("กรุณากรอกรหัสสาขาและชื่อสาขา", true);

  try {
    await insertBranch(row);
    await logAudit({ actor_id: null, action: "create_branch", target_table: "branches", after: row });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มสาขาไม่สำเร็จ", true);
  }

  revalidatePath("/admin/branches");
  back(`เพิ่มสาขา ${row.name} เรียบร้อยแล้ว`);
}

export async function updateBranchForm(form: FormData): Promise<void> {
  await requireAdmin();
  const id = str(form, "id");
  const patch = await readForm(form);

  if (!id) back("ไม่พบสาขา", true);
  if (!patch.code || !patch.name) back("กรุณากรอกรหัสสาขาและชื่อสาขา", true);

  try {
    await updateBranch(id, patch);
    await logAudit({
      actor_id: null,
      action: "update_branch",
      target_table: "branches",
      target_id: id,
      after: patch,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกสาขาไม่สำเร็จ", true);
  }

  revalidatePath("/admin/branches");
  back("บันทึกข้อมูลสาขาเรียบร้อยแล้ว");
}

export async function deleteBranchForm(form: FormData): Promise<void> {
  await requireAdmin();
  const id = str(form, "id");
  const force = form.get("force") === "on";

  let affected = 0;
  try {
    ({ affected } = await deleteBranch(id, force));
    await logAudit({
      actor_id: null,
      action: "delete_branch",
      target_table: "branches",
      target_id: id,
      after: { forced: force, employeesUnassigned: affected },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบสาขาไม่สำเร็จ", true);
  }

  revalidatePath("/admin/branches");
  back(
    affected > 0
      ? `ลบสาขาเรียบร้อยแล้ว · พนักงาน ${affected} คนกลายเป็นไม่ระบุสาขา`
      : "ลบสาขาเรียบร้อยแล้ว",
  );
}
