import { describe, expect, it } from "vitest";
import {
  assertPhotoPaths,
  buddhistYearOf,
  canReceive,
  canSubmit,
  computeFlowStatus,
  countByFlowStatus,
  filterRows,
  formatDocNo,
  groupTotals,
  monthKeyOf,
  outstandingAmount,
  parseAmount,
  summarize,
  assertMemoPeriod,
  isPeriodExpired,
  summarizeMemos,
  groupMemoCounts,
  filterMemos,
  assertMemoFilePaths,
  formatPeriod,
} from "../src/lib/marketing";
import type { MktActivityRow, MktMemoRow } from "../src/lib/marketing-types";

function row(patch: Partial<MktActivityRow> = {}): MktActivityRow {
  return {
    id: "a1",
    doc_no: "MK-2569-0001",
    activity_date: "2026-08-15",
    title: "ออกบูธห้างเซ็นทรัล",
    memo: null,
    request_amount: 10_000,
    approved_amount: null,
    active_status: "active",
    flow_status: "draft",
    activity_type_id: "t1",
    activity_type_name: "ออกบูธแสดงรถ",
    company_id: "c1",
    company_name: "โตโยต้า",
    created_by_staff_id: "s1",
    created_by_name: "สมชาย",
    submission_id: null,
    submit_date: null,
    postal_no: null,
    letter_photo_path: null,
    ack_photo_path: null,
    submission_status: null,
    submitted_by_name: null,
    receipt_id: null,
    receive_date: null,
    receipt_no: null,
    received_amount: null,
    receipt_status: null,
    received_by_name: null,
    ...patch,
  };
}

describe("computeFlowStatus", () => {
  it("ยังไม่ส่งเบิก = ทำเรื่องตั้งเบิก", () => {
    expect(computeFlowStatus({ hasActiveSubmission: false, hasActiveReceipt: false })).toBe("draft");
  });

  it("ส่งเบิกแล้วแต่ยังไม่รับเงิน", () => {
    expect(computeFlowStatus({ hasActiveSubmission: true, hasActiveReceipt: false })).toBe(
      "submitted",
    );
  });

  it("รับเงินแล้วมาก่อนเสมอ", () => {
    expect(computeFlowStatus({ hasActiveSubmission: true, hasActiveReceipt: true })).toBe(
      "received",
    );
  });

  it("ยกเลิกใบส่งเบิกแล้วสถานะถอยกลับ", () => {
    expect(computeFlowStatus({ hasActiveSubmission: false, hasActiveReceipt: false })).toBe("draft");
  });
});

describe("canSubmit / canReceive", () => {
  it("ใบที่ยกเลิกแล้วทำอะไรต่อไม่ได้", () => {
    const cancelled = { active_status: "cancelled" as const, flow_status: "draft" as const };
    expect(canSubmit(cancelled).ok).toBe(false);
    expect(canReceive(cancelled).ok).toBe(false);
  });

  it("ยังไม่ส่งเบิก บันทึกรับเงินไม่ได้", () => {
    const result = canReceive({ active_status: "active", flow_status: "draft" });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("ส่งเรื่องเบิกเงินก่อน");
  });

  it("ส่งเบิกแล้วรับเงินได้", () => {
    expect(canReceive({ active_status: "active", flow_status: "submitted" }).ok).toBe(true);
  });

  it("รับเงินแล้วแก้การส่งเบิกไม่ได้", () => {
    expect(canSubmit({ active_status: "active", flow_status: "received" }).ok).toBe(false);
  });
});

describe("parseAmount", () => {
  it("รับตัวเลขที่มีเครื่องหมายคั่นหลักพัน", () => {
    expect(parseAmount("12,500.50")).toBe(12_500.5);
    expect(parseAmount(" 1 000 ")).toBe(1000);
    expect(parseAmount("฿250")).toBe(250);
  });

  it("เว้นว่าง = ไม่ระบุ", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });

  it("ปัดเป็นทศนิยม 2 ตำแหน่ง", () => {
    expect(parseAmount("100.005")).toBe(100.01);
  });

  it("ไม่รับค่าติดลบหรือไม่ใช่ตัวเลข", () => {
    expect(() => parseAmount("-5")).toThrow();
    expect(() => parseAmount("abc")).toThrow();
  });
});

describe("ยอดคงค้าง", () => {
  it("ยังไม่รับเงิน = ค้างเต็มจำนวนที่ขอ", () => {
    expect(outstandingAmount(row())).toBe(10_000);
  });

  it("มียอดอนุมัติให้ใช้ยอดอนุมัติ", () => {
    expect(outstandingAmount(row({ approved_amount: 8000 }))).toBe(8000);
  });

  it("หักยอดที่รับมาแล้ว", () => {
    expect(
      outstandingAmount(row({ approved_amount: 8000, received_amount: 5000, receipt_status: "active" })),
    ).toBe(3000);
  });

  it("ใบรับเงินที่ถูกยกเลิกไม่นับเป็นเงินที่ได้รับ", () => {
    expect(
      outstandingAmount(row({ received_amount: 5000, receipt_status: "cancelled" })),
    ).toBe(10_000);
  });

  it("ใบกิจกรรมที่ยกเลิกไม่มียอดค้าง", () => {
    expect(outstandingAmount(row({ active_status: "cancelled" }))).toBe(0);
  });
});

