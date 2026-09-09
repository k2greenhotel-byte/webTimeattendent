import { describe, expect, it } from "vitest";
import {
  avgPctByKey,
  bonusFor,
  buildForm,
  countByKey,
  daysSince,
  formatScore,
  gradeOf,
  itemMaxScore,
  latestByBranch,
  scorePercent,
  summarizeInspections,
  totalsOf,
  validateInspection,
  validateItem,
  validateResult,
} from "../src/lib/inspection";
import type {
  InspItem,
  InspItemInput,
  InspItemOption,
  InspResultInput,
  InspSection,
  InspTemplate,
  InspectionRow,
} from "../src/lib/inspection-types";

const TODAY = "2026-09-09";

const TEMPLATE: InspTemplate = {
  id: "t1",
  code: "MC",
  name: "ตรวจสอบสาขา มอเตอร์ไซค์",
  description: null,
  bonus_threshold: 60,
  bonus_amount: 300,
  footer_note: null,
  sort_order: 10,
  is_active: true,
};

function section(over: Partial<InspSection> & { id: string; code: string }): InspSection {
  return {
    template_id: "t1",
    name: over.code,
    note: null,
    sort_order: 10,
    is_active: true,
    ...over,
  };
}

function item(over: Partial<InspItem> & { id: string; code: string; section_id: string }): InspItem {
  return {
    name: over.code,
    item_type: "choice",
    max_score: 0,
    require_photo: false,
    note: null,
    sort_order: 10,
    is_active: true,
    ...over,
  };
}

function option(
  over: Partial<InspItemOption> & { id: string; code: string; item_id: string; score: number },
): InspItemOption {
  return {
    label: over.code,
    fine_amount: 0,
    sort_order: 10,
    is_active: true,
    ...over,
  };
}

function result(over: Partial<InspResultInput> = {}): InspResultInput {
  return {
    item_id: "i1",
    section_name: "หมวด",
    section_sort: 10,
    item_name: "ข้อ",
    item_type: "choice",
    option_id: "o1",
    option_label: "ตรง",
    score: 5,
    max_score: 5,
    fine_amount: 0,
    note: null,
    sort_order: 10,
    photos: [],
    ...over,
  };
}

function inspection(over: Partial<InspectionRow> & { id: string }): InspectionRow {
  return {
    doc_no: `INS-2569-${over.id}`,
    inspect_date: TODAY,
    template_id: "t1",
    template_code: "MC",
    template_name: "มอเตอร์ไซค์",
    company_id: "c1",
    company_name: "บริษัท ก",
    branch_id: "b1",
    branch_name: "สาขา ก",
    inspector_id: "e1",
    inspector_name: "สมชาย",
    status: "submitted",
    total_score: 60,
    max_score: 64,
    score_pct: 93.75,
    total_fine: 0,
    bonus_amount: 300,
    fail_count: 1,
    note: null,
    created_by: null,
    created_at: `${TODAY}T03:00:00Z`,
    updated_at: `${TODAY}T03:00:00Z`,
    company_ref_name: "บริษัท ก",
    branch_ref_name: "สาขา ก",
    branch_code: "B01",
    inspector_full_name: "สมชาย",
    result_count: 20,
    photo_count: 2,
    ...over,
  };
}

describe("คะแนนเต็มของรายการตรวจ", () => {
  it("แบบ rating ใช้คะแนนเต็มที่ตั้งไว้บนรายการ", () => {
    expect(itemMaxScore({ item_type: "rating", max_score: 2 }, [])).toBe(2);
  });

  it("แบบ choice ใช้คะแนนสูงสุดของตัวเลือกที่ยังเปิดใช้งาน", () => {
    const options = [
      { score: 5, is_active: true },
      { score: 1.5, is_active: true },
      { score: 99, is_active: false },
    ];
    expect(itemMaxScore({ item_type: "choice", max_score: 0 }, options)).toBe(5);
  });

  it("แบบ choice ที่ยังไม่มีตัวเลือกเลย คะแนนเต็มเป็น 0 ไม่ใช่ -Infinity", () => {
    expect(itemMaxScore({ item_type: "choice", max_score: 0 }, [])).toBe(0);
  });
});

