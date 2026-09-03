"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { normalizeCode, specOf, validateMasterInput, type MotoMasterSpec } from "@/lib/moto";
import {
  countMasterUsage,
  deleteMaster,
  getMaster,
  insertMaster,
  updateMaster,
} from "@/lib/moto-db";
import type { MotoMasterInput } from "@/lib/moto-types";
import { requirePermission } from "@/lib/session";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

/** กลับไปหน้าเดิมพร้อมข้อความ — ข้อมูลหลักคนละชุดอยู่คนละ URL */
function back(spec: MotoMasterSpec | null, message: string, isError = false): never {
  const path = spec ? `/moto/setup/${spec.slug}` : "/moto";
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readSpec(form: FormData): MotoMasterSpec {
  const spec = specOf(str(form, "kind"));
  if (!spec) back(null, "ไม่รู้จักชนิดข้อมูลที่ส่งมา กรุณาเปิดหน้าใหม่แล้วลองอีกครั้ง", true);
  return spec;
}

function readInput(form: FormData): MotoMasterInput {
  return {
    code: normalizeCode(str(form, "code")),
    name: str(form, "name"),
    is_active: form.get("is_active") === "on",
    parent_id: str(form, "parent_id") || null,
  };
}

export async function createMasterForm(form: FormData): Promise<void> {
  const spec = readSpec(form);
  const user = await requirePermission(spec.menuCode, "write");
  const input = { ...readInput(form), is_active: true };

  const problem = validateMasterInput(spec, input);
  if (problem) back(spec, problem, true);

  try {
    await insertMaster(spec.kind, input);
    await logAudit({
      actor_id: user.id,
      action: `moto_create_${spec.kind}`,
      target_table: spec.table,
      after: input,
    });
  } catch (err) {
    back(spec, err instanceof Error ? err.message : `เพิ่ม${spec.title}ไม่สำเร็จ`, true);
  }

  revalidatePath(`/moto/setup/${spec.slug}`);
  back(spec, `เพิ่ม${spec.title} ${input.code} ${input.name} เรียบร้อยแล้ว`);
}

export async function updateMasterForm(form: FormData): Promise<void> {
  const spec = readSpec(form);
  const user = await requirePermission(spec.menuCode, "edit");
  const id = str(form, "id");
  const input = readInput(form);

  if (!id) back(spec, "ไม่พบข้อมูลที่ต้องการแก้ไข", true);
  const problem = validateMasterInput(spec, input);
  if (problem) back(spec, problem, true);

  try {
    const before = await getMaster(spec.kind, id);
    await updateMaster(spec.kind, id, input);
    await logAudit({
      actor_id: user.id,
      action: `moto_update_${spec.kind}`,
      target_table: spec.table,
      target_id: id,
      before,
      after: input,
    });
  } catch (err) {
    back(spec, err instanceof Error ? err.message : `บันทึก${spec.title}ไม่สำเร็จ`, true);
  }

  revalidatePath(`/moto/setup/${spec.slug}`);
  back(spec, `บันทึก${spec.title} ${input.code} ${input.name} เรียบร้อยแล้ว`);
}

export async function deleteMasterForm(form: FormData): Promise<void> {
  const spec = readSpec(form);
  const user = await requirePermission(spec.menuCode, "delete");
  const id = str(form, "id");
  const name = str(form, "name");

  if (!id) back(spec, "ไม่พบข้อมูลที่ต้องการลบ", true);
  if (form.get("confirm") !== "on") back(spec, "กรุณาติ๊กยืนยันก่อนลบ", true);

  let used = 0;
  try {
    const before = await getMaster(spec.kind, id);
    used = await countMasterUsage(spec.kind, id);
    await deleteMaster(spec.kind, id);
    await logAudit({
      actor_id: user.id,
      action: `moto_delete_${spec.kind}`,
      target_table: spec.table,
      target_id: id,
      before: { ...before, usedBy: used },
    });
  } catch (err) {
    back(spec, err instanceof Error ? err.message : `ลบ${spec.title}ไม่สำเร็จ`, true);
  }

  revalidatePath(`/moto/setup/${spec.slug}`);
  back(
    spec,
    used > 0
      ? `ลบ${spec.title} ${name} แล้ว · ข้อมูล ${used} รายการที่เคยอ้างถึงจะกลายเป็น “ไม่ระบุ”`
      : `ลบ${spec.title} ${name} เรียบร้อยแล้ว`,
  );
}
