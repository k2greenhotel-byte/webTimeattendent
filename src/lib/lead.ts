/**
 * กฎธุรกิจของระบบข้อมูล Lead อยู่ในไฟล์นี้ที่เดียว (pure function ไม่แตะฐานข้อมูล)
 * หน้าเว็บ / server action / dashboard / ไฟล์ export เรียกใช้ชุดเดียวกันหมด
 * ตัวเลขบนจอกับในไฟล์ export จะได้ไม่มีทางเพี้ยนกัน
 */
import { countByKey } from "./booking";
import type { AccessLevel } from "./core-types";
import { workDateOf } from "./datetime";
import {
  CHANCE_ORDER,
  HOT_LEAD_SILENT_DAYS,
  WORK_STATUS_ORDER,
  type BoardColumnView,
  type Chance,
  type FollowUpInput,
  type LeadInput,
  type LeadQuery,
  type LeadRow,
  type WorkStatus,
} from "./lead-types";

export const NO_STAFF = "— ไม่ระบุพนักงาน —";
export const NO_BRANCH = "— ไม่ระบุสาขา —";
export const NO_MODEL = "— ไม่ระบุรุ่น —";
export const NO_CHANNEL = "— ไม่ระบุช่องทาง —";

// ---------- สิทธิ์การมองเห็น (ข้อ 2) ----------

/**
 * เห็น Lead ของคนอื่นได้ไหม
 * ข้อ 2 ระบุว่าพนักงานขายเห็นเฉพาะของตัวเอง ส่วนหัวหน้า/ผู้จัดการ/admin เห็นได้ทั้งหมด
 * ในระบบนี้ระดับ "user" คือพนักงานทั่วไป ที่เหลือ (supervisor/assistant_admin/admin) คือระดับคุมทีม
 */
export function canSeeAllLeads(level: AccessLevel): boolean {
  return level !== "user";
}

// ---------- ตรวจค่าก่อนบันทึก ----------

const CLOSED_NEEDS_CONTRACT =
  "ปิดการขายต้องกรอกเลขที่สัญญาขายและวันที่ขาย — ถ้ายังไม่ได้สัญญา ให้เลือกสถานะ “ติดตามอีกครั้ง” ไปก่อน";

/**
 * ตรวจใบ Lead ก่อนบันทึก — คืนข้อความไทยบอกวิธีแก้ ผ่านแล้วคืน null
 * (หน้าจอกับ server action ใช้ฟังก์ชันเดียวกัน ข้อความจะได้ไม่เพี้ยนกัน)
 */
export function validateLead(input: Pick<
  LeadInput,
  "lead_date" | "customer_name" | "phone" | "work_status" | "sale_contract_no" | "sale_date" | "next_follow_date"
>): string | null {
  if (!input.lead_date) return "กรุณาเลือกวันที่";
  if (!input.customer_name.trim()) {
    return "กรุณาเลือกชื่อลูกค้าจากทะเบียนลูกค้า — ยังไม่มีให้กด “+ เพิ่มลูกค้าใหม่”";
  }
  if (input.phone && !/^[0-9]{9,10}$/.test(input.phone)) {
    return "เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก (เช่น 0812345678)";
  }
  if (input.work_status === "closed_won") {
    if (!(input.sale_contract_no ?? "").trim() || !input.sale_date) return CLOSED_NEEDS_CONTRACT;
  }
  if (input.next_follow_date && input.next_follow_date < input.lead_date) {
    return "วันที่คาดจะติดตามต่อ ต้องไม่ก่อนวันที่รับ Lead";
  }
  return null;
}

/** ตรวจใบติดตามก่อนบันทึก (ข้อ 2.1-2.7) */
export function validateFollowUp(input: Pick<
  FollowUpInput,
  "follow_date" | "detail" | "work_status" | "sale_contract_no" | "sale_date" | "next_follow_date"
>): string | null {
  if (!input.follow_date) return "กรุณาเลือกวันที่ติดตาม";
  if (!(input.detail ?? "").trim()) return "กรุณากรอกรายละเอียดผลการติดตาม";
  if (input.work_status === "closed_won") {
    if (!(input.sale_contract_no ?? "").trim() || !input.sale_date) return CLOSED_NEEDS_CONTRACT;
  }
  if (input.next_follow_date && input.next_follow_date < input.follow_date) {
    return "วันที่คาดจะติดตามต่อ ต้องไม่ก่อนวันที่ติดตาม";
  }
  return null;
}

// ---------- ผลของการบันทึกติดตามหนึ่งครั้ง ----------

/** ค่าที่จะถูกเขียนทับลงบนใบ Lead หลังบันทึกใบติดตาม */
export type LeadStatePatch = {
  work_status?: WorkStatus;
  chance?: Chance;
  next_follow_date?: string | null;
  sale_contract_no?: string | null;
  sale_date?: string | null;
};

