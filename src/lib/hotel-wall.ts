import "server-only";
import { formatThaiDate, workDateOf } from "./datetime";
import { listBranches } from "./db";
import {
  countByKey,
  dueLabel,
  isOverdue,
  openDays,
  placeLabel,
  summarizeByPeriod,
  summarizeIssues,
  summarizeRounds,
  sortIssuesByUrgency,
} from "./hotel";
import { listIssues, listRooms, listRounds } from "./hotel-db";
import { HTL_PRIORITY_LABEL } from "./hotel-types";
import { inPeriod, type WallPeriod } from "./wall-period";
import type { HotelWall, WallRank, WallRow } from "./wall-types";

/**
 * ข้อมูลจอ War Room ของระบบตรวจเช็คโรงแรมประจำวัน
 *
 * ตอบคำถามที่หัวหน้าช่างต้องรู้ตอนนี้:
 *   1. วันนี้สาขาไหนยังไม่ได้ตรวจ — งานประจำวันต้องครบทุกสาขาทุกวัน
 *   2. มีอะไรเร่งด่วนค้างอยู่ และอะไรเลยกำหนดแก้ไขแล้ว
 *   3. ปัญหากระจุกที่ประเภทงานไหน/สาขาไหน — จะได้แก้ที่ต้นเหตุ
 *
 * เกณฑ์กำหนดแก้ไขและเปอร์เซ็นต์ผ่านใช้ฟังก์ชันกลางใน hotel.ts ชุดเดียวกับหน้า Dashboard
 */

const TOP_N = 8;

export type { HotelWall };

export async function buildHotelWall(input: {
  companyId?: string | null;
  branchId?: string | null;
  period: WallPeriod;
}): Promise<HotelWall> {
  const today = workDateOf();
  const { period } = input;

  const [rounds, allBranches, issues, rooms] = await Promise.all([
    listRounds({ company_id: input.companyId ?? null, branch_id: input.branchId ?? null }),
    listBranches(true, input.companyId ?? null),
    listIssues({ company_id: input.companyId ?? null, branch_id: input.branchId ?? null }),
    listRooms(input.branchId ?? null),
  ]);

  // เลือกสาขาเดียว = ตัวหารของ "สาขาทั้งหมด" ต้องเหลือสาขานั้นสาขาเดียวด้วย
  const branches = input.branchId ? allBranches.filter((b) => b.id === input.branchId) : allBranches;

  const inRange = rounds.filter((r) => inPeriod(r.check_date, period));
  const periodSummary = summarizeRounds(inRange);
  const issueSummary = summarizeIssues(issues, today);

  const openIssues = sortIssuesByUrgency(
    issues.filter((i) => !i.is_fixed),
    today,
  );

  const toRow = (i: (typeof openIssues)[number]): WallRow => ({
    key: i.result_id,
    title: `${placeLabel(i)} · ${i.item_name}`,
    detail: [
      i.group_name,
      formatThaiDate(i.check_date),
      i.note ?? undefined,
      i.repair_doc_no ? `ใบซ่อม ${i.repair_doc_no}` : "ยังไม่เปิดใบซ่อม",
    ]
      .filter(Boolean)
      .join(" · "),
    right: dueLabel(i, today),
  });

  // งานประจำวันต้องครบทุกสาขาและทุกห้องในแต่ละวัน
  const submittedToday = rounds.filter((r) => r.check_date === today && r.status === "submitted");

  const checkedTodayIds = new Set(
    submittedToday.filter((r) => !r.room_id).map((r) => r.branch_id),
  );
  const notCheckedToday: WallRow[] = branches
    .filter((b) => !checkedTodayIds.has(b.id))
    .map((b) => {
      const last = rounds.find((r) => r.branch_id === b.id && !r.room_id && r.status === "submitted");
      return {
        key: `nc-${b.id}`,
        title: b.name,
        detail: last ? `ตรวจล่าสุด ${formatThaiDate(last.check_date)}` : "ยังไม่เคยส่งผลตรวจเลย",
        right: "ยังไม่ตรวจ",
      };
    });

  const checkedRoomIdsToday = new Set(
    submittedToday.filter((r) => r.room_id).map((r) => r.room_id),
  );
  const notCheckedRoomsToday: WallRow[] = rooms
    .filter((r) => !checkedRoomIdsToday.has(r.id))
    .map((r) => {
      const last = rounds.find((d) => d.room_id === r.id && d.status === "submitted");
      return {
        key: `ncr-${r.id}`,
        title: `${r.branch_name ?? "ไม่ระบุสาขา"} · ห้อง ${r.code}`,
        detail: last ? `ตรวจล่าสุด ${formatThaiDate(last.check_date)}` : "ยังไม่เคยตรวจห้องนี้เลย",
        right: "ยังไม่ตรวจ",
      };
    });

  const byGroup: WallRank[] = countByKey(openIssues, (i) => i.group_name, "ไม่ระบุประเภทงาน")
    .slice(0, TOP_N)
    .map((g) => ({ label: g.label, value: g.count, sub: "ข้อที่ยังไม่ได้แก้" }));

  const byBranch: WallRank[] = countByKey(openIssues, (i) => i.branch_name, "ไม่ระบุสาขา")
    .slice(0, TOP_N)
    .map((b) => {
      const urgent = openIssues.filter(
        (i) => (i.branch_name ?? "ไม่ระบุสาขา") === b.label && i.priority === "urgent",
      ).length;
      return {
        label: b.label,
        value: b.count,
        sub: urgent > 0 ? `${HTL_PRIORITY_LABEL.urgent} ${urgent} ข้อ` : undefined,
      };
    });

  // แนวโน้มรายวันในช่วงที่เลือก — เอาวันหลังสุดขึ้นก่อนให้เห็นของใหม่ทันที
  const trend: WallRank[] = summarizeByPeriod(inRange, "day")
    .slice(-TOP_N)
    .reverse()
    .map((d) => ({
      label: d.label,
      value: Math.round(d.passPct),
      sub: `ตรวจ ${d.rounds} สาขา · ไม่ปกติ ${d.failCount} ข้อ`,
    }));

  return {
    generatedAt: new Date().toISOString(),
    today,
    period,
    counts: {
      branchesTotal: branches.length,
      checkedToday: checkedTodayIds.size,
      roomsTotal: rooms.length,
      roomsCheckedToday: checkedRoomIdsToday.size,
      roundsInPeriod: periodSummary.submitted,
      draft: rounds.filter((r) => r.status === "draft").length,
      openIssues: issueSummary.open,
      urgentOpen: issueSummary.urgent,
      overdueIssues: issueSummary.overdue,
      fixedInPeriod: issues.filter((i) => i.is_fixed && inPeriod(i.check_date, period)).length,
      noRepairDoc: issueSummary.noRepairDoc,
    },
    passPct: periodSummary.avgPassPct,
    urgentIssues: openIssues
      .filter((i) => i.priority === "urgent")
      .slice(0, TOP_N)
      .map(toRow),
    overdueIssues: openIssues
      .filter((i) => isOverdue(i, today))
      .sort((a, b) => openDays(b, today) - openDays(a, today))
      .slice(0, TOP_N)
      .map(toRow),
    notCheckedToday: notCheckedToday.slice(0, TOP_N),
    notCheckedRoomsToday: notCheckedRoomsToday.slice(0, TOP_N),
    byGroup,
    byBranch,
    trend,
  };
}
