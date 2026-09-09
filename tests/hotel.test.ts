import { describe, expect, it } from "vitest";
import {
  buildChecklist,
  dueDateOf,
  dueLabel,
  isOverdue,
  latestByBranch,
  openDays,
  percent,
  periodBucket,
  sortIssuesByUrgency,
  summarizeByPeriod,
  summarizeIssues,
  summarizeRounds,
  totalsOf,
  validateItem,
  validateResult,
  validateRound,
  parseRoomCodes,
  placeLabel,
  scopeOf,
  validateRoom,
  weekStartOf,
} from "../src/lib/hotel";
import type {
  HtlGroup,
  HtlIssueRow,
  HtlItem,
  HtlResultInput,
  HtlRoundRow,
  HtlScope,
} from "../src/lib/hotel-types";

// ---------- ตัวช่วยสร้างข้อมูลทดสอบ ----------

function group(id: string, sort: number, active = true, scope: HtlScope = "building"): HtlGroup {
  return {
    id,
    code: `G-${id}`,
    name: `หมวด ${id}`,
    note: null,
    scope,
    sort_order: sort,
    is_active: active,
  };
}

function item(id: string, groupId: string, sort: number, patch: Partial<HtlItem> = {}): HtlItem {
  return {
    id,
    group_id: groupId,
    code: `I-${id}`,
    name: `รายการ ${id}`,
    note: null,
    branch_id: null,
    scope: "building",
    require_photo: false,
    require_photo_on_fail: true,
    default_priority: "soon",
    sort_order: sort,
    is_active: true,
    ...patch,
  };
}

function result(patch: Partial<HtlResultInput> = {}): HtlResultInput {
  return {
    item_id: "i1",
    group_name: "หมวด",
    group_sort: 10,
    item_name: "รายการ",
    sort_order: 10,
    result: "pass",
    note: null,
    priority: null,
    is_fixed: false,
    fixed_note: null,
    repair_id: null,
    repair_doc_no: null,
    photos: [],
    ...patch,
  };
}

function round(patch: Partial<HtlRoundRow> = {}): HtlRoundRow {
  return {
    id: "r1",
    doc_no: "HTC-2569-0001",
    check_date: "2026-09-09",
    company_id: null,
    company_name: null,
    branch_id: "b1",
    branch_name: "สาขา 1",
    room_id: null,
    room_code: null,
    inspector_id: null,
    inspector_name: "ช่างเอ",
    status: "submitted",
    total_items: 10,
    checked_count: 10,
    pass_count: 8,
    fail_count: 2,
    na_count: 0,
    urgent_count: 1,
    soon_count: 1,
    later_count: 0,
    open_fix_count: 2,
    pass_pct: 80,
    note: null,
    created_by: null,
    created_at: "",
    updated_at: "",
    company_ref_name: null,
    branch_ref_name: null,
    branch_code: null,
    room_ref_code: null,
    room_name: null,
    inspector_full_name: null,
    photo_count: 0,
    ...patch,
  };
}

function issue(patch: Partial<HtlIssueRow> = {}): HtlIssueRow {
  return {
    result_id: "x1",
    round_id: "r1",
    item_id: "i1",
    group_name: "ระบบน้ำ",
    group_sort: 10,
    item_name: "ปั๊มน้ำ",
    sort_order: 10,
    note: "ปั๊มไม่ทำงาน",
    priority: "soon",
    is_fixed: false,
    fixed_at: null,
    fixed_note: null,
    repair_id: null,
    repair_doc_no: null,
    doc_no: "HTC-2569-0001",
    check_date: "2026-09-09",
    company_id: null,
    company_name: null,
    branch_id: "b1",
    branch_name: "สาขา 1",
    room_id: null,
    room_code: null,
    inspector_id: null,
    inspector_name: null,
    status: "submitted",
    photo_count: 0,
    repair_ref_no: null,
    repair_job_status: null,
    ...patch,
  };
}

// ---------- ประกอบรายการตรวจ ----------

