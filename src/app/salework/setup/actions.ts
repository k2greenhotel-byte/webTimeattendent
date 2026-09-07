"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { taskTypeBlockers, validateTaskType } from "@/lib/salework";
import {
  countTaskUsage,
  createTaskType,
  deleteTaskType,
  getTaskType,
  listTaskTypes,
  updateTaskType,
} from "@/lib/salework-db";
import type { TaskTypeInput } from "@/lib/salework-types";
import { requirePermission } from "@/lib/session";

const PATH = "/salework/setup";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function bool(form: FormData, key: string): boolean {
  return str(form, key) === "on" || str(form, key) === "1";
}

function back(message: string, isError = false): never {
  redirect(`${PATH}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readTaskType(form: FormData): TaskTypeInput {
  const target = optText(form, "daily_target");
  return {
    parent_id: optText(form, "parent_id"),
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    description: optText(form, "description"),
    metric_label: optText(form, "metric_label"),
    metric_unit: optText(form, "metric_unit"),
    require_metric: bool(form, "require_metric"),
    require_media: bool(form, "require_media"),
    allow_link: bool(form, "allow_link"),
    daily_target: target === null ? null : Number(target),
    sort_order: Number(str(form, "sort_order") || "100"),
    is_active: bool(form, "is_active"),
  };
}

/** เพิ่มหรือแก้ไขประเภทงาน (ข้อ 1 — หน้าเมนูตั้งค่าของแอดมิน) */
export async function saveTaskTypeForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const user = await requirePermission("SW_SETUP", id ? "edit" : "write");

  const input = readTaskType(form);
  const all = await listTaskTypes(false);

  const problem = validateTaskType(
    input,
    all.filter((t) => t.id !== id).map((t) => t.code),
  );
  if (problem) back(problem, true);

  // หัวข้อของตัวเองห้ามเป็นตัวเอง และรองรับแค่ 2 ระดับ (หัวข้อ → งานย่อย)
  if (input.parent_id) {
    if (input.parent_id === id) back("เลือกหัวข้อเป็นตัวเองไม่ได้", true);
    const parent = all.find((t) => t.id === input.parent_id);
    if (!parent) back("ไม่พบหัวข้อที่เลือก", true);
    if (parent.parent_id) back("ระบบรองรับ 2 ระดับ — งานย่อยซ้อนใต้งานย่อยอีกทีไม่ได้", true);
    if (all.some((t) => t.parent_id === id)) {
      back("ประเภทงานนี้มีงานย่อยอยู่แล้ว จึงย้ายไปเป็นงานย่อยของหัวข้ออื่นไม่ได้", true);
    }
  }

  try {
    if (id) await updateTaskType(id, input);
    else await createTaskType(input);

    await logAudit({
      actor_id: user.id,
      action: id ? "แก้ไขประเภทงานพนักงานขาย" : "เพิ่มประเภทงานพนักงานขาย",
      target_table: "sw_task_types",
      target_id: id || null,
      after: { code: input.code, name: input.name },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกประเภทงานไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  revalidatePath("/salework/daily");
  back(`บันทึกประเภทงาน ${input.code} เรียบร้อยแล้ว`);
}

/** ลบประเภทงาน — ที่ถูกใช้ไปแล้วหรือมีงานย่อยจะถูกกันไว้ ให้ปิดใช้งานแทน */
export async function deleteTaskTypeForm(form: FormData): Promise<void> {
  const user = await requirePermission("SW_SETUP", "delete");
  const id = str(form, "id");

  const [type, all] = await Promise.all([getTaskType(id), listTaskTypes(false)]);
  if (!type) back("ไม่พบประเภทงานที่ต้องการลบ", true);

  const blocker = taskTypeBlockers(type, all, await countTaskUsage(id));
  if (blocker) back(blocker, true);

  try {
    await deleteTaskType(id);
    await logAudit({
      actor_id: user.id,
      action: "ลบประเภทงานพนักงานขาย",
      target_table: "sw_task_types",
      target_id: id,
      before: { code: type.code, name: type.name },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบประเภทงานไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  revalidatePath("/salework/daily");
  back(`ลบประเภทงาน ${type.code} แล้ว`);
}
