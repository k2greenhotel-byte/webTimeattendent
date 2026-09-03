import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE_SEC,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  signAdminToken,
  signSessionToken,
  verifyAdminToken,
  verifySessionToken,
} from "./session-token";
import { getEffectivePermissions } from "./core-db";
import { PERM_ACTION_LABEL, type EffectiveMenuPermission, type PermAction, type WorkContext } from "./core-types";
import { accessibleProgramCodes, can, isCoreAdmin } from "./permissions";
import type { SessionUser } from "./types";

export async function createSession(user: SessionUser): Promise<void> {
  const token = await signSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** ใช้ในหน้า/route ที่ต้อง login แล้วเท่านั้น */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

// ---------- หน้าหลังบ้าน /admin (เข้าด้วย PIN 6 หลัก) ----------

export async function createAdminSession(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, await signAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_MAX_AGE_SEC,
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  return token ? verifyAdminToken(token) : false;
}

/** ใช้ในทุกหน้า/action ของหลังบ้าน — ไม่ผ่าน PIN จะถูกส่งกลับไปหน้า /admin */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthed())) redirect("/admin");
}

// ---------- ระบบส่วนกลาง: บริษัท/สาขาที่เลือก + สิทธิ์รายเมนู ----------

/** เปลี่ยนบริษัท/สาขาที่กำลังทำงานอยู่ โดยออก session ใหม่ให้ (ข้อมูลอื่นคงเดิม) */
export async function setWorkContext(context: WorkContext): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  await createSession({ ...user, ...context });
}

/**
 * สิทธิ์ที่มีผลจริงของผู้ใช้ที่ล็อกอินอยู่ — cache ไว้ต่อหนึ่ง request
 * (หน้าเดียวอาจถามหลายรอบ ไม่ควรยิงฐานข้อมูลซ้ำ)
 */
export const getMyPermissions = cache(async (): Promise<EffectiveMenuPermission[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  return getEffectivePermissions(user.id);
});

/** ตรวจว่าผู้ใช้ที่ล็อกอินอยู่ทำสิ่งนี้กับเมนูนี้ได้ไหม (ไม่ redirect) */
export async function checkPermission(menuCode: string, action: PermAction = "read"): Promise<boolean> {
  return can(await getMyPermissions(), menuCode, action);
}

/** ใช้ในหน้า/action ที่ต้องมีสิทธิ์เฉพาะ — ไม่มีสิทธิ์จะถูกส่งกลับไปหน้ารวมโปรแกรม */
export async function requirePermission(
  menuCode: string,
  action: PermAction = "read",
): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await checkPermission(menuCode, action))) {
    redirect(`/apps?err=${encodeURIComponent(`ไม่มีสิทธิ์${PERM_ACTION_LABEL[action]}ข้อมูลในเมนูนี้ กรุณาติดต่อผู้ดูแลระบบ`)}`);
  }
  return user;
}

/** ประตูเข้าระบบส่วนกลาง — เปิดให้ระดับ admin/ผู้ช่วย admin หรือผู้ที่ผ่าน PIN หลังบ้านแล้ว */
export async function requireCoreAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isCoreAdmin(user.level) && !(await isAdminAuthed())) {
    redirect(`/apps?err=${encodeURIComponent("ระบบส่วนกลางเปิดให้เฉพาะผู้ดูแลระบบและผู้ช่วยผู้ดูแลระบบ")}`);
  }
  return user;
}

/** ใช้ในหน้าแรกของแต่ละโปรแกรม — ไม่มีสิทธิ์เลยสักเมนูในโปรแกรมนี้จะถูกส่งกลับหน้ารวมโปรแกรม */
export async function requireProgram(programCode: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!accessibleProgramCodes(await getMyPermissions()).includes(programCode)) {
    redirect(`/apps?err=${encodeURIComponent("ไม่มีสิทธิ์เข้าใช้งานโปรแกรมนี้ กรุณาติดต่อผู้ดูแลระบบ")}`);
  }
  return user;
}