describe("buildChecklist", () => {
  const groups = [group("g2", 20), group("g1", 10)];

  it("เรียงหมวดและรายการตามลำดับที่ตั้งไว้", () => {
    const built = buildChecklist(groups, [item("i2", "g1", 20), item("i1", "g1", 10)], "b1");

    expect(built.groups.map((g) => g.id)).toEqual(["g1"]);
    expect(built.groups[0].items.map((i) => i.id)).toEqual(["i1", "i2"]);
    expect(built.itemCount).toBe(2);
  });

  it("รายการที่ผูกกับสาขา โผล่เฉพาะตอนตรวจสาขานั้น", () => {
    const items = [item("all", "g1", 10), item("only-b2", "g1", 20, { branch_id: "b2" })];

    expect(buildChecklist(groups, items, "b1").itemCount).toBe(1);
    expect(buildChecklist(groups, items, "b2").itemCount).toBe(2);
  });

  it("ตัดหมวดที่ไม่เหลือรายการทิ้ง ไม่ให้หน้าบันทึกมีหัวข้อว่าง", () => {
    const built = buildChecklist(groups, [item("i1", "g1", 10)], "b1");
    expect(built.groups).toHaveLength(1);
  });

  it("โหมดตั้งค่าเห็นทุกอย่าง รวมของที่ปิดใช้งานและหมวดว่าง", () => {
    const built = buildChecklist(
      [...groups, group("g3", 30, false)],
      [item("i1", "g1", 10, { is_active: false }), item("i2", "g1", 20, { branch_id: "b9" })],
      "b1",
      true,
    );

    expect(built.groups.map((g) => g.id)).toEqual(["g1", "g2", "g3"]);
    expect(built.itemCount).toBe(2);
  });
});

// ---------- ยอดสรุปของใบตรวจ ----------

describe("totalsOf", () => {
  it("นับผลแต่ละแบบ และแยกความเร่งด่วนของข้อที่ไม่ปกติ", () => {
    const totals = totalsOf([
      result({ result: "pass" }),
      result({ result: "fail", priority: "urgent" }),
      result({ result: "fail", priority: "later", is_fixed: true }),
      result({ result: "na" }),
      result({ result: null }),
    ]);

    expect(totals.totalItems).toBe(5);
    expect(totals.checkedCount).toBe(4);
    expect(totals.passCount).toBe(1);
    expect(totals.failCount).toBe(2);
    expect(totals.naCount).toBe(1);
    expect(totals.urgentCount).toBe(1);
    expect(totals.laterCount).toBe(1);
    expect(totals.openFixCount).toBe(1);
  });

  it('ข้อที่ตอบว่า "ไม่มี" ไม่ถูกนับเป็นตัวหารของเปอร์เซ็นต์ผ่าน', () => {
    const totals = totalsOf([
      result({ result: "pass" }),
      result({ result: "fail", priority: "soon" }),
      result({ result: "na" }),
      result({ result: "na" }),
    ]);

    expect(totals.passPct).toBe(50);
  });

  it("ยังไม่ได้ตรวจเลย ได้ 0% โดยไม่หารศูนย์", () => {
    expect(totalsOf([result({ result: null })]).passPct).toBe(0);
    expect(percent(1, 0)).toBe(0);
  });

  it("ข้อไม่ปกติที่ไม่ได้ระบุความเร่งด่วน ถือเป็นระดับกลาง (ภายใน 1-2 วัน)", () => {
    expect(totalsOf([result({ result: "fail", priority: null })]).soonCount).toBe(1);
  });
});

// ---------- กำหนดแก้ไข ----------

describe("กำหนดแก้ไขตามความเร่งด่วน", () => {
  it("เร่งด่วนทันทีครบกำหนดวันเดียวกัน · 1-2 วัน = +2 · 3 วันขึ้นไป = +7", () => {
    expect(dueDateOf("2026-09-09", "urgent")).toBe("2026-09-09");
    expect(dueDateOf("2026-09-09", "soon")).toBe("2026-09-11");
    expect(dueDateOf("2026-09-09", "later")).toBe("2026-09-16");
  });

  it("ไม่ระบุความเร่งด่วน ใช้เกณฑ์ระดับกลาง", () => {
    expect(dueDateOf("2026-09-09", null)).toBe("2026-09-11");
  });

  it("เลยกำหนดเมื่อวันนี้เกินวันครบกำหนด และข้อที่แก้แล้วไม่นับว่าเลยกำหนด", () => {
    const open = issue({ priority: "urgent" });
    expect(isOverdue(open, "2026-09-09")).toBe(false);
    expect(isOverdue(open, "2026-09-10")).toBe(true);
    expect(isOverdue({ ...open, is_fixed: true }, "2026-12-31")).toBe(false);
  });

  it("ข้อความกำหนดแก้ไขอ่านออกทั้งสามกรณี", () => {
    const open = issue({ priority: "soon" });
    expect(dueLabel(open, "2026-09-10")).toBe("เหลืออีก 1 วัน");
    expect(dueLabel(open, "2026-09-11")).toBe("ครบกำหนดวันนี้");
    expect(dueLabel(open, "2026-09-14")).toBe("เลยกำหนด 3 วัน");
    expect(dueLabel({ ...open, is_fixed: true }, "2026-09-14")).toBe("แก้ไขแล้ว");
  });

  it("นับวันที่ค้างจากวันที่ตรวจพบ และข้อที่แก้แล้วคืน 0", () => {
    expect(openDays(issue(), "2026-09-14")).toBe(5);
    expect(openDays(issue({ is_fixed: true }), "2026-09-14")).toBe(0);
  });
});

