import { describe, expect, it } from "vitest";
import {
  amountText,
  applyDecision,
  autoApprovable,
  autoApproveNote,
  buildUserLimits,
  groupLimitsByUser,
  canDecideFinal,
  hasAnyAuthority,
  isOverdue,
  NO_AUTHORITY,
  resolveAuthority,
  sortByUrgency,
  splitByAuthority,
  summarizeInbox,
  userAuthorityFrom,
  validateDecision,
  validateRequest,
  validateUserAuthority,
  withinLimit,
  type DecisionInput,
} from "../src/lib/approval";
import type { ApvLimit, ApvRequestRow, ApvStatus } from "../src/lib/approval-types";

const TYPE_LEAVE = "type-leave";
const TYPE_MONEY = "type-money";
const COMPANY_A = "company-a";

function limit(over: Partial<ApvLimit>): ApvLimit {
  return {
    id: "l1",
    level: null,
    user_id: null,
    type_id: null,
    company_id: null,
    max_amount: 5000,
    can_reject: true,
    is_final: false,
    note: null,
    is_active: true,
    ...over,
  };
}

function request(over: Partial<ApvRequestRow> = {}): ApvRequestRow {
  return {
    id: "r1",
    doc_no: "AV-2569-0001",
    type_id: TYPE_MONEY,
    company_id: COMPANY_A,
    branch_id: null,
    requester_id: "emp1",
    requester_name: "สมชาย ใจดี",
    subject: "ขอเบิกล่วงหน้า",
    detail: null,
    requested_amount: 3000,
    approved_amount: 0,
    status: "pending" as ApvStatus,
    request_date: "2026-09-01",
    needed_by: null,
    decided_at: null,
    decided_by: null,
    decided_by_name: null,
    source_table: null,
    source_id: null,
    source_url: null,
    created_at: "2026-09-01T00:00:00.000Z",
    type_code: "SALARY_ADV",
    type_name: "ขอเบิกเงินเดือนล่วงหน้า",
    type_icon: "💰",
    has_amount: true,
    allow_partial: true,
    amount_label: "จำนวนเงิน (บาท)",
    company_name: "บริษัททดสอบ",
    branch_name: null,
    branch_code: null,
    decision_count: 0,
    endorse_note: null,
    endorse_by_name: null,
    ...over,
  };
}

const decision = (over: Partial<DecisionInput> = {}): DecisionInput => ({
  decision: "approve",
  approvedAmount: 0,
  reasonId: null,
  note: "",
  ...over,
});

const supervisor = { userId: "emp2", level: "supervisor" as const, typeId: TYPE_MONEY, companyId: COMPANY_A };

