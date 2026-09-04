"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteLookup,
  deleteSchedule,
  insertLookup,
  insertSchedule,
  logAudit,
  setDefaultSchedule,
  updateLookup,
  updateSchedule,
} from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import type { WorkSchedule } from "@/lib/types";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function num(form: FormData, key: string, fallback: number): number {
  const value = Number(str(form, key));
  return Number.isFinite(value) ? value : fallback;
}

function back(message: string, isError = false, companyId?: string | null): never {
  // พากลับมาที่บริษัทเดิม ไม่งั้นหน้าจะเด้งไปบริษัทแรกทุกครั้งที่บันทึก
  const company = companyId ? `company=${companyId}&` : "";
  redirect(`/admin/setup?${company}${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/** บริษัทที่หน้าจอกำลังทำงานอยู่ (ส่งมากับฟอร์มทุกใบ) */
function companyOf(form: FormData): string | null {
  return str(form, "company") || null;
}

function lookupTable(form: FormData): "departments" | "positions" {
  return str(form, "table") === "positions" ? "positions" : "departments";
}

// ---------- แผนก / ตำแหน่ง ----------

export async function createLookupForm(form: FormData): Promise<void> {
  await requireAdmin();
  const table = lookupTable(form);
  const name = str(form, "name");
  const companyId = companyOf(form);
  if (!name) back("กรุณากรอกชื่อ", true, companyId);

  try {
    await insertLookup(table, name, companyId);
    await logAudit({
      actor_id: null,
      action: `create_${table}`,
      target_table: table,
      after: { name, company_id: companyId },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มไม่สำเร็จ", true, companyId);
  }

  revalidatePath("/admin/setup");
  back(`เพิ่ม "${name}" เรียบร้อยแล้ว`, false, companyId);
}

export async function updateLookupForm(form: FormData): Promise<void> {
  await requireAdmin();
  const table = lookupTable(form);
  const id = str(form, "id");
  const companyId = companyOf(form);
  const name = str(form, "name");
  if (!id || !name) back("ข้อมูลไม่ครบ", true, companyId);

  try {
    await updateLookup(table, id, name);
    await logAudit({
      actor_id: null,
      action: `update_${table}`,
      target_table: table,
      target_id: id,
      after: { name },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true, companyId);
  }

  revalidatePath("/admin/setup");
  back("บันทึกเรียบร้อยแล้ว", false, companyId);
}

export async function deleteLookupForm(form: FormData): Promise<void> {
  await requireAdmin();
  const table = lookupTable(form);
  const id = str(form, "id");
  const companyId = companyOf(form);
  const force = form.get("force") === "on";

  let affected = 0;
  try {
    ({ affected } = await deleteLookup(table, id, force));
    await logAudit({
      actor_id: null,
      action: `delete_${table}`,
      target_table: table,
      target_id: id,
      after: { forced: force, employeesAffected: affected },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบไม่สำเร็จ", true, companyId);
  }

  revalidatePath("/admin/setup");
  back(affected > 0 ? `ลบเรียบร้อยแล้ว · พนักงาน ${affected} คนถูกล้างค่านี้` : "ลบเรียบร้อยแล้ว", false, companyId);
}

// ---------- กะทำงาน (เวลาเข้า-ออก) ----------

function readSchedule(form: FormData): Omit<WorkSchedule, "id" | "is_default"> {
  return {
    company_id: companyOf(form),
    name: str(form, "name"),
    work_start: str(form, "work_start") || "08:00",
    break_start: str(form, "break_start") || "12:00",
    break_end: str(form, "break_end") || "13:00",
    work_end: str(form, "work_end") || "17:00",
    break_allow_minutes: num(form, "break_allow_minutes", 60),
    break_policy: form.get("break_policy") === "fixed" ? "fixed" : "actual",
    late_grace_min: num(form, "late_grace_min", 5),
    early_leave_grace_min: num(form, "early_leave_grace_min", 5),
    count_ot: form.get("count_ot") === "on",
    ot_grace_min: num(form, "ot_grace_min", 30),
    workdays: [0, 1, 2, 3, 4, 5, 6].filter((d) => form.get(`workday_${d}`) === "on"),
  };
}

export async function createScheduleForm(form: FormData): Promise<void> {
  await requireAdmin();
  const row = readSchedule(form);
  const companyId = row.company_id;
  if (!row.name) back("กรุณาตั้งชื่อกะทำงาน", true, companyId);
  if (row.workdays.length === 0) row.workdays = [1, 2, 3, 4, 5, 6];

  try {
    await insertSchedule({ ...row, is_default: false });
    await logAudit({
      actor_id: null,
      action: "create_schedule",
      target_table: "work_schedules",
      after: row,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มกะทำงานไม่สำเร็จ", true, companyId);
  }

  revalidatePath("/admin/setup");
  back(`เพิ่มกะ "${row.name}" เรียบร้อยแล้ว`, false, companyId);
}

export async function updateScheduleForm(form: FormData): Promise<void> {
  await requireAdmin();
  const id = str(form, "id");
  const companyId = companyOf(form);
  const patch = readSchedule(form);
  if (!id) back("ไม่พบกะทำงาน", true, companyId);
  if (!patch.name) back("กรุณาตั้งชื่อกะทำงาน", true, companyId);
  if (patch.workdays.length === 0) back("ต้องเลือกวันทำงานอย่างน้อย 1 วัน", true, companyId);

  try {
    await updateSchedule(id, patch);
    await logAudit({
      actor_id: null,
      action: "update_schedule",
      target_table: "work_schedules",
      target_id: id,
      after: patch,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกกะทำงานไม่สำเร็จ", true, companyId);
  }

  revalidatePath("/admin/setup");
  back("บันทึกกะทำงานเรียบร้อยแล้ว", false, companyId);
}

export async function setDefaultScheduleForm(form: FormData): Promise<void> {
  await requireAdmin();
  const id = str(form, "id");
  const companyId = companyOf(form);

  try {
    await setDefaultSchedule(id);
    await logAudit({
      actor_id: null,
      action: "set_default_schedule",
      target_table: "work_schedules",
      target_id: id,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ตั้งกะเริ่มต้นไม่สำเร็จ", true, companyId);
  }

  revalidatePath("/admin/setup");
  back("ตั้งเป็นกะเริ่มต้นเรียบร้อยแล้ว", false, companyId);
}

export async function deleteScheduleForm(form: FormData): Promise<void> {
  await requireAdmin();
  const id = str(form, "id");
  const companyId = companyOf(form);
  const force = form.get("force") === "on";

  try {
    await deleteSchedule(id, force);
    await logAudit({
      actor_id: null,
      action: "delete_schedule",
      target_table: "work_schedules",
      target_id: id,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบกะทำงานไม่สำเร็จ", true, companyId);
  }

  revalidatePath("/admin/setup");
  back("ลบกะทำงานเรียบร้อยแล้ว", false, companyId);
}