// ---------- ตรวจความถูกต้องก่อนบันทึก ----------

describe("validateResult", () => {
  const base = item("i1", "g1", 10);

  it("ยังไม่เลือกผล บันทึกส่งผลไม่ได้", () => {
    expect(validateResult(result({ result: null }), base)).toContain("ยังไม่ได้เลือกผลการตรวจ");
  });

  it("ผลไม่ปกติต้องมีหมายเหตุ", () => {
    const problem = validateResult(result({ result: "fail", photos: ["p"] }), base);
    expect(problem).toContain("ต้องใส่หมายเหตุ");
  });

  it("ผลไม่ปกติต้องแนบรูป ถ้ารายการตั้งไว้ว่าบังคับ", () => {
    const problem = validateResult(result({ result: "fail", note: "น้ำรั่ว" }), base);
    expect(problem).toContain("ต้องแนบรูปประกอบ");
  });

  it("รายการที่บังคับแนบรูปทุกครั้ง ต้องมีรูปแม้ผลปกติ", () => {
    const strict = item("i1", "g1", 10, { require_photo: true });
    expect(validateResult(result({ result: "pass" }), strict)).toContain("ต้องแนบรูปทุกครั้ง");
    expect(validateResult(result({ result: "pass", photos: ["p"] }), strict)).toBeNull();
  });

  it("ผลปกติไม่ต้องมีหมายเหตุหรือรูป", () => {
    expect(validateResult(result({ result: "pass" }), base)).toBeNull();
    expect(validateResult(result({ result: "na" }), base)).toBeNull();
  });
});

describe("validateRound / validateItem", () => {
  it("ต้องเลือกสาขาและวันที่ และต้องมีรายการตรวจอย่างน้อยหนึ่งข้อ", () => {
    expect(validateRound({ branch_id: null, check_date: "2026-09-09", results: [1] })).toContain(
      "เลือกสาขา",
    );
    expect(validateRound({ branch_id: "b1", check_date: "", results: [1] })).toContain("วันที่");
    expect(validateRound({ branch_id: "b1", check_date: "2026-09-09", results: [] })).toContain(
      "ยังไม่มีรายการตรวจเช็ค",
    );
    expect(validateRound({ branch_id: "b1", check_date: "2026-09-09", results: [1] })).toBeNull();
  });

  it("รายการตรวจต้องมีรหัส ชื่อ ประเภทงาน และรหัสห้ามซ้ำ", () => {
    const input = { ...item("i1", "g1", 10), code: "HC-01" };
    expect(validateItem({ ...input, code: " " }, [])).toContain("รหัส");
    expect(validateItem({ ...input, name: "" }, [])).toContain("ชื่อ");
    expect(validateItem({ ...input, group_id: "" }, [])).toContain("ประเภทงาน");
    expect(validateItem(input, ["HC-01"])).toContain("ถูกใช้ไปแล้ว");
    expect(validateItem(input, ["HC-02"])).toBeNull();
  });
});

// ---------- สรุปหลายใบ ----------

describe("summarizeRounds / latestByBranch", () => {
  const rows = [
    round({ id: "a", status: "submitted", pass_pct: 80 }),
    round({ id: "b", status: "draft", pass_pct: 100 }),
    round({ id: "c", status: "cancelled", pass_pct: 0 }),
    round({ id: "d", status: "submitted", pass_pct: 60, branch_id: "b2", branch_name: "สาขา 2" }),
  ];

  it("นับเฉพาะใบที่ส่งผลแล้วเป็นผลการตรวจจริง", () => {
    const s = summarizeRounds(rows);
    expect(s.rounds).toBe(4);
    expect(s.submitted).toBe(2);
    expect(s.draft).toBe(1);
    expect(s.cancelled).toBe(1);
    expect(s.avgPassPct).toBe(70);
  });

  it("ใบล่าสุดของแต่ละสาขา เรียงสาขาที่ผ่านน้อยที่สุดขึ้นก่อน", () => {
    const latest = latestByBranch([
      round({ id: "old", check_date: "2026-09-01", pass_pct: 100 }),
      round({ id: "new", check_date: "2026-09-09", pass_pct: 80 }),
      round({ id: "b2", branch_id: "b2", branch_name: "สาขา 2", pass_pct: 50 }),
    ]);

    expect(latest.map((r) => r.id)).toEqual(["b2", "new"]);
  });
});