/**
 * สถานะใหม่ของ Lead หลังบันทึกผลการติดตามหนึ่งครั้ง
 * ช่องที่ผู้ใช้ไม่ได้เลือก (null) แปลว่า "ไม่เปลี่ยน" — ไม่ใช่ "ล้างค่าเดิม"
 * ส่วนวันนัดติดตามต่อจะถูกเขียนทับเสมอ เพราะใบล่าสุดคือใบที่ถูกต้องที่สุด
 */
export function applyFollowUp(follow: Pick<
  FollowUpInput,
  "work_status" | "chance" | "next_follow_date" | "sale_contract_no" | "sale_date"
>): LeadStatePatch {
  const patch: LeadStatePatch = { next_follow_date: follow.next_follow_date ?? null };

  if (follow.work_status) patch.work_status = follow.work_status;
  if (follow.chance) patch.chance = follow.chance;

  if ((follow.sale_contract_no ?? "").trim()) {
    patch.sale_contract_no = follow.sale_contract_no;
    patch.sale_date = follow.sale_date ?? null;
    // trigger ฝั่งฐานข้อมูลก็บังคับให้อยู่แล้ว แต่ตั้งไว้ตรงนี้ด้วยเพื่อให้หน้าจอเห็นค่าเดียวกันทันที
    patch.work_status = "closed_won";
  }

  return patch;
}

// ---------- สถานะที่ต้องรีบทำ ----------

/** เลยวันนัดติดตามแล้วแต่ยังไม่ปิดงาน */
export function isOverdue(
  row: Pick<LeadRow, "work_status" | "next_follow_date">,
  today = workDateOf(),
): boolean {
  if (row.work_status !== "follow_up") return false;
  return !!row.next_follow_date && row.next_follow_date < today;
}

/** ยังต้องตามต่อแต่ไม่ได้นัดวันไว้ — หลุดมือง่ายที่สุด */
export function hasNoPlan(row: Pick<LeadRow, "work_status" | "next_follow_date">): boolean {
  return row.work_status === "follow_up" && !row.next_follow_date;
}

/**
 * โอกาสสูงแต่เงียบมานาน (ไม่เคยติดตาม หรือติดตามครั้งสุดท้ายเกิน 7 วัน)
 * ผู้จัดการควรเห็นก่อนใคร เพราะเป็นลูกค้าที่พร้อมซื้อที่สุดแต่กำลังจะหลุด
 */
export function isSilentHotLead(
  row: Pick<LeadRow, "work_status" | "chance" | "last_follow_date" | "lead_date">,
  today = workDateOf(),
  days = HOT_LEAD_SILENT_DAYS,
): boolean {
  if (row.work_status !== "follow_up" || row.chance !== "high") return false;
  const since = row.last_follow_date ?? row.lead_date;
  return daysBetween(since, today) >= days;
}

/** จำนวนวันจาก from ถึง to (ค่าติดลบได้ ถ้า to มาก่อน from) */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

// ---------- กระดานติดตาม (หน้าจอ 2) ----------

/**
 * จัดรายการ Lead เป็นกลุ่มตามสถานะงาน แล้วซอยย่อยตามสถานะโอกาส (ข้อ 2)
 * ภายในกลุ่มเรียงจาก "ต้องตามก่อน" ไปหลัง: เลยนัด → นัดใกล้สุด → ยังไม่ได้นัด
 */
export function groupForBoard(rows: LeadRow[], today = workDateOf()): BoardColumnView[] {
  return WORK_STATUS_ORDER.map((status) => {
    const inStatus = rows.filter((r) => r.work_status === status);
    return {
      status,
      total: inStatus.length,
      groups: CHANCE_ORDER.map((chance) => ({
        chance,
        rows: inStatus.filter((r) => r.chance === chance).sort(byFollowPriority(today)),
      })),
    };
  });
}

/** ใบที่เลยนัดขึ้นก่อน แล้วเรียงตามวันนัด ส่วนใบที่ยังไม่ได้นัดไว้ท้ายสุด */
export function byFollowPriority(today = workDateOf()) {
  return (a: LeadRow, b: LeadRow): number => {
    const overdue = Number(isOverdue(b, today)) - Number(isOverdue(a, today));
    if (overdue !== 0) return overdue;
    if (a.next_follow_date && b.next_follow_date) {
      return a.next_follow_date.localeCompare(b.next_follow_date);
    }
    if (a.next_follow_date) return -1;
    if (b.next_follow_date) return 1;
    return b.lead_date.localeCompare(a.lead_date);
  };
}

// ---------- ภาพรวม (dashboard ข้อ 3) ----------

