/**
 * ตัวช่วยจัดการวัน-เวลาโซนไทย (Asia/Bangkok = UTC+7 ตลอดปี ไม่มี DST)
 * หลักการ: เก็บลงฐานข้อมูลเป็น UTC (timestamptz) แต่ "ตัดวัน" และแสดงผลตามเวลาไทยเสมอ
 */

export const BANGKOK_OFFSET_MIN = 7 * 60;

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const THAI_DAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/** เลื่อน Date ไปเป็นเวลาไทย แล้วอ่านค่าด้วย getUTC* */
function shift(d: Date): Date {
  return new Date(d.getTime() + BANGKOK_OFFSET_MIN * 60_000);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** วันที่ทำงาน (YYYY-MM-DD) ตามเวลาไทย */
export function workDateOf(value: string | Date = new Date()): string {
  const d = shift(toDate(value) ?? new Date());
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** เวลา HH:mm ตามเวลาไทย ("-" ถ้าไม่มีค่า) */
export function formatTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "-";
  const s = shift(d);
  return `${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}`;
}

/** เวลา HH:mm:ss ตามเวลาไทย */
export function formatTimeSeconds(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "-";
  const s = shift(d);
  return `${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}:${pad(s.getUTCSeconds())}`;
}

/** จำนวนนาทีนับจากเที่ยงคืนของวันไทย */
export function minutesOfDay(value: string | Date | null | undefined): number | null {
  const d = toDate(value);
  if (!d) return null;
  const s = shift(d);
  return s.getUTCHours() * 60 + s.getUTCMinutes() + s.getUTCSeconds() / 60;
}

/** แปลง "08:00" หรือ "08:00:00" เป็นจำนวนนาที */
export function parseTimeToMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** แปลงนาทีเป็น "HH:mm" */
export function minutesToTimeString(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** "8 ชม. 30 นาที" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "-";
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} นาที`;
  if (rest === 0) return `${h} ชม.`;
  return `${h} ชม. ${rest} นาที`;
}

/** ชั่วโมงทศนิยม 2 ตำแหน่ง สำหรับ export ไป Excel */
export function toDecimalHours(minutes: number | null | undefined): number {
  if (!minutes || minutes <= 0) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}

/** "จ. 31 ส.ค. 2569" */
export function formatThaiDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${THAI_DAYS_SHORT[dow]} ${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`;
}

/** "สิงหาคม 2569" */
export function formatThaiMonth(year: number, month1to12: number): string {
  return `${THAI_MONTHS_FULL[month1to12 - 1]} ${year + 543}`;
}

/** วันในสัปดาห์ 0=อาทิตย์ ของ YYYY-MM-DD */
export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** ชื่อเดือนแบบย่อไทย เช่น 8 -> "ส.ค." */
export function thaiMonthShort(month1to12: number): string {
  return THAI_MONTHS_SHORT[month1to12 - 1] ?? "";
}

/** รายการวันที่ทั้งหมดระหว่าง from ถึง to (รวมปลายทั้งสองด้าน) */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const cursor = new Date(Date.UTC(fy, fm - 1, fd));
  const end = new Date(Date.UTC(ty, tm - 1, td));
  while (cursor.getTime() <= end.getTime()) {
    out.push(
      `${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}-${pad(cursor.getUTCDate())}`,
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** วันแรก/วันสุดท้ายของเดือน */
export function monthBounds(year: number, month1to12: number): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  return {
    from: `${year}-${pad(month1to12)}-01`,
    to: `${year}-${pad(month1to12)}-${pad(last)}`,
  };
}

/** วัน-เวลาไทยแบบเต็มสำหรับ watermark: "31 ส.ค. 2569 08:15:32" */
export function formatStampThai(value: string | Date): string {
  const d = toDate(value) ?? new Date();
  const s = shift(d);
  const day = s.getUTCDate();
  const month = THAI_MONTHS_SHORT[s.getUTCMonth()];
  const year = s.getUTCFullYear() + 543;
  return `${day} ${month} ${year} ${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}:${pad(s.getUTCSeconds())}`;
}
