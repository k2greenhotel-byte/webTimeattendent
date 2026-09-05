import { describe, expect, it } from "vitest";
import {
  canPunch,
  computeDaySummary,
  computeFieldSession,
  nextPunchType,
  resolveSettings,
  summarizePeriod,
} from "../src/lib/attendance";
import type { Branch, OrgSettings, WorkSchedule, WorkSettings, WorkSite } from "../src/lib/types";

const settings: WorkSettings = {
  company_id: "c1",
  org_name: "ทดสอบ",
  schedule_name: "กะมาตรฐาน",
  site_name: null,
  crosses_midnight: false,
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
    company_id: "c1",
    org_name: "ทดสอบ",
    timezone: "Asia/Bangkok",
    require_gps: true,
    radius_m: 200,
    default_schedule_id: "s1",
  };

  const morning: WorkSchedule = {
    id: "s1",
    company_id: "c1",
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
    company_id: "c1",
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

  it("ไปประจำบูธทั้งวัน: พิกัด/รัศมี/ชื่อจุดมาจากสถานที่ แต่กะยังเป็นของสาขา", () => {
    const booth: WorkSite = {
      id: "w1",
      company_id: "c1",
      code: "BOOTH",
      name: "บูธบิ๊กซี",
      address: null,
      lat: 14.0,
      lng: 99.5,
      radius_m: null,
      is_active: true,
    };
    const s = resolveSettings(org, afternoon, branch, booth);
    expect(s.site_lat).toBe(14.0);
    expect(s.site_lng).toBe(99.5);
    expect(s.radius_m).toBe(200); // สถานที่ไม่ระบุรัศมี → ใช้ค่าองค์กร ไม่ใช่ของสาขา
    expect(s.site_name).toBe("บูธบิ๊กซี");
    expect(s.work_start).toBe("09:00");
    expect(resolveSettings(org, afternoon, branch).site_name).toBe("สาขาสยาม");
  });
});

describe("งานนอกสถานที่ (ภารกิจ เริ่ม → จบ)", () => {
  it("ออกบูธหลังเลิกงาน 17:30–20:30 = 180 นาที นับเป็นชั่วโมงงานพิเศษ", () => {
    const s = computeFieldSession({
      workDate: D,
      startAt: at(D, "17:30"),
      endAt: at(D, "20:30"),
      plannedStart: "17:30",
      countsHours: true,
    });
    expect(s.status).toBe("done");
    expect(s.minutes).toBe(180);
    expect(s.countedMinutes).toBe(180);
    expect(s.lateStartMinutes).toBe(0);
    expect(s.flags).toEqual([]);
  });

  it("ส่งรถระหว่างเวลางาน: คำนวณนาทีให้ดู แต่ไม่นับเป็นชั่วโมงงานพิเศษ", () => {
    const s = computeFieldSession({
      workDate: D,
      startAt: at(D, "10:00"),
      endAt: at(D, "11:15"),
      countsHours: false,
    });
    expect(s.minutes).toBe(75);
    expect(s.countedMinutes).toBe(0);
  });

  it("เริ่มช้ากว่าแผน 20 นาที ติดธง", () => {
    const s = computeFieldSession({
      workDate: D,
      startAt: at(D, "17:50"),
      endAt: at(D, "20:00"),
      plannedStart: "17:30",
      countsHours: true,
    });
    expect(s.lateStartMinutes).toBe(20);
    expect(s.flags).toContain("เริ่มช้ากว่าแผน");
  });

  it("ยังไม่กดเริ่ม = planned; เริ่มแล้วยังไม่จบในวันเดียวกัน = in_progress", () => {
    expect(computeFieldSession({ workDate: D, startAt: null, endAt: null, countsHours: true }).status).toBe("planned");
    const s = computeFieldSession({
      workDate: D,
      startAt: at(D, "17:30"),
      endAt: null,
      countsHours: true,
      now: new Date(at(D, "19:00")),
    });
    expect(s.status).toBe("in_progress");
    expect(s.minutes).toBe(0);
  });

  it("เริ่มแล้วไม่กดจบ เลยเที่ยงวันถัดไป = missing_end", () => {
    const s = computeFieldSession({
      workDate: D,
      startAt: at(D, "17:30"),
      endAt: null,
      countsHours: true,
      now: new Date(at("2026-09-01", "13:00")),
    });
    expect(s.status).toBe("missing_end");
    expect(s.flags).toContain("ไม่ได้กดจบงาน");
  });
});