describe("หาอำนาจอนุมัติจากกฎ", () => {
  it("ระดับ admin ได้ไม่จำกัดวงเงินเสมอ แม้จะไม่มีกฎ หรือมีกฎจำกัดไว้", () => {
    const admin = { userId: "emp1", level: "admin" as const, typeId: TYPE_MONEY, companyId: COMPANY_A };
    expect(resolveAuthority([], admin)).toMatchObject({ maxAmount: null, isFinal: true });
    expect(resolveAuthority([limit({ level: "admin", max_amount: 100 })], admin)).toMatchObject({
      maxAmount: null,
      isFinal: true,
    });
  });

  it("ไม่มีกฎที่ตรงเลย = ไม่มีอำนาจอนุมัติ", () => {
    expect(resolveAuthority([], supervisor)).toEqual(NO_AUTHORITY);
    expect(resolveAuthority([limit({ level: "assistant_admin" })], supervisor)).toEqual(NO_AUTHORITY);
  });

  it("กฎที่ปิดใช้งานไม่ถูกนำมาคิด", () => {
    const rules = [limit({ level: "supervisor", is_active: false })];
    expect(resolveAuthority(rules, supervisor)).toEqual(NO_AUTHORITY);
  });

  it("กฎเจาะจงรายคน ชนะกฎตามระดับ", () => {
    const rules = [
      limit({ id: "by-level", level: "supervisor", max_amount: 5000 }),
      limit({ id: "by-user", user_id: "emp2", max_amount: 20000 }),
    ];
    expect(resolveAuthority(rules, supervisor)).toMatchObject({ maxAmount: 20000, fromLimitId: "by-user" });
  });

  it("กฎเจาะจงประเภทเรื่อง ชนะกฎที่ครอบทุกเรื่อง (ในความเจาะจงระดับเดียวกัน)", () => {
    const rules = [
      limit({ id: "all-types", level: "supervisor", max_amount: 5000 }),
      limit({ id: "this-type", level: "supervisor", type_id: TYPE_MONEY, max_amount: 9000 }),
    ];
    expect(resolveAuthority(rules, supervisor)).toMatchObject({ maxAmount: 9000, fromLimitId: "this-type" });
  });

  it("กฎที่ผูกบริษัทไว้ ใช้ได้เฉพาะบริษัทนั้น", () => {
    const rules = [limit({ level: "supervisor", company_id: "company-other", max_amount: 9000 })];
    expect(resolveAuthority(rules, supervisor)).toEqual(NO_AUTHORITY);
    expect(resolveAuthority(rules, { ...supervisor, companyId: "company-other" })).toMatchObject({
      maxAmount: 9000,
    });
  });

  it("กฎเจาะจงคนของคนอื่น ไม่มีผลกับเรา", () => {
    const rules = [limit({ user_id: "someone-else", max_amount: 99999 })];
    expect(resolveAuthority(rules, supervisor)).toEqual(NO_AUTHORITY);
  });

  it("บอกที่มาของอำนาจเป็นภาษาไทยให้แอดมินอ่านเข้าใจ", () => {
    const rules = [limit({ level: "supervisor", max_amount: 5000 })];
    expect(resolveAuthority(rules, supervisor).reason).toContain("กฎตามระดับการทำงาน");
    expect(resolveAuthority(rules, supervisor).reason).toContain("5,000");
  });
});

describe("อยู่ในวงเงินไหม", () => {
  const auth = (over: Partial<ReturnType<typeof resolveAuthority>>) => ({
    maxAmount: 5000,
    canReject: true,
    isFinal: false,
    fromLimitId: "l1",
    reason: "",
    ...over,
  });

  it("ไม่จำกัดวงเงิน หรือตัดสินขั้นสุดท้ายได้ = ผ่านทุกจำนวน", () => {
    expect(withinLimit(auth({ maxAmount: null }), 999999)).toBe(true);
    expect(withinLimit(auth({ isFinal: true }), 999999)).toBe(true);
  });

  it("เท่ากับวงเงินพอดี ยังอนุมัติได้ เกินไปบาทเดียวไม่ได้", () => {
    expect(withinLimit(auth({}), 5000)).toBe(true);
    expect(withinLimit(auth({}), 5000.01)).toBe(false);
  });

  it("เรื่องที่ไม่มีจำนวนเงิน (เช่น ขอลา) ขอแค่มีอำนาจอยู่บ้างก็ตัดสินได้", () => {
    expect(withinLimit(auth({ maxAmount: 1 }), 0, false)).toBe(true);
    expect(withinLimit(auth({ maxAmount: 0 }), 0, false)).toBe(false);
  });

  it("วงเงิน 0 = ยื่นเรื่องได้แต่อนุมัติไม่ได้", () => {
    expect(hasAnyAuthority(auth({ maxAmount: 0 }))).toBe(false);
    expect(hasAnyAuthority(auth({ maxAmount: 1 }))).toBe(true);
    expect(hasAnyAuthority(auth({ maxAmount: null }))).toBe(true);
  });
});

