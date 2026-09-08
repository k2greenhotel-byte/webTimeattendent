import "server-only";
import { monthBounds, workDateOf } from "./datetime";
import { isOverdue, overdueDays, remainingToPay, summarizeDocs, urgencyText } from "./procurement";
import { listDocs } from "./procurement-db";
import type { PrDocRow } from "./procurement-types";
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
}): Promise<ProcurementWall> {
  const today = workDateOf();
  const month = monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7)));

  const rows = await listDocs(input.branchId ? { branch_id: input.branchId } : {});
  const summary = summarizeDocs(rows, today);

  const live = rows.filter((r) => r.doc_status !== "cancelled");
  const openRows = live.filter((r) => !r.done_date);
  const waitingRows = live.filter((r) => r.approve_status === "pending");
  const overdueRows = live
    .filter((r) => isOverdue(r, today))
    .sort((a, b) => overdueDays(b, today) - overdueDays(a, today));

  const unpaid = live.reduce((sum, r) => sum + remainingToPay(r), 0);

  return {
    generatedAt: new Date().toISOString(),
    today,
    counts: {
      open: openRows.length,
      waitingApproval: waitingRows.length,
      overdue: overdueRows.length,
      createdToday: live.filter((r) => r.doc_date === today).length,
      createdThisMonth: live.filter((r) => r.doc_date >= month.from && r.doc_date <= month.to)
        .length,
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
    byBranch: rank(openRows, (r) => r.branch_name ?? "ไม่ระบุสาขา"),
    byType: rank(openRows, (r) => r.type_name ?? "ไม่ระบุประเภท"),
  };
}