// ---------- สรุปรายวัน / รายสัปดาห์ / รายเดือน ----------

describe("periodBucket / summarizeByPeriod", () => {
  it("สัปดาห์เริ่มวันจันทร์เสมอ", () => {
    // 2026-09-09 เป็นวันพุธ · จันทร์ของสัปดาห์นั้นคือ 2026-09-07
    expect(weekStartOf("2026-09-09")).toBe("2026-09-07");
    expect(weekStartOf("2026-09-07")).toBe("2026-09-07");
    // วันอาทิตย์ 2026-09-13 ยังอยู่ในสัปดาห์ที่เริ่ม 2026-09-07
    expect(weekStartOf("2026-09-13")).toBe("2026-09-07");
  });

  it("คีย์ของแต่ละโหมดจัดกลุ่มถูกช่อง", () => {
    expect(periodBucket("2026-09-09", "day").key).toBe("2026-09-09");
    expect(periodBucket("2026-09-09", "week").key).toBe("2026-09-07");
    expect(periodBucket("2026-09-09", "month").key).toBe("2026-09");
    expect(periodBucket("2026-09-09", "month").label).toBe("ก.ย. 2569");
  });

  it("รวมใบในช่วงเดียวกันเข้าด้วยกัน เรียงจากช่วงเก่าไปใหม่", () => {
    const rows = summarizeByPeriod(
      [
        round({ id: "1", check_date: "2026-09-09", pass_count: 8, fail_count: 2 }),
        round({ id: "2", check_date: "2026-09-10", pass_count: 10, fail_count: 0 }),
        round({ id: "3", check_date: "2026-10-01", pass_count: 5, fail_count: 5 }),
        round({ id: "4", check_date: "2026-10-02", status: "draft", pass_count: 9, fail_count: 1 }),
      ],
      "month",
    );

    expect(rows.map((r) => r.key)).toEqual(["2026-09", "2026-10"]);
    expect(rows[0].rounds).toBe(2);
    expect(rows[0].passPct).toBe(90);
    // ฉบับร่างไม่ถูกนับ เดือนตุลาคมจึงเหลือใบเดียว
    expect(rows[1].rounds).toBe(1);
    expect(rows[1].passPct).toBe(50);
  });
});

// ---------- ข้อที่ต้องแก้ไข ----------

describe("summarizeIssues / sortIssuesByUrgency", () => {
  const today = "2026-09-14";
  const issues = [
    issue({ result_id: "1", priority: "later", check_date: "2026-09-13" }),
    issue({ result_id: "2", priority: "urgent", check_date: "2026-09-14" }),
    issue({ result_id: "3", priority: "soon", check_date: "2026-09-01" }),
    issue({ result_id: "4", priority: "urgent", check_date: "2026-09-01", is_fixed: true }),
    issue({ result_id: "5", priority: "soon", check_date: "2026-09-13", repair_doc_no: "RP-1" }),
  ];

  it("นับข้อค้าง ข้อที่แก้แล้ว ข้อเลยกำหนด และข้อที่ยังไม่เปิดใบซ่อม", () => {
    const s = summarizeIssues(issues, today);
    expect(s.total).toBe(5);
    expect(s.open).toBe(4);
    expect(s.fixed).toBe(1);
    expect(s.urgent).toBe(1);
    expect(s.later).toBe(1);
    // ข้อ 3 (soon พบ 1 ก.ย. ครบกำหนด 3 ก.ย.) เลยกำหนดอยู่ข้อเดียว
    expect(s.overdue).toBe(1);
    // ข้อ 5 เปิดใบซ่อมแล้ว จึงเหลือ 3 ข้อที่ยังไม่เปิด
    expect(s.noRepairDoc).toBe(3);
  });

  it("เรียงข้อที่ควรลงมือก่อน: เลยกำหนด → เร่งด่วนกว่า → พบมานานกว่า", () => {
    const sorted = sortIssuesByUrgency(issues, today);
    expect(sorted[0].result_id).toBe("3");
    expect(sorted.map((i) => i.result_id)).toEqual(["3", "4", "2", "5", "1"]);
  });
});

