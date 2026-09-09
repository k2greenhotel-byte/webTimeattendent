import { formatThaiDate, formatThaiMonth, monthBounds, workDateOf } from "./datetime";

/**
 * ช่วงเวลาของจอ War Room — ใช้ร่วมกันทุกโปรแกรม
 *
 * ยกแบบมาจากจอยอดขาย Db2 ที่ใช้งานจริงแล้วดี: ปุ่มลัด 5 แบบ
 * (วันนี้ · เดือนนี้ · เลือกเดือน · ปีนี้ · กำหนดเอง) แล้วแปลงเป็นช่วง from–to
 *
 * ไฟล์นี้ไม่มี "server-only" เพราะทั้งฝั่งหน้าเว็บ (คำนวณช่วงก่อนยิง API)
 * และฝั่ง server (ตีความช่วงที่รับมา) ใช้ตัวเดียวกัน จะได้ไม่มีสูตรสองชุดให้เพี้ยน
 */

export type WallPreset = "today" | "mtd" | "month" | "ytd" | "custom";

export type WallPeriodState = {
  preset: WallPreset;
  /** ใช้เมื่อ preset = "month" — รูปแบบ YYYY-MM */
  month: string;
  /** ใช้เมื่อ preset = "custom" */
  from: string;
  to: string;
};

export type WallPeriod = { from: string; to: string; label: string };

export const WALL_PRESETS: { key: WallPreset; label: string }[] = [
  { key: "today", label: "วันนี้" },
  { key: "mtd", label: "เดือนนี้" },
  { key: "month", label: "เลือกเดือน" },
  { key: "ytd", label: "ปีนี้" },
  { key: "custom", label: "กำหนดเอง" },
];

/** สถานะเริ่มต้นของแถบตัวกรอง — ค่าตั้งต้นเป็น "เดือนนี้" เหมือนจอ Db2 */
export function initialPeriodState(preset: WallPreset = "mtd"): WallPeriodState {
  const today = workDateOf();
  return {
    preset,
    month: today.slice(0, 7),
    from: `${today.slice(0, 4)}-01-01`,
    to: today,
  };
}

/** แปลงสถานะปุ่มเป็นช่วงวันที่จริง พร้อมคำอธิบายภาษาไทยไว้ขึ้นบนจอ */
export function periodFromState(state: WallPeriodState): WallPeriod {
  const today = workDateOf();
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];

  switch (state.preset) {
    case "today":
      return { from: today, to: today, label: formatThaiDate(today) };

    case "mtd": {
      const b = monthBounds(y, m);
      return { from: b.from, to: today, label: `${formatThaiMonth(y, m)} (ถึงวันนี้)` };
    }

    case "month": {
      const my = Number(state.month.slice(0, 4));
      const mm = Number(state.month.slice(5, 7));
      const b = monthBounds(my, mm);
      // เดือนปัจจุบันไม่ต้องดึงไปถึงสิ้นเดือนที่ยังมาไม่ถึง
      const to = b.to > today ? today : b.to;
      return { from: b.from, to, label: formatThaiMonth(my, mm) };
    }

    case "ytd":
      return { from: `${y}-01-01`, to: today, label: `ปี ${y + 543} (ถึงวันนี้)` };

    case "custom":
      return {
        from: state.from,
        to: state.to,
        label: `${formatThaiDate(state.from)} – ${formatThaiDate(state.to)}`,
      };
  }
}

/**
 * ฝั่ง server: ตีความ from/to ที่รับมาจาก query string
 *
 * ไม่เชื่อค่าจาก browser — รูปแบบต้องเป็น YYYY-MM-DD เท่านั้น ถ้าเพี้ยนให้ตกกลับไป
 * ใช้เดือนปัจจุบัน (พฤติกรรมเดิมของจอก่อนมีตัวกรอง) และสลับให้ from มาก่อน to เสมอ
 */
export function resolvePeriod(from?: string | null, to?: string | null): WallPeriod {
  const today = workDateOf();
  const valid = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

  const f = valid(from);
  const t = valid(to);

  if (!f && !t) {
    const b = monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
    return {
      from: b.from,
      to: today,
      label: `${formatThaiMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)))} (ถึงวันนี้)`,
    };
  }

  const start = f ?? t!;
  const end = t ?? f!;
  const [lo, hi] = start <= end ? [start, end] : [end, start];

  return {
    from: lo,
    to: hi,
    label: lo === hi ? formatThaiDate(lo) : `${formatThaiDate(lo)} – ${formatThaiDate(hi)}`,
  };
}

/** อยู่ในช่วงไหม — ใช้กับวันที่รูปแบบ YYYY-MM-DD ที่เทียบด้วย string ได้ตรงๆ */
export function inPeriod(date: string | null | undefined, period: WallPeriod): boolean {
  return !!date && date >= period.from && date <= period.to;
}
