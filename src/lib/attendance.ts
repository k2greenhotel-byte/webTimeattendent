/**
 * แหล่งความจริงเดียวของ "กฎการคำนวณเวลาทำงาน"
 * ทุกหน้าจอ ทุกรายงาน และไฟล์ export ต้องเรียกใช้ฟังก์ชันในไฟล์นี้เท่านั้น
 * ห้ามคำนวณสาย/ชั่วโมงทำงานซ้ำที่อื่นเด็ดขาด
 */
import { bangkokAt, dayOfWeek, parseTimeToMinutes, toDate } from "./datetime";
import {
  PUNCH_ORDER,
  type ErrandPunch,
  type ErrandPunchType,
  type ErrandRound,
  type Branch,
  type DayStatus,
  type DaySummary,
  type OrgSettings,
  type PunchType,
  type WorkSchedule,
  type WorkSettings,
  type WorkSite,
} from "./types";

/**
 * ประกอบค่าที่ใช้คำนวณจริงจาก 3 แหล่ง (แต่ละค่าเก็บอยู่ที่เดียว ไม่ซ้ำซ้อน)
 *   - work_settings   : ค่าระดับองค์กร (ชื่อร้าน, บังคับ GPS, รัศมีเริ่มต้น)
 *   - work_schedules  : เวลาเข้า-ออก และกฎการคำนวณ (กะของสาขา หรือกะเริ่มต้น)
 *   - branches        : พิกัดและรัศมีเฉพาะสาขา
 */
export function resolveSettings(
  org: OrgSettings,
  schedule: WorkSchedule,
  branch?: Branch | null,
  /** สถานที่ตามตารางเวร (ไปประจำบูธทั้งวัน) — ถ้ามีจะใช้พิกัดของสถานที่แทนสาขา */
  site?: WorkSite | null,
): WorkSettings {
  return {
    company_id: branch?.company_id ?? org.company_id,
    org_name: org.org_name,
    timezone: org.timezone,
    require_gps: org.require_gps,
    site_lat: site ? site.lat : (branch?.site_lat ?? null),
    site_lng: site ? site.lng : (branch?.site_lng ?? null),
    radius_m: (site ? site.radius_m : branch?.radius_m) ?? org.radius_m,
    site_name: site?.name ?? branch?.name ?? null,
    schedule_name: schedule.name,
    // เลิกงานไม่เกินเวลาเข้างาน = กะข้ามเที่ยงคืน (กะดึกของโรงแรม 22:00–07:00)
    crosses_midnight: parseTimeToMinutes(schedule.work_end) <= parseTimeToMinutes(schedule.work_start),
    work_start: schedule.work_start,
    break_start: schedule.break_start,
    break_end: schedule.break_end,
    work_end: schedule.work_end,
    break_allow_minutes: schedule.break_allow_minutes,
    break_policy: schedule.break_policy,
    late_grace_min: schedule.late_grace_min,
    early_leave_grace_min: schedule.early_leave_grace_min,
    count_ot: schedule.count_ot,
    ot_grace_min: schedule.ot_grace_min,
    workdays: schedule.workdays,
  };
}

export type DayPunches = {
  work_date: string;
  check_in_at?: string | null;
  break_out_at?: string | null;
  break_in_at?: string | null;
  check_out_at?: string | null;
  /** เวลาออกไปทำธุระระหว่างวันรวมทุกรอบ (นาที) — มาจากตาราง errand_punches */
  errand_minutes?: number | null;
  /** จำนวนรอบที่ออกไปทำธุระ */
  errand_rounds?: number | null;
};

function diffMinutes(from: string | null | undefined, to: string | null | undefined): number | null {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return null;
  return (b.getTime() - a.getTime()) / 60_000;
}

/** ระบุว่าวันนี้เป็นวันทำงานตามปฏิทินหรือไม่ (ยังไม่รวมวันหยุดพิเศษ) */
export function isWorkday(workDate: string, settings: WorkSettings): boolean {
  return settings.workdays.includes(dayOfWeek(workDate));
}

