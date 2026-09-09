"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { validateItem } from "@/lib/inspection";
import {
  countItemUsage,
  countTemplateUsage,
  createItem,
  createOption,
  createSection,
  createTemplate,
  deleteItem,
  deleteOption,
  deleteSection,
  deleteTemplate,
  listItemOptions,
  listItems,
  listSections,
  listTemplates,
  updateItem,
  updateOption,
  updateSection,
  updateTemplate,
} from "@/lib/inspection-db";
import type { InspItemType } from "@/lib/inspection-types";
import { requirePermission } from "@/lib/session";

/**
 * หน้าจอ 4 — ตั้งค่ารายการที่ตรวจ
 * แอดมินเพิ่ม/ลด/แก้ได้ทั้ง 4 ชั้น: แม่แบบ → หมวด → รายการ → ตัวเลือก
 * ทุกครั้งที่แก้ต้องเขียน audit_logs เพราะกระทบคะแนนของทุกใบที่จะตรวจต่อจากนี้
 */

const PATH = "/inspection/setup";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function bool(form: FormData, key: string): boolean {
  const value = str(form, key);
  return value === "on" || value === "1";
}

function numOf(form: FormData, key: string, fallback = 0): number {
  const value = Number(str(form, key));
  return Number.isFinite(value) ? value : fallback;
}

/** กลับหน้าตั้งค่า โดยคงแม่แบบที่กำลังเปิดอยู่ไว้ */
function back(form: FormData, message: string, isError = false): never {
  const tab = str(form, "tab");
  const query = new URLSearchParams();
  if (tab) query.set("tab", tab);
  query.set(isError ? "err" : "msg", message);
  redirect(`${PATH}?${query}`);
}

function done(form: FormData, message: string): never {
  revalidatePath(PATH);
  revalidatePath("/inspection/inspections/new");
  back(form, message);
}

async function audit(
  actorId: string,
  action: string,
  table: string,
  id: string | null,
  detail: Record<string, unknown>,
): Promise<void> {
  await logAudit({
    actor_id: actorId,
    action,
    target_table: table,
    target_id: id,
    after: detail,
  });
}

// ---------- แม่แบบใบตรวจ ----------

