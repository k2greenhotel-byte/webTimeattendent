"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { validatePrType } from "@/lib/procurement";
import {
  countPrTypeUsage,
  deletePrType,
  insertPrType,
  PR_TYPE_TABLE,
  updatePrType,
} from "@/lib/procurement-db";
import type { PrTypeInput, PrTypeKind } from "@/lib/procurement-types";
import { requirePermission } from "@/lib/session";

const MENU_OF: Record<PrTypeKind, string> = {
  asset: "PR_ASSET_TYPE",
  material: "PR_MATERIAL_TYPE",
};

const SLUG_OF: Record<PrTypeKind, string> = {
  asset: "asset-types",
  material: "material-types",
};

const LABEL_OF: Record<PrTypeKind, string> = {
  asset: "ประเภททรัพย์สิน",
  material: "ประเภทวัสดุ",
};

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function readKind(form: FormData): PrTypeKind {
  const kind = str(form, "kind");
  if (kind !== "asset" && kind !== "material") {
    redirect(`/procurement/setup/asset-types?${new URLSearchParams({ err: "ไม่รู้จักชนิดข้อมูลที่ส่งมา กรุณาเปิดหน้าใหม่แล้วลองอีกครั้ง" })}`);
  }
  return kind;
}

function back(kind: PrTypeKind, message: string, isError = false): never {
  redirect(`/procurement/setup/${SLUG_OF[kind]}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readInput(form: FormData): PrTypeInput {
  return {
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    sort_order: Number(str(form, "sort_order")) || 0,
    is_active: true,
  };
}

export async function createPrTypeForm(form: FormData): Promise<void> {
  const kind = readKind(form);
  const user = await requirePermission(MENU_OF[kind], "write");
  const input = readInput(form);

  const problem = validatePrType(input, LABEL_OF[kind]);
  if (problem) back(kind, problem, true);

  try {
    await insertPrType(kind, input);
    await logAudit({
      actor_id: user.id,
      action: `pr_create_${kind}_type`,
      target_table: PR_TYPE_TABLE[kind],
      after: input,
    });
  } catch (err) {
    back(kind, err instanceof Error ? err.message : `เพิ่ม${LABEL_OF[kind]}ไม่สำเร็จ`, true);
  }

  revalidatePath(`/procurement/setup/${SLUG_OF[kind]}`);
  back(kind, `เพิ่ม${LABEL_OF[kind]} ${input.code} ${input.name} เรียบร้อยแล้ว`);
}

export async function updatePrTypeForm(form: FormData): Promise<void> {
  const kind = readKind(form);
  const user = await requirePermission(MENU_OF[kind], "edit");
  const id = str(form, "id");
  const input = readInput(form);
  input.is_active = form.get("is_active") === "on";

  if (!id) back(kind, "ไม่พบข้อมูลที่ต้องการแก้ไข", true);
  const problem = validatePrType(input, LABEL_OF[kind]);
  if (problem) back(kind, problem, true);

  try {
    await updatePrType(kind, id, input);
    await logAudit({
      actor_id: user.id,
      action: `pr_update_${kind}_type`,
      target_table: PR_TYPE_TABLE[kind],
      target_id: id,
      after: input,
    });
  } catch (err) {
    back(kind, err instanceof Error ? err.message : `บันทึก${LABEL_OF[kind]}ไม่สำเร็จ`, true);
  }

  revalidatePath(`/procurement/setup/${SLUG_OF[kind]}`);
  back(kind, `บันทึก${LABEL_OF[kind]} ${input.code} ${input.name} เรียบร้อยแล้ว`);
}

export async function deletePrTypeForm(form: FormData): Promise<void> {
  const kind = readKind(form);
  const user = await requirePermission(MENU_OF[kind], "delete");
  const id = str(form, "id");
  const name = str(form, "name");

  if (!id) back(kind, "ไม่พบข้อมูลที่ต้องการลบ", true);
  if (form.get("confirm") !== "on") back(kind, "กรุณาติ๊กยืนยันก่อนลบ", true);

  let used = 0;
  try {
    used = await countPrTypeUsage(kind, id);
    await deletePrType(kind, id);
    await logAudit({
      actor_id: user.id,
      action: `pr_delete_${kind}_type`,
      target_table: PR_TYPE_TABLE[kind],
      target_id: id,
      before: { name, usedBy: used },
    });
  } catch (err) {
    back(kind, err instanceof Error ? err.message : `ลบ${LABEL_OF[kind]}ไม่สำเร็จ`, true);
  }

  revalidatePath(`/procurement/setup/${SLUG_OF[kind]}`);
  back(
    kind,
    used > 0
      ? `ลบ${LABEL_OF[kind]} ${name} แล้ว · เอกสาร ${used} ใบที่เคยอ้างถึงจะกลายเป็น "ไม่ระบุ"`
      : `ลบ${LABEL_OF[kind]} ${name} เรียบร้อยแล้ว`,
  );
}
