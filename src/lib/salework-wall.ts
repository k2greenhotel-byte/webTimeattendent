import "server-only";
import { workDateOf } from "./datetime";
import { buildStaffSummaries, buildTaskSummaries } from "./salework";
import { listItemStats, listWorkOwners } from "./salework-db";
import type { WallPeriod } from "./wall-period";
import type { SaleWorkWall, WallRow } from "./wall-types";

/**
 * ข้อมูลจอ War Room ของบันทึกงานประจำวันพนักงานขาย
 *
 * ตอบคำถามที่หัวหน้าฝ่ายขายต้องรู้ตอนนี้:
 *   1. วันนี้ใครยังไม่ส่งใบงาน — ต้องตามก่อนหมดวัน
 *   2. งานที่ต้องทำวันนี้ทำไปได้กี่ % แล้ว
 *   3. คนไหน/งานประเภทไหนทำได้มากที่สุดวันนี้
 *
 * ยอดรวมใช้ buildStaffSummaries / buildTaskSummaries จาก salework.ts
 * ชุดเดียวกับหน้า Dashboard
 */

const TOP_N = 10;

export type { SaleWorkWall };

export async function buildSaleWorkWall(input: {
  branchId?: string | null;
  period: WallPeriod;
}): Promise<SaleWorkWall> {
  const today = workDateOf();
  const { period } = input;

  const [rows, owners] = await Promise.all([
    listItemStats({ from: period.from, to: period.to, branch_id: input.branchId ?? null }),
    listWorkOwners(),
  ]);

  const staff = buildStaffSummaries(rows);
  const tasks = buildTaskSummaries(rows);

  // ใครส่งใบงานแล้วในช่วงนี้ — นับจากรายการที่มี submitted_at
  const submittedOwners = new Set(
    rows.filter((r) => r.submitted_at).map((r) => r.owner_id ?? r.owner_name),
  );
  const notReportedOwners = owners.filter((o) => !submittedOwners.has(o.id));

  const itemsTotal = rows.length;
  const itemsDone = rows.filter((r) => r.done).length;

  const isToday = period.from === today && period.to === today;
  const notReported: WallRow[] = notReportedOwners.slice(0, TOP_N).map((o) => ({
    key: o.id,
    title: o.name,
    detail: isToday ? "ยังไม่ส่งใบงานวันนี้" : `ไม่ส่งใบงานเลยใน ${period.label}`,
    right: "รอส่ง",
  }));

  return {
    generatedAt: new Date().toISOString(),
    today,
    period,
    counts: {
      staffTotal: owners.length,
      reported: submittedOwners.size,
      notReported: notReportedOwners.length,
      itemsDone,
      itemsTotal,
    },
    donePct: itemsTotal > 0 ? Math.round((itemsDone / itemsTotal) * 100) : 0,
    notReported,
    byStaff: staff
      .map((s) => ({
        label: s.owner_name,
        value: s.doneCount,
        sub: `${s.donePct}% ของงานในใบ`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_N),
    byTask: tasks
      .map((t) => ({ label: t.task_name, value: t.doneCount }))
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_N),
  };
}
