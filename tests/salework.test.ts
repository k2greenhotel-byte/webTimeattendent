import { describe, expect, it } from "vitest";
import {
  attachDb2Sales,
  buildStaffSummaries,
  buildTaskSummaries,
  canSeeAllWork,
  fillableTasks,
  groupTaskTypes,
  mediaKindOf,
  normalizeLink,
  normalizeSalcod,
  progressOf,
  simplifyName,
  suggestMappings,
  taskTypeBlockers,
  validateMapping,
  validateTaskType,
  validateWorkLog,
} from "../src/lib/salework";
import type {
  ItemStatRow,
  LogItemInput,
  MapRow,
  TaskType,
  TaskTypeInput,
} from "../src/lib/salework-types";

const TODAY = "2026-09-07";

function task(over: Partial<TaskType> & { id: string; code: string; name: string }): TaskType {
  return {
    parent_id: null,
    description: null,
    metric_label: null,
    metric_unit: null,
    require_metric: false,
    require_media: false,
    allow_link: false,
    daily_target: null,
    sort_order: 100,
    is_active: true,
    ...over,
  };
}

const HEAD = task({ id: "h", code: "SW02", name: "งานการตลาดออนไลน์", sort_order: 20 });
const FB = task({
  id: "fb",
  parent_id: "h",
  code: "SW02A",
  name: "การโพสต์ Facebook",
  metric_label: "จำนวนผู้ชม",
  metric_unit: "คน",
  require_metric: true,
  require_media: true,
  allow_link: true,
  sort_order: 21,
});
const TIKTOK = task({ id: "tt", parent_id: "h", code: "SW02B", name: "การโพสต์ TikTok", sort_order: 22 });
const FLYER = task({
  id: "fl",
  code: "SW01",
  name: "งานแจกใบปลิว",
  metric_label: "จำนวนใบปลิวที่แจก",
  metric_unit: "ใบ",
  require_metric: true,
  sort_order: 10,
});

const TYPES = [HEAD, FB, TIKTOK, FLYER];

function item(over: Partial<LogItemInput> & { task_type_id: string }): LogItemInput {
  return {
    task_code: "X",
    task_name: "งาน",
    metric_label: null,
    metric_unit: null,
    done: false,
    qty: null,
    detail: null,
    link_url: null,
    sort_order: 10,
    media: [],
    ...over,
  };
}

describe("สิทธิ์การมองเห็น", () => {
  it("หัวหน้าขึ้นไปเห็นของทุกคน พนักงานทั่วไปเห็นเฉพาะของตัวเอง", () => {
    expect(canSeeAllWork("admin")).toBe(true);
    expect(canSeeAllWork("assistant_admin")).toBe(true);
    expect(canSeeAllWork("supervisor")).toBe(true);
    expect(canSeeAllWork("user")).toBe(false);
  });
});

describe("จัดชั้นประเภทงาน", () => {
  it("หัวข้อเรียงตาม sort_order และงานย่อยอยู่ใต้หัวข้อของตัวเอง", () => {
    const groups = groupTaskTypes(TYPES);
    expect(groups.map((g) => g.head.code)).toEqual(["SW01", "SW02"]);
    expect(groups[1].children.map((c) => c.code)).toEqual(["SW02A", "SW02B"]);
  });

  it("หัวข้อที่มีงานย่อยเป็นแค่ป้าย ไม่นับเป็นบรรทัดให้ติ๊ก", () => {
    expect(fillableTasks(TYPES).map((t) => t.code)).toEqual(["SW01", "SW02A", "SW02B"]);
  });

  it("งานเดี่ยวที่ไม่มีงานย่อย ยังเป็นบรรทัดให้ติ๊กตามปกติ", () => {
    expect(fillableTasks([FLYER]).map((t) => t.code)).toEqual(["SW01"]);
  });
});