/**
 * เวลาเริ่ม/เลิกงานที่คาดหวังของวันนั้นเป็น timestamp จริง
 * กะข้ามเที่ยงคืน: เวลาเลิกงานอยู่วันถัดไป จึงต้องบวก 1 วัน
 * (เทียบ timestamp ตรง ๆ แทนนับนาทีจากเที่ยงคืน จะได้ถูกทั้งกะกลางวันและกะดึก)
 */
export function expectedTimes(workDate: string, settings: WorkSettings): { start: Date; end: Date } {
  return {
    start: bangkokAt(workDate, settings.work_start),
    end: bangkokAt(workDate, settings.work_end, settings.crosses_midnight ? 1 : 0),
  };
}

function minutesFrom(from: Date, to: string | null | undefined): number | null {
  const b = toDate(to);
  return b ? (b.getTime() - from.getTime()) / 60_000 : null;
}

/**
 * คำนวณสรุปการทำงานของ 1 วัน
 * - สาย        = เวลาเข้างานจริง − เวลาเริ่มงานมาตรฐาน − นาทีผ่อนผัน
 * - กลับก่อน   = เวลาเลิกงานมาตรฐาน − เวลาออกจริง − นาทีผ่อนผัน
 * - เวลาพัก    = เข้าบ่าย − ออกพัก (ถ้าลงไม่ครบใช้โควตามาตรฐานแทน)
 * - ธุระ       = รวมทุกรอบที่ออกไปทำธุระแล้วกลับเข้ามา (errand_punches)
 * - พักเกิน    = (เวลาพัก + ธุระ) − โควตา (พักกลางวันและธุระใช้โควตาก้อนเดียวกัน ปกติ 1 ชม.)
 * - ชม.ทำงาน   = (ออกงาน − เข้างาน) − เวลาส่วนตัวที่หัก
 * - OT         = ออกงาน − เลิกงานมาตรฐาน − นาทีผ่อนผัน OT
 * - isDayOff   = วันหยุดตามตารางเวร → สถานะ "off" ไม่นับขาดงาน (ถ้ามาทำงานก็ยังคำนวณให้)
 */