describe("กะข้ามเที่ยงคืน (กะดึกโรงแรม)", () => {
  const night: WorkSettings = {
    ...settings,
    schedule_name: "กะดึก",
    crosses_midnight: true,
    work_start: "22:00",
    break_start: "02:00",
    break_end: "03:00",
    work_end: "07:00",
    workdays: [0, 1, 2, 3, 4, 5, 6],
  };
  const NEXT = "2026-09-01";

  it("เข้า 22:10 ออก 07:05 ของวันถัดไป → สาย 5 / ไม่กลับก่อน / ทำงาน 8 ชม.", () => {
    const s = computeDaySummary(
      {
        work_date: D,
        check_in_at: at(D, "22:10"),
        break_out_at: at(NEXT, "02:00"),
        break_in_at: at(NEXT, "03:00"),
        check_out_at: at(NEXT, "07:05"),
      },
      night,
    );
    expect(s.status).toBe("complete");
    expect(s.lateMinutes).toBe(5); // 10 − ผ่อนผัน 5
    expect(s.earlyLeaveMinutes).toBe(0);
    expect(s.otMinutes).toBe(0); // เกิน 5 นาที ไม่ถึงผ่อนผัน OT 30
    expect(s.workMinutes).toBe(475); // 22:10→07:05 = 535 − พัก 60
  });

  it("กะดึกออกก่อนเวลา 05:30 → กลับก่อน 85 นาที (ไม่ใช่ตัวเลขผิดจากการเทียบข้ามวัน)", () => {
    const s = computeDaySummary(
      { work_date: D, check_in_at: at(D, "22:00"), check_out_at: at(NEXT, "05:30") },
      night,
    );
    expect(s.earlyLeaveMinutes).toBe(85); // 90 − ผ่อนผัน 5
    expect(s.otMinutes).toBe(0);
  });

  it("กะดึกอยู่ต่อถึง 08:30 → OT 60 นาที", () => {
    const s = computeDaySummary(
      { work_date: D, check_in_at: at(D, "22:00"), check_out_at: at(NEXT, "08:30") },
      night,
    );
    expect(s.otMinutes).toBe(60); // 90 − ผ่อนผัน 30
    expect(s.earlyLeaveMinutes).toBe(0);
  });

  it("resolveSettings ตรวจจับกะข้ามเที่ยงคืนจากเวลาเลิกงานที่ไม่เกินเวลาเข้างาน", () => {
    const org: OrgSettings = {
      company_id: "c1",
      org_name: "ทดสอบ",
      timezone: "Asia/Bangkok",
      require_gps: false,
      radius_m: 200,
      default_schedule_id: null,
    };
    const base: WorkSchedule = {
      id: "n1",
      company_id: "c1",
      name: "กะดึก",
      work_start: "22:00",
      break_start: "02:00",
      break_end: "03:00",
      work_end: "07:00",
      break_allow_minutes: 60,
      break_policy: "actual",
      late_grace_min: 5,
      early_leave_grace_min: 5,
      count_ot: true,
      ot_grace_min: 30,
      workdays: [0, 1, 2, 3, 4, 5, 6],
      is_default: false,
    };
    expect(resolveSettings(org, base, null).crosses_midnight).toBe(true);
    expect(resolveSettings(org, { ...base, work_start: "08:00", work_end: "17:00" }, null).crosses_midnight).toBe(false);
  });
});

describe("วันหยุดตามตารางเวร", () => {
  it("ไม่มีการลงเวลาในวันหยุดเวร = off ไม่นับขาดงาน", () => {
    const s = computeDaySummary({ work_date: D }, settings, false, true);
    expect(s.status).toBe("off");
    expect(summarizePeriod([s]).absentDays).toBe(0);
    expect(summarizePeriod([s]).offDays).toBe(1);
  });

  it("มาทำงานในวันหยุดเวร ยังคำนวณให้ตามปกติ", () => {
    const s = computeDaySummary(
      { work_date: D, check_in_at: at(D, "08:00"), check_out_at: at(D, "17:00") },
      settings,
      false,
      true,
    );
    expect(s.status).toBe("incomplete");
    expect(s.workMinutes).toBe(480);
  });
});
