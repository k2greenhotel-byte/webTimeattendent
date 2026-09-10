import { describe, expect, it } from "vitest";
import {
  auditQueryFromParams,
  beYearOf,
  checkQueryFromParams,
  countMissingDocs,
  formatBaht,
  groupChecks,
  isAuditEditable,
  isCheckDone,
  isProblem,
  isPullable,
  rangeLabel,
  rowTone,
  summarizeAudits,
  summarizeChecks,
  validateAudit,
  validateCheckResult,
  validateCheckType,
  validateDocType,
} from "../src/lib/audit";
import type {
  AudAuditInput,
  AudAuditRow,
  AudCheckResultInput,
  AudCheckRow,
} from "../src/lib/audit-types";

const FLAGS_ALL = { has_docs: true, has_call: true, has_slip: true };
const FLAGS_NONE = { has_docs: false, has_call: false, has_slip: false };

function auditInput(patch: Partial<AudAuditInput> = {}): AudAuditInput {
  return {
    audit_date: "2026-09-10",
    auditor_id: "u1",
    auditor_name: "สมชาย ตรวจสอบ",
    company_id: null,
    company_name: null,
    branch_id: null,
    branch_name: null,
    status: "draft",
    note: null,
    ...patch,
  };
}

function resultInput(patch: Partial<AudCheckResultInput> = {}): AudCheckResultInput {
  return {
    result: "correct",
    result_note: null,
    doc_result: "complete",
    doc_note: null,
    call_result: "contacted",
    info_result: "match",
    call_note: null,
    slip_result: "has",
    slip_amount_result: "correct",
    slip_amount: null,
    deposit_amount: null,
    missing: [],
    ...patch,
  };
}

function check(patch: Partial<AudCheckRow> = {}): AudCheckRow {
  return {
    id: "c1",
    audit_id: "a1",
    type_id: "t1",
    type_code: "SALE",
    type_name: "ตรวจสอบใบสั่งขาย",
    kind: "sale",
    ref_no: "C001",
    ref_date: "2026-09-09",
    title: "ลูกค้า ก",
    party: "พนักงานขาย ข",
    branch_label: "KMS01",
    amount: 50_000,
    extra: {},
    payment_id: null,
    result: "correct",
    result_note: null,
    doc_result: "complete",
    doc_note: null,
    call_result: "contacted",
    info_result: "match",
    call_note: null,
    slip_result: "pending",
    slip_amount_result: "pending",
    slip_amount: null,
    deposit_amount: null,
    sort_order: 10,
    checked_by: "u1",
    created_at: "2026-09-10T03:00:00Z",
    updated_at: "2026-09-10T03:00:00Z",
    audit_no: "AUD-2569-0001",
    audit_date: "2026-09-10",
    auditor_id: "u1",
    auditor_name: "สมชาย ตรวจสอบ",
    audit_status: "draft",
    company_id: null,
    company_name: null,
    branch_id: null,
    branch_name: "สาขาหลัก",
    missing_docs: [],
    missing_count: 0,
    ...patch,
  };
}

function audit(patch: Partial<AudAuditRow> = {}): AudAuditRow {
  return {
    id: "a1",
    doc_no: "AUD-2569-0001",
    audit_date: "2026-09-10",
    auditor_id: "u1",
    auditor_name: "สมชาย ตรวจสอบ",
    company_id: null,
    company_name: null,
    branch_id: null,
    branch_name: null,
    status: "draft",
    note: null,
    created_by: "u1",
    created_at: "2026-09-10T03:00:00Z",
    updated_at: "2026-09-10T03:00:00Z",
    company_ref_name: null,
    branch_ref_name: null,
    branch_code: null,
    auditor_full_name: null,
    check_count: 3,
    wrong_count: 1,
    incomplete_count: 1,
    no_contact_count: 0,
    mismatch_count: 1,
    pending_count: 0,
    ...patch,
  };
}

