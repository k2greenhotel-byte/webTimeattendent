/**
 * กฎการคิดผลของระบบตรวจเช็คโรงแรมประจำวัน — pure function ล้วน ไม่แตะฐานข้อมูล
 *
 * หน้าบันทึก หน้าสอบถาม dashboard จอ War Room และรายงาน
 * เรียกฟังก์ชันชุดเดียวกันนี้หมด ตัวเลขจึงตรงกันทุกที่
 */

import { addDays, dayOfWeek, daysBetween, formatThaiDate, thaiMonthShort } from "./datetime";
import {
  HTL_PRIORITY_DAYS,
  type HtlChecklist,
  type HtlGroup,
  type HtlItem,
  type HtlItemInput,
  type HtlIssueRow,
  type HtlPeriodMode,
  type HtlPriority,
  type HtlResultInput,
  type HtlRoundRow,
  type HtlScope,
} from "./hotel-types";

// ---------- ประกอบรายการตรวจ ----------

const bySort = (a: { sort_order: number; code: string }, b: { sort_order: number; code: string }) =>
  a.sort_order - b.sort_order || a.code.localeCompare(b.code);

/**
 * ประกอบรายการตรวจของงานหนึ่งครั้ง
 *
 *   scope     งานตรวจอาคาร กับ งานตรวจห้องพัก ใช้คนละชุดรายการ ไม่ปนกัน
 *   branchId  รายการที่ผูกกับสาขา (branch_id) จะโผล่เฉพาะตอนตรวจสาขานั้น
 *             ส่วนรายการที่ branch_id เป็น null ใช้กับทุกสาขา
 *
 * หมวดที่ไม่เหลือรายการเลยจะถูกตัดทิ้ง เพื่อไม่ให้หน้าบันทึกมีหัวข้อว่าง ๆ
 * (โหมดตั้งค่า includeInactive = true จะเห็นทุกอย่าง รวมหมวดว่างและของที่ปิดใช้งาน)
 */
export function buildChecklist(
  groups: HtlGroup[],
  items: HtlItem[],
  branchId: string | null,
  includeInactive = false,
  scope: HtlScope = "building",
): HtlChecklist {
  const keep = <T extends { is_active: boolean }>(rows: T[]) =>
    includeInactive ? rows : rows.filter((r) => r.is_active);

  const inScope = keep(items).filter(
    (i) => i.scope === scope && (includeInactive || !i.branch_id || i.branch_id === branchId),
  );

  const built = keep(groups)
    .filter((g) => g.scope === scope)
    .slice()
    .sort(bySort)
    .map((group) => ({
      ...group,
      items: inScope.filter((i) => i.group_id === group.id).sort(bySort),
    }))
    .filter((g) => includeInactive || g.items.length > 0);

  return { groups: built, itemCount: built.reduce((sum, g) => sum + g.items.length, 0) };
}

/** ใบนี้เป็นงานตรวจห้องพักหรืองานตรวจอาคาร — ดูจากว่ามีห้องผูกอยู่ไหม */
export function scopeOf(row: { room_id: string | null }): HtlScope {
  return row.room_id ? "room" : "building";
}

/** ชื่อจุดที่ตรวจสำหรับแสดงผล — งานห้องพักต้องเห็นเบอร์ห้องคู่กับสาขาเสมอ */
export function placeLabel(row: {
  branch_name: string | null;
  room_code: string | null;
}): string {
  const branch = row.branch_name ?? "ไม่ระบุสาขา";
  return row.room_code ? `${branch} · ห้อง ${row.room_code}` : branch;
}

// ---------- สรุปผลของหนึ่งใบตรวจ ----------

export type HtlRoundTotals = {
  totalItems: number;
  /** ตรวจไปแล้วกี่ข้อ (ข้อที่ยังไม่ได้เลือกผลไม่นับ) */
  checkedCount: number;
  passCount: number;
  failCount: number;
  naCount: number;
  urgentCount: number;
  soonCount: number;
  laterCount: number;
  /** ข้อที่ไม่ปกติและยังไม่ได้แก้ */
  openFixCount: number;
  /** เปอร์เซ็นต์ข้อที่ปกติ จากข้อที่ต้องตรวจจริง (ข้อ "ไม่มี" ไม่นับเป็นตัวหาร) */
  passPct: number;
};

/** เปอร์เซ็นต์ ปัดสองตำแหน่ง — ตัวหารเป็น 0 ถือว่า 0% (กันหารศูนย์) */
export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 10000) / 100;
}