describe("ตรวจข้อมูลประเภทงาน", () => {
  const base: TaskTypeInput = {
    parent_id: null,
    code: "SW09",
    name: "งานใหม่",
    description: null,
    metric_label: null,
    metric_unit: null,
    require_metric: false,
    require_media: false,
    allow_link: false,
    daily_target: null,
    sort_order: 100,
    is_active: true,
  };

  it("ผ่านเมื่อข้อมูลครบ", () => {
    expect(validateTaskType(base, ["SW01"])).toBeNull();
  });

  it("รหัสซ้ำไม่ได้", () => {
    expect(validateTaskType(base, ["SW09"])).toContain("ถูกใช้ไปแล้ว");
  });

  it("รหัสภาษาไทยหรือมีช่องว่างไม่ได้", () => {
    expect(validateTaskType({ ...base, code: "งาน 1" }, [])).toContain("รหัสประเภทงาน");
  });

  it("บังคับกรอกตัวเลขแต่ไม่ตั้งชื่อช่อง = ไม่ผ่าน", () => {
    expect(validateTaskType({ ...base, require_metric: true }, [])).toContain("ชื่อช่องตัวเลข");
  });

  it("เป้าหมายติดลบไม่ได้", () => {
    expect(validateTaskType({ ...base, daily_target: -1 }, [])).toContain("ไม่ติดลบ");
  });
});

describe("เงื่อนไขการลบประเภทงาน", () => {
  it("หัวข้อที่ยังมีงานย่อยลบไม่ได้", () => {
    expect(taskTypeBlockers(HEAD, TYPES, 0)).toContain("งานย่อย");
  });

  it("ประเภทงานที่ถูกใช้ในใบงานแล้ว แนะนำให้ปิดใช้งานแทน", () => {
    expect(taskTypeBlockers(FLYER, TYPES, 12)).toContain("ปิดใช้งาน");
  });

  it("ไม่มีงานย่อยและยังไม่เคยถูกใช้ = ลบได้", () => {
    expect(taskTypeBlockers(FLYER, TYPES, 0)).toBeNull();
  });
});

describe("ตรวจใบบันทึกงานประจำวัน", () => {
  it("บันทึกงานล่วงหน้าไม่ได้", () => {
    expect(validateWorkLog("2026-09-08", [], TYPES, false, TODAY)).toContain("ล่วงหน้า");
  });

  it("บรรทัดที่ยังไม่ทำ ปล่อยว่างได้ทั้งหมด", () => {
    const items = [item({ task_type_id: "fb" }), item({ task_type_id: "fl" })];
    expect(validateWorkLog(TODAY, items, TYPES, false, TODAY)).toBeNull();
  });

  it("งานที่บังคับตัวเลข ต้องมีค่ามากกว่า 0 เมื่อติ๊กว่าทำแล้ว", () => {
    const items = [item({ task_type_id: "fl", done: true, qty: 0 })];
    expect(validateWorkLog(TODAY, items, TYPES, false, TODAY)).toContain("จำนวนใบปลิวที่แจก");
  });

  it("งานที่บังคับแนบรูป ต้องมีไฟล์อย่างน้อย 1", () => {
    const items = [item({ task_type_id: "fb", done: true, qty: 250 })];
    expect(validateWorkLog(TODAY, items, TYPES, false, TODAY)).toContain("แนบรูปหรือคลิป");
  });

  it("ครบเงื่อนไขแล้วผ่าน", () => {
    const items = [
      item({
        task_type_id: "fb",
        done: true,
        qty: 250,
        media: [{ path: "sw/a.jpg", kind: "image", filename: null, mime: null, size_bytes: null }],
      }),
    ];
    expect(validateWorkLog(TODAY, items, TYPES, true, TODAY)).toBeNull();
  });

  it("กดส่งงานทั้งที่ยังไม่ติ๊กงานไหนเลย = ไม่ผ่าน แต่เก็บร่างได้", () => {
    const items = [item({ task_type_id: "fl" })];
    expect(validateWorkLog(TODAY, items, TYPES, true, TODAY)).toContain("ส่งงาน");
    expect(validateWorkLog(TODAY, items, TYPES, false, TODAY)).toBeNull();
  });

  it("ตัวเลขติดลบไม่ได้", () => {
    const items = [item({ task_type_id: "tt", done: true, qty: -5 })];
    expect(validateWorkLog(TODAY, items, TYPES, false, TODAY)).toContain("ติดลบ");
  });
});