describe("ตรวจก่อนบันทึกการตัดสิน", () => {
  const within = resolveAuthority([limit({ level: "supervisor", max_amount: 5000 })], supervisor);
  const unlimited = resolveAuthority(
    [limit({ level: "supervisor", max_amount: null, is_final: true })],
    supervisor,
  );

  it("อยู่ในวงเงิน อนุมัติได้", () => {
    expect(validateDecision(request(), within, decision())).toBeNull();
  });

  it("เกินวงเงิน อนุมัติไม่ได้ และข้อความบอกให้กดเสนอแทน", () => {
    const message = validateDecision(request({ requested_amount: 20000 }), within, decision());
    expect(message).toContain("เกินอำนาจ");
    expect(message).toContain("เสนอผู้มีอำนาจสูงกว่า");
  });

  it("เกินวงเงินก็ยังเสนอต่อได้ แต่ต้องใส่ความเห็น", () => {
    const row = request({ requested_amount: 20000 });
    expect(validateDecision(row, within, decision({ decision: "endorse" }))).toContain("ความเห็น");
    expect(
      validateDecision(row, within, decision({ decision: "endorse", note: "ควรอนุมัติ ของจำเป็น" })),
    ).toBeNull();
  });

  it("ผู้มีอำนาจไม่จำกัด ตัดสินเรื่องใหญ่ได้เลย", () => {
    expect(validateDecision(request({ requested_amount: 999999 }), unlimited, decision())).toBeNull();
  });

  it("ไม่อนุมัติต้องเลือกเหตุผล และต้องมีอำนาจปฏิเสธ", () => {
    expect(validateDecision(request(), within, decision({ decision: "reject" }))).toContain("เหตุผล");
    expect(
      validateDecision(request(), within, decision({ decision: "reject", reasonId: "reason-1" })),
    ).toBeNull();

    const noReject = resolveAuthority(
      [limit({ level: "supervisor", can_reject: false })],
      supervisor,
    );
    expect(
      validateDecision(request(), noReject, decision({ decision: "reject", reasonId: "reason-1" })),
    ).toContain("ไม่มีอำนาจปฏิเสธ");
  });

  it("ปฏิเสธเรื่องที่เกินวงเงินตัวเองไม่ได้เหมือนกัน (กันคนวงเงินน้อยไปตัดจบเรื่องใหญ่)", () => {
    const message = validateDecision(
      request({ requested_amount: 20000 }),
      within,
      decision({ decision: "reject", reasonId: "reason-1" }),
    );
    expect(message).toContain("เกินอำนาจ");
  });

  it("อนุมัติบางส่วน ต้องมากกว่า 0 และไม่เกินที่ขอ", () => {
    const row = request({ requested_amount: 3000 });
    expect(validateDecision(row, within, decision({ decision: "partial" }))).toContain("มากกว่า 0");
    expect(
      validateDecision(row, within, decision({ decision: "partial", approvedAmount: 4000 })),
    ).toContain("ไม่เกินจำนวนที่ขอ");
    expect(
      validateDecision(row, within, decision({ decision: "partial", approvedAmount: 2000 })),
    ).toBeNull();
  });

  it("เรื่องที่ห้ามอนุมัติบางส่วน กดบางส่วนไม่ได้", () => {
    const row = request({ allow_partial: false });
    expect(
      validateDecision(row, within, decision({ decision: "partial", approvedAmount: 100 })),
    ).toContain("อนุมัติบางส่วนไม่ได้");
  });

  it("เรื่องที่ปิดไปแล้ว ตัดสินซ้ำไม่ได้", () => {
    for (const status of ["approved", "rejected", "partial", "cancelled"] as ApvStatus[]) {
      expect(validateDecision(request({ status }), within, decision())).toContain("ปิดไปแล้ว");
    }
  });

  it("เรื่องที่เสนอขึ้นมาแล้ว ผู้บริหารยังตัดสินต่อได้", () => {
    expect(validateDecision(request({ status: "endorsed" }), unlimited, decision())).toBeNull();
  });

  it("ไม่มีอำนาจเลย ทำอะไรไม่ได้สักอย่าง", () => {
    expect(validateDecision(request(), NO_AUTHORITY, decision())).toContain("ยังไม่ได้รับอำนาจอนุมัติ");
  });

  it("เรื่องที่ไม่มีจำนวนเงิน (ขอลา) ไม่ติดเรื่องวงเงิน", () => {
    const leave = request({ type_id: TYPE_LEAVE, has_amount: false, requested_amount: 0 });
    expect(validateDecision(leave, within, decision())).toBeNull();
  });
});