describe("ประกอบแบบฟอร์ม", () => {
  const sections = [
    section({ id: "s2", code: "MC-02", sort_order: 20 }),
    section({ id: "s1", code: "MC-01", sort_order: 10 }),
    section({ id: "sx", code: "FN-01", template_id: "t2" }),
  ];
  const items = [
    item({ id: "i1", code: "MC-01-1", section_id: "s1" }),
    item({ id: "i2", code: "MC-02-1", section_id: "s2", item_type: "rating", max_score: 2 }),
    item({ id: "i3", code: "MC-01-9", section_id: "s1", is_active: false }),
  ];
  const options = [
    option({ id: "o1", code: "A", item_id: "i1", score: 5 }),
    option({ id: "o2", code: "B", item_id: "i1", score: 0, sort_order: 20 }),
  ];

  it("รวมคะแนนเต็มทุกชั้น และเรียงหมวดตามลำดับที่ตั้งไว้", () => {
    const form = buildForm(TEMPLATE, sections, items, options);
    expect(form.sections.map((s) => s.code)).toEqual(["MC-01", "MC-02"]);
    expect(form.sections[0].maxScore).toBe(5);
    expect(form.sections[1].maxScore).toBe(2);
    expect(form.maxScore).toBe(7);
  });

  it("ตัดของที่ปิดใช้งานออกโดยค่าเริ่มต้น แต่หน้าตั้งค่าขอดูได้", () => {
    expect(buildForm(TEMPLATE, sections, items, options).sections[0].items).toHaveLength(1);
    expect(buildForm(TEMPLATE, sections, items, options, true).sections[0].items).toHaveLength(2);
  });

  it("ไม่ดึงหมวดของแม่แบบอื่นเข้ามาปน", () => {
    const form = buildForm(TEMPLATE, sections, items, options);
    expect(form.sections.some((s) => s.code === "FN-01")).toBe(false);
  });
});

describe("รวมคะแนนของใบตรวจ", () => {
  it("รวมคะแนน ค่าปรับ และนับข้อที่ไม่เต็ม", () => {
    const totals = totalsOf(
      [
        result({ score: 5, max_score: 5 }),
        result({ score: 0, max_score: 5, fine_amount: 60 }),
        result({ score: 1.5, max_score: 1.5 }),
      ],
      TEMPLATE,
    );
    expect(totals.totalScore).toBe(6.5);
    expect(totals.maxScore).toBe(11.5);
    expect(totals.totalFine).toBe(60);
    expect(totals.failCount).toBe(1);
  });

  it("ข้อที่คะแนนเต็มเป็น 0 (ปรับเงินอย่างเดียว) ไม่นับเป็นข้อที่ตก", () => {
    const totals = totalsOf([result({ score: 0, max_score: 0, fine_amount: 200 })], TEMPLATE);
    expect(totals.failCount).toBe(0);
    expect(totals.totalFine).toBe(200);
  });

  it("ได้เงินรางวัลเมื่อถึงเกณฑ์ และไม่ได้เมื่อต่ำกว่าเกณฑ์", () => {
    expect(bonusFor(TEMPLATE, 60)).toBe(300);
    expect(bonusFor(TEMPLATE, 59.5)).toBe(0);
    expect(bonusFor({ bonus_threshold: null, bonus_amount: 300 }, 64)).toBe(0);
    expect(bonusFor(null, 64)).toBe(0);
  });

  it("คะแนนเต็ม 0 ไม่ทำให้เปอร์เซ็นต์กลายเป็น NaN", () => {
    expect(scorePercent(0, 0)).toBe(0);
    expect(scorePercent(48, 64)).toBe(75);
  });
});

describe("เกรดจากเปอร์เซ็นต์คะแนน", () => {
  it("แบ่งเกรดตามเส้นที่ตั้งไว้", () => {
    expect(gradeOf(93.75)).toBe("good");
    expect(gradeOf(90)).toBe("good");
    expect(gradeOf(89.9)).toBe("fair");
    expect(gradeOf(75)).toBe("fair");
    expect(gradeOf(74.9)).toBe("poor");
  });
});