describe("ความคืบหน้าของใบงาน", () => {
  it("นับเฉพาะบรรทัดที่ติ๊กแล้ว", () => {
    expect(progressOf([{ done: true }, { done: false }, { done: true }, { done: false }])).toEqual({
      done: 2,
      total: 4,
      pct: 50,
    });
  });

  it("ใบเปล่าไม่หารศูนย์", () => {
    expect(progressOf([])).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

describe("ลิงก์และชนิดไฟล์", () => {
  it("เติม https:// ให้ลิงก์ที่ผู้ใช้พิมพ์มาไม่ครบ", () => {
    expect(normalizeLink("www.facebook.com/post/1")).toBe("https://www.facebook.com/post/1");
  });

  it("ค่าที่ไม่ใช่ลิงก์คืน null", () => {
    expect(normalizeLink("   ")).toBeNull();
    expect(normalizeLink("javascript:alert(1)")).toBeNull();
  });

  it("แยกคลิปออกจากรูปด้วย mime", () => {
    expect(mediaKindOf("video/mp4")).toBe("video");
    expect(mediaKindOf("image/jpeg")).toBe("image");
    expect(mediaKindOf(null)).toBe("image");
  });
});

// ---------- Dashboard ----------

function statRow(over: Partial<ItemStatRow> & { owner_id: string; task_code: string }): ItemStatRow {
  return {
    task_type_id: null,
    task_name: over.task_code,
    metric_unit: "ใบ",
    done: true,
    qty: 10,
    media_count: 1,
    work_date: TODAY,
    owner_name: "พนักงาน",
    owner_full_name: null,
    branch_id: null,
    branch_name: "สำนักงานใหญ่",
    submitted_at: "2026-09-07T10:00:00Z",
    ...over,
  };
}

describe("สรุปผลงานรายคน", () => {
  const rows: ItemStatRow[] = [
    statRow({ owner_id: "u1", task_code: "SW01", qty: 100, work_date: "2026-09-01" }),
    statRow({ owner_id: "u1", task_code: "SW04", qty: 20, work_date: "2026-09-01" }),
    statRow({ owner_id: "u1", task_code: "SW01", qty: 50, work_date: "2026-09-02", submitted_at: null }),
    statRow({ owner_id: "u1", task_code: "SW04", done: false, qty: null, work_date: "2026-09-02", submitted_at: null }),
    statRow({ owner_id: "u2", task_code: "SW01", qty: 30, work_date: "2026-09-01", owner_name: "บี" }),
  ];

  it("รวมตัวเลขแยกตามประเภทงาน และนับวันที่ทำงานแบบไม่ซ้ำ", () => {
    const [u1] = buildStaffSummaries(rows);
    expect(u1.owner_id).toBe("u1");
    expect(u1.days).toBe(2);
    expect(u1.qtyByTask).toEqual({ SW01: 150, SW04: 20 });
  });

  it("นับเฉพาะวันที่ส่งงานแล้วใน submittedDays", () => {
    const [u1] = buildStaffSummaries(rows);
    expect(u1.submittedDays).toBe(1);
  });

  it("ไม่รวมตัวเลขของบรรทัดที่ยังไม่ได้ทำ และคิด % งานที่ทำ", () => {
    const [u1] = buildStaffSummaries(rows);
    expect(u1.doneCount).toBe(3);
    expect(u1.itemCount).toBe(4);
    expect(u1.donePct).toBe(75);
  });

  it("เรียงจากคนที่ทำงานมากที่สุดลงมา", () => {
    expect(buildStaffSummaries(rows).map((s) => s.owner_id)).toEqual(["u1", "u2"]);
  });
});

describe("สรุปผลงานรายประเภทงาน", () => {
  it("รวมจำนวนครั้ง ตัวเลข และจำนวนคนที่ทำงานนั้น", () => {
    const rows = [
      statRow({ owner_id: "u1", task_code: "SW01", qty: 100 }),
      statRow({ owner_id: "u2", task_code: "SW01", qty: 30 }),
      statRow({ owner_id: "u1", task_code: "SW04", done: false, qty: null }),
    ];
    const [flyer, chat] = buildTaskSummaries(rows);
    expect(flyer).toMatchObject({ task_code: "SW01", doneCount: 2, qty: 130, staffCount: 2 });
    expect(chat).toMatchObject({ task_code: "SW04", doneCount: 0, qty: 0, staffCount: 0 });
  });
});

describe("เติมยอดขายจริงจากระบบขาย", () => {
  it("คนที่จับคู่แล้วได้ยอดขาย คนที่ยังไม่จับคู่ได้ null", () => {
    const summaries = buildStaffSummaries([
      statRow({ owner_id: "u1", task_code: "SW01" }),
      statRow({ owner_id: "u2", task_code: "SW01" }),
    ]);
    const out = attachDb2Sales(
      summaries,
      new Map([["u1", "MN047"]]),
      new Map([["MN047", 12]]),
    );
    expect(out.find((s) => s.owner_id === "u1")).toMatchObject({ db2Salcod: "MN047", db2Units: 12 });
    expect(out.find((s) => s.owner_id === "u2")).toMatchObject({ db2Salcod: null, db2Units: null });
  });

  it("จับคู่แล้วแต่ช่วงนี้ยังไม่มียอดขาย = 0 ไม่ใช่ null", () => {
    const summaries = buildStaffSummaries([statRow({ owner_id: "u1", task_code: "SW01" })]);
    const out = attachDb2Sales(summaries, new Map([["u1", "MN999"]]), new Map());
    expect(out[0].db2Units).toBe(0);
  });
});

// ---------- จับคู่พนักงานขาย ----------

describe("จับคู่พนักงานขายกับระบบขาย", () => {
  it("รหัสพนักงานขายเก็บเป็นตัวพิมพ์ใหญ่ไม่มีช่องว่าง", () => {
    expect(normalizeSalcod(" mn047 ")).toBe("MN047");
  });

  it("หนึ่งรหัสจับคู่ได้กับบัญชีเดียว", () => {
    const existing = [{ employee_id: "u1", db2_salcod: "MN047" }];
    expect(validateMapping("u2", "MN047", existing)).toContain("ถูกจับคู่กับบัญชีอื่น");
    expect(validateMapping("u1", "MN047", existing)).toBeNull();
  });

  it("รหัสรูปแบบผิดไม่ผ่าน", () => {
    expect(validateMapping("u1", "MN 047!", [])).toContain("รหัสพนักงานขาย");
    expect(validateMapping("u1", "", [])).toContain("กรุณาเลือก");
  });

  it("ตัดคำนำหน้าชื่อออกก่อนเทียบ (คนละระบบพิมพ์คำนำหน้าไม่เหมือนกัน)", () => {
    const target = simplifyName("น้องนุช แผนสมบูรณ์");
    expect(simplifyName("น.ส. น้องนุช แผนสมบูรณ์")).toBe(target);
    expect(simplifyName("น.ส.น้องนุช แผนสมบูรณ์")).toBe(target);
    expect(simplifyName("นส.น้องนุช แผนสมบูรณ์")).toBe(target);
    expect(simplifyName("นางสาวน้องนุช แผนสมบูรณ์")).toBe(target);
  });
});

describe("เดาคู่ที่น่าจะใช่", () => {
  const rows: MapRow[] = [
    {
      employee_id: "u1",
      emp_code: "E01",
      full_name: "น.ส. น้องนุช แผนสมบูรณ์",
      access_level: "user",
      branch_name: null,
      is_active: true,
      db2_salcod: null,
      db2_name: null,
      note: null,
    },
    {
      employee_id: "u2",
      emp_code: "E02",
      full_name: "สมชาย ใจดี",
      access_level: "user",
      branch_name: null,
      is_active: true,
      db2_salcod: "MN001",
      db2_name: "สมชาย ใจดี",
      note: null,
    },
  ];

  it("เสนอเฉพาะบัญชีที่ยังไม่จับคู่ และชื่อตรงกันพอดี", () => {
    const guess = suggestMappings(rows, [
      { salcod: "MN156", name: "น้องนุช แผนสมบูรณ์", units: 162 },
      { salcod: "MN222", name: null, units: 180 },
    ]);
    expect(guess.get("u1")?.salcod).toBe("MN156");
    expect(guess.has("u2")).toBe(false);
  });

  it("ชื่อซ้ำกันหลายรหัสไม่เดาให้ (ต้องเลือกเอง)", () => {
    const guess = suggestMappings(rows, [
      { salcod: "MN156", name: "น้องนุช แผนสมบูรณ์", units: 162 },
      { salcod: "MN157", name: "น้องนุช แผนสมบูรณ์", units: 5 },
    ]);
    expect(guess.has("u1")).toBe(false);
  });

  it("ไม่เสนอรหัสที่ถูกจับคู่ไปแล้ว", () => {
    // u2 จับคู่ MN001 ไว้แล้ว — u1 ที่ชื่อพ้องกันจึงต้องไม่ถูกเสนอรหัสเดียวกัน
    const guess = suggestMappings(
      [{ ...rows[0], full_name: "สมชาย ใจดี" }, rows[1]],
      [{ salcod: "MN001", name: "สมชาย ใจดี", units: 10 }],
    );
    expect(guess.size).toBe(0);
  });
});