export function computeDaySummary(
  punches: DayPunches,
  settings: WorkSettings,
  isHoliday = false,
  isDayOff = false,
): DaySummary {
  const checkInAt = punches.check_in_at ?? null;
  const breakOutAt = punches.break_out_at ?? null;
  const breakInAt = punches.break_in_at ?? null;
  const checkOutAt = punches.check_out_at ?? null;

  const present: Record<PunchType, string | null> = {
    check_in: checkInAt,
    break_out: breakOutAt,
    break_in: breakInAt,
    check_out: checkOutAt,
  };
  const missing = PUNCH_ORDER.filter((t) => !present[t]);
  const punchCount = PUNCH_ORDER.length - missing.length;

  const expected = expectedTimes(punches.work_date, settings);

  // ---- สาย: เข้าจริงช้ากว่าเวลาเริ่มที่คาดหวัง ----
  const inOffset = minutesFrom(expected.start, checkInAt);
  const lateMinutes =
    inOffset === null ? 0 : Math.max(0, Math.round(inOffset - settings.late_grace_min));

  // ---- กลับก่อนเวลา: ออกจริงเร็วกว่าเวลาเลิกที่คาดหวัง ----
  const outOffset = minutesFrom(expected.end, checkOutAt);
  const earlyLeaveMinutes =
    outOffset === null ? 0 : Math.max(0, Math.round(-outOffset - settings.early_leave_grace_min));

  // ---- เวลาพักเที่ยง (ไม่ลงเวลาพัก = ถือว่าใช้เต็มโควตา) ----
  const breakActual = diffMinutes(breakOutAt, breakInAt);
  const breakMinutes =
    breakActual === null ? settings.break_allow_minutes : Math.max(0, Math.round(breakActual));

  // ---- ออกไปทำธุระระหว่างวัน (นับเฉพาะรอบที่กลับเข้ามาแล้ว) ----
  const errandMinutes = Math.max(0, Math.round(punches.errand_minutes ?? 0));
  const errandRounds = Math.max(0, Math.round(punches.errand_rounds ?? 0));

  // ---- เวลาส่วนตัวรวม: พักเที่ยง + ธุระ ใช้โควตาก้อนเดียวกัน (ปกติ 60 นาที) ----
  const personalMinutes = breakMinutes + errandMinutes;
  const overBreakMinutes = Math.max(0, personalMinutes - settings.break_allow_minutes);

  // ---- ชั่วโมงทำงานสุทธิ ----
  // นโยบาย fixed = หักพักเที่ยงเต็มโควตาเสมอ แต่ถ้าออกไปทำธุระจนรวมเกินโควตา ต้องหักตามจริง
  const span = diffMinutes(checkInAt, checkOutAt);
  const deduct =
    settings.break_policy === "fixed"
      ? Math.max(settings.break_allow_minutes, personalMinutes)
      : personalMinutes;
  const workMinutes = span === null ? 0 : Math.max(0, Math.round(span - deduct));

  // ---- OT: ออกจริงช้ากว่าเวลาเลิกที่คาดหวัง ----
  let otMinutes = 0;
  if (settings.count_ot && outOffset !== null) {
    otMinutes = Math.max(0, Math.round(outOffset - settings.ot_grace_min));
  }

  // ---- สถานะ ----
  let status: DayStatus;
  if (punchCount === 4) {
    status = "complete";
  } else if (punchCount === 0) {
    if (isDayOff) status = "off";
    else status = isHoliday || !isWorkday(punches.work_date, settings) ? "holiday" : "absent";
  } else {
    status = "incomplete";
  }

  const flags: string[] = [];
  if (lateMinutes > 0) flags.push("มาสาย");
  if (earlyLeaveMinutes > 0) flags.push("กลับก่อนเวลา");
  if (errandRounds > 0) flags.push(`ออกทำธุระ ${errandRounds} ครั้ง`);
  if (overBreakMinutes > 0) flags.push("พักเกินเวลา");
  if (status === "incomplete") flags.push("ลงเวลาไม่ครบ");
  if (otMinutes > 0) flags.push("มี OT");

  return {
    workDate: punches.work_date,
    status,
    checkInAt,
    breakOutAt,
    breakInAt,
    checkOutAt,
    lateMinutes,
    earlyLeaveMinutes,
    breakMinutes: breakActual === null ? 0 : breakMinutes,
    errandMinutes,
    errandRounds,
    // เวลาส่วนตัวที่ใช้คำนวณจริง (นับพักเต็มโควตาให้วันที่ไม่ได้ลงเวลาพัก)
    personalMinutes,
    overBreakMinutes,
    workMinutes,
    otMinutes,
    missing,
    flags,
  };
}

export type PeriodTotals = {
  days: number;
  workedDays: number;
  completeDays: number;
  incompleteDays: number;
  absentDays: number;
  /** วันหยุดตามตารางเวร */
  offDays: number;
  lateDays: number;
  lateMinutes: number;
  earlyLeaveDays: number;
  earlyLeaveMinutes: number;
  overBreakDays: number;
  overBreakMinutes: number;
  workMinutes: number;
  otMinutes: number;
  /** เวลาออกไปทำธุระรวม (นาที) */
  errandMinutes: number;
  /** ชั่วโมงงานพิเศษ (นาที) จากภารกิจนอกสถานที่ที่นับชั่วโมง — เติมโดยชั้นรายงาน ไม่ได้มาจาก DaySummary */
  fieldMinutes: number;
};

