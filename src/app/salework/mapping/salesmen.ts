import "server-only";
import { addDays, workDateOf } from "@/lib/datetime";
import { Db2ApiError, db2Officers, db2Salesmen } from "@/lib/db2-api";
import type { Db2Salesman } from "@/lib/salework-types";

/**
 * แหล่งรายชื่อพนักงานขายที่หน้าจอจับคู่ใช้อยู่
 *   officer = ทะเบียนพนักงาน `OFFICER` ของระบบขาย (ครบและมีชื่อทุกคน — ที่ควรได้)
 *   sales   = ถอยไปใช้รายชื่อจากรายการขาย (ใช้เมื่อแอป Db2 ยังไม่ได้อัปเดต endpoint ใหม่)
 *   none    = ต่อระบบขายไม่ได้เลย ต้องพิมพ์รหัสเอง
 */
export type SalesmanSource = "officer" | "sales" | "none";

/** ยอดขายที่ใช้จัดอันดับ = 365 วันล่าสุด (ตรงกับค่าเริ่มต้นฝั่ง Db2) */
export function salesRange(): { from: string; to: string } {
  const today = workDateOf();
  return { from: addDays(today, -364), to: today };
}

/**
 * รายชื่อพนักงานขายให้เลือกจับคู่
 *
 * เอาจากทะเบียนพนักงาน (`OFFICER`) เป็นหลัก เพราะมีชื่อครบทุกรหัส —
 * ตารางชื่อเดิม (`SECRET`) มีชื่อแค่ 13 จาก 33 รหัสที่ขายจริง
 * ถ้าแอป Db2 ยังไม่มี `/api/officers` (ยังไม่ได้ build ใหม่) จะถอยไปใช้รายชื่อจากยอดขายให้อัตโนมัติ
 * เพื่อให้หน้าจอยังใช้งานได้ ไม่ค้าง
 */
export async function loadDb2Salesmen(
  opts: { includeResigned?: boolean } = {},
): Promise<{ salesmen: Db2Salesman[]; source: SalesmanSource; error: string | null }> {
  const { from, to } = salesRange();

  try {
    const res = await db2Officers({
      status: opts.includeResigned ? "all" : "Y",
      from,
      to,
      limit: 500,
    });
    return {
      salesmen: res.officers.map((o) => ({
        salcod: o.code,
        name: o.name || null,
        units: o.units ?? 0,
        branch: o.branch,
        active: o.active,
      })),
      source: "officer",
      error: null,
    };
  } catch (err) {
    const notDeployed = err instanceof Db2ApiError && err.status === 404;

    try {
      const items = await db2Salesmen({ from, to });
      return {
        salesmen: items,
        source: "sales",
        error: notDeployed
          ? "แอป Db2 ในบริษัทยังไม่มีเมนูทะเบียนพนักงาน (/api/officers) — ตอนนี้แสดงเฉพาะรหัสที่มียอดขายจริงและชื่อเท่าที่มี กรุณา build แอป Db2 ใหม่เพื่อให้เห็นชื่อครบทุกคน"
          : "ดึงทะเบียนพนักงานจากระบบขายไม่ได้ ตอนนี้แสดงเฉพาะรหัสที่มียอดขายจริงแทน",
      };
    } catch (err2) {
      const reason = err2 instanceof Error ? err2.message : "ต่อระบบขาย (Db2) ไม่ได้";
      return { salesmen: [], source: "none", error: reason };
    }
  }
}

/**
 * เรียงให้คนที่ขายจริงมากที่สุดอยู่บนสุด แล้วค่อยเรียงชื่อ
 * (ทะเบียนพนักงานมีทั้งทุกแผนกและรายการที่ไม่ใช่คน เช่น ชื่อบริษัท — คนขายจริงต้องหาง่ายที่สุด)
 */
export function sortSalesmen(list: Db2Salesman[]): Db2Salesman[] {
  return [...list].sort(
    (a, b) => b.units - a.units || (a.name ?? a.salcod).localeCompare(b.name ?? b.salcod, "th"),
  );
}
