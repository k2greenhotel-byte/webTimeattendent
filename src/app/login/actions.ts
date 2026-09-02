"use server";

import { redirect } from "next/navigation";
import { loginWithPhone } from "@/lib/auth";
import { clearSession, createSession } from "@/lib/session";
import type { SessionUser } from "@/lib/types";

export type LoginState = { error: string | null };

/**
 * ปลายทางหลังล็อกอิน — รับเฉพาะเส้นทางภายในเว็บนี้เท่านั้น
 * (กัน open redirect: ต้องขึ้นต้นด้วย "/" เดี่ยว ๆ ห้าม "//" หรือ URL เต็ม)
 */
function safeNext(value: unknown): string | null {
  const path = String(value ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

function homeFor(user: SessionUser): string {
  return user.role === "admin" ? "/admin" : "/punch";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const phone = String(formData.get("phone") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const next = safeNext(formData.get("next"));

  let target: string;
  try {
    const result = await loginWithPhone(phone, pin);
    if (!result.ok) return { error: result.error };
    await createSession(result.user);
    target = next ?? homeFor(result.user);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่รู้จัก" };
  }

  redirect(target);
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
