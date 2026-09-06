import { describe, expect, it } from "vitest";
import {
  applyFollowUp,
  buildOverview,
  buildRankings,
  canSeeAllLeads,
  chanceNameOf,
  channelNameOf,
  daysBetween,
  defaultChanceCode,
  defaultStatusCode,
  groupForBoard,
  hasNoPlan,
  hotChanceCode,
  isOverdue,
  isSilentHotLead,
  kindOf,
  lastActiveOfKind,
  normalizeStatusCode,
  queryFromParams,
  rankByCloseRate,
  rateOf,
  selectableStatuses,
  staffNameOf,
  statusNameOf,
  summarizeBySalesperson,
  validateFollowUp,
  validateLead,
  validateStatusInput,
} from "../src/lib/lead";
import type { ChanceOption, LeadRow, WorkStatusOption } from "../src/lib/lead-types";

const TODAY = "2026-01-01"; // พ.ศ. 2569

/** ชุดสถานะตั้งต้นเหมือนที่ migration seed ไว้ */
const STATUSES: WorkStatusOption[] = [
  { code: "follow_up", name: "ติดตามอีกครั้ง", kind: "open", color: "sky", sort_order: 10, is_active: true, is_system: true },
  { code: "closed_won", name: "ปิดการขายแล้ว", kind: "won", color: "emerald", sort_order: 20, is_active: true, is_system: true },
  { code: "bought_other", name: "ได้รถที่อื่นแล้ว", kind: "lost", color: "orange", sort_order: 30, is_active: true, is_system: true },
  { code: "dropped", name: "ไม่เอาแล้ว", kind: "lost", color: "slate", sort_order: 40, is_active: true, is_system: true },
];

const CHANCES: ChanceOption[] = [
  { code: "high", name: "สูง", color: "emerald", sort_order: 10, is_active: true, is_system: true },
  { code: "medium", name: "กลาง", color: "amber", sort_order: 20, is_active: true, is_system: true },
  { code: "low", name: "น้อย", color: "rose", sort_order: 30, is_active: true, is_system: true },
];

function statusFields(code: string) {
  const s = STATUSES.find((x) => x.code === code);
  return {
    work_status: code,
    work_status_name: s?.name ?? null,
    work_status_kind: s?.kind ?? null,
    work_status_color: s?.color ?? null,
    work_status_sort: s?.sort_order ?? null,
  };
}

function lead(over: Partial<LeadRow> = {}): LeadRow {
  const base: LeadRow = {
    id: "id-1",
    doc_no: "LD-2569-0001",
    lead_date: "2026-01-01",
    owner_id: "emp-1",
    owner_name: "สมชาย",
    customer_id: "cus-1",
    customer_name: "ลูกค้า ก",
    phone: "0812345678",
    brand_id: "b-1",
    model_id: "m-1",
    note: null,
    channel_id: "ch-1",
    channel_other: null,
    ...statusFields("follow_up"),
    chance: "medium",
    chance_name: "กลาง",
    chance_color: "amber",
    chance_sort: 20,
    next_follow_date: null,
    sale_contract_no: null,
    sale_date: null,
    branch_id: "br-1",
    company_id: null,
    created_by: "emp-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    customer_code: "C000001",
    channel_name: "Facebook",
    branch_name: "สาขาหลัก",
    company_name: null,
    brand_name: "Honda",
    model_name: "Wave 110i",
    owner_full_name: "สมชาย ใจดี",
    follow_count: 0,
    last_follow_date: null,
  };

  // เปลี่ยนสถานะงานให้ลาก name/kind/color ตามไปด้วย เหมือนที่ view join มาให้
  const withStatus = over.work_status ? { ...base, ...statusFields(over.work_status) } : base;
  return { ...withStatus, ...over };
}

describe("สิทธิ์การมองเห็น (ข้อ 2)", () => {
  it("พนักงานทั่วไปเห็นเฉพาะ Lead ของตัวเอง ส่วนระดับคุมทีมเห็นทั้งหมด", () => {
    expect(canSeeAllLeads("user")).toBe(false);
    expect(canSeeAllLeads("supervisor")).toBe(true);
    expect(canSeeAllLeads("assistant_admin")).toBe(true);
    expect(canSeeAllLeads("admin")).toBe(true);
  });
});

