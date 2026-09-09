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

export class Db2Unreachable extends Error {}

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
      const why = err instanceof Error && err.name === "AbortError" ? "หมดเวลารอ" : (err as Error).message;
      reasons.push(`${new URL(base).host} → ${why}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Db2Unreachable(
    `ต่อระบบขาย (Db2) ไม่ได้ทุกเส้นทาง — เครื่องในบริษัทอาจปิดอยู่ (${reasons.join(" · ")})`,
  );
}
