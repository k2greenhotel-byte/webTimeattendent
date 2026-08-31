"use server";

import { redirect } from "next/navigation";
import { loginWithPhone } from "@/lib/auth";
import { clearSession, createSession } from "@/lib/session";

export type LoginState = { error: string | null };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const phone = String(formData.get("phone") ?? "");
  const pin = String(formData.get("pin") ?? "");

  let target = "/punch";
  try {
    const result = await loginWithPhone(phone, pin);
    if (!result.ok) return { error: result.error };
    await createSession(result.user);
    target = result.user.role === "admin" ? "/admin" : "/punch";
  } catch (err) {
    return { error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่รู้จัก" };
  }

  redirect(target);
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
