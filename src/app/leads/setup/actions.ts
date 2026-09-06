"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import { lastActiveOfKind, normalizeStatusCode, validateStatusInput } from "@/lib/lead";
import {
  countStatusUsage,
  createChance,
  createWorkStatus,
  deleteChance,
  deleteWorkStatus,
  listChances,
  listWorkStatuses,
  updateChance,
  updateWorkStatus,
} from "@/lib/lead-db";
import { COLOR_ORDER, STATUS_KIND_ORDER, type ColorKey, type StatusKind } from "@/lib/lead-types";
import { requirePermission } from "@/lib/session";

const PATH = "/leads/setup";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(message: string, isError = false): never {
  redirect(`${PATH}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

/** ชุดข้อมูลที่กำลังแก้: สถานะงาน หรือ สถานะโอกาส */
function targetOf(form: FormData): "status" | "chance" {
  return str(form, "target") === "chance" ? "chance" : "status";
}

/**
 * บันทึกสถานะ (เพิ่มใหม่ถ้ายังไม่มีรหัสนี้ · แก้ไขถ้ามีแล้ว)
 * รหัสตั้งได้ครั้งเดียวตอนเพิ่ม — แก้ไขเปลี่ยนได้แค่ชื่อ/พฤติกรรม/สี/ลำดับ/เปิด-ปิด
 */
export async function saveStatusForm(form: FormData): Promise<void> {
  const target = targetOf(form);
  const code = normalizeStatusCode(str(form, "code"));
  const name = str(form, "name");
  const sort_order = Number(str(form, "sort_order") || 0);
  const is_active = form.get("is_active") === "on";

  const color: ColorKey = (COLOR_ORDER as string[]).includes(str(form, "color"))
    ? (str(form, "color") as ColorKey)
    : "slate";
  const kind: StatusKind = (STATUS_KIND_ORDER as string[]).includes(str(form, "kind"))
    ? (str(form, "kind") as StatusKind)
    : "open";

  const problem = validateStatusInput({ code, name, sort_order });
  if (problem) back(problem, true);

  const existing =
    target === "status"
      ? (await listWorkStatuses(true)).find((s) => s.code === code)
      : (await listChances(true)).find((c) => c.code === code);

  const user = await requirePermission("LEAD_SETUP", existing ? "edit" : "write");

  // ปิดใช้งานตัวสุดท้ายของกลุ่มไม่ได้ ไม่งั้นพนักงานจะบันทึกงานต่อไม่ได้
  if (existing && !is_active) {
    if (target === "status") {
      if (lastActiveOfKind(await listWorkStatuses(true), code)) {
        back(
          `ปิดใช้งานไม่ได้ — “${existing.name}” เป็นสถานะที่ใช้ได้ตัวสุดท้ายของกลุ่มนี้ กรุณาเพิ่มสถานะอื่นในกลุ่มเดียวกันก่อน`,
          true,
        );
      }
    } else if ((await listChances()).length <= 1) {
      back("ปิดใช้งานไม่ได้ — ต้องเหลือสถานะโอกาสที่ใช้งานได้อย่างน้อยหนึ่งรายการ", true);
    }
  }

  try {
    if (target === "status") {
      if (existing) {
        // สถานะของระบบเปลี่ยนพฤติกรรมไม่ได้ (กฎธุรกิจอ้างพฤติกรรมนี้อยู่)
        const current = (await listWorkStatuses(true)).find((s) => s.code === code);
        const nextKind = current?.is_system ? current.kind : kind;
        await updateWorkStatus(code, { name, kind: nextKind, color, sort_order, is_active });
      } else {
        await createWorkStatus({ code, name, kind, color, sort_order, is_active });
      }
    } else if (existing) {
      await updateChance(code, { name, color, sort_order, is_active });
    } else {
      await createChance({ code, name, color, sort_order, is_active });
    }

    await logAudit({
      actor_id: user.id,
      action: existing ? "update_lead_status" : "create_lead_status",
      target_table: target === "status" ? "ld_work_statuses" : "ld_chances",
      target_id: code,
      after: { name, color, sort_order, is_active, ...(target === "status" ? { kind } : {}) },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกสถานะไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  revalidatePath("/leads/leads");
  revalidatePath("/leads/follow");
  back(existing ? `บันทึกสถานะ “${name}” เรียบร้อยแล้ว` : `เพิ่มสถานะ “${name}” เรียบร้อยแล้ว`);
}

/** ลบสถานะที่ไม่มีใบงานใช้อยู่ (สถานะของระบบลบไม่ได้ — ปิดใช้งานแทน) */
export async function deleteStatusForm(form: FormData): Promise<void> {
  const user = await requirePermission("LEAD_SETUP", "delete");
  const target = targetOf(form);
  const code = str(form, "code");
  if (!code) back("ไม่พบสถานะที่ต้องการลบ", true);

  const field = target === "status" ? "work_status" : "chance";
  const usage = await countStatusUsage(field, code);
  if (usage > 0) {
    back(`ลบไม่ได้ — มีใบงานใช้สถานะนี้อยู่ ${usage} ใบ ให้ปิดใช้งานแทน`, true);
  }

  try {
    if (target === "status") await deleteWorkStatus(code);
    else await deleteChance(code);

    await logAudit({
      actor_id: user.id,
      action: "delete_lead_status",
      target_table: target === "status" ? "ld_work_statuses" : "ld_chances",
      target_id: code,
      after: { code },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบสถานะไม่สำเร็จ", true);
  }

  revalidatePath(PATH);
  back(`ลบสถานะ ${code} เรียบร้อยแล้ว`);
}