describe("summarize", () => {
  const rows = [
    row({ id: "1", request_amount: 10_000, approved_amount: 9000, received_amount: 9000, receipt_status: "active", flow_status: "received" }),
    row({ id: "2", request_amount: 5000, flow_status: "submitted" }),
    row({ id: "3", request_amount: 3000, active_status: "cancelled" }),
  ];

  it("ใบที่ยกเลิกนับจำนวนแต่ไม่นับเงิน", () => {
    const t = summarize(rows);
    expect(t.count).toBe(3);
    expect(t.request).toBe(15_000);
    expect(t.approved).toBe(9000);
    expect(t.received).toBe(9000);
    expect(t.outstanding).toBe(5000);
  });

  it("นับจำนวนตามสถานะ (ไม่รวมใบยกเลิก)", () => {
    expect(countByFlowStatus(rows)).toEqual({ draft: 0, submitted: 1, received: 1 });
  });
});

describe("groupTotals / monthKeyOf", () => {
  it("จัดกลุ่มตามบริษัทและเรียงยอดมากไปน้อย", () => {
    const groups = groupTotals(
      [
        row({ id: "1", company_id: "c1", company_name: "โตโยต้า", request_amount: 1000 }),
        row({ id: "2", company_id: "c2", company_name: "ฮอนด้า", request_amount: 4000 }),
        row({ id: "3", company_id: "c1", company_name: "โตโยต้า", request_amount: 2000 }),
      ],
      (r) => ({ key: r.company_id ?? "-", label: r.company_name ?? "ไม่ระบุ" }),
    );

    expect(groups.map((g) => g.label)).toEqual(["ฮอนด้า", "โตโยต้า"]);
    expect(groups[1].request).toBe(3000);
    expect(groups[1].count).toBe(2);
  });

  it("คีย์รายเดือนเป็น พ.ศ.", () => {
    expect(monthKeyOf("2026-08-15")).toBe("2569-08");
  });
});