export type LeadOverview = {
  total: number;
  byStatus: Record<WorkStatus, number>;
  byChance: Record<Chance, number>;
  /** ปิดการขายได้ */
  closed: number;
  /** อัตราการปิดการขาย เป็น % ทศนิยม 1 ตำแหน่ง */
  closeRate: number;
  overdue: number;
  noPlan: number;
  silentHot: number;
  /** จำนวนครั้งที่ติดตามเฉลี่ยต่อหนึ่ง Lead */
  avgFollowPerLead: number;
  /** วันเฉลี่ยจากรับ Lead ถึงวันที่ขาย (เฉพาะใบที่ปิดการขายแล้ว) */
  avgDaysToClose: number;
};

function emptyStatusCounts(): Record<WorkStatus, number> {
  return { follow_up: 0, dropped: 0, bought_other: 0, closed_won: 0 };
}

function emptyChanceCounts(): Record<Chance, number> {
  return { high: 0, medium: 0, low: 0 };
}

/** อัตราส่วนเป็น % ทศนิยม 1 ตำแหน่ง — หารศูนย์คืน 0 ไม่ใช่ NaN */
export function rateOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function buildOverview(rows: LeadRow[], today = workDateOf()): LeadOverview {
  const overview: LeadOverview = {
    total: rows.length,
    byStatus: emptyStatusCounts(),
    byChance: emptyChanceCounts(),
    closed: 0,
    closeRate: 0,
    overdue: 0,
    noPlan: 0,
    silentHot: 0,
    avgFollowPerLead: 0,
    avgDaysToClose: 0,
  };

  let follows = 0;
  let closeDays = 0;
  let closeDayRows = 0;

  for (const row of rows) {
    overview.byStatus[row.work_status] += 1;
    overview.byChance[row.chance] += 1;
    follows += Number(row.follow_count ?? 0);

    if (row.work_status === "closed_won") {
      overview.closed += 1;
      if (row.sale_date) {
        closeDays += Math.max(0, daysBetween(row.lead_date, row.sale_date));
        closeDayRows += 1;
      }
    }
    if (isOverdue(row, today)) overview.overdue += 1;
    if (hasNoPlan(row)) overview.noPlan += 1;
    if (isSilentHotLead(row, today)) overview.silentHot += 1;
  }

  overview.closeRate = rateOf(overview.closed, overview.total);
  overview.avgFollowPerLead =
    rows.length > 0 ? Math.round((follows / rows.length) * 10) / 10 : 0;
  overview.avgDaysToClose = closeDayRows > 0 ? Math.round(closeDays / closeDayRows) : 0;

  return overview;
}

// ---------- อันดับสูงสุด (ข้อ 1 ท้ายสเปก: 10 อันดับแรก) ----------

/** จำนวนอันดับที่แสดงบน dashboard — ผู้ใช้ขอ 10 อันดับแรก */
export const TOP_N = 10;

export type LeadRankings = {
  /** รุ่นรถที่ลูกค้าสนใจมากสุด */
  topModels: { label: string; count: number }[];
  /** พนักงานขายที่มี Lead มากสุด */
  topStaff: { label: string; count: number }[];
  /** ช่องทางที่ได้ Lead มากสุด */
  topChannels: { label: string; count: number }[];
};

export function buildRankings(rows: LeadRow[]): LeadRankings {
  return {
    topModels: countByKey(rows, (r) => r.model_name, NO_MODEL).slice(0, TOP_N),
    topStaff: countByKey(rows, staffNameOf, NO_STAFF).slice(0, TOP_N),
    topChannels: countByKey(rows, channelNameOf, NO_CHANNEL).slice(0, TOP_N),
  };
}

/**
 * ชื่อพนักงานขายเจ้าของ Lead ที่ใช้แสดงและจัดกลุ่ม
 * ใช้ชื่อบนใบ (owner_name) ก่อน เพราะเป็นคนที่รับ Lead จริงตอนบันทึก
 * ไม่มีจึงถอยไปใช้ชื่อบัญชีที่ join มา (บัญชีถูกเปลี่ยนชื่อภายหลัง)
 */
export function staffNameOf(row: {
  owner_name?: string | null;
  owner_full_name?: string | null;
}): string {
  return (row.owner_name ?? "").trim() || (row.owner_full_name ?? "").trim() || NO_STAFF;
}

/** ช่องทางการติดต่อที่ใช้แสดง — เลือก "อื่นๆ" แล้วระบุเอง ให้ใช้ข้อความที่ระบุ */
export function channelNameOf(row: {
  channel_name?: string | null;
  channel_other?: string | null;
}): string {
  const other = (row.channel_other ?? "").trim();
  const name = (row.channel_name ?? "").trim();
  if (other) return name ? `${name}: ${other}` : other;
  return name || NO_CHANNEL;
}

// ---------- สรุปตามพนักงานขาย / สาขา / ช่องทาง ----------

