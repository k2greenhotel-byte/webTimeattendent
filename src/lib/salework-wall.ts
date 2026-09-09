import "server-only";
import { workDateOf } from "./datetime";
import { buildStaffSummaries, buildTaskMatrix, daysElapsed, perDay } from "./salework";
import { listItemStats, listWorkOwners } from "./salework-db";
import type { WallPeriod } from "./wall-period";
import type { SaleWorkWall, WallRow } from "./wall-types";

/**
 * ข้อมูลจอ War Room ของบันทึกงานประจำวันพนักงานขาย
 *
 * ตอบคำถามที่หัวหน้าฝ่ายขายต้องรู้ตอนนี้:
 *   1. วันนี้ใครยังไม่ส่งใบงาน — ต้องตามก่อนหมดวัน
 *   2. งานที่ต้องทำวันนี้ทำไปได้กี่ % แล้ว
 *   3. ใครทำได้น้อยที่สุด และงานประเภทไหนถูกทำน้อยที่สุด — ทั้งสองแผงเรียงจากน้อยไปมาก
 *      เพราะจอนี้มีไว้ "ตามงานที่ยังขาด" ไม่ใช่ชมคนที่ทำเยอะอยู่แล้ว
 *   4. เทียบกันได้ว่าแต่ละคนทำงานประเภทนั้นไปกี่ % ของยอดรวมทั้งร้าน
 *
 * ยอดรวมใช้ buildStaffSummaries / buildTaskMatrix จาก salework.ts ชุดเดียวกับหน้า Dashboard
 * ค่าเฉลี่ยต่อวันหารด้วยจำนวนวันที่ผ่านมาจริง (daysElapsed) ไม่ใช่จำนวนวันที่คนนั้นส่งใบงาน
 * — จะได้เทียบกันได้ตรง ๆ ว่าใครทำงานสม่ำเสมอกว่ากัน
 */

const TOP_N = 12;

/** แผงรายคนเรียงจากน้อยไปมาก จึงเผื่อแถวไว้มากกว่า เพื่อไม่ให้คนทำงานเยอะหายไปหมด */
const STAFF_N = 20;

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
  const taskMatrix = buildTaskMatrix(rows);
  const days = daysElapsed(period.from, period.to, today);

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
    days,
    notReported,
    // เรียงจากน้อยไปมาก — คนที่ทำได้น้อยอยู่บนสุด หัวหน้าจะได้เห็นคนที่ต้องตามก่อน
    byStaff: staff
      .map((s) => ({
        label: s.owner_name,
        value: s.doneCount,
        sub: `เฉลี่ย ${perDay(s.doneCount, days)} งาน/วัน · ${s.donePct}% ของงานในใบ`,
      }))
      .sort((a, b) => a.value - b.value || a.label.localeCompare(b.label, "th"))
      .slice(0, STAFF_N),
    staffOptions: staff
      .map((s) => ({ id: s.key, name: s.owner_name }))
      .sort((a, b) => a.name.localeCompare(b.name, "th")),
    byTask: taskMatrix
      .slice(0, TOP_N)
      .map((t) => ({ label: t.task_name, total: t.total, byStaff: t.byStaff })),
  };
}
