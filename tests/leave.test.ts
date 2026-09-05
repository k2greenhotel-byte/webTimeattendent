import { describe, expect, it } from "vitest";
import {
  canDecideAdvance,
  canDecideLeave,
  certDaysLeft,
  daysBetween,
  daysInRange,
  evaluateLeave,
  formatServiceMonths,
  groupByCompany,
  isCertOverdue,
  leaveFlags,
  leaveRangeText,
  resolveApprovedAmount,
  serviceMonths,
  summarizeAdvanceInbox,
  summarizeLeaveInbox,
  validateAdvanceDecision,
  validateAdvanceInput,
  validateLeaveDecision,
  validateLeaveInput,
  type AdvanceDecisionInput,
  type LeaveInput,
} from "../src/lib/leave";
import type { AdvanceRequestRow, LeaveRequestRow, LeaveType } from "../src/lib/leave-types";
import type { Authority } from "../src/lib/approval-types";

// ---------- ตัวช่วยสร้างข้อมูลทดสอบ ----------

function type(over: Partial<LeaveType> = {}): LeaveType {
  return {
    id: "t1",
    code: "SICK",
    name: "ลาป่วย",
    description: null,
    conditions: null,
    advance_days: 0,
    late_becomes_absent: false,
    min_service_months: 0,
    require_medical_cert: false,
    cert_within_days: 3,
    same_day_cutoff: null,
    late_penalty_multiplier: 0,
    max_days_per_year: null,
    needs_date_range: true,
    needs_arrival_time: false,
    is_paid: true,
    icon: null,
    sort_order: 0,
    is_active: true,
    ...over,
  };
}

function input(over: Partial<LeaveInput> = {}): LeaveInput {
  return {
    typeId: "t1",
    detail: "ป่วยเป็นไข้",
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    totalDays: 1,
    arrivalTime: null,
    ...over,
  };
}

