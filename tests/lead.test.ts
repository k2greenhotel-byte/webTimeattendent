import { describe, expect, it } from "vitest";
import {
  applyFollowUp,
  buildOverview,
  buildRankings,
  canSeeAllLeads,
  channelNameOf,
  daysBetween,
  groupForBoard,
  hasNoPlan,
  isOverdue,
  isSilentHotLead,
  queryFromParams,
  rankByCloseRate,
  rateOf,
  staffNameOf,
  summarizeBySalesperson,
  validateFollowUp,
  validateLead,
} from "../src/lib/lead";
import type { Chance, LeadRow, WorkStatus } from "../src/lib/lead-types";

const TODAY = "2569-01-01".replace("2569", "2026"); // 2026-01-01 (พ.ศ. 2569)

function lead(over: Partial<LeadRow> = {}): LeadRow {
  return {
    id: over.id ?? "id-1",
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
    work_status: "follow_up",
    chance: "medium",
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
    ...over,
  };
}

describe("สิทธิ์การมองเห็น (ข้อ 2)", () => {
  it("พนักงานทั่วไปเห็นเฉพาะ Lead ของตัวเอง ส่วนระดับคุมทีมเห็นทั้งหมด", () => {
    expect(canSeeAllLeads("user")).toBe(false);
    expect(canSeeAllLeads("supervisor")).toBe(true);
    expect(canSeeAllLeads("assistant_admin")).toBe(true);
    expect(canSeeAllLeads("admin")).toBe(true);
  });
});

describe("validateLead", () => {
  const base = {
    lead_date: "2026-01-01",
    customer_name: "ลูกค้า ก",
    phone: "0812345678",
    work_status: "follow_up" as WorkStatus,
    sale_contract_no: null,
    sale_date: null,
    next_follow_date: null,
  };

  it("ค่าครบถ้วนผ่าน", () => {
    expect(validateLead(base)).toBeNull();
  });

  it("ต้องเลือกลูกค้า", () => {
    expect(validateLead({ ...base, customer_name: "  " })).toContain("ชื่อลูกค้า");
  });

  it("เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก", () => {
    expect(validateLead({ ...base, phone: "081-234-5678" })).toContain("เบอร์โทร");
    expect(validateLead({ ...base, phone: "021234567" })).toBeNull();
  });

  it("ปิดการขายต้องมีเลขที่สัญญาขายและวันที่ขาย", () => {
    expect(validateLead({ ...base, work_status: "closed_won" })).toContain("เลขที่สัญญาขาย");
    expect(
      validateLead({
        ...base,
        work_status: "closed_won",
        sale_contract_no: "S-001",
        sale_date: "2026-01-05",
      }),
    ).toBeNull();
  });

  it("วันนัดติดตามต้องไม่ก่อนวันที่รับ Lead", () => {
    expect(validateLead({ ...base, next_follow_date: "2025-12-31" })).toContain("ติดตามต่อ");
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
    expect(validateFollowUp({ ...base, detail: "" })).toContain("รายละเอียด");
    expect(validateFollowUp(base)).toBeNull();
  });

  it("ปิดการขายต้องมีเลขที่สัญญาขาย", () => {
    expect(validateFollowUp({ ...base, work_status: "closed_won" })).toContain("เลขที่สัญญาขาย");
  });
});