describe("ตารางสถานะที่ตั้งค่าได้", () => {
  it("อ่านพฤติกรรมจากรหัส · รหัสที่ไม่รู้จักถือว่ายังต้องติดตาม", () => {
    expect(kindOf(STATUSES, "closed_won")).toBe("won");
    expect(kindOf(STATUSES, "dropped")).toBe("lost");
    expect(kindOf(STATUSES, "ไม่มีรหัสนี้")).toBe("open");
  });

  it("ค่าตั้งต้นของใบใหม่: สถานะ open ตัวแรก และโอกาสระดับกลาง", () => {
    expect(defaultStatusCode(STATUSES)).toBe("follow_up");
    expect(defaultChanceCode(CHANCES)).toBe("medium");
    expect(hotChanceCode(CHANCES)).toBe("high");
  });

  it("สถานะที่ปิดใช้งานแล้วยังเลือกได้ ถ้าใบนั้นใช้อยู่", () => {
    const withClosed = STATUSES.map((s) =>
      s.code === "dropped" ? { ...s, is_active: false } : s,
    );
    expect(selectableStatuses(withClosed).map((s) => s.code)).not.toContain("dropped");
    expect(selectableStatuses(withClosed, "dropped").map((s) => s.code)).toContain("dropped");
  });

  it("ปิดใช้งานตัวสุดท้ายของกลุ่มไม่ได้ แต่ตัวที่มีเพื่อนในกลุ่มได้", () => {
    expect(lastActiveOfKind(STATUSES, "follow_up")).toBe(true); // open มีตัวเดียว
    expect(lastActiveOfKind(STATUSES, "dropped")).toBe(false); // lost มีสองตัว
  });

  it("รหัสสถานะถูกจัดรูปเป็นอังกฤษพิมพ์เล็กเสมอ", () => {
    expect(normalizeStatusCode(" Wait Finance ")).toBe("wait_finance");
    expect(normalizeStatusCode("รอไฟแนนซ์")).toBe("");
  });

  it("ตรวจค่าที่กรอกในหน้าตั้งค่า", () => {
    expect(validateStatusInput({ code: "", name: "ก", sort_order: 1 })).toContain("รหัส");
    expect(validateStatusInput({ code: "x", name: " ", sort_order: 1 })).toContain("ชื่อ");
    expect(validateStatusInput({ code: "x", name: "ก", sort_order: -1 })).toContain("ลำดับ");
    expect(validateStatusInput({ code: "x", name: "ก", sort_order: 10 })).toBeNull();
  });
});

describe("validateLead", () => {
  const base = {
    lead_date: "2026-01-01",
    customer_name: "ลูกค้า ก",
    phone: "0812345678",
    work_status: "follow_up",
    chance: "medium",
    sale_contract_no: null,
    sale_date: null,
    next_follow_date: null,
  };

  it("ค่าครบถ้วนผ่าน", () => {
    expect(validateLead(base, STATUSES)).toBeNull();
  });

  it("ต้องเลือกลูกค้าและสถานะ", () => {
    expect(validateLead({ ...base, customer_name: "  " }, STATUSES)).toContain("ชื่อลูกค้า");
    expect(validateLead({ ...base, work_status: "" }, STATUSES)).toContain("สถานะงาน");
    expect(validateLead({ ...base, chance: "" }, STATUSES)).toContain("โอกาส");
  });

  it("เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก", () => {
    expect(validateLead({ ...base, phone: "081-234-5678" }, STATUSES)).toContain("เบอร์โทร");
    expect(validateLead({ ...base, phone: "021234567" }, STATUSES)).toBeNull();
  });

  it("สถานะที่ปิดการขายได้ ต้องมีเลขที่สัญญาขายและวันที่ขาย", () => {
    expect(validateLead({ ...base, work_status: "closed_won" }, STATUSES)).toContain(
      "เลขที่สัญญาขาย",
    );
    expect(
      validateLead(
        {
          ...base,
          work_status: "closed_won",
          sale_contract_no: "S-001",
          sale_date: "2026-01-05",
        },
        STATUSES,
      ),
    ).toBeNull();
  });

  it("สถานะที่เพิ่มเองแบบ won ก็ถูกบังคับเหมือนกัน", () => {
    const custom: WorkStatusOption[] = [
      ...STATUSES,
      { code: "sold_cash", name: "ขายสด", kind: "won", color: "teal", sort_order: 25, is_active: true, is_system: false },
    ];
    expect(validateLead({ ...base, work_status: "sold_cash" }, custom)).toContain("เลขที่สัญญาขาย");
  });

  it("วันนัดติดตามต้องไม่ก่อนวันที่รับ Lead", () => {
    expect(validateLead({ ...base, next_follow_date: "2025-12-31" }, STATUSES)).toContain(
      "ติดตามต่อ",
    );
  });
});