describe("ผลของการตัดสิน", () => {
  const approver = { id: "emp2", name: "หัวหน้าสาขา" };
  const now = new Date("2026-09-04T10:30:00.000Z");

  it("อนุมัติตามที่ขอ = ปิดเรื่อง เก็บจำนวนเต็ม วันเวลา และชื่อผู้อนุมัติ", () => {
    const patch = applyDecision(request({ requested_amount: 3000 }), decision(), approver, now);
    expect(patch).toEqual({
      status: "approved",
      approved_amount: 3000,
      decided_at: "2026-09-04T10:30:00.000Z",
      decided_by: "emp2",
      decided_by_name: "หัวหน้าสาขา",
    });
  });

  it("อนุมัติบางส่วน = เก็บจำนวนที่อนุมัติจริง", () => {
    const patch = applyDecision(
      request({ requested_amount: 20000 }),
      decision({ decision: "partial", approvedAmount: 15000 }),
      approver,
      now,
    );
    expect(patch).toMatchObject({ status: "partial", approved_amount: 15000 });
  });

  it("ไม่อนุมัติ = จำนวนที่อนุมัติเป็น 0 แต่ยังบันทึกว่าใครตัดสินเมื่อไร", () => {
    const patch = applyDecision(request(), decision({ decision: "reject", reasonId: "r" }), approver, now);
    expect(patch).toMatchObject({
      status: "rejected",
      approved_amount: 0,
      decided_by_name: "หัวหน้าสาขา",
    });
    expect(patch.decided_at).toBe("2026-09-04T10:30:00.000Z");
  });

  it("เสนอต่อ = เรื่องยังไม่จบ ไม่บันทึกผู้ตัดสินขั้นสุดท้าย", () => {
    const patch = applyDecision(request(), decision({ decision: "endorse", note: "ควรอนุมัติ" }), approver, now);
    expect(patch).toEqual({
      status: "endorsed",
      approved_amount: 0,
      decided_at: null,
      decided_by: null,
      decided_by_name: null,
    });
  });

  it("เรื่องที่ไม่มีจำนวนเงิน อนุมัติแล้วจำนวนยังเป็น 0", () => {
    const leave = request({ has_amount: false, requested_amount: 0 });
    expect(applyDecision(leave, decision(), approver, now)).toMatchObject({
      status: "approved",
      approved_amount: 0,
    });
  });

  it("ปัดเศษสตางค์ให้เรียบร้อย", () => {
    const patch = applyDecision(
      request({ requested_amount: 100 }),
      decision({ decision: "partial", approvedAmount: 33.333 }),
      approver,
      now,
    );
    expect(patch.approved_amount).toBe(33.33);
  });
});

describe("ตรวจใบขอก่อนยื่น", () => {
  const money = { has_amount: true, form_enabled: true, name: "ขอเบิกเงิน" };
  const leave = { has_amount: false, form_enabled: true, name: "ขอลาหยุด" };
  const input = { typeId: TYPE_MONEY, subject: "ขอเบิก", detail: "", requestedAmount: 500, neededBy: null };

  it("ต้องเลือกประเภทเรื่องและกรอกเรื่อง", () => {
    expect(validateRequest(input, null)).toContain("เลือกประเภทเรื่อง");
    expect(validateRequest({ ...input, subject: "  " }, money)).toContain("กรอกเรื่อง");
  });

  it("เรื่องที่มีจำนวนเงิน ต้องกรอกจำนวนมากกว่า 0", () => {
    expect(validateRequest({ ...input, requestedAmount: 0 }, money)).toContain("มากกว่า 0");
    expect(validateRequest({ ...input, requestedAmount: 0 }, leave)).toBeNull();
  });

  it("เรื่องที่ปิดฟอร์มกลางไว้ ยื่นเองไม่ได้ ต้องมาจากโปรแกรมต้นทาง", () => {
    expect(validateRequest(input, { ...money, form_enabled: false })).toContain("โปรแกรมต้นทาง");
  });

  it("กรอกครบถูกต้องแล้วผ่าน", () => {
    expect(validateRequest(input, money)).toBeNull();
  });
});