export async function saveTemplateForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const user = await requirePermission("INSP_SETUP", id ? "edit" : "write");

  const code = str(form, "code").toUpperCase();
  const name = str(form, "name");
  if (!code) back(form, "กรุณาใส่รหัสแบบฟอร์ม", true);
  if (!name) back(form, "กรุณาใส่ชื่อแบบฟอร์ม", true);

  const thresholdRaw = str(form, "bonus_threshold");
  const input = {
    code,
    name,
    description: optText(form, "description"),
    bonus_threshold: thresholdRaw === "" ? null : Number(thresholdRaw),
    bonus_amount: numOf(form, "bonus_amount"),
    footer_note: optText(form, "footer_note"),
    sort_order: numOf(form, "sort_order", 100),
    is_active: bool(form, "is_active"),
  };

  const existing = await listTemplates(true);
  if (existing.some((t) => t.id !== id && t.code === code)) {
    back(form, `รหัส ${code} ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`, true);
  }

  try {
    if (id) await updateTemplate(id, input);
    else await createTemplate(input);
    await audit(user.id, id ? "แก้ไขแบบฟอร์มตรวจสาขา" : "เพิ่มแบบฟอร์มตรวจสาขา", "insp_templates", id || null, {
      code,
      name,
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกแบบฟอร์มไม่สำเร็จ", true);
  }

  done(form, `บันทึกแบบฟอร์ม ${code} เรียบร้อยแล้ว`);
}

export async function deleteTemplateForm(form: FormData): Promise<void> {
  const user = await requirePermission("INSP_SETUP", "delete");
  const id = str(form, "id");

  if (str(form, "confirm") !== "on") back(form, "กรุณาติ๊กยืนยันก่อนลบแบบฟอร์ม", true);

  const used = await countTemplateUsage(id);
  if (used > 0) {
    back(
      form,
      `แบบฟอร์มนี้ถูกใช้ตรวจไปแล้ว ${used} ใบ จึงลบไม่ได้ — ให้ปิด “ใช้งาน” แทน ใบเก่าจะยังอ่านได้เหมือนเดิม`,
      true,
    );
  }

  try {
    await deleteTemplate(id);
    await audit(user.id, "ลบแบบฟอร์มตรวจสาขา", "insp_templates", id, { name: str(form, "name") });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ลบแบบฟอร์มไม่สำเร็จ", true);
  }

  done(form, "ลบแบบฟอร์มแล้ว");
}

// ---------- หมวดที่ตรวจ ----------

export async function saveSectionForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const user = await requirePermission("INSP_SETUP", id ? "edit" : "write");

  const code = str(form, "code").toUpperCase();
  const name = str(form, "name");
  const templateId = str(form, "template_id");
  if (!code) back(form, "กรุณาใส่รหัสหมวด", true);
  if (!name) back(form, "กรุณาใส่ชื่อหมวด", true);
  if (!templateId) back(form, "ไม่พบแบบฟอร์มของหมวดนี้", true);

  const existing = await listSections(true);
  if (existing.some((s) => s.id !== id && s.code === code)) {
    back(form, `รหัส ${code} ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`, true);
  }

  const input = {
    template_id: templateId,
    code,
    name,
    note: optText(form, "note"),
    sort_order: numOf(form, "sort_order", 100),
    is_active: bool(form, "is_active"),
  };

  try {
    if (id) await updateSection(id, input);
    else await createSection(input);
    await audit(user.id, id ? "แก้ไขหมวดตรวจสาขา" : "เพิ่มหมวดตรวจสาขา", "insp_sections", id || null, {
      code,
      name,
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกหมวดไม่สำเร็จ", true);
  }

  done(form, `บันทึกหมวด ${name} เรียบร้อยแล้ว`);
}

export async function deleteSectionForm(form: FormData): Promise<void> {
  const user = await requirePermission("INSP_SETUP", "delete");
  const id = str(form, "id");

  if (str(form, "confirm") !== "on") back(form, "กรุณาติ๊กยืนยันก่อนลบหมวด", true);

  // ลบหมวดคือลบรายการทั้งหมดในหมวดไปด้วย — ต้องรู้ก่อนว่ารายการเหล่านั้นเคยถูกใช้ตรวจไปแล้วหรือยัง
  const items = (await listItems(true)).filter((i) => i.section_id === id);
  const usage = await Promise.all(items.map((i) => countItemUsage(i.id)));
  const used = usage.reduce((sum, n) => sum + n, 0);
  if (used > 0) {
    back(
      form,
      `หมวดนี้มีรายการที่ถูกใช้ตรวจไปแล้ว ${used} ครั้ง จึงลบไม่ได้ — ให้ปิด “ใช้งาน” แทน`,
      true,
    );
  }

  try {
    await deleteSection(id);
    await audit(user.id, "ลบหมวดตรวจสาขา", "insp_sections", id, {
      name: str(form, "name"),
      items_removed: items.length,
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ลบหมวดไม่สำเร็จ", true);
  }

  done(form, "ลบหมวดแล้ว");
}

// ---------- รายการตรวจ ----------

export async function saveItemForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const user = await requirePermission("INSP_SETUP", id ? "edit" : "write");

  const sectionId = str(form, "section_id");
  if (!sectionId) back(form, "ไม่พบหมวดของรายการนี้", true);

  const itemType = (str(form, "item_type") === "rating" ? "rating" : "choice") as InspItemType;
  const input = {
    section_id: sectionId,
    code: str(form, "code").toUpperCase(),
    name: str(form, "name"),
    item_type: itemType,
    max_score: itemType === "rating" ? numOf(form, "max_score") : 0,
    require_photo: bool(form, "require_photo"),
    note: optText(form, "note"),
    sort_order: numOf(form, "sort_order", 100),
    is_active: bool(form, "is_active"),
  };

  const others = (await listItems(true)).filter((i) => i.id !== id).map((i) => i.code);
  const problem = validateItem(input, others);
  if (problem) back(form, problem, true);

  try {
    if (id) await updateItem(id, input);
    else await createItem(input);
    await audit(user.id, id ? "แก้ไขรายการตรวจสาขา" : "เพิ่มรายการตรวจสาขา", "insp_items", id || null, {
      code: input.code,
      name: input.name,
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกรายการตรวจไม่สำเร็จ", true);
  }

  done(form, `บันทึกรายการ ${input.name} เรียบร้อยแล้ว`);
}

export async function deleteItemForm(form: FormData): Promise<void> {
  const user = await requirePermission("INSP_SETUP", "delete");
  const id = str(form, "id");

  if (str(form, "confirm") !== "on") back(form, "กรุณาติ๊กยืนยันก่อนลบรายการ", true);

  const used = await countItemUsage(id);
  if (used > 0) {
    back(
      form,
      `รายการนี้ถูกใช้ตรวจไปแล้ว ${used} ครั้ง จึงลบไม่ได้ — ให้ปิด “ใช้งาน” แทน ใบเก่าจะยังอ่านได้เหมือนเดิม`,
      true,
    );
  }

  try {
    await deleteItem(id);
    await audit(user.id, "ลบรายการตรวจสาขา", "insp_items", id, { name: str(form, "name") });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ลบรายการตรวจไม่สำเร็จ", true);
  }

  done(form, "ลบรายการตรวจแล้ว");
}

// ---------- ตัวเลือกของรายการ ----------

export async function saveOptionForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const user = await requirePermission("INSP_SETUP", id ? "edit" : "write");

  const itemId = str(form, "item_id");
  const code = str(form, "code").toUpperCase();
  const label = str(form, "label");
  if (!itemId) back(form, "ไม่พบรายการของตัวเลือกนี้", true);
  if (!code) back(form, "กรุณาใส่รหัสตัวเลือก", true);
  if (!label) back(form, "กรุณาใส่ข้อความของตัวเลือก", true);

  const existing = await listItemOptions(true);
  if (existing.some((o) => o.id !== id && o.code === code)) {
    back(form, `รหัส ${code} ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`, true);
  }

  const score = numOf(form, "score");
  const fine = numOf(form, "fine_amount");
  if (score < 0) back(form, "คะแนนของตัวเลือกติดลบไม่ได้", true);
  if (fine < 0) back(form, "ค่าปรับติดลบไม่ได้", true);

  const input = {
    item_id: itemId,
    code,
    label,
    score,
    fine_amount: fine,
    sort_order: numOf(form, "sort_order", 100),
    is_active: bool(form, "is_active"),
  };

  try {
    if (id) await updateOption(id, input);
    else await createOption(input);
    await audit(
      user.id,
      id ? "แก้ไขตัวเลือกของรายการตรวจ" : "เพิ่มตัวเลือกของรายการตรวจ",
      "insp_item_options",
      id || null,
      { code, label, score, fine },
    );
  } catch (err) {
    back(form, err instanceof Error ? err.message : "บันทึกตัวเลือกไม่สำเร็จ", true);
  }

  done(form, `บันทึกตัวเลือก ${label} เรียบร้อยแล้ว`);
}

export async function deleteOptionForm(form: FormData): Promise<void> {
  const user = await requirePermission("INSP_SETUP", "delete");
  const id = str(form, "id");

  try {
    await deleteOption(id);
    await audit(user.id, "ลบตัวเลือกของรายการตรวจ", "insp_item_options", id, {
      label: str(form, "label"),
    });
  } catch (err) {
    back(form, err instanceof Error ? err.message : "ลบตัวเลือกไม่สำเร็จ", true);
  }

  done(form, "ลบตัวเลือกแล้ว");
}