describe("validateFollowUp", () => {
  const base = {
    follow_date: "2026-01-05",
    detail: "โทรแล้ว ลูกค้าขอคิดดูก่อน",
    work_status: null,
    sale_contract_no: null,
    sale_date: null,
    next_follow_date: null,
  };

  it("ต้องกรอกรายละเอียดผลการติดตาม", () => {
    expect(validateFollowUp({ ...base, detail: "" }, STATUSES)).toContain("รายละเอียด");
    expect(validateFollowUp(base, STATUSES)).toBeNull();
  });

  it("ปิดการขายต้องมีเลขที่สัญญาขาย", () => {
    expect(validateFollowUp({ ...base, work_status: "closed_won" }, STATUSES)).toContain(
      "เลขที่สัญญาขาย",
    );
  });
});

describe("applyFollowUp", () => {
  it("ช่องที่ไม่ได้เลือก (null) แปลว่าไม่เปลี่ยนสถานะเดิม", () => {
    const patch = applyFollowUp(
      {
        work_status: null,
        chance: null,
        next_follow_date: "2026-01-10",
        sale_contract_no: null,
        sale_date: null,
      },
      STATUSES,
    );
    expect(patch.work_status).toBeUndefined();
    expect(patch.chance).toBeUndefined();
    expect(patch.next_follow_date).toBe("2026-01-10");
  });

  it("เลือกสถานะใหม่แล้วเขียนทับ", () => {
    const patch = applyFollowUp(
      {
        work_status: "dropped",
        chance: "low",
        next_follow_date: null,
        sale_contract_no: null,
        sale_date: null,
      },
      STATUSES,
    );
    expect(patch.work_status).toBe("dropped");
    expect(patch.chance).toBe("low");
    expect(patch.next_follow_date).toBeNull();
  });

  it("กรอกเลขที่สัญญาขายแล้วเปลี่ยนเป็นสถานะกลุ่มปิดการขายให้อัตโนมัติ", () => {
    const patch = applyFollowUp(
      {
        work_status: null,
        chance: null,
        next_follow_date: null,
        sale_contract_no: "S-2569-001",
        sale_date: "2026-01-09",
      },
      STATUSES,
    );
    expect(patch.work_status).toBe("closed_won");
    expect(patch.sale_date).toBe("2026-01-09");
  });

  it("เลือกสถานะ won ที่เพิ่มเองมาแล้ว ไม่ถูกเปลี่ยนทับ", () => {
    const custom: WorkStatusOption[] = [
      ...STATUSES,
      { code: "sold_cash", name: "ขายสด", kind: "won", color: "teal", sort_order: 25, is_active: true, is_system: false },
    ];
    const patch = applyFollowUp(
      {
        work_status: "sold_cash",
        chance: null,
        next_follow_date: null,
        sale_contract_no: "S-2569-002",
        sale_date: "2026-01-09",
      },
      custom,
    );
    expect(patch.work_status).toBe("sold_cash");
  });
});