describe("filterRows", () => {
  const rows = [
    row({ id: "1", activity_date: "2026-08-01", flow_status: "draft", company_id: "c1" }),
    row({ id: "2", activity_date: "2026-09-10", flow_status: "received", company_id: "c2", doc_no: "MK-2569-0002" }),
  ];

  it("กรองตามสถานะ", () => {
    expect(filterRows(rows, { flow_status: "received" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("กรองตามช่วงวันที่", () => {
    expect(filterRows(rows, { from: "2026-09-01", to: "2026-09-30" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("กรองตามบริษัท", () => {
    expect(filterRows(rows, { company_id: "c1" }).map((r) => r.id)).toEqual(["1"]);
  });

  it("ค้นหาด้วยคำค้นจากเลขที่เอกสาร", () => {
    expect(filterRows(rows, { keyword: "0002" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("ไม่ใส่เงื่อนไข = ได้ทุกแถว", () => {
    expect(filterRows(rows, {})).toHaveLength(2);
  });
});

describe("เลขที่เอกสาร", () => {
  it("แปลงปีเป็น พ.ศ.", () => {
    expect(buddhistYearOf("2026-01-31")).toBe(2569);
  });

  it("รูปแบบเลขที่", () => {
    expect(formatDocNo(2569, 7)).toBe("MK-2569-0007");
    expect(formatDocNo(2569, 12_345)).toBe("MK-2569-12345");
  });
});

describe("assertPhotoPaths", () => {
  it("ตัดค่าว่างทิ้ง", () => {
    expect(assertPhotoPaths(["mkt/2569/a.jpg", "", "  "])).toEqual(["mkt/2569/a.jpg"]);
  });

  it("เกิน 10 รูปไม่ได้", () => {
    const many = Array.from({ length: 11 }, (_, i) => `mkt/2569/${i}.jpg`);
    expect(() => assertPhotoPaths(many)).toThrow(/10 รูป/);
  });

  it("กันเส้นทางนอกโฟลเดอร์ mkt", () => {
    expect(() => assertPhotoPaths(["EMP001/photo.jpg"])).toThrow();
    expect(() => assertPhotoPaths(["mkt/../secret.jpg"])).toThrow();
  });
});

// ==================== Memo (หน้าจอ 7 และ 8) ====================

function memo(patch: Partial<MktMemoRow> = {}): MktMemoRow {
  return {
    id: "m1",
    doc_no: "MEMO-2569-0001",
    memo_date: "2026-08-01",
    detail: "ข้อตกลงส่งเสริมการขายไตรมาส 3",
    period_from: "2026-07-01",
    period_to: "2026-09-30",
    status: "not_requested",
    active_status: "active",
    company_id: "c1",
    company_name: "โตโยต้า",
    created_by_staff_id: "s1",
    created_by_name: "สนุ๊ก",
    file_count: 0,
    status_log_count: 0,
    last_status_changed_on: null,
    ...patch,
  };
}

describe("ช่วงเวลาของ Memo", () => {
  it("เว้นว่างได้ทั้งคู่", () => {
    expect(assertMemoPeriod(null, null)).toEqual({ from: null, to: null });
    expect(assertMemoPeriod("", "")).toEqual({ from: null, to: null });
  });

  it("กรอกข้างเดียวได้", () => {
    expect(assertMemoPeriod("2026-07-01", null)).toEqual({ from: "2026-07-01", to: null });
  });

  it("วันสิ้นสุดมาก่อนวันเริ่มไม่ได้", () => {
    expect(() => assertMemoPeriod("2026-09-30", "2026-07-01")).toThrow(/วันสิ้นสุด/);
  });

  it("วันเดียวกันได้", () => {
    expect(assertMemoPeriod("2026-07-01", "2026-07-01").to).toBe("2026-07-01");
  });

  it("บอกได้ว่าเลยกำหนดแล้วหรือยัง", () => {
    expect(isPeriodExpired("2026-09-30", "2026-10-01")).toBe(true);
    expect(isPeriodExpired("2026-09-30", "2026-09-30")).toBe(false);
    expect(isPeriodExpired(null, "2026-10-01")).toBe(false);
  });
});

describe("summarizeMemos", () => {
  const rows = [
    memo({ id: "1", status: "not_requested" }),
    memo({ id: "2", status: "partial_received" }),
    memo({ id: "3", status: "partial_received" }),
    memo({ id: "4", status: "closed", active_status: "cancelled" }),
  ];

  it("นับตามสถานะ และไม่นับใบที่ยกเลิก", () => {
    const t = summarizeMemos(rows);
    expect(t.count).toBe(3);
    expect(t.byStatus.partial_received).toBe(2);
    expect(t.byStatus.not_requested).toBe(1);
    expect(t.byStatus.closed).toBe(0);
  });

  it("จัดกลุ่มตามบริษัทเรียงมากไปน้อย", () => {
    const groups = groupMemoCounts(
      [
        memo({ id: "1", company_id: "c1", company_name: "โตโยต้า" }),
        memo({ id: "2", company_id: "c2", company_name: "ฮอนด้า" }),
        memo({ id: "3", company_id: "c2", company_name: "ฮอนด้า" }),
      ],
      (r) => ({ key: r.company_id ?? "-", label: r.company_name ?? "ไม่ระบุ" }),
    );
    expect(groups.map((g) => [g.label, g.count])).toEqual([
      ["ฮอนด้า", 2],
      ["โตโยต้า", 1],
    ]);
  });
});

describe("filterMemos", () => {
  const rows = [
    memo({ id: "1", memo_date: "2026-08-01", status: "not_requested", company_id: "c1" }),
    memo({
      id: "2",
      memo_date: "2026-09-15",
      status: "fully_received",
      company_id: "c2",
      doc_no: "MEMO-2569-0002",
    }),
  ];

  it("กรองตามสถานะ", () => {
    expect(filterMemos(rows, { status: "fully_received" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("กรองตามช่วงวันที่", () => {
    expect(filterMemos(rows, { from: "2026-09-01" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("กรองตามบริษัท", () => {
    expect(filterMemos(rows, { company_id: "c1" }).map((r) => r.id)).toEqual(["1"]);
  });

  it("ค้นด้วยคำค้นจากเลขที่", () => {
    expect(filterMemos(rows, { keyword: "0002" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("ไม่ใส่เงื่อนไข = ได้ทุกแถว", () => {
    expect(filterMemos(rows, {})).toHaveLength(2);
  });
});

describe("ไฟล์แนบของ Memo", () => {
  it("ตัดค่าว่างทิ้ง", () => {
    expect(assertMemoFilePaths(["mkt/files/a.pdf", "", " "], 20)).toEqual(["mkt/files/a.pdf"]);
  });

  it("เกินจำนวนที่กำหนดไม่ได้", () => {
    const many = Array.from({ length: 21 }, (_, i) => `mkt/files/${i}.pdf`);
    expect(() => assertMemoFilePaths(many, 20)).toThrow(/20 ไฟล์/);
  });

  it("กันเส้นทางนอกโฟลเดอร์ mkt", () => {
    expect(() => assertMemoFilePaths(["E001/secret.pdf"], 20)).toThrow();
    expect(() => assertMemoFilePaths(["mkt/../secret.pdf"], 20)).toThrow();
  });
});

describe("formatPeriod", () => {
  const fmt = (d: string) => d;

  it("มีทั้งสองวัน", () => {
    expect(formatPeriod("2026-07-01", "2026-09-30", fmt)).toBe("2026-07-01 - 2026-09-30");
  });

  it("มีวันเดียว", () => {
    expect(formatPeriod("2026-07-01", null, fmt)).toBe("ตั้งแต่ 2026-07-01");
    expect(formatPeriod(null, "2026-09-30", fmt)).toBe("ถึง 2026-09-30");
  });

  it("ไม่กำหนดช่วงเวลา", () => {
    expect(formatPeriod(null, null, fmt)).toBe("-");
  });
});
