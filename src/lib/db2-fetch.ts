import "server-only";

/**
 * เรียกแอป Db2 ที่รันในบริษัท โดยลอง URL หลักก่อน แล้วถอยไป URL สำรองเองเมื่อตัวหลักต่อไม่ได้
 *
 *   DB2_API_URL           เช่น https://sales.kmsgroup.app            (Cloudflare Tunnel — DNS ของเราเอง)
 *   DB2_API_URL_FALLBACK  เช่น https://db2-sales.tail9c6195.ts.net  (Tailscale Funnel — สำรอง)
 *   DB2_API_KEY           header x-api-key
 *
 * ทำไมต้องมีสำรอง: 2026-09-09 DNS สาธารณะของ Tailscale Funnel หายไปหลังเซิร์ฟเวอร์รีบูตทั้งคืน
 * ทำให้ทุกหน้าใน webTimeattendent เข้าข้อมูลสดไม่ได้ทั้งที่แอปทำงานอยู่ — สองเส้นทางที่อิสระต่อกัน
 * ทำให้เว็บยังใช้ได้ตราบใดที่ทางใดทางหนึ่งยังต่อถึง
 *
 * ถือว่า "ต่อไม่ได้" เมื่อ: fetch โยน error/หมดเวลา · หรือปลายทางตอบ 52x (Cloudflare/relay ต่อ origin ไม่ถึง)
 * · หรือตอบเป็น HTML แทน JSON (หน้า error ของตัวกลาง) — เคสเหล่านี้ลองทางถัดไป
 * ส่วน 4xx/500 ที่เป็น JSON คือคำตอบจริงของแอป ส่งกลับทันทีไม่ลองซ้ำ
 */

export class Db2Unreachable extends Error {
  constructor(
    message: string,
    /** 404 = ทุกเส้นทางตอบ "ไม่มี endpoint นี้" (แอปทำงานอยู่ แต่ยังไม่ได้ build เวอร์ชันที่มี endpoint) */
    public status?: number,
  ) {
    super(message);
  }
}

export type Db2Upstream = { res: Response; text: string; base: string };

function bases(): string[] {
  return [process.env.DB2_API_URL, process.env.DB2_API_URL_FALLBACK]
    .map((v) => (v ?? "").trim())
    .filter((v, i, arr) => v && arr.indexOf(v) === i);
}

export function db2Configured(): boolean {
  return bases().length > 0 && !!process.env.DB2_API_KEY;
}

const looksJson = (s: string) => /^\s*[\[{]/.test(s);

export async function db2Fetch(pathWithQuery: string, timeoutMs = 20_000): Promise<Db2Upstream> {
  const key = process.env.DB2_API_KEY ?? "";
  const list = bases();
  if (!list.length || !key) throw new Db2Unreachable("ยังไม่ได้ตั้งค่า DB2_API_URL / DB2_API_KEY");

  const reasons: string[] = [];
  let all404 = list.length > 0;
  for (const base of list) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(new URL(pathWithQuery, base), {
        headers: { "x-api-key": key },
        signal: ctrl.signal,
        cache: "no-store",
      });
      const text = await res.text();
      if (res.status !== 404) all404 = false;
      const relayDown = res.status >= 520 && res.status <= 530;
      if (relayDown || (!looksJson(text) && res.status >= 500)) {
        reasons.push(`${new URL(base).host} → HTTP ${res.status}`);
        continue;
      }
      if (!looksJson(text)) {
        reasons.push(`${new URL(base).host} → ตอบไม่ใช่ JSON (HTTP ${res.status})`);
        continue;
      }
      return { res, text, base };
    } catch (err) {
      all404 = false;
      const why = err instanceof Error && err.name === "AbortError" ? "หมดเวลารอ" : (err as Error).message;
      reasons.push(`${new URL(base).host} → ${why}`);
    } finally {
      clearTimeout(timer);
    }
  }
  // ทุกเส้นทางตอบ 404 = แอปทำงานอยู่แต่ยังไม่รู้จัก path นี้ (ยังไม่ได้ build เวอร์ชันใหม่)
  // ต้องแยกจาก "เครื่องดับ" ไม่งั้นคนอ่านจะไปไล่หาว่าเซิร์ฟเวอร์ล่ม ทั้งที่แค่ยังไม่ได้ deploy
  if (all404) {
    const path = pathWithQuery.split("?")[0];
    throw new Db2Unreachable(
      `แอป Db2 ในบริษัทยังไม่มีเอนด์พอยต์ ${path} — ต้อง build แอป Db2 บนเซิร์ฟเวอร์เวอร์ชันที่มีเอนด์พอยต์นี้ก่อน`,
      404,
    );
  }
  throw new Db2Unreachable(
    `ต่อระบบขาย (Db2) ไม่ได้ทุกเส้นทาง — เครื่องในบริษัทอาจปิดอยู่ (${reasons.join(" · ")})`,
  );
}