describe("สถานะที่ต้องรีบทำ", () => {
  it("เลยวันนัดแล้วถือว่าค้าง แต่วันนี้พอดียังไม่ค้าง", () => {
    expect(isOverdue(lead({ next_follow_date: "2025-12-31" }), TODAY)).toBe(true);
    expect(isOverdue(lead({ next_follow_date: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(lead({ next_follow_date: "2026-01-02" }), TODAY)).toBe(false);
  });

  it("งานที่จบแล้วไม่นับว่าค้างติดตาม", () => {
    expect(
      isOverdue(lead({ work_status: "closed_won", next_follow_date: "2025-12-01" }), TODAY),
    ).toBe(false);
  });

  it("ยังต้องตามต่อแต่ไม่ได้นัดวันไว้ = ไม่มีแผน", () => {
    expect(hasNoPlan(lead())).toBe(true);
    expect(hasNoPlan(lead({ next_follow_date: "2026-02-01" }))).toBe(false);
  });

  it("โอกาสสูงสุดแต่เงียบเกิน 7 วัน", () => {
    const row = lead({ chance: "high", lead_date: "2025-12-20", last_follow_date: null });
    expect(isSilentHotLead(row, TODAY, "high")).toBe(true);
    expect(isSilentHotLead(lead({ chance: "high", last_follow_date: "2025-12-30" }), TODAY, "high")).toBe(
      false,
    );
    expect(isSilentHotLead(lead({ chance: "low", lead_date: "2025-01-01" }), TODAY, "high")).toBe(
      false,
    );
  });

  it("daysBetween นับวันตรงไปตรงมา", () => {
    expect(daysBetween("2026-01-01", "2026-01-11")).toBe(10);
    expect(daysBetween("2026-01-11", "2026-01-01")).toBe(-10);
  });
});

describe("กระดานติดตาม (หน้าจอ 2)", () => {
  it("แยกตามสถานะงานแล้วซอยตามสถานะโอกาส ตามลำดับที่ตั้งไว้", () => {
    const rows = [
      lead({ id: "1", chance: "high" }),
      lead({ id: "2", chance: "low" }),
      lead({ id: "3", work_status: "dropped", chance: "low" }),
    ];
    const board = groupForBoard(rows, STATUSES, CHANCES, TODAY);

    expect(board.map((c) => c.status.code)).toEqual([
      "follow_up",
      "closed_won",
      "bought_other",
      "dropped",
    ]);

    const followUp = board[0];
    expect(followUp.total).toBe(2);
    expect(followUp.groups.find((g) => g.chance.code === "high")?.rows).toHaveLength(1);
    expect(followUp.groups.find((g) => g.chance.code === "medium")?.rows).toHaveLength(0);
    expect(board.find((c) => c.status.code === "dropped")?.total).toBe(1);
  });

  it("สถานะที่ปิดใช้งานแล้วยังขึ้นเป็นคอลัมน์ ถ้ายังมีใบค้างอยู่", () => {
    const off = STATUSES.map((s) => (s.code === "dropped" ? { ...s, is_active: false } : s));
    const board = groupForBoard([lead({ work_status: "dropped" })], off, CHANCES, TODAY);
    expect(board.map((c) => c.status.code)).toContain("dropped");
  });

  it("ใบที่เลยนัดขึ้นก่อนใบที่นัดไว้วันหน้า", () => {
    const rows = [
      lead({ id: "future", chance: "high", next_follow_date: "2026-02-01" }),
      lead({ id: "overdue", chance: "high", next_follow_date: "2025-12-01" }),
      lead({ id: "noplan", chance: "high", next_follow_date: null }),
    ];
    const group = groupForBoard(rows, STATUSES, CHANCES, TODAY)[0].groups.find(
      (g) => g.chance.code === "high",
    );
    expect(group?.rows.map((r) => r.id)).toEqual(["overdue", "future", "noplan"]);
  });
});

describe("ภาพรวมและอัตราการปิดการขาย", () => {
  it("ไม่มี Lead เลย อัตราปิดการขายต้องเป็น 0 ไม่ใช่ NaN", () => {
    const overview = buildOverview([], TODAY);
    expect(overview.total).toBe(0);
    expect(overview.closeRate).toBe(0);
    expect(overview.avgFollowPerLead).toBe(0);
    expect(overview.avgDaysToClose).toBe(0);
  });

  it("rateOf ปัดทศนิยม 1 ตำแหน่ง", () => {
    expect(rateOf(1, 3)).toBe(33.3);
    expect(rateOf(0, 0)).toBe(0);
  });

  it("นับสถานะ อัตราปิด และวันเฉลี่ยถึงปิดการขาย", () => {
    const rows = [
      lead({ id: "1", work_status: "closed_won", sale_date: "2026-01-11", follow_count: 3 }),
      lead({ id: "2", follow_count: 1, next_follow_date: "2025-12-01" }),
      lead({ id: "3", work_status: "dropped" }),
      lead({ id: "4", work_status: "bought_other" }),
    ];
    const overview = buildOverview(rows, TODAY, "high");

    expect(overview.total).toBe(4);
    expect(overview.closed).toBe(1);
    expect(overview.open).toBe(1);
    expect(overview.closeRate).toBe(25);
    expect(overview.byStatus.dropped).toBe(1);
    expect(overview.overdue).toBe(1);
    expect(overview.avgFollowPerLead).toBe(1);
    expect(overview.avgDaysToClose).toBe(10);
  });
});

describe("อันดับ 10 อันดับแรก", () => {
  it("ตัดที่ 10 อันดับ และเรียงจากมากไปน้อย", () => {
    const rows: LeadRow[] = [];
    for (let i = 0; i < 12; i += 1) {
      // รุ่นที่ i มี (12 - i) ใบ — รุ่นแรกมากสุด
      for (let n = 0; n < 12 - i; n += 1) {
        rows.push(lead({ id: `${i}-${n}`, model_name: `รุ่น ${i}` }));
      }
    }
    const { topModels } = buildRankings(rows);
    expect(topModels).toHaveLength(10);
    expect(topModels[0]).toEqual({ label: "รุ่น 0", count: 12 });
    expect(topModels[9].label).toBe("รุ่น 9");
  });

  it("ไม่ระบุรุ่น/พนักงาน/ช่องทาง ใช้ข้อความแทน ไม่ตกหล่น", () => {
    const { topModels, topStaff, topChannels } = buildRankings([
      lead({ model_name: null, owner_name: null, owner_full_name: null, channel_name: null }),
    ]);
    expect(topModels[0].label).toContain("ไม่ระบุ");
    expect(topStaff[0].label).toContain("ไม่ระบุ");
    expect(topChannels[0].label).toContain("ไม่ระบุ");
  });
});

describe("สรุปตามพนักงานขาย", () => {
  it("คิดอัตราปิดการขายรายคน และเรียงจาก Lead มากไปน้อย", () => {
    const rows = [
      lead({ id: "1", owner_name: "เอ", work_status: "closed_won", sale_date: "2026-01-06" }),
      lead({ id: "2", owner_name: "เอ" }),
      lead({ id: "3", owner_name: "เอ", work_status: "dropped" }),
      lead({ id: "4", owner_name: "บี", work_status: "closed_won", sale_date: "2026-01-03" }),
    ];
    const summary = summarizeBySalesperson(rows, TODAY);

    expect(summary.map((s) => s.label)).toEqual(["เอ", "บี"]);
    expect(summary[0].closeRate).toBe(33.3);
    expect(summary[1].closeRate).toBe(100);

    // เรียงตามอัตราปิดการขาย บี ต้องขึ้นก่อน
    expect(rankByCloseRate(summary)[0].label).toBe("บี");
  });

  it("ใช้ชื่อบนใบก่อน แล้วค่อยถอยไปใช้ชื่อบัญชี", () => {
    expect(staffNameOf({ owner_name: "  ", owner_full_name: "สมหญิง" })).toBe("สมหญิง");
    expect(staffNameOf({ owner_name: "สมชาย", owner_full_name: "สมชาย ใจดี" })).toBe("สมชาย");
  });
});

describe("ชื่อที่ใช้แสดง", () => {
  it("ช่องทาง: เลือกอื่นๆ แล้วระบุเอง ให้แสดงข้อความที่ระบุด้วย", () => {
    expect(channelNameOf({ channel_name: "อื่นๆ", channel_other: "งานวัด" })).toBe("อื่นๆ: งานวัด");
    expect(channelNameOf({ channel_name: "Line", channel_other: null })).toBe("Line");
    expect(channelNameOf({ channel_name: null, channel_other: null })).toContain("ไม่ระบุ");
  });

  it("สถานะที่ถูกลบไปแล้ว ยังอ่านออกว่าเป็นรหัสอะไร", () => {
    expect(statusNameOf({ work_status: "wait_finance", work_status_name: null })).toBe(
      "wait_finance",
    );
    expect(chanceNameOf({ chance: "high", chance_name: "สูง" })).toBe("สูง");
  });
});

describe("queryFromParams", () => {
  it("ตัดรหัสสถานะที่ไม่มีอยู่จริงทิ้ง", () => {
    const q = queryFromParams(
      { status: "ไม่มีสถานะนี้", chance: "high", overdue: "1", q: " ฮอนด้า " },
      { statuses: STATUSES, chances: CHANCES },
    );
    expect(q.work_status).toBeNull();
    expect(q.chance).toBe("high");
    expect(q.overdue_only).toBe(true);
    expect(q.keyword).toBe("ฮอนด้า");
  });

  it("ไม่ได้ส่งรายการสถานะมา ก็ยังรับค่าที่กรอกได้ (ใช้ตอน export)", () => {
    expect(queryFromParams({ status: "wait_finance" }).work_status).toBe("wait_finance");
  });
});