describe("validateAudit", () => {
  it("ผ่านเมื่อกรอกครบ", () => {
    expect(validateAudit(auditInput())).toBeNull();
  });

  it("ต้องมีวันที่ทำงาน", () => {
    expect(validateAudit(auditInput({ audit_date: "" }))).toContain("วันที่ทำงาน");
  });

  it("รูปแบบวันที่ต้องเป็น YYYY-MM-DD", () => {
    expect(validateAudit(auditInput({ audit_date: "10/09/2569" }))).toContain("รูปแบบวันที่");
  });

  it("ต้องมีชื่อผู้ตรวจสอบ", () => {
    expect(validateAudit(auditInput({ auditor_name: "  " }))).toContain("ผู้ตรวจสอบ");
  });
});

describe("validateCheckResult", () => {
  it("ผ่านเมื่อกรอกครบทุกช่อง", () => {
    expect(validateCheckResult(resultInput(), FLAGS_ALL)).toBeNull();
  });

  it("ผลตรวจ “ไม่ถูกต้อง” ต้องมีหมายเหตุ", () => {
    expect(validateCheckResult(resultInput({ result: "wrong" }), FLAGS_ALL)).toContain("หมายเหตุ");
    expect(
      validateCheckResult(resultInput({ result: "wrong", result_note: "ราคาผิด" }), FLAGS_ALL),
    ).toBeNull();
  });

  it("เอกสารไม่ครบต้องระบุว่าขาดอะไร", () => {
    expect(validateCheckResult(resultInput({ doc_result: "incomplete" }), FLAGS_ALL)).toContain(
      "ขาดเอกสารอะไร",
    );
    expect(
      validateCheckResult(
        resultInput({
          doc_result: "incomplete",
          missing: [{ doc_type_id: "d1", doc_name: "บัตรประชาชน" }],
        }),
        FLAGS_ALL,
      ),
    ).toBeNull();
  });

  it("ติดต่อได้แล้วต้องสรุปว่าข้อมูลตรงหรือไม่", () => {
    expect(
      validateCheckResult(resultInput({ call_result: "contacted", info_result: "pending" }), FLAGS_ALL),
    ).toContain("ข้อมูลตรง");
  });

  it("ข้อมูลไม่ตรงต้องมีหมายเหตุ", () => {
    expect(validateCheckResult(resultInput({ info_result: "abnormal" }), FLAGS_ALL)).toContain(
      "หมายเหตุ",
    );
    expect(
      validateCheckResult(
        resultInput({ info_result: "branch_error", call_note: "สาขาแจ้งราคาผิด" }),
        FLAGS_ALL,
      ),
    ).toBeNull();
  });

  it("มีสลิปแล้วต้องระบุว่ายอดเงินถูกหรือไม่", () => {
    expect(
      validateCheckResult(resultInput({ slip_result: "has", slip_amount_result: "pending" }), FLAGS_ALL),
    ).toContain("ยอดเงิน");
  });

  it("ไม่ตรวจช่องที่รายการตรวจนั้นปิดไว้", () => {
    const input = resultInput({
      doc_result: "incomplete",
      call_result: "contacted",
      info_result: "pending",
      slip_result: "has",
      slip_amount_result: "pending",
    });
    expect(validateCheckResult(input, FLAGS_NONE)).toBeNull();
  });
});

describe("isCheckDone", () => {
  it("ครบเมื่อลงผลทุกช่องที่เปิดใช้", () => {
    expect(isCheckDone(check(), { has_docs: true, has_call: true, has_slip: false })).toBe(true);
  });

  it("ยังไม่ครบถ้าช่องที่เปิดใช้ยังว่าง", () => {
    expect(isCheckDone(check(), FLAGS_ALL)).toBe(false);
    expect(isCheckDone(check({ result: "pending" }), FLAGS_NONE)).toBe(false);
  });
});