// ---------- ขอบเขตงาน: ตรวจอาคาร กับ ตรวจห้องพัก ----------

describe("buildChecklist แยกงานอาคารกับงานห้องพัก", () => {
  const groups = [group("gb", 10), group("gr", 20, true, "room")];
  const items = [
    item("b1", "gb", 10),
    item("r1", "gr", 10, { scope: "room" }),
    item("r2", "gr", 20, { scope: "room", branch_id: "b2" }),
  ];

  it("งานตรวจอาคารเห็นเฉพาะรายการของอาคาร", () => {
    const built = buildChecklist(groups, items, "b1", false, "building");
    expect(built.groups.map((g) => g.id)).toEqual(["gb"]);
    expect(built.itemCount).toBe(1);
  });

  it("งานตรวจห้องพักเห็นเฉพาะรายการของห้องพัก และแยกตามสาขา", () => {
    expect(buildChecklist(groups, items, "b1", false, "room").itemCount).toBe(1);
    expect(buildChecklist(groups, items, "b2", false, "room").itemCount).toBe(2);
  });

  it("ค่าเริ่มต้นคืองานตรวจอาคาร (ของเดิมยังทำงานเหมือนเดิม)", () => {
    expect(buildChecklist(groups, items, "b1").itemCount).toBe(1);
  });
});

describe("scopeOf / placeLabel", () => {
  it("ใบที่มีห้องผูกอยู่คืองานตรวจห้องพัก", () => {
    expect(scopeOf({ room_id: null })).toBe("building");
    expect(scopeOf({ room_id: "r1" })).toBe("room");
  });

  it("ชื่อจุดที่ตรวจใส่เบอร์ห้องต่อท้ายเฉพาะงานห้องพัก", () => {
    expect(placeLabel({ branch_name: "เคทู กาญ", room_code: null })).toBe("เคทู กาญ");
    expect(placeLabel({ branch_name: "เคทู กาญ", room_code: "V1" })).toBe("เคทู กาญ · ห้อง V1");
    expect(placeLabel({ branch_name: null, room_code: "V1" })).toBe("ไม่ระบุสาขา · ห้อง V1");
  });
});

describe("validateRound ฝั่งงานห้องพัก", () => {
  it("งานห้องพักต้องเลือกห้องก่อน", () => {
    const base = { branch_id: "b1", check_date: "2026-09-09", results: [1], scope: "room" as const };
    expect(validateRound({ ...base, room_id: null })).toContain("เลือกห้องพัก");
    expect(validateRound({ ...base, room_id: "r1" })).toBeNull();
  });

  it("งานอาคารไม่บังคับห้อง", () => {
    expect(
      validateRound({ branch_id: "b1", check_date: "2026-09-09", results: [1] }),
    ).toBeNull();
  });
});

// ---------- ห้องพัก ----------

describe("validateRoom / parseRoomCodes", () => {
  it("ต้องมีสาขาและเบอร์ห้อง และห้ามซ้ำในสาขาเดียวกัน", () => {
    expect(validateRoom({ branch_id: "", code: "V1" }, [])).toContain("เลือกสาขา");
    expect(validateRoom({ branch_id: "b1", code: "  " }, [])).toContain("เบอร์ห้อง");
    expect(validateRoom({ branch_id: "b1", code: "V1" }, ["V1"])).toContain("อยู่แล้ว");
    // เบอร์เดียวกันแต่คนละสาขาถือว่าใช้ได้ (V1 มีได้ทุกโรงแรม)
    expect(validateRoom({ branch_id: "b2", code: "V1" }, ["V2"])).toBeNull();
  });

  it("แยกเบอร์ห้องที่พิมพ์รวดเดียวได้ทั้งจุลภาค เว้นวรรค และขึ้นบรรทัดใหม่", () => {
    expect(parseRoomCodes("V1, V2 V3\n801;802")).toEqual(["V1", "V2", "V3", "801", "802"]);
  });

  it("ตัดช่องว่างเกินและเบอร์ห้องซ้ำออกให้", () => {
    expect(parseRoomCodes("  V1 ,, V1 ,  V2  ")).toEqual(["V1", "V2"]);
    expect(parseRoomCodes("   ")).toEqual([]);
  });
});