export type GroupSummary = {
  label: string;
  total: number;
  byStatus: Record<WorkStatus, number>;
  byChance: Record<Chance, number>;
  closed: number;
  /** อัตราการปิดการขาย % */
  closeRate: number;
  overdue: number;
  /** จำนวนครั้งติดตามเฉลี่ยต่อ Lead */
  avgFollow: number;
  /** วันเฉลี่ยจากรับ Lead ถึงปิดการขาย */
  avgDaysToClose: number;
};

/** สรุปตามคีย์ใด ๆ (พนักงาน / สาขา / ช่องทาง) เรียงจาก Lead มากไปน้อย */
export function summarizeBy(
  rows: LeadRow[],
  pick: (row: LeadRow) => string,
  today = workDateOf(),
): GroupSummary[] {
  const map = new Map<string, { summary: GroupSummary; follows: number; closeDays: number; closeDayRows: number }>();

  for (const row of rows) {
    const label = pick(row);
    let entry = map.get(label);
    if (!entry) {
      entry = {
        summary: {
          label,
          total: 0,
          byStatus: emptyStatusCounts(),
          byChance: emptyChanceCounts(),
          closed: 0,
          closeRate: 0,
          overdue: 0,
          avgFollow: 0,
          avgDaysToClose: 0,
        },
        follows: 0,
        closeDays: 0,
        closeDayRows: 0,
      };
      map.set(label, entry);
    }

    const s = entry.summary;
    s.total += 1;
    s.byStatus[row.work_status] += 1;
    s.byChance[row.chance] += 1;
    entry.follows += Number(row.follow_count ?? 0);

    if (row.work_status === "closed_won") {
      s.closed += 1;
      if (row.sale_date) {
        entry.closeDays += Math.max(0, daysBetween(row.lead_date, row.sale_date));
        entry.closeDayRows += 1;
      }
    }
    if (isOverdue(row, today)) s.overdue += 1;
  }

  return [...map.values()]
    .map(({ summary, follows, closeDays, closeDayRows }) => ({
      ...summary,
      closeRate: rateOf(summary.closed, summary.total),
      avgFollow: summary.total > 0 ? Math.round((follows / summary.total) * 10) / 10 : 0,
      avgDaysToClose: closeDayRows > 0 ? Math.round(closeDays / closeDayRows) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "th"));
}

/** 3.2 / 3.3 สรุปตามพนักงานขาย */
export function summarizeBySalesperson(rows: LeadRow[], today = workDateOf()): GroupSummary[] {
  return summarizeBy(rows, staffNameOf, today);
}

/** 3.1 สรุปตามสาขา */
export function summarizeByBranch(rows: LeadRow[], today = workDateOf()): GroupSummary[] {
  return summarizeBy(rows, (r) => (r.branch_name ?? "").trim() || NO_BRANCH, today);
}

/** 3.4 ช่องทางไหนได้ลูกค้าที่ปิดการขายได้จริง */
export function summarizeByChannel(rows: LeadRow[], today = workDateOf()): GroupSummary[] {
  return summarizeBy(rows, channelNameOf, today);
}

/** เรียงตามอัตราการปิดการขาย (คนที่มี Lead น้อยกว่า 1 ใบไม่นับ) */
export function rankByCloseRate(summaries: GroupSummary[]): GroupSummary[] {
  return [...summaries].sort(
    (a, b) => b.closeRate - a.closeRate || b.closed - a.closed || b.total - a.total,
  );
}

// ---------- ตัวช่วยของหน้าจอสอบถาม ----------

export type LeadSearchParams = Record<string, string | undefined>;

function one<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * แปลงเงื่อนไขจาก query string เป็น LeadQuery
 * ค่าที่ไม่อยู่ในชุดตัวเลือก (พิมพ์มาเอง/ของเก่า) จะถูกตัดทิ้ง ไม่ส่งต่อไปให้ฐานข้อมูล
 */
export function queryFromParams(params: LeadSearchParams): LeadQuery {
  return {
    keyword: (params.q ?? "").trim() || undefined,
    owner_id: params.owner || null,
    branch_id: params.branch || null,
    brand_id: params.brand || null,
    model_id: params.model || null,
    channel_id: params.channel || null,
    work_status: one(params.status, WORK_STATUS_ORDER),
    chance: one(params.chance, CHANCE_ORDER),
    from: params.from || null,
    to: params.to || null,
    overdue_only: params.overdue === "1",
  };
}

/** ข้อความรถที่ลูกค้าสนใจ เช่น "Honda Wave 110i" */
export function describeVehicle(row: Pick<LeadRow, "brand_name" | "model_name">): string {
  const text = [row.brand_name, row.model_name].filter(Boolean).join(" ").trim();
  return text || NO_MODEL;
}