/** รวมผลของใบตรวจหนึ่งใบ */
export function totalsOf(
  results: Pick<HtlResultInput, "result" | "priority" | "is_fixed">[],
): HtlRoundTotals {
  let passCount = 0;
  let failCount = 0;
  let naCount = 0;
  let urgentCount = 0;
  let soonCount = 0;
  let laterCount = 0;
  let openFixCount = 0;

  for (const r of results) {
    if (r.result === "pass") passCount += 1;
    else if (r.result === "na") naCount += 1;
    else if (r.result === "fail") {
      failCount += 1;
      if (!r.is_fixed) openFixCount += 1;
      if (r.priority === "urgent") urgentCount += 1;
      else if (r.priority === "later") laterCount += 1;
      else soonCount += 1;
    }
  }

  // ข้อที่ตอบว่า "ไม่มี" ไม่ควรทำให้เปอร์เซ็นต์ผ่านตกลง จึงไม่นับเป็นตัวหาร
  const scored = passCount + failCount;

  return {
    totalItems: results.length,
    checkedCount: passCount + failCount + naCount,
    passCount,
    failCount,
    naCount,
    urgentCount,
    soonCount,
    laterCount,
    openFixCount,
    passPct: percent(passCount, scored),
  };
}

// ---------- ความเร่งด่วนและกำหนดแก้ไข ----------

/** วันครบกำหนดแก้ไขของข้อที่ไม่ปกติ นับจากวันที่ตรวจพบ */
export function dueDateOf(checkDate: string, priority: HtlPriority | null): string {
  return addDays(checkDate, HTL_PRIORITY_DAYS[priority ?? "soon"]);
}

/** เลยกำหนดแก้ไขแล้วหรือยัง — ข้อที่แก้แล้วไม่ถือว่าเลยกำหนด */
export function isOverdue(
  issue: Pick<HtlIssueRow, "check_date" | "priority" | "is_fixed">,
  today: string,
): boolean {
  if (issue.is_fixed) return false;
  return today > dueDateOf(issue.check_date, issue.priority);
}

/** ค้างมากี่วันแล้ว (ข้อที่แก้แล้วคืน 0) */
export function openDays(
  issue: Pick<HtlIssueRow, "check_date" | "is_fixed">,
  today: string,
): number {
  if (issue.is_fixed) return 0;
  return Math.max(0, daysBetween(issue.check_date, today));
}

/** ข้อความบอกกำหนดแก้ไขแบบอ่านง่าย ใช้ทั้งหน้าจอและจอ War Room */
export function dueLabel(
  issue: Pick<HtlIssueRow, "check_date" | "priority" | "is_fixed">,
  today: string,
): string {
  if (issue.is_fixed) return "แก้ไขแล้ว";

  const due = dueDateOf(issue.check_date, issue.priority);
  const left = daysBetween(today, due);

  if (left < 0) return `เลยกำหนด ${Math.abs(left)} วัน`;
  if (left === 0) return "ครบกำหนดวันนี้";
  return `เหลืออีก ${left} วัน`;
}

// ---------- ตรวจความถูกต้องก่อนบันทึก ----------

/** ตรวจหนึ่งบรรทัดผลตรวจ — คืนข้อความปัญหา หรือ null ถ้าผ่าน */
export function validateResult(
  result: Pick<HtlResultInput, "result" | "note" | "photos">,
  item: Pick<HtlItem, "name" | "require_photo" | "require_photo_on_fail">,
): string | null {
  if (!result.result) return `ข้อ "${item.name}" ยังไม่ได้เลือกผลการตรวจ`;

  if (result.result === "fail" && !(result.note ?? "").trim()) {
    return `ข้อ "${item.name}" ผลไม่ปกติ ต้องใส่หมายเหตุว่าพบอะไรและต้องแก้อย่างไร`;
  }
  if (item.require_photo && result.photos.length === 0) {
    return `ข้อ "${item.name}" กำหนดไว้ว่าต้องแนบรูปทุกครั้ง`;
  }
  if (result.result === "fail" && item.require_photo_on_fail && result.photos.length === 0) {
    return `ข้อ "${item.name}" ผลไม่ปกติ ต้องแนบรูปประกอบอย่างน้อย 1 รูป`;
  }
  return null;
}

/** ตรวจหัวใบก่อนบันทึก — คืนข้อความปัญหาแรกที่เจอ */
export function validateRound(input: {
  branch_id: string | null;
  room_id?: string | null;
  check_date: string;
  results: unknown[];
  scope?: HtlScope;
}): string | null {
  const scope = input.scope ?? "building";

  if (!input.branch_id) return "กรุณาเลือกสาขาที่ตรวจเช็ค";
  if (scope === "room" && !input.room_id) return "กรุณาเลือกห้องพักที่ตรวจเช็ค";
  if (!input.check_date) return "กรุณาระบุวันที่ตรวจเช็ค";

  if (input.results.length === 0) {
    const what = scope === "room" ? "ห้องพักของสาขานี้" : "สาขานี้";
    return `${what}ยังไม่มีรายการตรวจเช็ค กรุณาตั้งค่ารายการที่หน้า “6. ตั้งค่ารายการและห้องพัก” ก่อน`;
  }
  return null;
}