describe("กล่องรออนุมัติ", () => {
  const rules = [limit({ level: "supervisor", max_amount: 5000 })];
  const authorityOf = (row: ApvRequestRow) =>
    resolveAuthority(rules, { ...supervisor, typeId: row.type_id, companyId: row.company_id });

  it("แยกเป็นกองที่ตัดสินได้ กับกองที่เกินอำนาจ", () => {
    const rows = [
      request({ id: "small", requested_amount: 3000 }),
      request({ id: "big", requested_amount: 20000 }),
      request({ id: "closed", requested_amount: 100, status: "approved" }),
    ];
    const { canDecide, overLimit } = splitByAuthority(rows, authorityOf);
    expect(canDecide.map((r) => r.id)).toEqual(["small"]);
    expect(overLimit.map((r) => r.id)).toEqual(["big"]);
  });

  it("คนที่ไม่มีอำนาจเลย กล่องว่างเปล่า", () => {
    const rows = [request(), request({ requested_amount: 20000 })];
    const { canDecide, overLimit } = splitByAuthority(rows, () => NO_AUTHORITY);
    expect(canDecide).toHaveLength(0);
    expect(overLimit).toHaveLength(0);
  });

  it("เรื่องที่เสนอขึ้นมาแล้วยังอยู่ในกล่อง (ยังไม่จบ)", () => {
    const rows = [request({ id: "e", status: "endorsed", requested_amount: 1000 })];
    expect(splitByAuthority(rows, authorityOf).canDecide.map((r) => r.id)).toEqual(["e"]);
  });

  it("นับสรุปยอด: เรื่องที่ไม่มีจำนวนเงินไม่ถูกนำไปรวมเป็นเงิน", () => {
    const summary = summarizeInbox(
      [request({ requested_amount: 3000 }), request({ has_amount: false, requested_amount: 0 })],
      [request({ requested_amount: 20000, needed_by: "2026-09-01" })],
      2,
      "2026-09-04",
    );
    expect(summary).toEqual({ mine: 2, overLimit: 1, endorsedByMe: 2, overdue: 1, totalAmount: 23000 });
  });

  it("เกินกำหนดนับเฉพาะเรื่องที่ยังไม่จบ", () => {
    expect(isOverdue(request({ needed_by: "2026-09-01" }), "2026-09-04")).toBe(true);
    expect(isOverdue(request({ needed_by: "2026-09-30" }), "2026-09-04")).toBe(false);
    expect(isOverdue(request({ needed_by: null }), "2026-09-04")).toBe(false);
    expect(isOverdue(request({ needed_by: "2026-09-01", status: "approved" }), "2026-09-04")).toBe(false);
  });

  it("เรียงเรื่องด่วนขึ้นก่อน เรื่องไม่มีกำหนดไปท้ายสุด", () => {
    const rows = [
      request({ id: "no-date", needed_by: null, request_date: "2026-09-01" }),
      request({ id: "later", needed_by: "2026-09-20" }),
      request({ id: "soon", needed_by: "2026-09-05" }),
    ];
    expect(sortByUrgency(rows).map((r) => r.id)).toEqual(["soon", "later", "no-date"]);
  });

  it("ตัดสินเรื่องได้เลยไหม ดูจากจำนวนที่ขอ", () => {
    const within = resolveAuthority(rules, supervisor);
    expect(canDecideFinal(within, request({ requested_amount: 5000 }))).toBe(true);
    expect(canDecideFinal(within, request({ requested_amount: 5001 }))).toBe(false);
  });
});

describe("ข้อความจำนวนเงินบนหน้าจอ", () => {
  it("เรื่องที่ไม่มีจำนวนเงินแสดงขีด ไม่ใช่เลข 0", () => {
    expect(amountText(request({ has_amount: false }))).toBe("-");
  });

  it("อนุมัติบางส่วนแสดงทั้งที่อนุมัติและที่ขอ", () => {
    expect(amountText(request({ status: "partial", approved_amount: 1500, requested_amount: 3000 }))).toBe(
      "1,500 / 3,000",
    );
  });

  it("ปกติแสดงจำนวนที่ขอ", () => {
    expect(amountText(request({ requested_amount: 12000 }))).toBe("12,000");
  });
});