describe("applyFollowUp", () => {
  it("ช่องที่ไม่ได้เลือก (null) แปลว่าไม่เปลี่ยนสถานะเดิม", () => {
    const patch = applyFollowUp({
      work_status: null,
      chance: null,
      next_follow_date: "2026-01-10",
      sale_contract_no: null,
      sale_date: null,
    });
    expect(patch.work_status).toBeUndefined();
    expect(patch.chance).toBeUndefined();
    expect(patch.next_follow_date).toBe("2026-01-10");
  });

  it("เลือกสถานะใหม่แล้วเขียนทับ", () => {
    const patch = applyFollowUp({
      work_status: "dropped",
      chance: "low",
      next_follow_date: null,
      sale_contract_no: null,
      sale_date: null,
    });
    expect(patch.work_status).toBe("dropped");
    expect(patch.chance).toBe("low");
    expect(patch.next_follow_date).toBeNull();
  });

  it("กรอกเลขที่สัญญาขายแล้วปิดการขายให้อัตโนมัติ", () => {
    const patch = applyFollowUp({
      work_status: null,
      chance: null,
      next_follow_date: null,
      sale_contract_no: "S-2569-001",
      sale_date: "2026-01-09",
    });
    expect(patch.work_status).toBe("closed_won");
    expect(patch.sale_date).toBe("2026-01-09");
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

  it("โอกาสสูงแต่เงียบเกิน 7 วัน", () => {
    const row = lead({ chance: "high", lead_date: "2025-12-20", last_follow_date: null });
    expect(isSilentHotLead(row, TODAY)).toBe(true);
    expect(isSilentHotLead(lead({ chance: "high", last_follow_date: "2025-12-30" }), TODAY)).toBe(false);
    expect(isSilentHotLead(lead({ chance: "low", lead_date: "2025-01-01" }), TODAY)).toBe(false);
  });

  it("daysBetween นับวันตรงไปตรงมา", () => {
    expect(daysBetween("2026-01-01", "2026-01-11")).toBe(10);
    expect(daysBetween("2026-01-11", "2026-01-01")).toBe(-10);
  });
});

describe("กระดานติดตาม (หน้าจอ 2)", () => {
  it("แยกตามสถานะงานแล้วซอยตามสถานะโอกาส", () => {
    const rows = [
      lead({ id: "1", chance: "high" }),
      lead({ id: "2", chance: "low" }),
      lead({ id: "3", work_status: "dropped", chance: "low" }),
    ];
    const board = groupForBoard(rows, TODAY);

    const followUp = board.find((c) => c.status === "follow_up");
    expect(followUp?.total).toBe(2);
    expect(followUp?.groups.find((g) => g.chance === "high")?.rows).toHaveLength(1);
    expect(followUp?.groups.find((g) => g.chance === "medium")?.rows).toHaveLength(0);
    expect(board.find((c) => c.status === "dropped")?.total).toBe(1);
  });

  it("ใบที่เลยนัดขึ้นก่อนใบที่นัดไว้วันหน้า", () => {
    const rows = [
      lead({ id: "future", chance: "high", next_follow_date: "2026-02-01" }),
      lead({ id: "overdue", chance: "high", next_follow_date: "2025-12-01" }),
      lead({ id: "noplan", chance: "high", next_follow_date: null }),
    ];
    const group = groupForBoard(rows, TODAY)[0].groups.find((g) => g.chance === "high");
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
    const overview = buildOverview(rows, TODAY);

    expect(overview.total).toBe(4);
    expect(overview.closed).toBe(1);
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

describe("ช่องทางการติดต่อ", () => {
  it("เลือกอื่นๆ แล้วระบุเอง ให้แสดงข้อความที่ระบุด้วย", () => {
    expect(channelNameOf({ channel_name: "อื่นๆ", channel_other: "งานวัด" })).toBe("อื่นๆ: งานวัด");
    expect(channelNameOf({ channel_name: "Line", channel_other: null })).toBe("Line");
    expect(channelNameOf({ channel_name: null, channel_other: null })).toContain("ไม่ระบุ");
  });
});

describe("queryFromParams", () => {
  it("ตัดค่าที่ไม่อยู่ในชุดตัวเลือกทิ้ง", () => {
    const q = queryFromParams({ status: "ไม่มีสถานะนี้", chance: "high", overdue: "1", q: " ฮอนด้า " });
    expect(q.work_status).toBeNull();
    expect(q.chance).toBe<Chance>("high");
    expect(q.overdue_only).toBe(true);
    expect(q.keyword).toBe("ฮอนด้า");
  });
});
