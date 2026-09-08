import "server-only";
import { isClosed, isOverdue, makerText, overdueDays, summarizeClaims, vehicleText } from "./claim";
import { listClaims } from "./claim-db";
import type { ClaimRow } from "./claim-types";
import { monthBounds, workDateOf } from "./datetime";
import type { ClaimWall, WallRank, WallRow } from "./wall-types";

/**
 * ข้อมูลจอ War Room ของระบบแจ้งเคลม
 *
 * ตอบคำถามที่หัวหน้าศูนย์บริการต้องรู้ตอนนี้:
 *   1. งานเคลมไหนเลยกำหนดแล้ว — ลูกค้ารอรถอยู่
 *   2. ใบไหนแจ้งผู้ผลิตไปแล้วแต่ยังไม่มีคำตอบ ต้องตามให้
 *   3. ซ่อมเสร็จแล้วแต่ยังไม่ได้ส่งมอบรถคืนกี่คัน
 *
 * เกณฑ์ "เลยกำหนด" และยอดรวมใช้ฟังก์ชันกลางใน claim.ts ชุดเดียวกับหน้า Dashboard
 */

const TOP_N = 8;

export type { ClaimWall };

function rowOf(r: ClaimRow, right: string, extra?: string): WallRow {
  return {
    key: r.id,
    title: `${r.doc_no} · ${r.customer_name ?? "ไม่ระบุลูกค้า"}`,
    detail: [vehicleText(r), r.branch_name, r.item_summary, extra].filter(Boolean).join(" · "),
    right,
  };
}

function rank(rows: ClaimRow[], keyOf: (r: ClaimRow) => string): WallRank[] {
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

export async function buildClaimWall(input: { branchId?: string | null }): Promise<ClaimWall> {
  const today = workDateOf();
  const month = monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7)));

  const rows = await listClaims(input.branchId ? { branch_id: input.branchId } : {});
  const summary = summarizeClaims(rows, today);

  const live = rows.filter((r) => r.doc_status !== "cancelled");
  const openRows = live.filter((r) => !isClosed(r.job_status) || !r.delivered_date);
  const overdueRows = live
    .filter((r) => isOverdue(r, today))
    .sort((a, b) => overdueDays(b, today) - overdueDays(a, today));
  const waitingMakerRows = live.filter((r) => r.job_status === "sent_agent");

  return {
    generatedAt: new Date().toISOString(),
    today,
    counts: {
      open: summary.open,
      overdue: summary.overdue,
      waitingMaker: summary.waitingMaker,
      waitingDelivery: summary.waitingDelivery,
      openedToday: live.filter((r) => r.claim_date === today).length,
      openedThisMonth: live.filter((r) => r.claim_date >= month.from && r.claim_date <= month.to).length,
    },
    overdue: overdueRows.slice(0, TOP_N).map((r) => rowOf(r, `เลย ${overdueDays(r, today)} วัน`)),
    waitingMaker: waitingMakerRows
      .slice(0, TOP_N)
      .map((r) => rowOf(r, makerText(r) || "รอผู้ผลิต")),
    byBranch: rank(openRows, (r) => r.branch_name ?? "ไม่ระบุสาขา"),
    byMaker: rank(openRows, (r) => r.maker_vendor_name ?? r.maker_name ?? "ไม่ระบุผู้ผลิต"),
  };
}