/** เวลาไทยของวันหนึ่ง ๆ (UTC+7 คงที่) */
function bkk(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+07:00`);
}

function leaveRow(over: Partial<LeaveRequestRow> = {}): LeaveRequestRow {
  return {
    id: "r1",
    doc_no: "LV-2569-0001",
    request_date: "2026-09-05",
    reported_at: "2026-09-05T01:00:00.000Z",
    employee_id: "e1",
    employee_name: "สมชาย ใจดี",
    company_id: "c1",
    branch_id: "b1",
    type_id: "t1",
    detail: "ป่วย",
    start_date: "2026-09-05",
    end_date: "2026-09-05",
    total_days: 1,
    arrival_time: null,
    status: "pending",
    decided_at: null,
    decided_by: null,
    decided_by_name: null,
    decision_note: null,
    reason_id: null,
    notice_days: 0,
    service_months: 24,
    counts_as_absent: false,
    is_late_notice: false,
    penalty_multiplier: 0,
    cert_due_date: null,
    cert_received: false,
    created_at: "2026-09-05T01:00:00.000Z",
    type_code: "SICK",
    type_name: "ลาป่วย",
    type_icon: "🤒",
    is_paid: true,
    require_medical_cert: false,
    needs_arrival_time: false,
    company_name: "บริษัท ก",
    branch_name: "สาขาใหญ่",
    branch_code: "HQ",
    reason_name: null,
    file_count: 0,
    cert_count: 0,
    ...over,
  };
}

function advanceRow(over: Partial<AdvanceRequestRow> = {}): AdvanceRequestRow {
  return {
    id: "a1",
    doc_no: "AD-2569-0001",
    request_date: "2026-09-05",
    requested_at: "2026-09-05T01:00:00.000Z",
    purpose: "ค่ารักษาพยาบาล",
    detail: null,
    employee_id: "e1",
    employee_name: "สมชาย ใจดี",
    company_id: "c1",
    branch_id: "b1",
    amount: 5000,
    approved_amount: 0,
    status: "pending",
    decided_at: null,
    decided_by: null,
    decided_by_name: null,
    decision_note: null,
    reason_id: null,
    created_at: "2026-09-05T01:00:00.000Z",
    company_name: "บริษัท ก",
    branch_name: "สาขาใหญ่",
    branch_code: "HQ",
    reason_name: null,
    ...over,
  };
}

function authority(over: Partial<Authority> = {}): Authority {
  return {
    maxAmount: 5000,
    canReject: true,
    isFinal: false,
    fromLimitId: "l1",
    reason: "กฎตามระดับการทำงาน",
    ...over,
  };
}

// ---------- วันและอายุงาน ----------

describe("การนับวัน", () => {
  it("นับระยะห่างระหว่างวันได้ทั้งบวกและลบ", () => {
    expect(daysBetween("2026-09-05", "2026-09-08")).toBe(3);
    expect(daysBetween("2026-09-08", "2026-09-05")).toBe(-3);
    expect(daysBetween("2026-09-05", "2026-09-05")).toBe(0);
  });

  it("นับข้ามเดือนและข้ามปีถูก", () => {
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysInRange("2026-09-05", "2026-09-07")).toBe(3);
  });
});

describe("อายุงาน", () => {
  it("นับเป็นเดือนเต็ม ยังไม่ถึงวันครบรอบไม่นับเพิ่ม", () => {
    expect(serviceMonths("2025-09-15", "2026-09-14")).toBe(11);
    expect(serviceMonths("2025-09-15", "2026-09-15")).toBe(12);
    expect(serviceMonths("2025-09-15", "2026-10-01")).toBe(12);
  });

  it("ไม่มีวันเริ่มงานคืน null", () => {
    expect(serviceMonths(null, "2026-09-05")).toBeNull();
    expect(formatServiceMonths(null)).toBe("ไม่ได้บันทึกวันเริ่มงาน");
  });

  it("แสดงผลเป็นปี/เดือนแบบไทย", () => {
    expect(formatServiceMonths(0)).toBe("0 เดือน");
    expect(formatServiceMonths(12)).toBe("1 ปี");
    expect(formatServiceMonths(15)).toBe("1 ปี 3 เดือน");
  });
});

// ---------- เงื่อนไขการใช้สิทธิ์ ----------

describe("ลาพักร้อน/ลากิจ: อายุงานและการแจ้งล่วงหน้า", () => {
  const vacation = type({
    code: "VACATION",
    name: "ลาพักร้อน",
    advance_days: 3,
    late_becomes_absent: true,
    min_service_months: 12,
  });

  it("อายุงานไม่ถึง 1 ปี ยื่นไม่ได้", () => {
    const result = evaluateLeave(vacation, input({ startDate: "2026-09-20" }), {
      requestDate: "2026-09-05",
      reportedAt: bkk("2026-09-05", "09:00"),
      hireDate: "2026-01-01",
    });
    expect(result.blocked).toContain("อายุงาน");
  });

  it("ไม่มีวันเริ่มงานในระบบ ยื่นไม่ได้ และบอกวิธีแก้", () => {
    const result = evaluateLeave(vacation, input({ startDate: "2026-09-20" }), {
      requestDate: "2026-09-05",
      reportedAt: bkk("2026-09-05", "09:00"),
      hireDate: null,
    });
    expect(result.blocked).toContain("แจ้งผู้ดูแลระบบ");
  });

  it("แจ้งล่วงหน้าครบ 3 วัน ผ่านทุกเงื่อนไข", () => {
    const result = evaluateLeave(vacation, input({ startDate: "2026-09-08" }), {
      requestDate: "2026-09-05",
      reportedAt: bkk("2026-09-05", "09:00"),
      hireDate: "2024-01-01",
    });
    expect(result.blocked).toBeNull();
    expect(result.noticeDays).toBe(3);
    expect(result.countsAsAbsent).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it("แจ้งล่วงหน้าไม่ครบ 3 วัน ยื่นได้แต่ถือเป็นขาดงาน", () => {
    const result = evaluateLeave(vacation, input({ startDate: "2026-09-07" }), {
      requestDate: "2026-09-05",
      reportedAt: bkk("2026-09-05", "09:00"),
      hireDate: "2024-01-01",
    });
    expect(result.blocked).toBeNull();
    expect(result.noticeDays).toBe(2);
    expect(result.countsAsAbsent).toBe(true);
    expect(result.warnings.join(" ")).toContain("ขาดงาน");
  });

  it("ผู้ใช้ปรับเงื่อนไขเป็นแจ้งล่วงหน้า 7 วันได้ โดยไม่ต้องแก้โค้ด", () => {
    const stricter = { ...vacation, advance_days: 7 };
    const result = evaluateLeave(stricter, input({ startDate: "2026-09-10" }), {
      requestDate: "2026-09-05",
      reportedAt: bkk("2026-09-05", "09:00"),
      hireDate: "2024-01-01",
    });
    expect(result.countsAsAbsent).toBe(true);
  });

  it("ปิดเงื่อนไขอายุงาน (ตั้งเป็น 0) แล้วพนักงานใหม่ยื่นได้", () => {
    const relaxed = { ...vacation, min_service_months: 0 };
    const result = evaluateLeave(relaxed, input({ startDate: "2026-09-20" }), {
      requestDate: "2026-09-05",
      reportedAt: bkk("2026-09-05", "09:00"),
      hireDate: "2026-08-01",
    });
    expect(result.blocked).toBeNull();
  });
});

describe("แจ้งหยุดงาน/เข้างานสาย: เวลาตัด 08:00 และค่าปรับ 2 เท่า", () => {
  const absent = type({
    code: "ABSENT",
    name: "แจ้งหยุดงาน",
    same_day_cutoff: "08:00",
    late_penalty_multiplier: 2,
  });

  const ctx = (reportedAt: Date) => ({
    requestDate: "2026-09-05",
    reportedAt,
    hireDate: "2024-01-01",
  });

  it("แจ้ง 07:30 ของวันเดียวกัน ไม่โดนหักเงิน", () => {
    const result = evaluateLeave(
      absent,
      input({ startDate: "2026-09-05", endDate: "2026-09-05" }),
      ctx(bkk("2026-09-05", "07:30")),
    );
    expect(result.isLateNotice).toBe(false);
    expect(result.penaltyMultiplier).toBe(0);
  });

  it("แจ้ง 08:01 ของวันเดียวกัน โดนหักเงิน 2 เท่า", () => {
    const result = evaluateLeave(
      absent,
      input({ startDate: "2026-09-05", endDate: "2026-09-05" }),
      ctx(bkk("2026-09-05", "08:01")),
    );
    expect(result.isLateNotice).toBe(true);
    expect(result.penaltyMultiplier).toBe(2);
    expect(result.warnings.join(" ")).toContain("2 เท่า");
  });

  it("แจ้ง 08:00 พอดี ยังทัน (ตัดที่ 'หลัง' เวลานั้น)", () => {
    const result = evaluateLeave(
      absent,
      input({ startDate: "2026-09-05", endDate: "2026-09-05" }),
      ctx(bkk("2026-09-05", "08:00")),
    );
    expect(result.isLateNotice).toBe(false);
  });

  it("แจ้งล่วงหน้าสำหรับวันพรุ่งนี้ ตอนบ่ายก็ยังทัน", () => {
    const result = evaluateLeave(
      absent,
      input({ startDate: "2026-09-06", endDate: "2026-09-06" }),
      ctx(bkk("2026-09-05", "15:00")),
    );
    expect(result.isLateNotice).toBe(false);
  });

  it("ผู้ใช้ปรับเวลาตัดเป็น 09:00 ได้ แล้วแจ้ง 08:30 ไม่โดนหัก", () => {
    const later = { ...absent, same_day_cutoff: "09:00" };
    const result = evaluateLeave(
      later,
      input({ startDate: "2026-09-05", endDate: "2026-09-05" }),
      ctx(bkk("2026-09-05", "08:30")),
    );
    expect(result.isLateNotice).toBe(false);
  });
});

describe("ลาป่วย: ใบรับรองแพทย์ภายใน 3 วัน", () => {
  const sick = type({ require_medical_cert: true, cert_within_days: 3 });

  it("กำหนดวันครบส่งเป็นวันที่แจ้ง + 3 วัน", () => {
    const result = evaluateLeave(sick, input(), {
      requestDate: "2026-09-05",
      reportedAt: bkk("2026-09-05", "09:00"),
      hireDate: "2024-01-01",
    });
    expect(result.certDueDate).toBe("2026-09-08");
    expect(result.warnings.join(" ")).toContain("ใบรับรองแพทย์");
  });

  it("เลยกำหนดแล้วยังไม่ส่ง ถือว่าค้าง", () => {
    const row = leaveRow({ cert_due_date: "2026-09-08", require_medical_cert: true });
    expect(isCertOverdue(row, "2026-09-09")).toBe(true);
    expect(isCertOverdue(row, "2026-09-08")).toBe(false);
  });

  it("ส่งไฟล์ใบรับรองแพทย์แล้ว ไม่นับว่าค้าง", () => {
    const row = leaveRow({ cert_due_date: "2026-09-08", cert_count: 1 });
    expect(isCertOverdue(row, "2026-09-20")).toBe(false);
    expect(certDaysLeft(row, "2026-09-06")).toBeNull();
  });

  it("ยังไม่ส่งและยังไม่ถึงกำหนด บอกจำนวนวันที่เหลือ", () => {
    const row = leaveRow({ cert_due_date: "2026-09-08" });
    expect(certDaysLeft(row, "2026-09-06")).toBe(2);
  });

  it("ใบที่ไม่อนุมัติแล้ว ไม่ต้องตามใบรับรองแพทย์ต่อ", () => {
    const row = leaveRow({ cert_due_date: "2026-09-08", status: "rejected" });
    expect(isCertOverdue(row, "2026-09-20")).toBe(false);
  });
});

describe("โควตาต่อปี", () => {
  it("เตือนเมื่อเกินโควตา แต่ยังยื่นได้", () => {
    const vacation = type({ max_days_per_year: 6, needs_date_range: true });
    const result = evaluateLeave(vacation, input({ totalDays: 3 }), {
      requestDate: "2026-09-05",
      reportedAt: bkk("2026-09-05", "09:00"),
      hireDate: "2024-01-01",
      usedDaysThisYear: 5,
    });
    expect(result.blocked).toBeNull();
    expect(result.warnings.join(" ")).toContain("เกินโควตา");
  });
});

// ---------- ตรวจฟอร์ม ----------

describe("ตรวจฟอร์มใบแจ้งลา", () => {
  it("ไม่เลือกประเภทการลาไม่ผ่าน", () => {
    expect(validateLeaveInput(input(), null)).toContain("ประเภทการลา");
  });

  it("ไม่กรอกรายละเอียดไม่ผ่าน", () => {
    expect(validateLeaveInput(input({ detail: "  " }), type())).toContain("รายละเอียด");
  });

  it("วันสิ้นสุดก่อนวันเริ่มไม่ผ่าน", () => {
    const problem = validateLeaveInput(
      input({ startDate: "2026-09-10", endDate: "2026-09-08" }),
      type(),
    );
    expect(problem).toContain("วันที่สิ้นสุด");
  });

  it("จำนวนวันมากกว่าช่วงที่เลือกไม่ผ่าน", () => {
    const problem = validateLeaveInput(
      input({ startDate: "2026-09-10", endDate: "2026-09-11", totalDays: 5 }),
      type(),
    );
    expect(problem).toContain("จำนวนวัน");
  });

  it("แจ้งเข้างานสายต้องระบุเวลาที่จะมาถึง", () => {
    const late = type({ needs_date_range: false, needs_arrival_time: true });
    expect(validateLeaveInput(input({ arrivalTime: null }), late)).toContain("เวลาที่คาดว่าจะมาถึง");
    expect(validateLeaveInput(input({ arrivalTime: "10:30" }), late)).toBeNull();
  });

  it("ประเภทที่ปิดใช้งานแล้วเลือกไม่ได้", () => {
    expect(validateLeaveInput(input(), type({ is_active: false }))).toContain("ปิดใช้งาน");
  });

  it("ลาครึ่งวันผ่าน", () => {
    expect(validateLeaveInput(input({ totalDays: 0.5 }), type())).toBeNull();
  });
});

// ---------- ตัดสินใบแจ้งลา ----------

describe("ตัดสินใบแจ้งลา", () => {
  it("สถานะที่ตัดสินได้คือรออนุมัติและอนุมัติแต่ขอหลักฐานเพิ่ม", () => {
    expect(canDecideLeave("pending")).toBe(true);
    expect(canDecideLeave("need_docs")).toBe(true);
    expect(canDecideLeave("approved")).toBe(false);
    expect(canDecideLeave("cancelled")).toBe(false);
  });

  it("ใบที่ตัดสินไปแล้วตัดสินซ้ำไม่ได้", () => {
    const problem = validateLeaveDecision(leaveRow({ status: "approved" }), {
      status: "rejected",
      note: "",
      reasonId: "x",
    });
    expect(problem).toContain("ตัดสินไปแล้ว");
  });

  it("ไม่อนุมัติต้องเลือกเหตุผล", () => {
    const problem = validateLeaveDecision(leaveRow(), {
      status: "rejected",
      note: "",
      reasonId: null,
    });
    expect(problem).toContain("เหตุผล");
  });

  it("อนุมัติแต่ขอหลักฐานเพิ่ม ต้องบอกว่าขออะไร", () => {
    expect(
      validateLeaveDecision(leaveRow(), { status: "need_docs", note: "", reasonId: null }),
    ).toContain("หลักฐาน");
    expect(
      validateLeaveDecision(leaveRow(), {
        status: "need_docs",
        note: "ขอใบรับรองแพทย์ฉบับจริง",
        reasonId: null,
      }),
    ).toBeNull();
  });

  it("อนุมัติตามปกติผ่าน", () => {
    expect(
      validateLeaveDecision(leaveRow(), { status: "approved", note: "", reasonId: null }),
    ).toBeNull();
  });

  it("สถานะที่ไม่ใช่ตัวเลือกของผู้อนุมัติไม่ผ่าน", () => {
    expect(
      validateLeaveDecision(leaveRow(), { status: "cancelled", note: "", reasonId: null }),
    ).toContain("ผลการพิจารณา");
  });
});

// ---------- ใบขอเบิกเงินเดือน ----------

describe("ยื่นใบขอเบิกเงินเดือน", () => {
  it("ต้องระบุว่าขอเบิกเพื่ออะไรและยอดมากกว่า 0", () => {
    expect(validateAdvanceInput({ purpose: "", detail: "", amount: 100 })).toContain("ขอเบิกเพื่อ");
    expect(validateAdvanceInput({ purpose: "ค่าเทอม", detail: "", amount: 0 })).toContain("ยอดเงิน");
    expect(validateAdvanceInput({ purpose: "ค่าเทอม", detail: "", amount: 3000 })).toBeNull();
  });
});

describe("ตัดสินใบขอเบิกเงินเดือน", () => {
  const base: AdvanceDecisionInput = {
    status: "approved",
    approvedAmount: 0,
    note: "",
    reasonId: null,
  };

  it("อนุมัติเต็มจำนวนได้ยอดเท่าที่ขอ", () => {
    const row = advanceRow({ amount: 5000 });
    expect(validateAdvanceDecision(row, base, authority())).toBeNull();
    expect(resolveApprovedAmount(row, base)).toBe(5000);
  });

  it("อนุมัติบางส่วนต้องน้อยกว่าที่ขอ", () => {
    const row = advanceRow({ amount: 5000 });
    const partial = { ...base, status: "partial" as const, approvedAmount: 5000 };
    expect(validateAdvanceDecision(row, partial, authority())).toContain("เต็มจำนวน");
    expect(
      validateAdvanceDecision(row, { ...partial, approvedAmount: 3000 }, authority()),
    ).toBeNull();
    expect(resolveApprovedAmount(row, { ...partial, approvedAmount: 3000 })).toBe(3000);
  });

  it("อนุมัติบางส่วนยอด 0 ไม่ผ่าน", () => {
    const row = advanceRow();
    const partial = { ...base, status: "partial" as const, approvedAmount: 0 };
    expect(validateAdvanceDecision(row, partial, authority())).toContain("มากกว่า 0");
  });

  it("ไม่อนุมัติต้องเลือกเหตุผล และยอดที่อนุมัติเป็น 0", () => {
    const row = advanceRow();
    const reject = { ...base, status: "rejected" as const };
    expect(validateAdvanceDecision(row, reject, authority())).toContain("เหตุผล");
    expect(
      validateAdvanceDecision(row, { ...reject, reasonId: "reason-1" }, authority()),
    ).toBeNull();
    expect(resolveApprovedAmount(row, reject)).toBe(0);
  });

  it("เกินวงเงินของผู้อนุมัติ ตัดสินไม่ได้", () => {
    const row = advanceRow({ amount: 20000 });
    const problem = validateAdvanceDecision(row, base, authority({ maxAmount: 5000 }));
    expect(problem).toContain("เกินอำนาจอนุมัติ");
  });

  it("อนุมัติบางส่วนให้อยู่ในวงเงิน ทำได้", () => {
    const row = advanceRow({ amount: 20000 });
    const partial = { ...base, status: "partial" as const, approvedAmount: 4000 };
    expect(validateAdvanceDecision(row, partial, authority({ maxAmount: 5000 }))).toBeNull();
  });

  it("ไม่คุมวงเงิน (authority = null) อนุมัติได้ทุกจำนวน", () => {
    const row = advanceRow({ amount: 999999 });
    expect(validateAdvanceDecision(row, base, null)).toBeNull();
  });

  it("ใบที่ตัดสินไปแล้วตัดสินซ้ำไม่ได้", () => {
    const row = advanceRow({ status: "partial" });
    expect(canDecideAdvance(row.status)).toBe(false);
    expect(validateAdvanceDecision(row, base, null)).toContain("ตัดสินไปแล้ว");
  });
});

// ---------- ข้อความและการจัดกลุ่ม ----------

describe("ข้อความบนหน้าจอ", () => {
  it("ลาวันเดียวแสดงวันเดียว ลาหลายวันแสดงช่วง", () => {
    expect(leaveRangeText(leaveRow())).not.toContain("–");
    expect(leaveRangeText(leaveRow({ end_date: "2026-09-07" }))).toContain("–");
  });

  it("แจ้งเข้างานสายแสดงเวลาที่จะมาถึง", () => {
    expect(leaveRangeText(leaveRow({ arrival_time: "10:30:00" }))).toContain("10:30");
  });

  it("ธงเตือนบอกทั้งขาดงานและค่าปรับ", () => {
    const row = leaveRow({ counts_as_absent: true, is_late_notice: true, penalty_multiplier: 2 });
    const flags = leaveFlags(row, "2026-09-05");
    expect(flags.join(" ")).toContain("ขาดงาน");
    expect(flags.join(" ")).toContain("2 เท่า");
  });

  it("ใบปกติไม่มีธงเตือน", () => {
    expect(leaveFlags(leaveRow(), "2026-09-05")).toHaveLength(0);
  });
});

describe("จัดกลุ่มตามบริษัท", () => {
  it("แยกกลุ่มตามบริษัทและเรียงชื่อ", () => {
    const rows = [
      leaveRow({ id: "1", company_id: "c2", company_name: "บริษัท ข" }),
      leaveRow({ id: "2", company_id: "c1", company_name: "บริษัท ก" }),
      leaveRow({ id: "3", company_id: "c1", company_name: "บริษัท ก" }),
    ];
    const groups = groupByCompany(rows);
    expect(groups).toHaveLength(2);
    expect(groups[0].companyName).toBe("บริษัท ก");
    expect(groups[0].rows).toHaveLength(2);
  });

  it("ใบที่ไม่ระบุบริษัทรวมเป็นกลุ่มเดียว", () => {
    const groups = groupByCompany([leaveRow({ company_id: null, company_name: null })]);
    expect(groups[0].companyName).toBe("ไม่ระบุบริษัท");
  });
});

describe("สรุปกล่องอนุมัติ", () => {
  it("นับใบรออนุมัติ ขาดงาน แจ้งช้า และใบรับรองแพทย์ค้าง", () => {
    const rows = [
      leaveRow({ id: "1" }),
      leaveRow({ id: "2", counts_as_absent: true }),
      leaveRow({ id: "3", is_late_notice: true }),
      leaveRow({ id: "4", cert_due_date: "2026-09-01" }),
    ];
    const summary = summarizeLeaveInbox(rows, "2026-09-05");
    expect(summary.pending).toBe(4);
    expect(summary.absent).toBe(1);
    expect(summary.penalty).toBe(1);
    expect(summary.certOverdue).toBe(1);
  });

  it("รวมยอดเฉพาะใบที่ยังรออนุมัติ", () => {
    const summary = summarizeAdvanceInbox([
      advanceRow({ id: "1", amount: 5000 }),
      advanceRow({ id: "2", amount: 3000 }),
      advanceRow({ id: "3", amount: 9000, status: "approved" }),
    ]);
    expect(summary.pending).toBe(2);
    expect(summary.totalRequested).toBe(8000);
  });
});