/** รวมยอดของช่วงเวลา (ใช้ทั้งรายบุคคล รายวัน และรายเดือน) */
export function summarizePeriod(summaries: DaySummary[]): PeriodTotals {
  const totals: PeriodTotals = {
    days: summaries.length,
    workedDays: 0,
    completeDays: 0,
    incompleteDays: 0,
    absentDays: 0,
    offDays: 0,
    lateDays: 0,
    lateMinutes: 0,
    earlyLeaveDays: 0,
    earlyLeaveMinutes: 0,
    overBreakDays: 0,
    overBreakMinutes: 0,
    workMinutes: 0,
    otMinutes: 0,
    errandMinutes: 0,
    fieldMinutes: 0,
  };

  for (const s of summaries) {
    if (s.status === "complete") totals.completeDays += 1;
    if (s.status === "incomplete") totals.incompleteDays += 1;
    if (s.status === "absent") totals.absentDays += 1;
    if (s.status === "off") totals.offDays += 1;
    if (s.status === "complete" || s.status === "incomplete") totals.workedDays += 1;
    if (s.lateMinutes > 0) {
      totals.lateDays += 1;
      totals.lateMinutes += s.lateMinutes;
    }
    if (s.earlyLeaveMinutes > 0) {
      totals.earlyLeaveDays += 1;
      totals.earlyLeaveMinutes += s.earlyLeaveMinutes;
    }
    if (s.overBreakMinutes > 0) {
      totals.overBreakDays += 1;
      totals.overBreakMinutes += s.overBreakMinutes;
    }
    totals.workMinutes += s.workMinutes;
    totals.otMinutes += s.otMinutes;
    totals.errandMinutes += s.errandMinutes;
  }

  return totals;
}

// ---------- ออกไปทำธุระระหว่างวัน ----------

/**
 * จับคู่การกดออก/กลับให้เป็นรอบ ๆ พร้อมนาทีที่ใช้ไป
 * รอบที่ยังไม่กดกลับ (isOpen) ยังไม่นับเวลา เพราะยังไม่รู้ว่าจะใช้เท่าไร
 */
export function groupErrandRounds(punches: ErrandPunch[]): ErrandRound[] {
  const byRound = new Map<number, ErrandRound>();

  for (const p of punches) {
    const current =
      byRound.get(p.round) ??
      ({ round: p.round, reason: null, out: null, in: null, minutes: 0, isOpen: true } as ErrandRound);
    if (p.punch_type === "out") {
      current.out = p;
      current.reason = p.reason ?? current.reason;
    } else {
      current.in = p;
    }
    byRound.set(p.round, current);
  }

  return [...byRound.values()]
    .map((r) => {
      const span = r.out && r.in ? (toDate(r.in.punched_at)!.getTime() - toDate(r.out.punched_at)!.getTime()) / 60_000 : null;
      return { ...r, minutes: span === null ? 0 : Math.max(0, Math.round(span)), isOpen: Boolean(r.out && !r.in) };
    })
    .sort((a, b) => a.round - b.round);
}

/** รวมเวลาธุระทุกรอบที่กลับเข้ามาแล้ว */
export function sumErrandMinutes(rounds: ErrandRound[]): number {
  return rounds.reduce((sum, r) => sum + r.minutes, 0);
}

/**
 * ตรวจว่ากด "ออกไปทำธุระ" หรือ "กลับเข้างาน" ได้ไหม
 * ต้องเข้างานแล้ว ยังไม่เลิกงาน และไม่อยู่ระหว่างพักเที่ยง (พักเที่ยงมีปุ่มของตัวเอง)
 */
export function canErrand(
  type: ErrandPunchType,
  done: PunchType[],
  hasOpenRound: boolean,
): { ok: boolean; reason?: string } {
  if (!done.includes("check_in")) return { ok: false, reason: "กรุณาลงเวลาเข้างานก่อน" };
  if (done.includes("check_out")) return { ok: false, reason: "เลิกงานแล้ว ลงเวลาธุระไม่ได้" };

  const onLunch = done.includes("break_out") && !done.includes("break_in");
  if (type === "out") {
    if (hasOpenRound) return { ok: false, reason: "คุณออกไปทำธุระอยู่แล้ว กรุณากดกลับเข้างานก่อน" };
    if (onLunch) return { ok: false, reason: "กำลังพักเที่ยงอยู่ กรุณากดเข้างานบ่ายก่อน" };
    return { ok: true };
  }

  if (!hasOpenRound) return { ok: false, reason: "ยังไม่ได้กดออกไปทำธุระ" };
  return { ok: true };
}

