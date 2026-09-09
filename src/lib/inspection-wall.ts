import "server-only";
import { monthBounds, workDateOf } from "./datetime";
import { listBranches } from "./db";
import { avgPctByKey, daysSince, latestByBranch, summarizeInspections } from "./inspection";
import { listFailedItems, listInspections } from "./inspection-db";
import { INSP_STALE_DAYS, type InspectionWall, type WallRank, type WallRow } from "./wall-types";

/**
 * ข้อมูลจอ War Room ของระบบตรวจสอบสาขา
 *
 * ตอบคำถามที่ผู้บริหารต้องรู้ตอนนี้:
 *   1. สาขาไหนคะแนนตรวจล่าสุดต่ำที่สุด — ต้องเข้าไปแก้ก่อน
 *   2. สาขาไหนหลุดคิวตรวจ ไม่ได้ไปตรวจมานานแล้ว หรือยังไม่เคยตรวจเลย
 *   3. ข้อไหนที่ทุกสาขาตกซ้ำ ๆ — ควรอบรมหรือแก้กระบวนการที่ต้นทาง
 *
 * เกณฑ์เกรดและค่าเฉลี่ยใช้ฟังก์ชันกลางใน inspection.ts ชุดเดียวกับหน้า Dashboard
 */

const TOP_N = 8;

export type { InspectionWall };

export async function buildInspectionWall(input: {
  companyId?: string | null;
  templateId?: string | null;
}): Promise<InspectionWall> {
  const today = workDateOf();
  const month = monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7)));

  const [rows, branches, failedItems] = await Promise.all([
    listInspections({
      company_id: input.companyId ?? null,
      template_id: input.templateId ?? null,
    }),
    listBranches(true, input.companyId ?? null),
    listFailedItems({ from: month.from, to: month.to }),
  ]);

  const thisMonth = rows.filter(
    (r) => r.inspect_date >= month.from && r.inspect_date <= month.to,
  );
  const monthSummary = summarizeInspections(thisMonth);

  // ผลตรวจล่าสุดของแต่ละสาขา (คะแนนต่ำสุดขึ้นก่อน)
  const latest = latestByBranch(rows);
  const inspectedBranchIds = new Set(latest.map((r) => r.branch_id).filter(Boolean) as string[]);

  // สาขาที่ยังไม่เคยตรวจ — ต้องขึ้นก่อนสาขาที่เคยตรวจแล้วแต่ค้างนาน
  const neverInspected: WallRow[] = branches
    .filter((b) => !inspectedBranchIds.has(b.id))
    .map((b) => ({
      key: `never-${b.id}`,
      title: b.name,
      detail: "ยังไม่เคยตรวจสาขานี้เลย",
      right: "ยังไม่ตรวจ",
    }));

  const staleInspected: WallRow[] = latest
    .filter((r) => daysSince(r.inspect_date, today) >= INSP_STALE_DAYS)
    .sort((a, b) => a.inspect_date.localeCompare(b.inspect_date))
    .map((r) => ({
      key: `stale-${r.id}`,
      title: r.branch_name ?? "ไม่ระบุสาขา",
      detail: `ตรวจล่าสุด ${r.inspect_date} · ${r.template_name}`,
      right: `${daysSince(r.inspect_date, today)} วัน`,
    }));

  const worstBranches: WallRow[] = latest.slice(0, TOP_N).map((r) => ({
    key: r.id,
    title: r.branch_name ?? "ไม่ระบุสาขา",
    detail: [r.template_name, r.inspect_date, r.inspector_name].filter(Boolean).join(" · "),
    right: `${r.score_pct.toFixed(0)}%`,
  }));

  const byBranch: WallRank[] = avgPctByKey(thisMonth, (r) => r.branch_name, "ไม่ระบุสาขา")
    .slice()
    .reverse()
    .slice(0, TOP_N)
    .map((b) => ({
      label: b.label,
      value: Math.round(b.avgPct),
      sub: `ตรวจ ${b.count} ครั้ง · ค่าปรับ ${b.fine.toLocaleString("th-TH")} บาท`,
    }));

  const topFailedItems: WallRank[] = failedItems.slice(0, TOP_N).map((i) => ({
    label: i.label,
    value: i.count,
    sub: i.fine > 0 ? `ค่าปรับรวม ${i.fine.toLocaleString("th-TH")} บาท` : undefined,
  }));

  return {
    generatedAt: new Date().toISOString(),
    today,
    counts: {
      inspectedThisMonth: monthSummary.submitted,
      inspectedToday: rows.filter((r) => r.inspect_date === today && r.status === "submitted").length,
      branchesCovered: new Set(
        thisMonth.filter((r) => r.status === "submitted").map((r) => r.branch_id),
      ).size,
      branchesTotal: branches.length,
      branchesNeverInspected: neverInspected.length,
      draft: rows.filter((r) => r.status === "draft").length,
    },
    money: { fineThisMonth: monthSummary.totalFine, bonusThisMonth: monthSummary.totalBonus },
    avgPct: monthSummary.avgPct,
    worstBranches,
    overdueBranches: [...neverInspected, ...staleInspected].slice(0, TOP_N),
    topFailedItems,
    byBranch,
  };
}