describe("อนุมัติอัตโนมัติ: ยอดไม่เกินวงเงินที่ไม่ต้องขออนุมัติ", () => {
  const salary = { has_amount: true, auto_approve_limit: 3000 };

  it("ไม่เกิน 3,000 ผ่านเอง · เท่ากับ 3,000 ก็ผ่าน · เกินต้องขออนุมัติ", () => {
    expect(autoApprovable(salary, 2500)).toBe(true);
    expect(autoApprovable(salary, 3000)).toBe(true);
    expect(autoApprovable(salary, 3000.01)).toBe(false);
  });

  it("ไม่ได้ตั้งวงเงิน (null) = ต้องขออนุมัติทุกใบ", () => {
    expect(autoApprovable({ has_amount: true, auto_approve_limit: null }, 1)).toBe(false);
  });

  it("เรื่องที่ไม่มีจำนวนเงิน ไม่มีอะไรให้เทียบ ต้องขออนุมัติเสมอ", () => {
    expect(autoApprovable({ has_amount: false, auto_approve_limit: 3000 }, 100)).toBe(false);
  });

  it("ยอด 0 หรือติดลบไม่ถือว่าผ่าน", () => {
    expect(autoApprovable(salary, 0)).toBe(false);
    expect(autoApprovable(salary, -5)).toBe(false);
  });

  it("หมายเหตุบอกวงเงินที่ใช้ตัดสิน", () => {
    expect(autoApproveNote(3000)).toContain("3,000");
  });

  it("บันทึกผลอนุมัติอัตโนมัติได้โดยไม่มีรหัสผู้ตัดสิน (ระบบเป็นคนตัดสิน)", () => {
    const patch = applyDecision(
      request({ requested_amount: 2500 }),
      { decision: "approve", approvedAmount: 0, reasonId: null, note: "" },
      { id: null, name: "ระบบอนุมัติอัตโนมัติ" },
      new Date("2026-09-05T03:00:00.000Z"),
    );
    expect(patch.status).toBe("approved");
    expect(patch.approved_amount).toBe(2500);
    expect(patch.decided_by).toBeNull();
    expect(patch.decided_by_name).toBe("ระบบอนุมัติอัตโนมัติ");
    expect(patch.decided_at).toBe("2026-09-05T03:00:00.000Z");
  });
});

