import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE_SEC,
  APPROVER_COOKIE,
  APPROVER_MAX_AGE_SEC,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  signAdminToken,
  signApproverToken,
  signSessionToken,
  verifyAdminToken,
  verifyApproverToken,
  verifySessionToken,
} from "./session-token";
import { getEffectivePermissions, getLiveAccount as getLiveAccountRow } from "./core-db";
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

const ACCOUNT_CLOSED =
  "บัญชีนี้ถูกปิดการใช้งานหรือถูกลบแล้ว กรุณาออกจากระบบแล้วติดต่อผู้ดูแลระบบ";

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

/**
 * สถานะบัญชีจริงในฐานข้อมูล ณ ตอนนี้ — cache ต่อหนึ่ง request
 * cookie มีอายุ 12 ชม. ถ้าแอดมินปิดบัญชี ลบบัญชี หรือลดระดับระหว่างนั้น
 * ต้องมีผลทันทีโดยไม่ต้องรอผู้ใช้ล็อกเอาต์
 */
export const getLiveAccount = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  return getLiveAccountRow(user.id);
});

/** ผู้ใช้ที่ล็อกอินอยู่ พร้อมระดับล่าสุดจากฐานข้อมูล — บัญชีถูกปิด/ลบแล้วจะไปต่อไม่ได้ */
export async function requireActiveUser(): Promise<SessionUser> {
  const user = await requireUser();
  const live = await getLiveAccount();

  if (!live || !live.is_active) {
    redirect(`/apps?err=${encodeURIComponent(ACCOUNT_CLOSED)}`);
  }
  return { ...user, level: live.access_level };
}

/** ตรวจว่าผู้ใช้ที่ล็อกอินอยู่ทำสิ่งนี้กับเมนูนี้ได้ไหม (ไม่ redirect) */
export async function checkPermission(menuCode: string, action: PermAction = "read"): Promise<boolean> {
  const live = await getLiveAccount();
  if (!live || !live.is_active) return false;
  return can(await getMyPermissions(), menuCode, action);
}

/** ใช้ในหน้า/action ที่ต้องมีสิทธิ์เฉพาะ — ไม่มีสิทธิ์จะถูกส่งกลับไปหน้ารวมโปรแกรม */
export async function requirePermission(
  menuCode: string,
  action: PermAction = "read",
): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (!(await checkPermission(menuCode, action))) {
    redirect(`/apps?err=${encodeURIComponent(`ไม่มีสิทธิ์${PERM_ACTION_LABEL[action]}ข้อมูลในเมนูนี้ กรุณาติดต่อผู้ดูแลระบบ`)}`);
  }
  return user;
}

/** ประตูเข้าระบบส่วนกลาง — เปิดให้ระดับ admin/ผู้ช่วย admin หรือผู้ที่ผ่าน PIN หลังบ้านแล้ว */
export async function requireCoreAdmin(): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (!isCoreAdmin(user.level) && !(await isAdminAuthed())) {
    redirect(`/apps?err=${encodeURIComponent("ระบบส่วนกลางเปิดให้เฉพาะผู้ดูแลระบบและผู้ช่วยผู้ดูแลระบบ")}`);
  }
  return user;
}

// ---------- ประตูหน้าจออนุมัติซ่อม/จัดซื้อ (ข้อ 3.1) ----------

/**
 * หน้าจออนุมัติต้องยืนยันรหัสผ่านของผู้อนุมัติซ้ำ แม้จะล็อกอินอยู่แล้ว
 * เพราะเครื่องที่เปิดค้างไว้อาจถูกคนอื่นมากดอนุมัติแทน
 * ผ่านแล้วออก cookie อายุ 30 นาที ผูกกับบัญชีคนนั้นโดยเฉพาะ
 */
export async function createApproverSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(APPROVER_COOKIE, await signApproverToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: APPROVER_MAX_AGE_SEC,
  });
}

export async function clearApproverSession(): Promise<void> {
  const store = await cookies();
  store.delete(APPROVER_COOKIE);
}

/** ผู้ใช้ที่ล็อกอินอยู่ผ่านประตูรหัสผ่านของหน้าอนุมัติมาแล้วหรือยัง */
export async function isApproverAuthed(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;

  const token = (await cookies()).get(APPROVER_COOKIE)?.value;
  return token ? verifyApproverToken(token, user.id) : false;
}

/**
 * ใช้ในทุกหน้า/action ที่อนุมัติเอกสารได้จริง
 * ต้องมีสิทธิ์เมนู PR_APPROVE และผ่านการยืนยันรหัสผ่านมาแล้ว
 */
export async function requireApprover(): Promise<SessionUser> {
  const user = await requirePermission("PR_APPROVE", "write");
  if (!(await isApproverAuthed())) redirect("/procurement/approvals");
  return user;
}

/** ใช้ในหน้าแรกของแต่ละโปรแกรม — ไม่มีสิทธิ์เลยสักเมนูในโปรแกรมนี้จะถูกส่งกลับหน้ารวมโปรแกรม */
export async function requireProgram(programCode: string): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (!accessibleProgramCodes(await getMyPermissions()).includes(programCode)) {
    redirect(`/apps?err=${encodeURIComponent("ไม่มีสิทธิ์เข้าใช้งานโปรแกรมนี้ กรุณาติดต่อผู้ดูแลระบบ")}`);
  }
  return user;
}
