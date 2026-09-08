import "server-only";
import { monthBounds, workDateOf } from "./datetime";
import { isCertOverdue } from "./leave";
import { listAdvanceRequests, listLeaveRequests } from "./leave-db";
import {
  LEAVE_STATUS_LABEL,
  type AdvanceRequestRow,
  type LeaveRequestRow,
} from "./leave-types";
import type { HrWall, WallRank, WallRow } from "./wall-types";

/**
 * ข้อมูลจอ War Room ของระบบขอลา / ขอเบิกเงินเดือน
 *
 * ตอบคำถามที่ฝ่ายบุคคลต้องรู้ตอนนี้:
 *   1. มีใบรออนุมัติค้างกี่ใบ (ทั้งใบลาและใบขอเบิกเงิน)
 *   2. วันนี้ใครลาบ้าง — ใช้วางกำลังคนหน้างาน
 *   3. ใครค้างส่งใบรับรองแพทย์เกินกำหนด และใครแจ้งลากระชั้นชิด
 *
 * เกณฑ์ "ค้างใบรับรองแพทย์" ใช้ isCertOverdue จาก leave.ts ตัวเดียวกับหน้าฝ่ายบุคคล
 */

const TOP_N = 8;

/** สถานะที่ถือว่ายังรอคนตัดสิน */
const LEAVE_PENDING: LeaveRequestRow["status"][] = ["pending", "need_docs", "escalated", "need_type_change"];
/** สถานะที่ถือว่าอนุมัติแล้ว — ใช้นับว่าวันนี้ใครลาจริง */
const LEAVE_APPROVED: LeaveRequestRow["status"][] = ["approved_hr", "approved_exec"];

export type { HrWall };

const baht = (n: number) => `${Math.round(n).toLocaleString("th-TH")} ฿`;

function rank<T>(rows: T[], keyOf: (r: T) => string): WallRank[] {
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

function leaveRow(r: LeaveRequestRow, right: string, extra?: string): WallRow {
  return {
    key: `L-${r.id}`,
    title: `${r.employee_name} · ${r.type_name}`,
    detail: [r.branch_name, `${r.start_date} ถึง ${r.end_date}`, extra].filter(Boolean).join(" · "),
    right,
  };
}

function advanceRow(r: AdvanceRequestRow, right: string): WallRow {
  return {
    key: `A-${r.id}`,
    title: `${r.employee_name} · ขอเบิกเงินเดือน`,
    detail: [r.branch_name, r.purpose].filter(Boolean).join(" · "),
    right,
  };
}

export async function buildHrWall(input: { branchId?: string | null }): Promise<HrWall> {
  const today = workDateOf();
  const month = monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
  const scope = { branchId: input.branchId ?? null };

  const [leaves, advances] = await Promise.all([
    listLeaveRequests(scope),
    listAdvanceRequests(scope),
  ]);

  const pendingLeave = leaves.filter((r) => LEAVE_PENDING.includes(r.status));
  const pendingAdvance = advances.filter((r) => r.status === "pending");

  // วันนี้ใครลาอยู่ — ใบที่อนุมัติแล้วและวันนี้อยู่ในช่วงวันลา
  const onLeaveToday = leaves.filter(
    (r) => LEAVE_APPROVED.includes(r.status) && r.start_date <= today && r.end_date >= today,
  );

  const certOverdue = leaves.filter((r) => isCertOverdue(r, today));
  const lateNotice = leaves.filter(
    (r) => r.is_late_notice && r.request_date >= month.from && r.request_date <= month.to,
  );

  const advancePending = pendingAdvance.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const advanceThisMonth = advances
    .filter((r) => r.request_date >= month.from && r.request_date <= month.to)
    .reduce((sum, r) => sum + (r.approved_amount || r.amount || 0), 0);

  // รายการรออนุมัติ — ใบลาก่อน แล้วต่อด้วยใบขอเบิกเงิน
  const pending: WallRow[] = [
    ...pendingLeave.map((r) => leaveRow(r, LEAVE_STATUS_LABEL[r.status], `${r.total_days} วัน`)),
    ...pendingAdvance.map((r) => advanceRow(r, baht(r.amount))),
  ].slice(0, TOP_N);

  return {
    generatedAt: new Date().toISOString(),
    today,
    counts: {
      pendingLeave: pendingLeave.length,
      pendingAdvance: pendingAdvance.length,
      onLeaveToday: onLeaveToday.length,
      leaveThisMonth: leaves.filter(
        (r) => r.request_date >= month.from && r.request_date <= month.to,
      ).length,
      certOverdue: certOverdue.length,
      lateNotice: lateNotice.length,
    },
    money: {
      advancePending: Math.round(advancePending),
      advanceThisMonth: Math.round(advanceThisMonth),
    },
    pending,
    onLeaveToday: onLeaveToday
      .slice(0, TOP_N)
      .map((r) => leaveRow(r, `${r.total_days} วัน`, r.detail ?? undefined)),
    byType: rank(
      leaves.filter((r) => r.request_date >= month.from && r.request_date <= month.to),
      (r) => r.type_name,
    ),
    byBranch: rank(
      leaves.filter((r) => r.request_date >= month.from && r.request_date <= month.to),
      (r) => r.branch_name ?? "ไม่ระบุสาขา",
    ),
  };
}
