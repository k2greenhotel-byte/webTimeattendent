/**
 * เทียบชื่อคนไทยระหว่างสองระบบที่พิมพ์ชื่อไม่เหมือนกันเป๊ะ
 * ใช้ตอนจับคู่รหัสพนักงานของระบบลงเวลากับรหัสจากระบบเงินเดือน
 *
 * ปัญหาที่เจอจริงในข้อมูล:
 *   - คำนำหน้าเขียนหลายแบบ: "น.ส." / "นส." / "นางสาว" / มีเว้นวรรคหลังคำนำหน้าบ้างไม่มีบ้าง
 *   - "เเ" (เอ สองตัว) พิมพ์แทน "แ" — ตามองไม่เห็นความต่าง
 *   - วรรณยุกต์ต่าง: "อุ่มน้อย" vs "อุ้มน้อย"
 *   - นามสกุลสะกดต่าง: "เจียระสถิตย์" vs "เจียรสถิตย์", "นาคสมพันธุ์" vs "นาคสมพันธ์"
 */

const PREFIXES = [
  "นางสาว",
  "น.ส.",
  "น.ส",
  "นส.",
  "นส",
  "นาย",
  "นาง",
  "ว่าที่ร้อยตรี",
  "ส.ต.ต.",
  "ดร.",
];

/** แก้ "เเ" ที่พิมพ์ผิดให้เป็น "แ" ก่อนเสมอ ไม่งั้นเทียบยังไงก็ไม่ตรง */
function fixThaiTypos(raw: string): string {
  return raw.replace(/เเ/g, "แ");
}

/** ตัดคำนำหน้า ช่องว่าง และจุด ออกให้หมด เหลือแต่ตัวอักษรชื่อ-สกุล */
export function normalizeThaiName(raw: string | null | undefined): string {
  let s = fixThaiTypos(String(raw ?? "").trim());
  for (const p of PREFIXES) {
    if (s.startsWith(p)) {
      s = s.slice(p.length);
      break;
    }
  }
  return s.replace(/[\s.]/g, "");
}

/** เหมือน normalizeThaiName แต่ตัดวรรณยุกต์/ไม้ไต่คู้/การันต์ออกด้วย เทียบชื่อที่สะกดต่างนิดหน่อย */
export function looseThaiName(raw: string | null | undefined): string {
  return normalizeThaiName(raw).replace(/[็-๎]/g, "");
}

/** ชื่อต้น (คำแรกหลังคำนำหน้า) ใช้เทียบกรณีนามสกุลสะกดต่างกันมาก */
export function firstNameOf(raw: string | null | undefined): string {
  const s = fixThaiTypos(String(raw ?? "").trim());
  for (const p of PREFIXES) {
    if (s.startsWith(p)) return s.slice(p.length).trim().split(/\s+/)[0] ?? "";
  }
  return s.split(/\s+/)[0] ?? "";
}

export type NameMatchLevel = "exact" | "loose" | "first";

export type NameCandidate = { id: string; full_name: string; nickname?: string | null };

/**
 * หาคนที่ชื่อตรงกับ `name` จากรายชื่อที่ให้มา — คืนค่าเฉพาะเมื่อ "ตรงคนเดียว" เท่านั้น
 * ไล่จากเข้มไปหลวม: ตรงเป๊ะ → ต่างแค่วรรณยุกต์ → ชื่อต้นตรง (และชื่อเล่นไม่ขัดกัน)
 * ชื่อเล่นใช้เป็นตัวกรองเพิ่ม ไม่ใช่ตัวจับคู่ เพราะหลายคนมีชื่อเล่นซ้ำกัน
 */
export function matchByName<T extends NameCandidate>(
  name: string,
  nickname: string | null | undefined,
  candidates: T[],
): { employee: T; level: NameMatchLevel } | null {
  const pick = (list: T[], level: NameMatchLevel) =>
    list.length === 1 ? { employee: list[0], level } : null;

  const exact = candidates.filter((c) => normalizeThaiName(c.full_name) === normalizeThaiName(name));
  const byExact = pick(exact, "exact");
  if (byExact) return byExact;

  const near = candidates.filter((c) => looseThaiName(c.full_name) === looseThaiName(name));
  const byLoose = pick(near, "loose");
  if (byLoose) return byLoose;

  const wanted = firstNameOf(name);
  if (!wanted) return null;
  const sameFirst = candidates.filter(
    (c) =>
      firstNameOf(c.full_name) === wanted &&
      // ชื่อเล่นต้องไม่ขัดกัน (ฝั่งใดฝั่งหนึ่งว่างถือว่าผ่าน)
      (!c.nickname || !nickname || c.nickname.trim() === nickname.trim()),
  );
  return pick(sameFirst, "first");
}

/**
 * แปลงข้อความที่ก๊อปมาจาก Excel เป็นรายการ (รหัส, ชื่อ, ชื่อเล่น)
 *
 * ก๊อปจาก Excel มาจะได้คอลัมน์คั่นด้วย Tab (หรือจุลภาคถ้ามาจาก CSV) — ใช้ทางนี้เป็นหลัก
 * ห้ามใช้ "เว้นวรรคหลายช่อง" เป็นตัวคั่นคอลัมน์ เพราะชื่อไทยในไฟล์จริงมีเว้นวรรคสองช่อง
 * ระหว่างชื่อกับนามสกุลอยู่แล้ว ("น.ส.กาญจนรินทร์  ปรีดา") จะถูกหั่นเป็นคนละคอลัมน์
 * ถ้าไม่มี Tab/จุลภาคเลย ถือว่าคำแรกคือรหัส ที่เหลือทั้งบรรทัดคือชื่อ
 */
export function parsePastedCodes(text: string): { code: string; name: string; nickname: string | null }[] {
  const rows: { code: string; name: string; nickname: string | null }[] = [];

  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    let cells: string[];
    if (line.includes("\t")) cells = line.split("\t");
    else if (line.includes(",")) cells = line.split(",");
    else {
      const [, code = "", rest = ""] = line.match(/^(\S+)\s+([\s\S]+)$/) ?? [];
      cells = [code, rest];
    }

    const [code, name, nickname] = cells.map((c) => c.trim());
    if (!code || !name) continue;
    if (/^รหัส/.test(code)) continue; // บรรทัดหัวตาราง
    rows.push({ code, name, nickname: nickname || null });
  }
  return rows;
}
