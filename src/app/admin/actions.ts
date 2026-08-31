"use server";

import { redirect } from "next/navigation";
import { verifyAdminPin } from "@/lib/auth";
import { clearAdminSession, createAdminSession } from "@/lib/session";

export type AdminGateState = { error: string | null };

/** ตรวจ PIN 6 หลักเพื่อเข้าหน้าหลังบ้าน */
export async function adminLoginAction(
  _prev: AdminGateState,
  form: FormData,
): Promise<AdminGateState> {
  const pin = String(form.get("pin") ?? "").trim();

  if (!/^\d{6}$/.test(pin)) return { error: "กรุณากรอก PIN 6 หลัก" };
  if (!verifyAdminPin(pin)) return { error: "PIN ไม่ถูกต้อง" };

  await createAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  await clearAdminSession();
  redirect("/admin");
}
