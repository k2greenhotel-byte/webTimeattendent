/**
 * กฎการคิดคะแนนของระบบตรวจสอบสาขา — pure function ล้วน ไม่แตะฐานข้อมูล
 *
 * หน้าบันทึก หน้าสอบถาม dashboard จอ War Room และไฟล์ export
 * เรียกฟังก์ชันชุดเดียวกันนี้หมด ตัวเลขจึงตรงกันทุกที่
 */

import {
  INSP_GRADE_CUTOFF,
  type InspForm,
  type InspGrade,
  type InspItem,
  type InspItemInput,
  type InspItemOption,
  type InspResultInput,
  type InspSection,
  type InspTemplate,
  type InspectionRow,
} from "./inspection-types";

// ---------- คะแนนเต็ม ----------

/**
 * คะแนนเต็มของหนึ่งรายการ
 *   rating → ค่าที่ตั้งไว้บนรายการ
 *   choice → คะแนนของตัวเลือกที่ให้คะแนนสูงสุด (ตัวเลือกที่ปิดใช้งานแล้วไม่นับ)
 */
export function itemMaxScore(
  item: Pick<InspItem, "item_type" | "max_score">,
  options: Pick<InspItemOption, "score" | "is_active">[],
): number {
  if (item.item_type === "rating") return Math.max(0, item.max_score);
  const active = options.filter((o) => o.is_active);
  return active.length === 0 ? 0 : Math.max(0, ...active.map((o) => o.score));
}

/** ประกอบแบบฟอร์มหนึ่งชุดจากแถวดิบ พร้อมคิดคะแนนเต็มของทุกชั้นให้เสร็จในทีเดียว */
export function buildForm(
  template: InspTemplate,
  sections: InspSection[],
  items: InspItem[],
  options: InspItemOption[],
  includeInactive = false,
): InspForm {
  const keep = <T extends { is_active: boolean }>(rows: T[]) =>
    includeInactive ? rows : rows.filter((r) => r.is_active);

  const bySort = (a: { sort_order: number; code: string }, b: { sort_order: number; code: string }) =>
    a.sort_order - b.sort_order || a.code.localeCompare(b.code);

  const builtSections = keep(sections)
    .filter((s) => s.template_id === template.id)
    .sort(bySort)
    .map((section) => {
      const builtItems = keep(items)
        .filter((i) => i.section_id === section.id)
        .sort(bySort)
        .map((item) => {
          const itemOptions = keep(options)
            .filter((o) => o.item_id === item.id)
            .sort(bySort);
          return { ...item, options: itemOptions, maxScore: itemMaxScore(item, itemOptions) };
        });

      return {
        ...section,
        items: builtItems,
        maxScore: builtItems.reduce((sum, i) => sum + i.maxScore, 0),
      };
    });

  return {
    template,
    sections: builtSections,
    maxScore: builtSections.reduce((sum, s) => sum + s.maxScore, 0),
  };
}

// ---------- สรุปผลของหนึ่งใบตรวจ ----------

export type InspectionTotals = {
  totalScore: number;
  maxScore: number;
  scorePct: number;
  totalFine: number;
  bonusAmount: number;
  /** จำนวนข้อที่ได้ไม่เต็มคะแนน (ข้อที่คะแนนเต็มเป็น 0 ไม่นับ เพราะเป็นข้อปรับเงินอย่างเดียว) */
  failCount: number;
};

/** เงินรางวัลตามเกณฑ์ของแม่แบบ — ไม่ถึงเกณฑ์หรือไม่ตั้งเกณฑ์ไว้ ได้ 0 */
export function bonusFor(
  template: Pick<InspTemplate, "bonus_threshold" | "bonus_amount"> | null,
  totalScore: number,
): number {
  if (!template || template.bonus_threshold === null) return 0;
  return totalScore >= template.bonus_threshold ? template.bonus_amount : 0;
}

/** เปอร์เซ็นต์คะแนน ปัดสองตำแหน่ง — คะแนนเต็ม 0 ถือว่า 0% (กันหารศูนย์) */
export function scorePercent(totalScore: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((totalScore / maxScore) * 10000) / 100;
}

