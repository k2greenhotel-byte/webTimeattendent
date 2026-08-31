"use server";

import { changeOwnPin } from "@/lib/auth";
import { logAudit } from "@/lib/db";
import { requireUser } from "@/lib/session";

export type ChangePinState = { error: string | null; success: string | null };

/** พนักงานตั้งรหัสผ่านใหม่ด้วยตัวเอง */
export async function changePinAction(
  _prev: ChangePinState,
  form: FormData,
): Promise<ChangePinState> {
  const user = await requireUser();

  const currentPin = String(form.get("current_pin") ?? "").trim();
  const newPin = String(form.get("new_pin") ?? "").trim();
  const confirmPin = String(form.get("confirm_pin") ?? "").trim();

  if (newPin !== confirmPin) {
    return { error: "รหัสผ่านใหม่กับการยืนยันไม่ตรงกัน", success: null };
  }

  const result = await changeOwnPin(user.id, currentPin, newPin);
  if (!result.ok) return { error: result.error, success: null };

  await logAudit({
    actor_id: user.id,
    action: "change_own_pin",
    target_table: "employees",
    target_id: user.id,
  });

  return { error: null, success: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว ครั้งต่อไปใช้รหัสใหม่เข้าระบบ" };
}