describe("ตรวจความถูกต้องก่อนบันทึก", () => {
  const plain = { name: "ตรวจนับเงิน", require_photo: false };

  it("ข้อแบบเลือกตัวเลือก ต้องเลือกก่อนถึงบันทึกได้", () => {
    expect(validateResult(result({ option_id: null }), plain)).toContain("ยังไม่ได้เลือก");
    expect(validateResult(result(), plain)).toBeNull();
  });

  it("ข้อแบบให้คะแนน ห้ามติดลบและห้ามเกินคะแนนเต็ม", () => {
    const rating = { item_type: "rating" as const, option_id: null, photos: [] };
    expect(validateResult({ ...rating, score: -1, max_score: 2 }, plain)).toContain("ติดลบ");
    expect(validateResult({ ...rating, score: 3, max_score: 2 }, plain)).toContain("ไม่เกิน 2");
    expect(validateResult({ ...rating, score: 2, max_score: 2 }, plain)).toBeNull();
  });

  it("ข้อที่บังคับแนบรูป ต้องมีรูปอย่างน้อยหนึ่งรูป", () => {
    const strict = { name: "ความสะอาด", require_photo: true };
    expect(validateResult(result(), strict)).toContain("แนบรูป");
    expect(validateResult(result({ photos: ["a.jpg"] }), strict)).toBeNull();
  });

  it("ใบตรวจต้องมีสาขา วันที่ และรายการตรวจ", () => {
    expect(
      validateInspection({ branch_id: null, inspect_date: TODAY, results: [result()] }),
    ).toContain("สาขา");
    expect(
      validateInspection({ branch_id: "b1", inspect_date: "", results: [result()] }),
    ).toContain("วันที่");
    expect(validateInspection({ branch_id: "b1", inspect_date: TODAY, results: [] })).toContain(
      "ยังไม่มีรายการตรวจ",
    );
    expect(
      validateInspection({ branch_id: "b1", inspect_date: TODAY, results: [result()] }),
    ).toBeNull();
  });

  it("รายการตรวจแบบให้คะแนน ต้องกำหนดคะแนนเต็มมากกว่า 0", () => {
    const base: InspItemInput = {
      section_id: "s1",
      code: "MC-09-1",
      name: "รถ",
      item_type: "rating",
      max_score: 0,
      require_photo: false,
      note: null,
      sort_order: 10,
      is_active: true,
    };
    expect(validateItem(base, [])).toContain("คะแนนเต็ม");
    expect(validateItem({ ...base, max_score: 2 }, [])).toBeNull();
    expect(validateItem({ ...base, max_score: 2 }, ["MC-09-1"])).toContain("ถูกใช้ไปแล้ว");
    expect(validateItem({ ...base, code: " " }, [])).toContain("รหัส");
  });
});

describe("สรุปหลายใบ", () => {
  const rows = [
    inspection({ id: "1", branch_id: "b1", branch_name: "สาขา ก", score_pct: 95, total_fine: 0 }),
    inspection({
      id: "2",
      branch_id: "b1",
      branch_name: "สาขา ก",
      inspect_date: "2026-08-01",
      score_pct: 60,
      total_fine: 300,
    }),
    inspection({
      id: "3",
      branch_id: "b2",
      branch_name: "สาขา ข",
      score_pct: 70,
      total_fine: 150,
      bonus_amount: 0,
    }),
    inspection({ id: "4", status: "draft", score_pct: 0, bonus_amount: 0 }),
    inspection({ id: "5", status: "cancelled", score_pct: 10, bonus_amount: 0 }),
  ];

  it("นับเฉพาะใบที่ส่งผลแล้วในค่าเฉลี่ยและยอดเงิน", () => {
    const s = summarizeInspections(rows);
    expect(s.count).toBe(5);
    expect(s.submitted).toBe(3);
    expect(s.draft).toBe(1);
    expect(s.cancelled).toBe(1);
    expect(s.totalFine).toBe(450);
    expect(s.totalBonus).toBe(600);
    expect(s.avgPct).toBe(75);
    expect(s.failed).toBe(2);
  });

  it("ผลล่าสุดของแต่ละสาขา คะแนนต่ำสุดขึ้นก่อน", () => {
    const latest = latestByBranch(rows);
    expect(latest.map((r) => r.branch_name)).toEqual(["สาขา ข", "สาขา ก"]);
    expect(latest[1].id).toBe("1");
  });

  it("คะแนนเฉลี่ยรายสาขา เรียงจากต่ำไปสูง", () => {
    const avg = avgPctByKey(rows, (r) => r.branch_name, "ไม่ระบุ");
    expect(avg[0].label).toBe("สาขา ข");
    expect(avg[0].avgPct).toBe(70);
    expect(avg[1].avgPct).toBe(77.5);
    expect(avg[1].count).toBe(2);
  });

  it("นับจำนวนตามคีย์ พร้อมค่าแทนเมื่อไม่มีข้อมูล", () => {
    const counts = countByKey(rows, (r) => r.branch_name, "ไม่ระบุสาขา");
    // นับทุกใบรวมฉบับร่างและใบที่ยกเลิก (ต่างจาก avgPctByKey ที่นับเฉพาะใบที่ส่งผลแล้ว)
    expect(counts[0]).toEqual({ label: "สาขา ก", count: 4 });
  });
});

describe("นับวันจากวันที่ตรวจล่าสุด", () => {
  it("นับเป็นวันเต็ม และไม่ติดลบ", () => {
    expect(daysSince("2026-08-10", "2026-09-09")).toBe(30);
    expect(daysSince("2026-09-09", "2026-09-09")).toBe(0);
    expect(daysSince("2026-10-09", "2026-09-09")).toBe(0);
  });
});

describe("รูปแบบตัวเลข", () => {
  it("คะแนนเต็มไม่โชว์ทศนิยม แต่ครึ่งคะแนนยังเห็น", () => {
    expect(formatScore(5)).toBe("5");
    expect(formatScore(1.5)).toBe("1.5");
  });
});
