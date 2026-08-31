/**
 * แหล่งความจริงเดียวของ "กฎการคำนวณเวลาทำงาน"
 * ทุกหน้าจอ ทุกรายงาน และไฟล์ export ต้องเรียกใช้ฟังก์ชันในไฟล์นี้เท่านั้น
 * ห้ามคำนวณสาย/ชั่วโมงทำงานซ้ำที่อื่นเด็ดขาด
 */
import { dayOfWeek, minutesOfDay, parseTimeToMinutes, toDate } from "./datetime";
import {
  PUNCH_ORDER,
  type Branch,
  type DayStatus,
  type DaySummary,
  type OrgSettings,
  type PunchType,
  type WorkSchedule,
  type WorkSettings,
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
): WorkSettings {
  return {
    id: org.id,
    org_name: org.org_name,
    timezone: org.timezone,
    require_gps: org.require_gps,
    site_lat: branch?.site_lat ?? null,
    site_lng: branch?.site_lng ?? null,
    radius_m: branch?.radius_m ?? org.radius_m,
    schedule_name: schedule.name,
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
 * คำนวณสรุปการทำงานของ 1 วัน
 * - สาย        = เวลาเข้างานจริง − เวลาเริ่มงานมาตรฐาน − นาทีผ่อนผัน
 * - กลับก่อน   = เวลาเลิกงานมาตรฐาน − เวลาออกจริง − นาทีผ่อนผัน
 * - เวลาพัก    = เข้าบ่าย − ออกพัก (ถ้าลงไม่ครบใช้โควตามาตรฐานแทน)
 * - พักเกิน    = เวลาพักจริง − โควตาพัก (พักกลางวันยืดหยุ่น แต่โควตา 1 ชม.)
 * - ชม.ทำงาน   = (ออกงาน − เข้างาน) − เวลาพักที่หัก
 * - OT         = ออกงาน − เลิกงานมาตรฐาน − นาทีผ่อนผัน OT
 */
export function computeDaySummary(
  punches: DayPunches,
  settings: WorkSettings,
  isHoliday = false,
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

  const workStart = parseTimeToMinutes(settings.work_start);
  const workEnd = parseTimeToMinutes(settings.work_end);

  // ---- สาย ----
  const inMinutes = minutesOfDay(checkInAt);
  const lateMinutes =
    inMinutes === null ? 0 : Math.max(0, Math.round(inMinutes - workStart - settings.late_grace_min));

  // ---- กลับก่อนเวลา ----
  const outMinutes = minutesOfDay(checkOutAt);
  const earlyLeaveMinutes =
    outMinutes === null
      ? 0
      : Math.max(0, Math.round(workEnd - outMinutes - settings.early_leave_grace_min));

  // ---- เวลาพัก ----
  const breakActual = diffMinutes(breakOutAt, breakInAt);
  const breakMinutes =
    breakActual === null ? settings.break_allow_minutes : Math.max(0, Math.round(breakActual));
  const overBreakMinutes = Math.max(0, breakMinutes - settings.break_allow_minutes);

  // ---- ชั่วโมงทำงานสุทธิ ----
  const span = diffMinutes(checkInAt, checkOutAt);
  const deduct = settings.break_policy === "fixed" ? settings.break_allow_minutes : breakMinutes;
  const workMinutes = span === null ? 0 : Math.max(0, Math.round(span - deduct));

  // ---- OT ----
  let otMinutes = 0;
  if (settings.count_ot && outMinutes !== null) {
    otMinutes = Math.max(0, Math.round(outMinutes - workEnd - settings.ot_grace_min));
  }

  // ---- สถานะ ----
  let status: DayStatus;
  if (punchCount === 4) {
    status = "complete";
  } else if (punchCount === 0) {
    status = isHoliday || !isWorkday(punches.work_date, settings) ? "holiday" : "absent";
  } else {
    status = "incomplete";
  }

  const flags: string[] = [];
  if (lateMinutes > 0) flags.push("มาสาย");
  if (earlyLeaveMinutes > 0) flags.push("กลับก่อนเวลา");
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
  lateDays: number;
  lateMinutes: number;
  earlyLeaveDays: number;
  earlyLeaveMinutes: number;
  overBreakDays: number;
  overBreakMinutes: number;
  workMinutes: number;
  otMinutes: number;
};

/** รวมยอดของช่วงเวลา (ใช้ทั้งรายบุคคล รายวัน และรายเดือน) */
export function summarizePeriod(summaries: DaySummary[]): PeriodTotals {
  const totals: PeriodTotals = {
    days: summaries.length,
    workedDays: 0,
    completeDays: 0,
    incompleteDays: 0,
    absentDays: 0,
    lateDays: 0,
    lateMinutes: 0,
    earlyLeaveDays: 0,
    earlyLeaveMinutes: 0,
    overBreakDays: 0,
    overBreakMinutes: 0,
    workMinutes: 0,
    otMinutes: 0,
  };

  for (const s of summaries) {
    if (s.status === "complete") totals.completeDays += 1;
    if (s.status === "incomplete") totals.incompleteDays += 1;
    if (s.status === "absent") totals.absentDays += 1;
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
  }

  return totals;
}

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
