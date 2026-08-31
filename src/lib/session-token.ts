import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "./types";

/** ใช้ได้ทั้งใน Node runtime และ Edge middleware (jose ล้วน ๆ ไม่มี dependency ของ Node) */
export const SESSION_COOKIE = "wta_session";
export const SESSION_MAX_AGE_SEC = 12 * 60 * 60; // 12 ชั่วโมง

/** cookie ของหน้าหลังบ้าน /admin (เข้าด้วย PIN 6 หลัก แยกจาก session พนักงาน) */
export const ADMIN_COOKIE = "wta_admin";
export const ADMIN_MAX_AGE_SEC = 8 * 60 * 60; // 8 ชั่วโมง

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET ต้องมีอย่างน้อย 32 ตัวอักษร (ตั้งค่าในไฟล์ .env.local)");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    emp_code: user.emp_code,
    full_name: user.full_name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(secretKey());
}

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ kind: "admin-console" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin-console")
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_MAX_AGE_SEC}s`)
    .sign(secretKey());
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.kind === "admin-console";
  } catch {
    return false;
  }
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      emp_code: String(payload.emp_code ?? ""),
      full_name: String(payload.full_name ?? ""),
      role: payload.role === "admin" ? "admin" : "employee",
    };
  } catch {
    return null;
  }
}
