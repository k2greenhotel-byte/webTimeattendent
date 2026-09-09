import "server-only";
import { workDateOf } from "./datetime";
import { isOverdue, overdueDays, remainingToPay, summarizeDocs, urgencyText } from "./procurement";
import { listDocs } from "./procurement-db";
import type { PrDocRow } from "./procurement-types";
import { inPeriod, type WallPeriod } from "./wall-period";
import type { ProcurementWall, WallRank, WallRow } from "./wall-types";

/**
 * ข้อมูลจอ War Room ของระบบจัดซื้อจัดจ้าง/แจ้งซ่อม
 *
 * ตอบคำถามที่ผู้จัดการต้องรู้ตอนนี้:
 *   1. ใบไหนเลยกำหนดเสร็จแล้ว — งานค้างที่กระทบหน้างานจริง
 *   2. ใบไหนรออนุมัติอยู่ ใครต้องกดอนุมัติ
 *   3. เงินที่อนุมัติไปแล้วแต่ยังไม่ได้จ่ายมีเท่าไหร่
 *
 * เกณฑ์ "เลยกำหนด" และยอดเงินใช้ฟังก์ชันกลางใน procurement.ts
 * ชุดเดียวกับหน้า Dashboard และหน้าสอบถาม
 *
 * ตัวเลขแบ่งสองพวก อย่าปนกัน:
 *   • ค้างอยู่ตอนนี้ (ยังไม่เสร็จ รออนุมัติ เลยกำหนด ยอดค้างจ่าย) — ไม่ขึ้นกับช่วงที่เลือก
 *   • เกิดขึ้นในช่วง (เปิดใบใหม่ ยอดขอ/อนุมัติ/จ่าย) — นับเฉพาะใบที่เปิดในช่วง from–to
 */

const TOP_N = 8;

export type { ProcurementWall };

const baht = (n: number) => `${Math.round(n).toLocaleString("th-TH")} ฿`;

function rowOf(r: PrDocRow, right: string, extra?: string): WallRow {
  return {
    key: `${r.kind}-${r.id}`,
    title: `${r.doc_no} · ${r.item_name}`,
    detail: [r.branch_name, r.type_name, extra].filter(Boolean).join(" · "),
    right,
  };
}

function rank(rows: PrDocRow[], keyOf: (r: PrDocRow) => string): WallRank[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N);
}

export async function buildProcurementWall(input: {
  branchId?: string | null;
  period: WallPeriod;
}): Promise<ProcurementWall> {
  const today = workDateOf();
  const { period } = input;

  const rows = await listDocs(input.branchId ? { branch_id: input.branchId } : {});

  // เงิน "ขอ/อนุมัติ/จ่าย" นับเฉพาะใบที่เปิดในช่วงที่เลือก — ตัวเลขกิจกรรม ขยับตามตัวกรอง
  const inRange = rows.filter((r) => inPeriod(r.doc_date, period));
  const summary = summarizeDocs(inRange, today);

  const live = rows.filter((r) => r.doc_status !== "cancelled");
  const openRows = live.filter((r) => !r.done_date);
  const waitingRows = live.filter((r) => r.approve_status === "pending");
  const overdueRows = live
    .filter((r) => isOverdue(r, today))
    .sort((a, b) => overdueDays(b, today) - overdueDays(a, today));

  // ยอดค้างจ่าย — สถานะปัจจุบัน ไม่ขึ้นกับช่วงที่เลือก
  const unpaid = live.reduce((sum, r) => sum + remainingToPay(r), 0);

  return {
    generatedAt: new Date().toISOString(),
    today,
    period,
    counts: {
      open: openRows.length,
      waitingApproval: waitingRows.length,
      overdue: overdueRows.length,
      createdToday: live.filter((r) => r.doc_date === today).length,
      createdInPeriod: live.filter((r) => inPeriod(r.doc_date, period)).length,
    },
    money: {
      requested: Math.round(summary.requested),
      approved: Math.round(summary.approved),
      paid: Math.round(summary.actual),
      unpaid: Math.round(unpaid),
    },
    overdue: overdueRows
      .slice(0, TOP_N)
      .map((r) => rowOf(r, `เลย ${overdueDays(r, today)} วัน`, urgencyText(r))),
    waitingApproval: waitingRows
      .slice(0, TOP_N)
      .map((r) => rowOf(r, baht(r.requested_amount), urgencyText(r))),
    // งานค้างรายสาขา/ประเภท — สถานะปัจจุบันของ backlog ไม่ขึ้นกับช่วงที่เลือก
    byBranch: rank(openRows, (r) => r.branch_name ?? "ไม่ระบุสาขา"),
    byType: rank(openRows, (r) => r.type_name ?? "ไม่ระบุประเภท"),
  };
}