describe("ตั้งค่าผู้มีอำนาจอนุมัติรายบุคคล (เลือกคน → ติ๊กเรื่อง → ใส่วงเงิน)", () => {
  const types = [
    { id: TYPE_MONEY, has_amount: true },
    { id: TYPE_LEAVE, has_amount: false },
    { id: "type-disc", has_amount: true },
  ];

  it("สร้างแถวกฎเฉพาะเรื่องที่ติ๊ก เรื่องที่ไม่ติ๊กไม่มีแถว", () => {
    const rows = buildUserLimits({
      userId: "u1",
      companyId: COMPANY_A,
      canReject: true,
      isFinal: false,
      entries: [
        { typeId: TYPE_MONEY, enabled: true, maxAmount: 5000 },
        { typeId: TYPE_LEAVE, enabled: true, maxAmount: null },
        { typeId: "type-disc", enabled: false, maxAmount: 999 },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      level: null,
      user_id: "u1",
      type_id: TYPE_MONEY,
      company_id: COMPANY_A,
      max_amount: 5000,
      can_reject: true,
      is_final: false,
      is_active: true,
    });
    expect(rows[1]).toMatchObject({ type_id: TYPE_LEAVE, max_amount: null });
  });

  it("แถวที่สร้างใช้กับ resolveAuthority ได้ทันที: เรื่องที่ติ๊กมีอำนาจ เรื่องที่ไม่ติ๊กไม่มี", () => {
    const rows = buildUserLimits({
      userId: "u1",
      companyId: null,
      canReject: false,
      isFinal: false,
      entries: [{ typeId: TYPE_MONEY, enabled: true, maxAmount: 8000 }],
    }).map((r, i) => ({ ...r, id: `gen-${i}` }));

    const money = resolveAuthority(rows, { userId: "u1", level: "user", typeId: TYPE_MONEY });
    expect(money.maxAmount).toBe(8000);
    expect(money.canReject).toBe(false);
    expect(hasAnyAuthority(resolveAuthority(rows, { userId: "u1", level: "user", typeId: TYPE_LEAVE }))).toBe(
      false,
    );
  });

  it("ตรวจฟอร์ม: ต้องเลือกคน · วงเงินติดลบไม่ได้ · เว้นว่าง (null) ได้", () => {
    const base = { userId: "u1", companyId: null, canReject: true, isFinal: false, entries: [] };
    expect(validateUserAuthority({ ...base, userId: "" })).toContain("เลือกผู้ใช้");
    expect(
      validateUserAuthority({ ...base, entries: [{ typeId: TYPE_MONEY, enabled: true, maxAmount: -1 }] }),
    ).toContain("ติดลบ");
    expect(
      validateUserAuthority({ ...base, entries: [{ typeId: TYPE_MONEY, enabled: true, maxAmount: null }] }),
    ).toBeNull();
    // เรื่องที่ไม่ติ๊ก ค่าที่ค้างในช่องไม่ต้องสน
    expect(
      validateUserAuthority({ ...base, entries: [{ typeId: TYPE_MONEY, enabled: false, maxAmount: -1 }] }),
    ).toBeNull();
  });

  it("อ่านกฎเดิมกลับมาเป็นค่าเริ่มต้นของฟอร์ม ครบทุกประเภทเรื่อง", () => {
    const limits = [
      limit({ id: "a", user_id: "u1", type_id: TYPE_MONEY, max_amount: 5000, company_id: COMPANY_A, is_final: true }),
      limit({ id: "b", user_id: "u1", type_id: TYPE_LEAVE, max_amount: null, company_id: COMPANY_A, is_final: true }),
      limit({ id: "c", user_id: "u2", type_id: "type-disc", max_amount: 100 }),
      limit({ id: "d", user_id: "u1", type_id: "type-disc", max_amount: 100, is_active: false }),
    ];
    const form = userAuthorityFrom("u1", limits, types);
    expect(form.companyId).toBe(COMPANY_A);
    expect(form.isFinal).toBe(true);
    expect(form.entries).toEqual([
      { typeId: TYPE_MONEY, enabled: true, maxAmount: 5000 },
      { typeId: TYPE_LEAVE, enabled: true, maxAmount: null },
      { typeId: "type-disc", enabled: false, maxAmount: null }, // ปิดใช้งานอยู่ = ไม่ติ๊ก
    ]);
  });

  it("กฎเก่าแบบ 'ทุกประเภทเรื่อง' ของคนนั้น อ่านมาเป็นติ๊กทุกเรื่องด้วยวงเงินเดียวกัน", () => {
    const form = userAuthorityFrom("u1", [limit({ user_id: "u1", type_id: null, max_amount: 2000 })], types);
    expect(form.entries.every((e) => e.enabled)).toBe(true);
    expect(form.entries[0].maxAmount).toBe(2000);
    expect(form.entries[1].maxAmount).toBeNull(); // เรื่องที่ไม่มีจำนวนเงิน
  });

  it("คนที่ยังไม่มีกฎ ได้ฟอร์มว่าง ปฏิเสธได้เป็นค่าเริ่มต้น", () => {
    const form = userAuthorityFrom("nobody", [], types);
    expect(form.entries.every((e) => !e.enabled)).toBe(true);
    expect(form.canReject).toBe(true);
    expect(form.isFinal).toBe(false);
  });

  it("จัดกลุ่มกฎตามคน โดยไม่รวมกฎตามระดับ", () => {
    const groups = groupLimitsByUser([
      limit({ id: "a", user_id: "u1", type_id: TYPE_MONEY }),
      limit({ id: "b", level: "supervisor" }),
      limit({ id: "c", user_id: "u1", type_id: TYPE_LEAVE }),
      limit({ id: "d", user_id: "u2" }),
    ]);
    expect([...groups.keys()]).toEqual(["u1", "u2"]);
    expect(groups.get("u1")?.map((l) => l.id)).toEqual(["a", "c"]);
  });
});
