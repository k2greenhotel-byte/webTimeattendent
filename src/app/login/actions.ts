"use server";

import { redirect } from "next/navigation";
import { changePinFromLogin, loginWithPhone } from "@/lib/auth";
import { getSelectableContext } from "@/lib/core-db";
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

/**
 * เลือกบริษัท/สาขาให้อัตโนมัติเมื่อผู้ใช้มีสิทธิ์อยู่ที่เดียว
 * ถ้ามีให้เลือกมากกว่าหนึ่ง ต้องผ่านหน้า /select-context ก่อนเข้าใช้งาน
 */
async function resolveContext(
  user: SessionUser,
): Promise<{ context: Partial<SessionUser>; needsPick: boolean }> {
  const { companies, branches } = await getSelectableContext(user.id);

  const company = companies.length === 1 ? companies[0] : null;
  const inCompany = company ? branches.filter((b) => b.company_id === company.id) : [];
  const branch = inCompany.length === 1 ? inCompany[0] : null;

  return {
    context: {
      company_id: company?.id ?? null,
      company_name: company?.name ?? null,
      branch_id: branch?.id ?? null,
      branch_name: branch?.name ?? null,
    },
    needsPick: !company || inCompany.length > 1,
  };
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const phone = String(formData.get("phone") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const next = safeNext(formData.get("next"));

  let target: string;
  try {
    const result = await loginWithPhone(phone, pin);
    if (!result.ok) return { error: result.error };

    const { context, needsPick } = await resolveContext(result.user);
    await createSession({ ...result.user, ...context });

    target = needsPick
      ? `/select-context${next ? `?next=${encodeURIComponent(next)}` : ""}`
      : (next ?? "/apps");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่รู้จัก" };
  }

  redirect(target);
}

/** เปลี่ยนรหัสผ่านจากหน้าล็อกอิน (ยังไม่ได้เข้าระบบ ต้องยืนยันรหัสเดิม) */
export async function changePinAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const phone = String(formData.get("phone") ?? "");
  const currentPin = String(formData.get("current_pin") ?? "");
  const newPin = String(formData.get("new_pin") ?? "");
  const confirmPin = String(formData.get("confirm_pin") ?? "");

  if (newPin !== confirmPin) return { error: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" };

  try {
    const result = await changePinFromLogin(phone, currentPin, newPin);
    if (!result.ok) return { error: result.error };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่รู้จัก" };
  }

  redirect("/login?msg=" + encodeURIComponent("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว เข้าสู่ระบบด้วยรหัสใหม่ได้เลย"));
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