// ---------- งานนอกสถานที่ (ภารกิจ: เริ่ม → จบ) ----------

export type FieldSessionStatus = "planned" | "in_progress" | "done" | "missing_end";

export type FieldSessionSummary = {
  /** นาทีที่ทำ (จบ − เริ่ม) ไม่หักพัก; 0 ถ้ายังไม่จบ */
  minutes: number;
  /** นาทีที่นับเป็น "ชั่วโมงงานพิเศษ" (0 ถ้าภารกิจไม่นับชั่วโมง เช่น ส่งรถระหว่างงาน) */
  countedMinutes: number;
  status: FieldSessionStatus;
  /** เริ่มช้ากว่าเวลาแผน (นาที) */
  lateStartMinutes: number;
  flags: string[];
};

/**
 * สรุปการทำงานของสมาชิก 1 คนในภารกิจ 1 งาน
 * - planned      = ยังไม่กดเริ่ม
 * - in_progress  = เริ่มแล้ว ยังไม่จบ และยังอยู่ในวันเดียวกัน (หรือวันถัดไปก่อนเที่ยง — บูธเลิกดึก)
 * - missing_end  = เริ่มแล้วไม่กดจบ และเลยกำหนดไปแล้ว → ต้องให้แอดมินบันทึกเวลาให้
 * - done         = ครบทั้งเริ่มและจบ
 */
export function computeFieldSession(input: {
  workDate: string;
  startAt: string | null | undefined;
  endAt: string | null | undefined;
  plannedStart?: string | null;
  countsHours: boolean;
  now?: Date;
}): FieldSessionSummary {
  const start = toDate(input.startAt);
  const end = toDate(input.endAt);
  const now = input.now ?? new Date();
  const flags: string[] = [];

  let lateStartMinutes = 0;
  if (start && input.plannedStart) {
    const planned = bangkokAt(input.workDate, input.plannedStart);
    lateStartMinutes = Math.max(0, Math.round((start.getTime() - planned.getTime()) / 60_000));
    if (lateStartMinutes > 0) flags.push("เริ่มช้ากว่าแผน");
  }

  let status: FieldSessionStatus;
  let minutes = 0;
  if (!start) {
    status = "planned";
  } else if (!end) {
    // ถือว่ายังทำอยู่จนถึงเที่ยงของวันถัดไป หลังจากนั้นถือว่าลืมกดจบ
    const deadline = bangkokAt(input.workDate, "12:00", 1);
    status = now.getTime() <= deadline.getTime() ? "in_progress" : "missing_end";
    if (status === "missing_end") flags.push("ไม่ได้กดจบงาน");
  } else {
    status = "done";
    minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
  }

  return {
    minutes,
    countedMinutes: input.countsHours ? minutes : 0,
    status,
    lateStartMinutes,
    flags,
  };
}

export const FIELD_STATUS_LABEL: Record<FieldSessionStatus, string> = {
  planned: "ยังไม่เริ่ม",
  in_progress: "กำลังทำ",
  done: "เสร็จแล้ว",
  missing_end: "ไม่ได้กดจบ",
};

/** punch ถัดไปที่พนักงานควรกด (null = ครบแล้ว) */
export function nextPunchType(done: PunchType[]): PunchType | null {
  return PUNCH_ORDER.find((t) => !done.includes(t)) ?? null;
}

/** ตรวจว่ากด punch ประเภทนี้ได้หรือไม่ — ต้องเรียงลำดับ 1→2→3→4 */
export function canPunch(type: PunchType, done: PunchType[]): { ok: boolean; reason?: string } {
  if (done.includes(type)) {
    return { ok: false, reason: "คุณลงเวลาช่วงนี้ไปแล้ววันนี้" };
  }
  const expected = nextPunchType(done);
  if (expected !== type) {
    return { ok: false, reason: "กรุณาลงเวลาตามลำดับ (เข้าเช้า → ออกพัก → เข้าบ่าย → เลิกงาน)" };
  }
  return { ok: true };
}
