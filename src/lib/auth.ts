import "server-only";
import bcrypt from "bcryptjs";
import { normalizePhone } from "./phone";
import { getSupabase } from "./supabase-server";
import type { SessionUser } from "./types";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

/** รหัสผ่านพนักงาน = ตัวเลข 4-8 หลัก (พิมพ์บนแป้นตัวเลขได้สะดวก) */
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin);
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

/** ตรวจเบอร์มือถือ + รหัสผ่าน พร้อมกลไกล็อกบัญชีเมื่อกรอกผิดหลายครั้ง */
export async function loginWithPhone(phoneInput: string, pin: string): Promise<LoginResult> {
  const phone = normalizePhone(phoneInput);
  if (!phone || !isValidPin(pin)) {
    return {
      ok: false,
      error: `กรุณากรอกเบอร์มือถือและรหัสผ่าน ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} หลักให้ถูกต้อง`,
    };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("employees")
    .select("id, emp_code, full_name, role, access_level, is_active, pin_hash, failed_attempts, locked_until")
    .eq("phone", phone)
    .maybeSingle();

  if (error) return { ok: false, error: `เข้าสู่ระบบไม่สำเร็จ: ${error.message}` };
  if (!data) return { ok: false, error: "ไม่พบเบอร์มือถือนี้ในระบบ กรุณาติดต่อผู้ดูแล" };
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
      level: (data.access_level ?? (data.role === "admin" ? "admin" : "user")) as SessionUser["level"],
    },
  };
}

/**
 * ยืนยันรหัสผ่านของบัญชีที่ล็อกอินอยู่แล้ว (ไม่ใช่การเข้าสู่ระบบ จึงไม่นับครั้งที่ผิด)
 * ใช้กับหน้าจอที่ต้องยืนยันตัวตนซ้ำ เช่น เปลี่ยนรหัสผ่าน และหน้าอนุมัติซ่อม/จัดซื้อ (ข้อ 3.1)
 */
export async function verifyEmployeePin(
  employeeId: string,
  pin: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pin) return { ok: false, error: "กรุณากรอกรหัสผ่าน" };

  const { data, error } = await getSupabase()
    .from("employees")
    .select("id, pin_hash, is_active")
    .eq("id", employeeId)
    .maybeSingle();

  if (error) return { ok: false, error: `ตรวจสอบรหัสผ่านไม่สำเร็จ: ${error.message}` };
  if (!data || !data.is_active) return { ok: false, error: "ไม่พบบัญชีนี้ หรือบัญชีถูกปิดการใช้งาน" };
  if (!(await bcrypt.compare(pin, data.pin_hash))) {
    return { ok: false, error: "รหัสผ่านไม่ถูกต้อง" };
  }
  return { ok: true };
}

/** พนักงานเปลี่ยนรหัสผ่านของตัวเอง (ต้องยืนยันรหัสเดิมก่อน) */
export async function changeOwnPin(
  employeeId: string,
  currentPin: string,
  newPin: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidPin(newPin)) {
    return { ok: false, error: `รหัสผ่านใหม่ต้องเป็นตัวเลข ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} หลัก` };
  }
  if (currentPin === newPin) {
    return { ok: false, error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม" };
  }

  const verified = await verifyEmployeePin(employeeId, currentPin);
  if (!verified.ok) {
    return { ok: false, error: currentPin ? "รหัสผ่านเดิมไม่ถูกต้อง" : verified.error };
  }

  const supabase = getSupabase();
  const { error: updateError } = await supabase
    .from("employees")
    .update({ pin_hash: await hashPin(newPin), failed_attempts: 0, locked_until: null })
    .eq("id", employeeId);

  if (updateError) return { ok: false, error: `เปลี่ยนรหัสผ่านไม่สำเร็จ: ${updateError.message}` };
  return { ok: true };
}

/**
 * เปลี่ยนรหัสผ่านจากหน้าล็อกอิน (ยังไม่ได้เข้าระบบ)
 * ต้องยืนยันตัวตนด้วยเบอร์มือถือ + รหัสผ่านเดิมก่อน จึงจะตั้งรหัสใหม่ได้
 */
export async function changePinFromLogin(
  phoneInput: string,
  currentPin: string,
  newPin: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await loginWithPhone(phoneInput, currentPin);
  if (!auth.ok) return { ok: false, error: auth.error };
  return changeOwnPin(auth.user.id, currentPin, newPin);
}
