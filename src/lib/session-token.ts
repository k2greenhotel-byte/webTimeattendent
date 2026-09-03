import { SignJWT, jwtVerify } from "jose";
import type { AccessLevel } from "./core-types";
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
    level: user.level,
    company_id: user.company_id ?? null,
    company_name: user.company_name ?? null,
    branch_id: user.branch_id ?? null,
    branch_name: user.branch_name ?? null,
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

const LEVELS = ["admin", "assistant_admin", "supervisor", "user"] as const;

function readLevel(value: unknown, role: unknown): AccessLevel {
  const found = LEVELS.find((l) => l === value);
  if (found) return found;
  // token เก่าที่ออกก่อนมีระบบสิทธิ์ — เดาจาก role เดิม
  return role === "admin" ? "admin" : "user";
}

function optText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
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
      level: readLevel(payload.level, payload.role),
      company_id: optText(payload.company_id),
      company_name: optText(payload.company_name),
      branch_id: optText(payload.branch_id),
      branch_name: optText(payload.branch_name),
    };
  } catch {
    return null;
  }
}
