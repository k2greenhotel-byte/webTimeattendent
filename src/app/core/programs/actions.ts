"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteMenu,
  deleteProgram,
  insertMenu,
  insertProgram,
  updateMenu,
  updateProgram,
} from "@/lib/core-db";
import type { MenuKind, Program, ProgramMenu } from "@/lib/core-types";
import { logAudit } from "@/lib/db";
import { requireCoreAdmin } from "@/lib/session";

const KINDS: MenuKind[] = ["entry", "inquiry", "report", "dashboard", "setting"];

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function num(form: FormData, key: string, fallback = 0): number {
  const n = Number(str(form, key));
  return Number.isFinite(n) ? n : fallback;
}

function back(message: string, isError = false): never {
  redirect(`/core/programs?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readKind(form: FormData): MenuKind {
  const value = str(form, "kind") as MenuKind;
  return KINDS.includes(value) ? value : "entry";
}

function readProgram(form: FormData): Omit<Program, "id"> {
  return {
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    description: optText(form, "description"),
    path: optText(form, "path"),
    icon: optText(form, "icon"),
    sort_order: num(form, "sort_order"),
    is_active: form.get("is_active") === "on",
  };
}

export async function createProgramForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const row = { ...readProgram(form), is_active: true };

  if (!row.code || !row.name) back("กรุณากรอกรหัสโปรแกรมและชื่อโปรแกรม", true);

  try {
    await insertProgram(row);
    await logAudit({
      actor_id: actor.id,
      action: "create_program",
      target_table: "programs",
      after: row,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มโปรแกรมไม่สำเร็จ", true);
  }

  revalidatePath("/core/programs");
  back(`เพิ่มโปรแกรม ${row.name} เรียบร้อยแล้ว`);
}

export async function updateProgramForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const id = str(form, "id");
  const patch = readProgram(form);

  if (!id) back("ไม่พบโปรแกรมที่ต้องการแก้ไข", true);
  if (!patch.code || !patch.name) back("กรุณากรอกรหัสโปรแกรมและชื่อโปรแกรม", true);

  try {
    await updateProgram(id, patch);
    await logAudit({
      actor_id: actor.id,
      action: "update_program",
      target_table: "programs",
      target_id: id,
      after: patch,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกโปรแกรมไม่สำเร็จ", true);
  }

  revalidatePath("/core/programs");
  back("บันทึกข้อมูลโปรแกรมเรียบร้อยแล้ว");
}

export async function deleteProgramForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const id = str(form, "id");
  const force = form.get("force") === "on";

  let affected = 0;
  try {
    ({ affected } = await deleteProgram(id, force));
    await logAudit({
      actor_id: actor.id,
      action: "delete_program",
      target_table: "programs",
      target_id: id,
      after: { forced: force, menusDeleted: affected },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบโปรแกรมไม่สำเร็จ", true);
  }

  revalidatePath("/core/programs");
  back(
    affected > 0
      ? `ลบโปรแกรมเรียบร้อยแล้ว · ลบเมนูที่ผูกอยู่ ${affected} เมนู พร้อมสิทธิ์ทั้งหมด`
      : "ลบโปรแกรมเรียบร้อยแล้ว",
  );
}

// ---------- เมนู / หน้าจอ ----------

function readMenu(form: FormData): Omit<ProgramMenu, "id"> {
  return {
    program_id: str(form, "program_id"),
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    path: optText(form, "path"),
    kind: readKind(form),
    sort_order: num(form, "sort_order"),
    is_active: form.get("is_active") === "on",
  };
}

export async function createMenuForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const row = { ...readMenu(form), is_active: true };

  if (!row.program_id) back("กรุณาเลือกโปรแกรมของเมนูนี้", true);
  if (!row.code || !row.name) back("กรุณากรอกรหัสเมนูและชื่อเมนู", true);

  try {
    await insertMenu(row);
    await logAudit({
      actor_id: actor.id,
      action: "create_menu",
      target_table: "program_menus",
      after: row,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มเมนูไม่สำเร็จ", true);
  }

  revalidatePath("/core/programs");
  back(`เพิ่มเมนู ${row.name} เรียบร้อยแล้ว — อย่าลืมกำหนดสิทธิ์ให้ระดับต่าง ๆ ด้วย`);
}

export async function updateMenuForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const id = str(form, "id");
  const patch = readMenu(form);

  if (!id) back("ไม่พบเมนูที่ต้องการแก้ไข", true);
  if (!patch.code || !patch.name) back("กรุณากรอกรหัสเมนูและชื่อเมนู", true);

  try {
    await updateMenu(id, patch);
    await logAudit({
      actor_id: actor.id,
      action: "update_menu",
      target_table: "program_menus",
      target_id: id,
      after: patch,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกเมนูไม่สำเร็จ", true);
  }

  revalidatePath("/core/programs");
  back("บันทึกข้อมูลเมนูเรียบร้อยแล้ว");
}

export async function deleteMenuForm(form: FormData): Promise<void> {
  const actor = await requireCoreAdmin();
  const id = str(form, "id");

  if (form.get("confirm") !== "on") back('ต้องติ๊ก "ยืนยัน" ก่อนลบเมนู (สิทธิ์ที่ผูกอยู่จะถูกลบด้วย)', true);

  try {
    await deleteMenu(id);
    await logAudit({
      actor_id: actor.id,
      action: "delete_menu",
      target_table: "program_menus",
      target_id: id,
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบเมนูไม่สำเร็จ", true);
  }

  revalidatePath("/core/programs");
  back("ลบเมนูเรียบร้อยแล้ว");
}