/** รวมคะแนน ค่าปรับ และเงินรางวัลของใบตรวจหนึ่งใบ */
export function totalsOf(
  results: Pick<InspResultInput, "score" | "max_score" | "fine_amount">[],
  template: Pick<InspTemplate, "bonus_threshold" | "bonus_amount"> | null,
): InspectionTotals {
  let totalScore = 0;
  let maxScore = 0;
  let totalFine = 0;
  let failCount = 0;

  for (const r of results) {
    totalScore += r.score;
    maxScore += r.max_score;
    totalFine += r.fine_amount;
    if (r.max_score > 0 && r.score < r.max_score) failCount += 1;
  }

  return {
    totalScore: round2(totalScore),
    maxScore: round2(maxScore),
    scorePct: scorePercent(totalScore, maxScore),
    totalFine: round2(totalFine),
    bonusAmount: bonusFor(template, totalScore),
    failCount,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** เกรดจากเปอร์เซ็นต์คะแนน — ใช้ชุดเดียวกันทุกหน้าจอ */
export function gradeOf(scorePct: number): InspGrade {
  if (scorePct >= INSP_GRADE_CUTOFF.good) return "good";
  if (scorePct >= INSP_GRADE_CUTOFF.fair) return "fair";
  return "poor";
}

// ---------- ตรวจความถูกต้องก่อนบันทึก ----------

/** ตรวจหนึ่งบรรทัดผลตรวจ — คืนข้อความปัญหา หรือ null ถ้าผ่าน */
export function validateResult(
  result: Pick<InspResultInput, "item_type" | "option_id" | "score" | "max_score" | "photos">,
  item: Pick<InspItem, "name" | "require_photo">,
): string | null {
  if (result.item_type === "choice" && !result.option_id) {
    return `ข้อ "${item.name}" ยังไม่ได้เลือกผลการตรวจ`;
  }
  if (result.item_type === "rating") {
    if (!Number.isFinite(result.score) || result.score < 0) {
      return `ข้อ "${item.name}" ใส่คะแนนติดลบไม่ได้`;
    }
    if (result.score > result.max_score) {
      return `ข้อ "${item.name}" ให้คะแนนได้ไม่เกิน ${result.max_score} คะแนน`;
    }
  }
  if (item.require_photo && result.photos.length === 0) {
    return `ข้อ "${item.name}" กำหนดไว้ว่าต้องแนบรูปประกอบอย่างน้อย 1 รูป`;
  }
  return null;
}

/** ตรวจทั้งใบก่อนส่งผล — คืนข้อความปัญหาแรกที่เจอ */
export function validateInspection(input: {
  branch_id: string | null;
  inspect_date: string;
  results: InspResultInput[];
}): string | null {
  if (!input.branch_id) return "กรุณาเลือกสาขาที่ตรวจสอบ";
  if (!input.inspect_date) return "กรุณาระบุวันที่ตรวจสอบ";
  if (input.results.length === 0) return "แบบฟอร์มนี้ยังไม่มีรายการตรวจ กรุณาตั้งค่ารายการก่อน";
  return null;
}

/** ตรวจค่าที่หน้าตั้งค่าส่งมา — คืนข้อความปัญหา หรือ null ถ้าผ่าน */
export function validateItem(input: InspItemInput, usedCodes: string[]): string | null {
  const code = input.code.trim();
  if (!code) return "กรุณาใส่รหัสรายการ";
  if (!input.name.trim()) return "กรุณาใส่ชื่อรายการ";
  if (usedCodes.includes(code)) return `รหัส ${code} ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`;
  if (input.item_type === "rating" && input.max_score <= 0) {
    return "รายการแบบให้คะแนนเป็นระดับ ต้องกำหนดคะแนนเต็มมากกว่า 0";
  }
  return null;
}

// ---------- สรุปหลายใบ (dashboard / จอ War Room) ----------

export type InspectionSummary = {
  count: number;
  submitted: number;
  draft: number;
  cancelled: number;
  totalFine: number;
  totalBonus: number;
  /** เฉลี่ยเปอร์เซ็นต์คะแนนของใบที่ส่งผลแล้ว */
  avgPct: number;
  failed: number;
};

/** ใบที่นับเป็นผลการตรวจจริง — ฉบับร่างและใบที่ยกเลิกไม่นับ */
export function isCounted(row: Pick<InspectionRow, "status">): boolean {
  return row.status === "submitted";
}

export function summarizeInspections(rows: InspectionRow[]): InspectionSummary {
  const counted = rows.filter(isCounted);
  const pctSum = counted.reduce((sum, r) => sum + r.score_pct, 0);

  return {
    count: rows.length,
    submitted: counted.length,
    draft: rows.filter((r) => r.status === "draft").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    totalFine: round2(counted.reduce((sum, r) => sum + r.total_fine, 0)),
    totalBonus: round2(counted.reduce((sum, r) => sum + r.bonus_amount, 0)),
    avgPct: counted.length === 0 ? 0 : Math.round((pctSum / counted.length) * 100) / 100,
    failed: counted.filter((r) => gradeOf(r.score_pct) === "poor").length,
  };
}

/** ผลล่าสุดของแต่ละสาขา — สาขาที่คะแนนต่ำสุดขึ้นก่อน (จอ War Room ต้องเห็นสาขาที่ต้องแก้) */
export function latestByBranch(rows: InspectionRow[]): InspectionRow[] {
  const latest = new Map<string, InspectionRow>();

  for (const row of rows) {
    if (!isCounted(row)) continue;
    const key = row.branch_id ?? row.branch_name ?? "-";
    const current = latest.get(key);
    if (!current || row.inspect_date > current.inspect_date) latest.set(key, row);
  }

  return [...latest.values()].sort(
    (a, b) => a.score_pct - b.score_pct || (a.branch_name ?? "").localeCompare(b.branch_name ?? ""),
  );
}

/** จำนวนวันนับจากวันที่ตรวจล่าสุด — ใช้เตือน "สาขานี้ไม่ได้ตรวจมานานแล้ว" */
export function daysSince(dateStr: string, today: string): number {
  const from = Date.parse(`${dateStr}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

/** นับจำนวนตามคีย์ แล้วเรียงจากมากไปน้อย — ใช้ทำกราฟแท่งในหน้า dashboard */
export function countByKey<T>(
  rows: T[],
  keyOf: (row: T) => string | null | undefined,
  fallback: string,
): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row) || fallback;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** ค่าเฉลี่ยคะแนนตามคีย์ (สาขา/บริษัท/ผู้ตรวจ) — เรียงจากน้อยไปมาก เพื่อให้เห็นตัวที่ต้องแก้ก่อน */
export function avgPctByKey(
  rows: InspectionRow[],
  keyOf: (row: InspectionRow) => string | null | undefined,
  fallback: string,
): { label: string; avgPct: number; count: number; fine: number }[] {
  const map = new Map<string, { sum: number; count: number; fine: number }>();

  for (const row of rows) {
    if (!isCounted(row)) continue;
    const key = keyOf(row) || fallback;
    const cur = map.get(key) ?? { sum: 0, count: 0, fine: 0 };
    map.set(key, {
      sum: cur.sum + row.score_pct,
      count: cur.count + 1,
      fine: cur.fine + row.total_fine,
    });
  }

  return [...map.entries()]
    .map(([label, v]) => ({
      label,
      avgPct: Math.round((v.sum / v.count) * 100) / 100,
      count: v.count,
      fine: round2(v.fine),
    }))
    .sort((a, b) => a.avgPct - b.avgPct || a.label.localeCompare(b.label));
}

/** จำนวนเงินแบบไทย ใช้ร่วมกันทุกหน้าจอ */
export function formatBaht(value: number): string {
  return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** คะแนนแบบไทย — ตัดทศนิยม .00 ทิ้งให้อ่านง่าย (5 ไม่ใช่ 5.00 แต่ 1.5 ยังเป็น 1.5) */
export function formatScore(value: number): string {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}
