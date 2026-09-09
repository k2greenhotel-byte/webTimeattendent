import "server-only";
import { workDateOf } from "./datetime";
import {
  byFollowPriority,
  hasNoPlan,
  isOpenLead,
  isOverdue,
  isWonLead,
  NO_BRANCH,
  NO_STAFF,
  NO_STATUS,
} from "./lead";
import { listLeads } from "./lead-db";
import type { LeadRow } from "./lead-types";
import { inPeriod, type WallPeriod } from "./wall-period";
import type { LeadWall, WallRank, WallRow } from "./wall-types";

/**
 * ข้อมูลจอ War Room ของระบบ Lead การขาย
 *
 * ตอบคำถามที่หัวหน้าฝ่ายขายต้องรู้ตอนนี้:
 *   1. วันนี้ต้องโทรหาใครบ้าง และมีใครที่เลยนัดไปแล้ว
 *   2. Lead ไหนยังไม่ได้นัดวันต่อไป (หลุดมือง่ายที่สุด)
 *   3. พนักงานคนไหน/สาขาไหนถือ Lead ค้างมากที่สุด
 *
 * เกณฑ์ "เลยนัด / ยังไม่ได้นัด / ยังเปิดอยู่" ใช้ฟังก์ชันกลางใน lead.ts
 * ชุดเดียวกับหน้า Dashboard และหน้าติดตามการขาย
 */

const TOP_N = 8;

export type { LeadWall };

function rowOf(r: LeadRow, today: string): WallRow {
  const days = r.next_follow_date
    ? Math.round(
        (Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10)) -
          Date.UTC(
            +r.next_follow_date.slice(0, 4),
            +r.next_follow_date.slice(5, 7) - 1,
            +r.next_follow_date.slice(8, 10),
          )) /
          86_400_000,
      )
    : 0;

  return {
    key: r.id,
    title: `${r.customer_name}${r.phone ? ` · ${r.phone}` : ""}`,
    detail: [r.owner_full_name ?? r.owner_name, r.model_name, r.work_status_name, r.chance_name]
      .filter(Boolean)
      .join(" · "),
    right: r.next_follow_date ? (days > 0 ? `เลย ${days} วัน` : "วันนี้") : "ยังไม่นัด",
  };
}

/** นับจำนวนตามคีย์แล้วเรียงมากไปน้อย */
function rank(rows: LeadRow[], keyOf: (r: LeadRow) => string): WallRank[] {
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

export async function buildLeadWall(input: {
  branchId?: string | null;
  ownerId?: string | null;
  period: WallPeriod;
}): Promise<LeadWall> {
  const today = workDateOf();
  const { period } = input;

  const rows = await listLeads({
    branch_id: input.branchId || undefined,
    owner_id: input.ownerId || undefined,
  });

  const open = rows.filter((r) => isOpenLead(r));
  const overdueRows = open.filter((r) => isOverdue(r, today)).sort(byFollowPriority(today));
  const dueTodayRows = open.filter((r) => r.next_follow_date === today);
  const noPlanRows = open.filter((r) => hasNoPlan(r));

  // Lead ที่รับเข้ามาในช่วงที่เลือก — ตัวเลขกลุ่มนี้ขยับตามตัวกรอง
  const inRange = rows.filter((r) => inPeriod(r.lead_date, period));

  return {
    generatedAt: new Date().toISOString(),
    today,
    period,
    counts: {
      open: open.length,
      newToday: rows.filter((r) => r.lead_date === today).length,
      newInPeriod: inRange.length,
      dueToday: dueTodayRows.length,
      overdue: overdueRows.length,
      noPlan: noPlanRows.length,
      won: rows.filter((r) => isWonLead(r)).length,
    },
    overdue: overdueRows.slice(0, TOP_N).map((r) => rowOf(r, today)),
    dueToday: [...dueTodayRows, ...noPlanRows].slice(0, TOP_N).map((r) => rowOf(r, today)),
    // รายพนักงานนับ "Lead ใหม่ในช่วง" — ดูผลงานรับลูกค้าเข้าตามช่วงที่เลือก
    byStaff: rank(inRange, (r) => r.owner_full_name ?? r.owner_name ?? NO_STAFF),
    // สองอันล่างเป็นภาพ "ค้างอยู่ตอนนี้" ไม่ขึ้นกับช่วงที่เลือก
    byBranch: rank(open, (r) => r.branch_name ?? NO_BRANCH),
    byStatus: rank(open, (r) => r.work_status_name ?? NO_STATUS),
  };
}