/** ตรวจค่าห้องพักที่หน้าตั้งค่าส่งมา — คืนข้อความปัญหา หรือ null ถ้าผ่าน */
export function validateRoom(
  input: { branch_id: string; code: string },
  usedCodesInBranch: string[],
): string | null {
  const code = input.code.trim();
  if (!input.branch_id) return "กรุณาเลือกสาขาของห้องพักนี้";
  if (!code) return "กรุณาใส่เบอร์ห้องพัก";
  if (usedCodesInBranch.includes(code)) {
    return `สาขานี้มีห้อง ${code} อยู่แล้ว กรุณาใช้เบอร์ห้องอื่น`;
  }
  return null;
}

/**
 * แยกเบอร์ห้องที่พิมพ์รวดเดียวออกเป็นรายห้อง — ใช้ในช่อง "เพิ่มหลายห้องพร้อมกัน"
 * รับได้ทั้งคั่นด้วยจุลภาค เว้นวรรค หรือขึ้นบรรทัดใหม่ และตัดตัวซ้ำออกให้
 */
export function parseRoomCodes(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of text.split(/[,\n\r\t;]+|\s{1,}/)) {
    const code = raw.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/** ตรวจค่าที่หน้าตั้งค่าส่งมา — คืนข้อความปัญหา หรือ null ถ้าผ่าน */
export function validateItem(input: HtlItemInput, usedCodes: string[]): string | null {
  const code = input.code.trim();
  if (!code) return "กรุณาใส่รหัสรายการ";
  if (!input.name.trim()) return "กรุณาใส่ชื่อรายการ";
  if (!input.group_id) return "กรุณาเลือกประเภทงานของรายการนี้";
  if (usedCodes.includes(code)) return `รหัส ${code} ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น`;
  return null;
}

// ---------- สรุปหลายใบ (dashboard / จอ War Room) ----------

export type HtlSummary = {
  rounds: number;
  submitted: number;
  draft: number;
  cancelled: number;
  passCount: number;
  failCount: number;
  naCount: number;
  urgentCount: number;
  openFixCount: number;
  /** เฉลี่ยเปอร์เซ็นต์ข้อที่ปกติ ของใบที่ส่งผลแล้ว */
  avgPassPct: number;
};

/** ใบที่นับเป็นผลการตรวจจริง — ฉบับร่างและใบที่ยกเลิกไม่นับ */
export function isCounted(row: Pick<HtlRoundRow, "status">): boolean {
  return row.status === "submitted";
}

export function summarizeRounds(rows: HtlRoundRow[]): HtlSummary {
  const counted = rows.filter(isCounted);
  const sum = (pick: (r: HtlRoundRow) => number) => counted.reduce((t, r) => t + pick(r), 0);
  const pctSum = sum((r) => r.pass_pct);

  return {
    rounds: rows.length,
    submitted: counted.length,
    draft: rows.filter((r) => r.status === "draft").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    passCount: sum((r) => r.pass_count),
    failCount: sum((r) => r.fail_count),
    naCount: sum((r) => r.na_count),
    urgentCount: sum((r) => r.urgent_count),
    openFixCount: sum((r) => r.open_fix_count),
    avgPassPct: counted.length === 0 ? 0 : Math.round((pctSum / counted.length) * 100) / 100,
  };
}

/** ใบล่าสุดของแต่ละสาขา — สาขาที่เปอร์เซ็นต์ผ่านต่ำสุดขึ้นก่อน */
export function latestByBranch(rows: HtlRoundRow[]): HtlRoundRow[] {
  const latest = new Map<string, HtlRoundRow>();

  for (const row of rows) {
    if (!isCounted(row)) continue;
    const key = row.branch_id ?? row.branch_name ?? "-";
    const current = latest.get(key);
    if (!current || row.check_date > current.check_date) latest.set(key, row);
  }

  return [...latest.values()].sort(
    (a, b) => a.pass_pct - b.pass_pct || (a.branch_name ?? "").localeCompare(b.branch_name ?? ""),
  );
}

/** นับจำนวนตามคีย์ แล้วเรียงจากมากไปน้อย — ใช้ทำกราฟแท่ง */
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

// ---------- สรุปรายวัน / รายสัปดาห์ / รายเดือน ----------

/** วันจันทร์ของสัปดาห์ที่วันนี้อยู่ (สัปดาห์เริ่มวันจันทร์แบบสากล) */
export function weekStartOf(dateStr: string): string {
  // dayOfWeek(): อาทิตย์ = 0 → ถอยกลับ 6 วัน ส่วนวันอื่นถอยกลับ (วัน - 1)
  return addDays(dateStr, -((dayOfWeek(dateStr) + 6) % 7));
}

/** ช่องสรุปของวันที่หนึ่ง ๆ ตามโหมดที่เลือก — คืนคีย์สำหรับจัดกลุ่มและป้ายภาษาไทย */
export function periodBucket(dateStr: string, mode: HtlPeriodMode): { key: string; label: string } {
  if (mode === "month") {
    const year = Number(dateStr.slice(0, 4));
    const month = Number(dateStr.slice(5, 7));
    return { key: dateStr.slice(0, 7), label: `${thaiMonthShort(month)} ${year + 543}` };
  }

  if (mode === "week") {
    const start = weekStartOf(dateStr);
    const end = addDays(start, 6);
    return { key: start, label: `${formatThaiDate(start)} – ${formatThaiDate(end)}` };
  }

  return { key: dateStr, label: formatThaiDate(dateStr) };
}

export type HtlPeriodRow = {
  key: string;
  label: string;
  rounds: number;
  passCount: number;
  failCount: number;
  urgentCount: number;
  openFixCount: number;
  passPct: number;
};

/**
 * สรุปใบตรวจเป็นช่วง ๆ ตามโหมด (รายวัน/รายสัปดาห์/รายเดือน)
 * นับเฉพาะใบที่ส่งผลแล้ว เรียงจากช่วงเก่าไปใหม่ เพื่อให้กราฟอ่านเป็นแนวโน้ม
 */
export function summarizeByPeriod(rows: HtlRoundRow[], mode: HtlPeriodMode): HtlPeriodRow[] {
  const map = new Map<string, HtlPeriodRow>();

  for (const row of rows) {
    if (!isCounted(row)) continue;
    const bucket = periodBucket(row.check_date, mode);

    const cur =
      map.get(bucket.key) ??
      ({
        key: bucket.key,
        label: bucket.label,
        rounds: 0,
        passCount: 0,
        failCount: 0,
        urgentCount: 0,
        openFixCount: 0,
        passPct: 0,
      } satisfies HtlPeriodRow);

    cur.rounds += 1;
    cur.passCount += row.pass_count;
    cur.failCount += row.fail_count;
    cur.urgentCount += row.urgent_count;
    cur.openFixCount += row.open_fix_count;
    map.set(bucket.key, cur);
  }

  return [...map.values()]
    .map((r) => ({ ...r, passPct: percent(r.passCount, r.passCount + r.failCount) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

// ---------- สรุปข้อที่ต้องแก้ไข ----------

export type HtlIssueSummary = {
  total: number;
  open: number;
  fixed: number;
  overdue: number;
  urgent: number;
  soon: number;
  later: number;
  /** ข้อค้างที่ยังไม่ได้เปิดใบแจ้งซ่อม */
  noRepairDoc: number;
};

export function summarizeIssues(issues: HtlIssueRow[], today: string): HtlIssueSummary {
  const open = issues.filter((i) => !i.is_fixed);

  return {
    total: issues.length,
    open: open.length,
    fixed: issues.length - open.length,
    overdue: open.filter((i) => isOverdue(i, today)).length,
    urgent: open.filter((i) => i.priority === "urgent").length,
    soon: open.filter((i) => i.priority === "soon" || i.priority === null).length,
    later: open.filter((i) => i.priority === "later").length,
    noRepairDoc: open.filter((i) => !i.repair_id && !i.repair_doc_no).length,
  };
}

/**
 * เรียงข้อที่ต้องแก้ตามลำดับที่ควรลงมือ:
 * เลยกำหนดก่อน → เร่งด่วนกว่าก่อน → พบมานานกว่าก่อน
 */
export function sortIssuesByUrgency(issues: HtlIssueRow[], today: string): HtlIssueRow[] {
  const rank: Record<HtlPriority, number> = { urgent: 0, soon: 1, later: 2 };

  return issues.slice().sort((a, b) => {
    const overdueDiff = Number(isOverdue(b, today)) - Number(isOverdue(a, today));
    if (overdueDiff !== 0) return overdueDiff;

    const priorityDiff = rank[a.priority ?? "soon"] - rank[b.priority ?? "soon"];
    if (priorityDiff !== 0) return priorityDiff;

    return a.check_date.localeCompare(b.check_date);
  });
}

/** จำนวนเต็มแบบไทย ใช้ร่วมกันทุกหน้าจอ */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("th-TH");
}