describe("summarizeChecks", () => {
  const rows = [
    check({ id: "1", result: "correct" }),
    check({ id: "2", result: "wrong", doc_result: "incomplete", info_result: "abnormal", amount: 1000 }),
    check({ id: "3", result: "pending", doc_result: "pending", call_result: "no_contact", info_result: "pending", amount: null }),
    check({ id: "4", result: "correct", info_result: "branch_error", slip_result: "none", slip_amount_result: "wrong" }),
  ];

  it("นับผลแต่ละแบบได้ถูก", () => {
    const s = summarizeChecks(rows);
    expect(s.count).toBe(4);
    expect(s.correct).toBe(2);
    expect(s.wrong).toBe(1);
    expect(s.pending).toBe(1);
    expect(s.docIncomplete).toBe(1);
    expect(s.noContact).toBe(1);
    expect(s.abnormal).toBe(1);
    expect(s.branchError).toBe(1);
    expect(s.slipNone).toBe(1);
    expect(s.slipAmountWrong).toBe(1);
  });

  it("% ถูกต้องคิดจากเฉพาะรายการที่ลงผลแล้ว", () => {
    // ตรวจแล้ว 3 ใบ (ถูก 2 ผิด 1) → 66.7% ไม่ใช่ 50% ของ 4 ใบ
    expect(summarizeChecks(rows).correctPct).toBeCloseTo((2 / 3) * 100, 5);
  });

  it("ยอดเงินรวมข้ามค่าที่ไม่มี", () => {
    expect(summarizeChecks(rows).amountTotal).toBe(50_000 + 1_000 + 50_000);
  });

  it("ชุดว่างไม่หารด้วยศูนย์", () => {
    expect(summarizeChecks([]).correctPct).toBe(0);
  });
});

describe("summarizeAudits", () => {
  it("รวมยอดของทุกใบคุมงาน", () => {
    const s = summarizeAudits([audit(), audit({ id: "a2", status: "submitted", check_count: 2, wrong_count: 0 })]);
    expect(s.count).toBe(2);
    expect(s.draft).toBe(1);
    expect(s.submitted).toBe(1);
    expect(s.checks).toBe(5);
    expect(s.wrong).toBe(1);
  });
});

describe("groupChecks", () => {
  it("เรียงกลุ่มที่มีปัญหามากสุดขึ้นก่อน", () => {
    const rows = [
      check({ id: "1", branch_label: "A" }),
      check({ id: "2", branch_label: "B", result: "wrong" }),
      check({ id: "3", branch_label: "B", info_result: "abnormal" }),
      check({ id: "4", branch_label: "A" }),
    ];
    const groups = groupChecks(rows, (r) => r.branch_label);
    expect(groups[0].label).toBe("B");
    expect(groups[0].summary.count).toBe(2);
    expect(groups[1].label).toBe("A");
  });

  it("ค่าว่างตกไปอยู่กลุ่ม fallback", () => {
    const groups = groupChecks([check({ branch_label: null })], (r) => r.branch_label, "— ไม่ระบุ —");
    expect(groups[0].label).toBe("— ไม่ระบุ —");
  });
});

describe("countMissingDocs", () => {
  it("นับจำนวนครั้งของเอกสารแต่ละชนิด เรียงมากไปน้อย", () => {
    const rows = [
      check({ id: "1", missing_docs: ["บัตรประชาชน", "ลอกลาย"] }),
      check({ id: "2", missing_docs: ["บัตรประชาชน"] }),
      check({ id: "3", missing_docs: [] }),
    ];
    expect(countMissingDocs(rows)).toEqual([
      { name: "บัตรประชาชน", count: 2 },
      { name: "ลอกลาย", count: 1 },
    ]);
  });
});

