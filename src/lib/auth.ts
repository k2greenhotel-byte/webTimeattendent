import "server-only";
import bcrypt from "bcryptjs";
import { getSupabase } from "./supabase-server";
import type { SessionUser } from "./types";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** PIN 6 หลักของหน้าหลังบ้าน /admin (ตั้งค่าได้ที่ ADMIN_PIN ใน .env.local) */
export const ADMIN_PIN_LENGTH = 6;

export function verifyAdminPin(pin: string): boolean {
  const expected = process.env.ADMIN_PIN || "123456";
  if (pin.length !== expected.length) return false;

  // เทียบแบบเวลาคงที่ กันการเดา PIN จากเวลาตอบสนอง
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= pin.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

type LoginResult = { ok: true; user: SessionUser } | { ok: false; error: string };

/** ตรวจรหัสพนักงาน + PIN พร้อมกลไกล็อกบัญชีเมื่อกรอกผิดหลายครั้ง */
export async function loginWithPin(empCode: string, pin: string): Promise<LoginResult> {
  const code = empCode.trim();
  if (!code || !isValidPin(pin)) {
    return { ok: false, error: "กรุณากรอกรหัสพนักงานและ PIN 4 หลักให้ถูกต้อง" };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("employees")
    .select("id, emp_code, full_name, role, is_active, pin_hash, failed_attempts, locked_until")
    .eq("emp_code", code)
    .maybeSingle();

  if (error) return { ok: false, error: `เข้าสู่ระบบไม่สำเร็จ: ${error.message}` };
  if (!data) return { ok: false, error: "ไม่พบรหัสพนักงานนี้" };
  if (!data.is_active) return { ok: false, error: "บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };

  if (data.locked_until && new Date(data.locked_until).getTime() > Date.now()) {
    const left = Math.ceil((new Date(data.locked_until).getTime() - Date.now()) / 60000);
    return { ok: false, error: `บัญชีถูกล็อกชั่วคราว กรุณารออีก ${left} นาที` };
  }

  const match = await bcrypt.compare(pin, data.pin_hash);

  if (!match) {
    const attempts = (data.failed_attempts ?? 0) + 1;
    const locked =
      attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
    await supabase
      .from("employees")
      .update({ failed_attempts: locked ? 0 : attempts, locked_until: locked })
      .eq("id", data.id);

    return {
      ok: false,
      error: locked
        ? `กรอก PIN ผิดครบ ${MAX_ATTEMPTS} ครั้ง บัญชีถูกล็อก ${LOCK_MINUTES} นาที`
        : `PIN ไม่ถูกต้อง (เหลืออีก ${MAX_ATTEMPTS - attempts} ครั้ง)`,
    };
  }

  if (data.failed_attempts || data.locked_until) {
    await supabase
      .from("employees")
      .update({ failed_attempts: 0, locked_until: null })
      .eq("id", data.id);
  }

  return {
    ok: true,
    user: {
      id: data.id,
      emp_code: data.emp_code,
      full_name: data.full_name,
      role: data.role === "admin" ? "admin" : "employee",
    },
  };
}
