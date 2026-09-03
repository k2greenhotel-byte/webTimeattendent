/**
 * กฎของข้อมูลลูกค้า — pure function ล้วน ไม่แตะฐานข้อมูล
 * ทั้งหน้าเว็บ ฟอร์ม และรายงาน เรียกใช้ชุดเดียวกัน
 */

// ---------- เลขบัตรประชาชน ----------

export function normalizeNationalId(input: string | null | undefined): string {
  return (input ?? "").replace(/\D/g, "");
}

/**
 * ตรวจเลขบัตรประชาชนไทย 13 หลักด้วยหลักตรวจสอบ (check digit)
 * ผลรวมของ 12 หลักแรกคูณน้ำหนัก 13..2 หารเอาเศษด้วย 11 แล้วเอา 11 ลบ เหลือหลักหน่วย = หลักที่ 13
 */
export function isValidNationalId(input: string | null | undefined): boolean {
  const id = normalizeNationalId(input);
  if (!/^\d{13}$/.test(id)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(id[i]) * (13 - i);
  }
  return ((11 - (sum % 11)) % 10) === Number(id[12]);
}

/** แสดงเป็น 1-2345-67890-12-3 */
export function formatNationalId(input: string | null | undefined): string {
  const id = normalizeNationalId(input);
  if (id.length !== 13) return id || "-";
  return `${id[0]}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id[12]}`;
}

// ---------- รหัสลูกค้า ----------

export const CUSTOMER_CODE_PREFIX = "C";

/**
 * รหัสลูกค้าตัวถัดไปจากรหัสล่าสุด เช่น C000123 → C000124
 * ไม่มีรหัสเดิม (ลูกค้ารายแรก) → C000001
 */
export function nextCustomerCode(latestCode: string | null | undefined, digits = 6): string {
  const matched = /(\d+)\s*$/.exec(latestCode ?? "");
  const next = matched ? Number(matched[1]) + 1 : 1;
  return `${CUSTOMER_CODE_PREFIX}${String(next).padStart(digits, "0")}`;
}

// ---------- ที่อยู่ ----------

export type GeoRow = {
  subdistrict_code: number;
  subdistrict_name: string;
  district_name: string;
  province_name: string;
  postal_code: string;
};

/** กรุงเทพฯ ใช้ "แขวง/เขต" ต่างจากจังหวัดอื่นที่ใช้ "ตำบล/อำเภอ" */
export function isBangkok(province: string | null | undefined): boolean {
  return (province ?? "").includes("กรุงเทพ");
}

export function subdistrictLabel(province: string | null | undefined): string {
  return isBangkok(province) ? "แขวง" : "ตำบล";
}

export function districtLabel(province: string | null | undefined): string {
  return isBangkok(province) ? "เขต" : "อำเภอ";
}

/** ที่อยู่เต็มบรรทัดเดียว: ส่วนที่ผู้ใช้กรอก + ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ ที่ระบบเติมให้ */
export function formatFullAddress(input: {
  address_detail?: string | null;
  subdistrict_name?: string | null;
  district_name?: string | null;
  province_name?: string | null;
  postal_code?: string | null;
}): string {
  const province = input.province_name ?? null;
  const parts = [
    (input.address_detail ?? "").trim(),
    input.subdistrict_name ? `${subdistrictLabel(province)}${input.subdistrict_name}` : "",
    input.district_name ? `${districtLabel(province)}${input.district_name}` : "",
    province ? `จ.${province}` : "",
    (input.postal_code ?? "").trim(),
  ].filter((p) => p.length > 0);

  // กรุงเทพฯ ไม่ต้องมีคำว่า "จ." นำหน้า
  return parts.join(" ").replace("จ.กรุงเทพมหานคร", "กรุงเทพมหานคร");
}

// ---------- ลิงก์โซเชียล ----------

/** รับได้ทั้งลิงก์เต็มและชื่อผู้ใช้ — คืนลิงก์เต็มที่กดได้ */
export function normalizeFacebook(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://www.facebook.com/${raw.replace(/^\/+/, "")}`;
}

/** LINE ID ขึ้นต้นด้วย @ (บัญชีทางการ) หรือ ID ธรรมดา — แปลงเป็นลิงก์เพิ่มเพื่อน */
export function normalizeLine(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("@")) return `https://line.me/R/ti/p/${encodeURIComponent(raw)}`;
  return `https://line.me/ti/p/~${raw.replace(/^~/, "")}`;
}

// ---------- วันเกิด ----------

/** อายุเต็มปี ณ วันที่อ้างอิง (ค่าเริ่มต้น = วันนี้) */
export function ageFromBirthDate(
  birthDate: string | null | undefined,
  today = new Date(),
): number | null {
  if (!birthDate) return null;
  const born = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;

  let age = today.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < born.getUTCMonth() ||
    (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;

  return age >= 0 ? age : null;
}