describe("isProblem / rowTone", () => {
  it("รายการปกติไม่ถือว่ามีปัญหา", () => {
    expect(isProblem(check())).toBe(false);
    expect(rowTone(check())).toBe("");
  });

  it("จับได้ทุกแบบที่ต้องตามต่อ", () => {
    expect(isProblem(check({ result: "wrong" }))).toBe(true);
    expect(isProblem(check({ doc_result: "incomplete" }))).toBe(true);
    expect(isProblem(check({ call_result: "no_contact" }))).toBe(true);
    expect(isProblem(check({ info_result: "branch_error" }))).toBe(true);
    expect(isProblem(check({ slip_result: "none" }))).toBe(true);
    expect(isProblem(check({ slip_amount_result: "wrong" }))).toBe(true);
  });

  it("ข้อมูลผิดปกติเป็นแดง สาขาสื่อสารผิดเป็นเหลือง", () => {
    expect(rowTone(check({ info_result: "abnormal" }))).toContain("rose");
    expect(rowTone(check({ info_result: "branch_error" }))).toContain("amber");
    expect(rowTone(check({ result: "wrong" }))).toContain("rose");
  });
});

describe("ตัวช่วยอื่น ๆ", () => {
  it("ปี พ.ศ. ของเอกสาร", () => {
    expect(beYearOf("2026-09-10")).toBe(2569);
  });

  it("ใบที่ส่งผลแล้วแก้ไม่ได้", () => {
    expect(isAuditEditable("draft")).toBe(true);
    expect(isAuditEditable("submitted")).toBe(false);
    expect(isAuditEditable("cancelled")).toBe(false);
  });

  it("ชนิดที่ดึงข้อมูลจากระบบอื่นได้", () => {
    expect(isPullable("sale")).toBe(true);
    expect(isPullable("payment")).toBe(true);
    expect(isPullable("cash")).toBe(false);
    expect(isPullable("custom")).toBe(false);
  });

  it("ข้อความช่วงวันที่", () => {
    expect(rangeLabel("2026-09-01", "2026-09-10")).toBe("2026-09-01 ถึง 2026-09-10");
    expect(rangeLabel("2026-09-01", "2026-09-01")).toBe("2026-09-01");
    expect(rangeLabel(null, null)).toBe("ทุกช่วงเวลา");
  });

  it("จัดรูปจำนวนเงิน", () => {
    expect(formatBaht(null)).toBe("—");
    expect(formatBaht(1234.5)).toContain("1,234.50");
  });

  it("ตรวจข้อมูลตั้งค่า", () => {
    expect(validateDocType({ code: "", name: "x", note: null, sort_order: 1, is_active: true })).toContain("รหัส");
    expect(validateDocType({ code: "A", name: "", note: null, sort_order: 1, is_active: true })).toContain("ชื่อ");
    expect(
      validateCheckType({
        code: "X",
        name: "ตรวจอะไรสักอย่าง",
        kind: "custom",
        description: null,
        has_docs: true,
        has_call: false,
        has_slip: false,
        has_amount: false,
        ref_label: "เลขที่",
        title_label: "เรื่อง",
        party_label: "ผู้เกี่ยว",
        sort_order: 100,
        is_active: true,
      }),
    ).toBeNull();
  });
});

describe("อ่านเงื่อนไขจาก query string", () => {
  it("ใบคุมงาน: ค่าที่ไม่รู้จักถูกตัดทิ้ง", () => {
    const q = auditQueryFromParams({ status: "ไม่รู้จัก", from: "2026-09-01", q: " ตรวจ " });
    expect(q.status).toBeNull();
    expect(q.from).toBe("2026-09-01");
    expect(q.keyword).toBe("ตรวจ");
  });

  it("รายเอกสาร: รับเฉพาะค่าที่อยู่ในชุดสถานะจริง", () => {
    const q = checkQueryFromParams({
      result: "wrong",
      doc_result: "incomplete",
      call_result: "no_contact",
      info_result: "abnormal",
      audit_status: "submitted",
      kind: "sale",
      type_id: "",
    });
    expect(q.result).toBe("wrong");
    expect(q.doc_result).toBe("incomplete");
    expect(q.call_result).toBe("no_contact");
    expect(q.info_result).toBe("abnormal");
    expect(q.audit_status).toBe("submitted");
    expect(q.kind).toBe("sale");
    expect(q.type_id).toBeNull();
  });
});
