/** ตัวช่วยจัดการเบอร์มือถือ — ใช้เป็นรหัสเข้าระบบของพนักงาน */

/** ตัดทุกอย่างที่ไม่ใช่ตัวเลขออก และแปลง +66 เป็น 0 */
export function normalizePhone(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "");
  if (digits.startsWith("66") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

/** เบอร์มือถือไทย 10 หลักขึ้นต้นด้วย 0 (รองรับเบอร์บ้าน 9 หลักด้วย) */
export function isValidPhone(input: string): boolean {
  return /^0\d{8,9}$/.test(normalizePhone(input));
}

/** แสดงผลเป็น 081-234-5678 */
export function formatPhone(input: string | null | undefined): string {
  const digits = normalizePhone(input ?? "");
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  return digits || "-";
}
