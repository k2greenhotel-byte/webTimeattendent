import { describe, expect, it } from "vitest";
import {
  canPunch,
  computeDaySummary,
  nextPunchType,
  resolveSettings,
  summarizePeriod,
} from "../src/lib/attendance";
import type { Branch, OrgSettings, WorkSchedule, WorkSettings } from "../src/lib/types";

const settings: WorkSettings = {
  id: 1,
  org_name: "ทดสอบ",
  schedule_name: "กะมาตรฐาน",
  work_start: "08:00",
  work_end: "17:00",
  break_start: "12:00",
  break_end: "13:00",
  break_allow_minutes: 60,
  break_policy: "actual",
  late_grace_min: 5,
  early_leave_grace_min: 5,
  count_ot: true,
  ot_grace_min: 30,
  workdays: [1, 2, 3, 4, 5, 6],
  require_gps: false,
  site_lat: null,
  site_lng: null,
  radius_m: 200,
  timezone: "Asia/Bangkok",
};

/** ช่วยสร้าง timestamp จากเวลาไทย */
function at(date: string, time: string): string {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

// 2026-08-31 เป็นวันจันทร์ (วันทำงาน)
const D = "2026-08-31";

describe("computeDaySummary", () => {
  it("วันทำงานปกติ ลงครบ 4 ครั้ง พัก 1 ชม. พอดี", () => {
    const s = computeDaySummary(
      {
        work_date: D,
        check_in_at: at(D, "08:00"),
        break_out_at: at(D, "12:00"),
        break_in_at: at(D, "13:00"),
        check_out_at: at(D, "17:00"),
      },
      settings,
    );

    expect(s.status).toBe("complete");
    expect(s.lateMinutes).toBe(0);
    expect(s.earlyLeaveMinutes).toBe(0);
    expect(s.breakMinutes).toBe(60);
    expect(s.overBreakMinutes).toBe(0);
    expect(s.workMinutes).toBe(480); // 8 ชั่วโมง
    expect(s.otMinutes).toBe(0);
  });

  it("มาสายเกินเวลาผ่อนผัน", () => {
    const s = computeDaySummary(
      {
        work_date: D,
        check_in_at: at(D, "08:20"),
        break_out_at: at(D, "12:00"),
        break_in_at: at(D, "13:00"),
        check_out_at: at(D, "17:00"),
      },
      settings,
    );

    expect(s.lateMinutes).toBe(15); // 20 นาที − ผ่อนผัน 5 นาที
    expect(s.flags).toContain("มาสาย");
    expect(s.workMinutes).toBe(460);
  });

  it("มาสายไม่เกินเวลาผ่อนผัน = ไม่สาย", () => {
    const s = computeDaySummary(
      { work_date: D, check_in_at: at(D, "08:05"), check_out_at: at(D, "17:00") },
      settings,
    );
    expect(s.lateMinutes).toBe(0);
  });

  it("พักเกินโควตา 1 ชม. ถูกหักออกจากชั่วโมงทำงานและติดธง", () => {
    const s = computeDaySummary(
      {
        work_date: D,
        check_in_at: at(D, "08:00"),
        break_out_at: at(D, "11:30"),
        break_in_at: at(D, "13:00"),
        check_out_at: at(D, "17:00"),
      },
      settings,
    );

    expect(s.breakMinutes).toBe(90);
    expect(s.overBreakMinutes).toBe(30);
    expect(s.workMinutes).toBe(450); // 9 ชม. − พักจริง 1.5 ชม.
    expect(s.flags).toContain("พักเกินเวลา");
  });

  it("พักน้อยกว่าโควตา: นโยบาย actual นับตามจริง / นโยบาย fixed หักเต็มโควตา", () => {
    const punches = {
      work_date: D,
      check_in_at: at(D, "08:00"),
      break_out_at: at(D, "12:00"),
      break_in_at: at(D, "12:30"),
      check_out_at: at(D, "17:00"),
    };

    expect(computeDaySummary(punches, settings).workMinutes).toBe(510); // หัก 30 นาที
    expect(
      computeDaySummary(punches, { ...settings, break_policy: "fixed" }).workMinutes,
    ).toBe(480); // หักเต็ม 60 นาที
  });

  it("กลับก่อนเวลา", () => {
    const s = computeDaySummary(
      {
        work_date: D,
        check_in_at: at(D, "08:00"),
        break_out_at: at(D, "12:00"),
        break_in_at: at(D, "13:00"),
        check_out_at: at(D, "16:00"),
      },
      settings,
    );

    expect(s.earlyLeaveMinutes).toBe(55); // 60 นาที − ผ่อนผัน 5 นาที
    expect(s.flags).toContain("กลับก่อนเวลา");
  });

  it("ทำ OT หลังเวลาเลิกงาน (เริ่มนับหลังผ่อนผัน 30 นาที)", () => {
    const s = computeDaySummary(
      {
        work_date: D,
        check_in_at: at(D, "08:00"),
        break_out_at: at(D, "12:00"),
        break_in_at: at(D, "13:00"),
        check_out_at: at(D, "19:00"),
      },
      settings,
    );

    expect(s.otMinutes).toBe(90);
    expect(s.workMinutes).toBe(600);
  });

  it("ลงเวลาไม่ครบ: ไม่มี punch พักให้ใช้โควตามาตรฐานหักแทน", () => {
    const s = computeDaySummary(
      { work_date: D, check_in_at: at(D, "08:00"), check_out_at: at(D, "17:00") },
      settings,
    );

    expect(s.status).toBe("incomplete");
    expect(s.missing).toEqual(["break_out", "break_in"]);
    expect(s.workMinutes).toBe(480); // หักพักมาตรฐาน 60 นาที
    expect(s.flags).toContain("ลงเวลาไม่ครบ");
  });

  it("ไม่มีการลงเวลาในวันทำงาน = ขาดงาน", () => {
    const s = computeDaySummary({ work_date: D }, settings);
    expect(s.status).toBe("absent");
    expect(s.workMinutes).toBe(0);
  });

  it("ไม่มีการลงเวลาในวันหยุด = วันหยุด (ไม่นับขาดงาน)", () => {
    expect(computeDaySummary({ work_date: D }, settings, true).status).toBe("holiday");
    // 2026-08-30 เป็นวันอาทิตย์ ซึ่งไม่อยู่ในวันทำงาน
    expect(computeDaySummary({ work_date: "2026-08-30" }, settings).status).toBe("holiday");
  });
});

describe("summarizePeriod", () => {
  it("รวมยอดหลายวันได้ถูกต้อง", () => {
    const days = [
      computeDaySummary(
        {
          work_date: D,
          check_in_at: at(D, "08:20"),
          break_out_at: at(D, "12:00"),
          break_in_at: at(D, "13:00"),
          check_out_at: at(D, "17:00"),
        },
        settings,
      ),
      computeDaySummary({ work_date: "2026-09-01" }, settings),
    ];

    const totals = summarizePeriod(days);
    expect(totals.days).toBe(2);
    expect(totals.completeDays).toBe(1);
    expect(totals.absentDays).toBe(1);
    expect(totals.lateDays).toBe(1);
    expect(totals.lateMinutes).toBe(15);
    expect(totals.workMinutes).toBe(460);
  });
});

describe("ลำดับการลงเวลา", () => {
  it("ต้องลงตามลำดับ 1 → 2 → 3 → 4", () => {
    expect(nextPunchType([])).toBe("check_in");
    expect(nextPunchType(["check_in"])).toBe("break_out");
    expect(nextPunchType(["check_in", "break_out", "break_in", "check_out"])).toBeNull();

    expect(canPunch("check_in", []).ok).toBe(true);
    expect(canPunch("check_out", ["check_in"]).ok).toBe(false);
    expect(canPunch("check_in", ["check_in"]).reason).toContain("ลงเวลาช่วงนี้ไปแล้ว");
  });
});

describe("resolveSettings (องค์กร + กะ + สาขา)", () => {
  const org: OrgSettings = {
    id: 1,
    org_name: "ทดสอบ",
    timezone: "Asia/Bangkok",
    require_gps: true,
    radius_m: 200,
    default_schedule_id: "s1",
  };

  const morning: WorkSchedule = {
    id: "s1",
    name: "กะมาตรฐาน",
    work_start: "08:00",
    break_start: "12:00",
    break_end: "13:00",
    work_end: "17:00",
    break_allow_minutes: 60,
    break_policy: "actual",
    late_grace_min: 5,
    early_leave_grace_min: 5,
    count_ot: true,
    ot_grace_min: 30,
    workdays: [1, 2, 3, 4, 5, 6],
    is_default: true,
  };

  const afternoon: WorkSchedule = { ...morning, id: "s2", name: "กะสาย", work_start: "09:00", is_default: false };

  const branch: Branch = {
    id: "b1",
    code: "BKK01",
    name: "สาขาสยาม",
    address: null,
    phone: null,
    site_lat: 13.7,
    site_lng: 100.5,
    radius_m: 150,
    schedule_id: "s2",
    is_active: true,
  };

  it("ไม่มีสาขา: ใช้เวลาจากกะ และรัศมีจากค่าองค์กร", () => {
    const s = resolveSettings(org, morning, null);
    expect(s.work_start).toBe("08:00");
    expect(s.radius_m).toBe(200);
    expect(s.site_lat).toBeNull();
    expect(s.require_gps).toBe(true);
  });

  it("มีสาขา: พิกัด/รัศมีมาจากสาขา เวลามาจากกะของสาขา", () => {
    const s = resolveSettings(org, afternoon, branch);
    expect(s.work_start).toBe("09:00");
    expect(s.work_end).toBe("17:00");
    expect(s.radius_m).toBe(150);
    expect(s.site_lat).toBe(13.7);
    expect(s.schedule_name).toBe("กะสาย");
  });

  it("พนักงานคนละกะ ลงเวลา 09:20 เท่ากัน แต่คิดสายต่างกัน", () => {
    const punches = { work_date: D, check_in_at: at(D, "09:20"), check_out_at: at(D, "17:00") };
    expect(computeDaySummary(punches, resolveSettings(org, morning, null)).lateMinutes).toBe(75);
    expect(computeDaySummary(punches, resolveSettings(org, afternoon, branch)).lateMinutes).toBe(15);
  });
});
