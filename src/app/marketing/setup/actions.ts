"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/db";
import {
  countMasterUsage,
  deleteMaster,
  insertMaster,
  updateMaster,
  type MktMasterKind,
} from "@/lib/marketing-db";

const KINDS: MktMasterKind[] = ["staff", "company", "activityType"];

const LABEL: Record<MktMasterKind, string> = {
  staff: "พนักงาน",
  company: "บริษัทที่ขอเบิก",
  activityType: "ประเภทกิจกรรม",
};

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(message: string, isError = false): never {
  redirect(`/marketing/setup?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function readKind(form: FormData): MktMasterKind {
  const kind = str(form, "kind") as MktMasterKind;
  if (!KINDS.includes(kind)) back("ประเภทข้อมูลไม่ถูกต้อง", true);
  return kind;
}

export async function createMasterForm(form: FormData): Promise<void> {
  const kind = readKind(form);
  const code = str(form, "code").toUpperCase();
  const name = str(form, "name");

  if (!code || !name) back(`กรุณากรอกทั้ง ID และชื่อ${LABEL[kind]}`, true);

  try {
    await insertMaster(kind, { code, name });
    await logAudit({
      actor_id: null,
      action: `mkt_create_${kind}`,
      target_table: "mkt_master",
      after: { code, name },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "เพิ่มข้อมูลไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/setup");
  back(`เพิ่ม${LABEL[kind]} ${name} เรียบร้อยแล้ว`);
}

export async function updateMasterForm(form: FormData): Promise<void> {
  const kind = readKind(form);
  const id = str(form, "id");
  const code = str(form, "code").toUpperCase();
  const name = str(form, "name");

  if (!id) back("ไม่พบข้อมูลที่ต้องการแก้ไข", true);
  if (!code || !name) back(`กรุณากรอกทั้ง ID และชื่อ${LABEL[kind]}`, true);

  try {
    await updateMaster(kind, id, { code, name, is_active: form.get("is_active") === "on" });
    await logAudit({
      actor_id: null,
      action: `mkt_update_${kind}`,
      target_table: "mkt_master",
      target_id: id,
      after: { code, name },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/setup");
  back(`บันทึก${LABEL[kind]} ${name} เรียบร้อยแล้ว`);
}

export async function deleteMasterForm(form: FormData): Promise<void> {
  const kind = readKind(form);
  const id = str(form, "id");
  const name = str(form, "name");

  if (form.get("confirm") !== "on") back("กรุณาติ๊กยืนยันก่อนลบ", true);

  let used = 0;
  try {
    used = await countMasterUsage(kind, id);
    await deleteMaster(kind, id);
    await logAudit({
      actor_id: null,
      action: `mkt_delete_${kind}`,
      target_table: "mkt_master",
      target_id: id,
      before: { name, usedBy: used },
    });
  } catch (err) {
    back(err instanceof Error ? err.message : "ลบไม่สำเร็จ", true);
  }

  revalidatePath("/marketing/setup");
  back(
    used > 0
      ? `ลบ${LABEL[kind]} ${name} แล้ว · เอกสาร ${used} รายการที่เคยอ้างถึงจะกลายเป็น "ไม่ระบุ"`
      : `ลบ${LABEL[kind]} ${name} เรียบร้อยแล้ว`,
  );
}
