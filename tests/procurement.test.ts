import { describe, expect, it } from "vitest";
import {
  applyApproval,
  applyRepairUpdate,
  deadlineOf,
  describeRepairUpdate,
  docOptionLabel,
  dueDateOf,
  isOverdue,
  overdueDays,
  payableProblem,
  remainingToPay,
  sumItems,
  summarizeByTag,
  summarizeDocs,
  parseTags,
  tagSlug,
  validateAccount,
  validateApproval,
  validateCancel,
  validatePayment,
  validatePrType,
  validatePurchase,
  validateRepair,
  validateRepairUpdate,
  validateRestore,
} from "../src/lib/procurement";
import type {
  ApprovalInput,
  PaymentItem,
  PrDocRow,
  PurchaseInput,
  RepairInput,
  RepairUpdateInput,
} from "../src/lib/procurement-types";

// ---------- ตัวช่วยสร้างข้อมูลทดสอบ ----------

function repair(over: Partial<RepairInput> = {}): RepairInput {
  return {
    request_date: "2026-09-01",
    company_id: "co1",
    branch_id: "br1",
    item_name: "แอร์ห้องประชุมไม่เย็น",
    asset_type_id: "at3",
    damage_detail: "คอมเพรสเซอร์ไม่ทำงาน",
    urgency: "d2_5",
    created_by: "e1",
    created_by_name: "สมชาย ใจดี",
    cancelled_at: null,
    cancelled_by: null,
    cancel_reason: null,
    requested_amount: 3500,
    approved_amount: 0,
    actual_amount: 0,
    tech_name: null,
    tech_phone: null,
    tech_kind: "external",
    doc_status: "active",
    pay_status: "requested",
    job_status: "wait_tech",
    approve_status: "pending",
    reject_reason: null,
    reject_note: null,
    approval_no: null,
    approved_date: null,
    approved_by: null,
    tech_visit_date: null,
    expected_done_date: null,
    fixed_date: null,
    note: null,
    ...over,
  };
}

function purchase(over: Partial<PurchaseInput> = {}): PurchaseInput {
  return {
    request_date: "2026-09-01",
    company_id: "co1",
    branch_id: "br1",
    supplier_name: "ร้านวัสดุดี",
    supplier_phone: "0812345678",
    item_name: "โต๊ะทำงาน 2 ตัว",
    material_type_id: "mt8",
    reason: "ของเดิมชำรุด",
    urgency: "d5_plus",
    created_by: "e1",
    created_by_name: "สมชาย ใจดี",
    cancelled_at: null,
    cancelled_by: null,
    cancel_reason: null,
    requested_amount: 8000,
    approved_amount: 0,
    actual_amount: 0,
    doc_status: "active",
    pay_status: "requested",
    approve_status: "pending",
    reject_reason: null,
    reject_note: null,
    approval_no: null,
    approved_date: null,
    approved_by: null,
    received_date: null,
    note: null,
    ...over,
  };
}

function update(over: Partial<RepairUpdateInput> = {}): RepairUpdateInput {
  return {
    update_date: "2026-09-03",
    repair_id: "r1",
    job_status: null,
    detail: null,
    expected_done_date: null,
    requested_amount: null,
    recorded_by: "e1",
    recorded_by_name: "สมชาย ใจดี",
    ...over,
  };
}

function doc(over: Partial<PrDocRow> = {}): PrDocRow {
  return {
    kind: "repair",
    id: "r1",
    doc_no: "RQ-2569-0001",
    doc_date: "2026-09-01",
    company_id: "co1",
    company_name: "บริษัทของฉัน",
    branch_id: "br1",
    branch_name: "สำนักงานใหญ่",
    item_name: "แอร์ห้องประชุมไม่เย็น",
    type_name: "เครื่องปรับอากาศ",
    urgency: "d2_5",
    requested_amount: 3500,
    approved_amount: 0,
    actual_amount: 0,
    doc_status: "active",
    pay_status: "requested",
    approve_status: "pending",
    reject_reason: null,
    reject_note: null,
    approval_no: null,
    approved_date: null,
    approved_by: null,
    job_status: "wait_tech",
    expected_done_date: null,
    done_date: null,
    cancelled_by_name: null,
    created_by: "e1",
    created_by_name: "สมชาย ใจดี",
    cancelled_at: null,
    cancelled_by: null,
    cancel_reason: null,
    note: null,
    created_at: "2026-09-01T02:00:00.000Z",
    ...over,
  };
}

function approval(over: Partial<ApprovalInput> = {}): ApprovalInput {
  return {
    approve_date: "2026-09-02",
    approver_id: "e9",
    approver_name: "ผู้จัดการ",
    decision: "approved",
    reject_reason: null,
    approved_amount: 3000,
    note: null,
    repair_id: "r1",
    purchase_id: null,
    ...over,
  };
}

// ---------- ความเร่งด่วนและกำหนดเสร็จ ----------

describe("กำหนดเสร็จตามความเร่งด่วน", () => {
  it("บวกวันตามระดับความเร่งด่วนทั้ง 3 ระดับ", () => {
    expect(dueDateOf("2026-09-01", "d1_2")).toBe("2026-09-03");
    expect(dueDateOf("2026-09-01", "d2_5")).toBe("2026-09-06");
    expect(dueDateOf("2026-09-01", "d5_plus")).toBe("2026-09-11");
  });

  it("ข้ามเดือนและข้ามปีได้ถูกต้อง", () => {
    expect(dueDateOf("2026-09-28", "d2_5")).toBe("2026-10-03");
    expect(dueDateOf("2026-12-28", "d5_plus")).toBe("2027-01-07");
  });

  it("ถ้าระบุวันที่คาดว่าจะเสร็จไว้ ให้ยึดวันนั้นแทนความเร่งด่วน", () => {
    expect(deadlineOf(doc({ expected_done_date: "2026-09-20" }))).toBe("2026-09-20");
    expect(deadlineOf(doc())).toBe("2026-09-06");
  });
});

describe("งานเกินกำหนด", () => {
  it("ยังไม่ถึงกำหนดและวันครบกำหนดพอดี ยังไม่ถือว่าเกิน", () => {
    expect(isOverdue(doc(), "2026-09-05")).toBe(false);
    expect(isOverdue(doc(), "2026-09-06")).toBe(false);
  });

  it("เลยวันครบกำหนดแล้วถือว่าเกิน และนับจำนวนวันได้", () => {
    expect(isOverdue(doc(), "2026-09-07")).toBe(true);
    expect(overdueDays(doc(), "2026-09-09")).toBe(3);
    expect(overdueDays(doc(), "2026-09-05")).toBe(0);
  });

  it("งานที่เสร็จแล้ว ยกเลิก หรือไม่อนุมัติ ไม่นับว่าเกินกำหนด", () => {
    expect(isOverdue(doc({ done_date: "2026-09-04" }), "2026-09-30")).toBe(false);
    expect(isOverdue(doc({ doc_status: "cancelled" }), "2026-09-30")).toBe(false);
    expect(isOverdue(doc({ approve_status: "rejected" }), "2026-09-30")).toBe(false);
  });
});

// ---------- ผลักสถานะจากใบ update ขึ้นใบขอซ่อม ----------

describe("applyRepairUpdate", () => {
  it("ช่องที่เป็น null แปลว่าไม่เปลี่ยน จึงไม่อยู่ใน patch", () => {
    expect(applyRepairUpdate(repair(), update())).toEqual({});
  });

  it("บันทึกสถานะงานเป็นเสร็จแล้ว ตั้งวันที่ได้รับการแก้ไขให้อัตโนมัติ", () => {
    const patch = applyRepairUpdate(repair(), update({ job_status: "done" }));
    expect(patch.job_status).toBe("done");
    expect(patch.fixed_date).toBe("2026-09-03");
  });

  it("ถ้าใบขอซ่อมมีวันที่แก้ไขเสร็จอยู่แล้ว ไม่ทับของเดิม", () => {
    const patch = applyRepairUpdate(
      repair({ fixed_date: "2026-09-02" }),
      update({ job_status: "done" }),
    );
    expect(patch.fixed_date).toBe("2026-09-02");
  });

  it("เปลี่ยนสถานะเป็นระหว่างซ่อม ไม่ตั้งวันที่แก้ไขเสร็จ", () => {
    const patch = applyRepairUpdate(repair(), update({ job_status: "in_progress" }));
    expect(patch.job_status).toBe("in_progress");
    expect(patch.fixed_date).toBeUndefined();
  });

  it("อัปเดตวันที่คาดว่าจะเสร็จและยอดที่ขออนุมัติ รวมถึงยอด 0", () => {
    const patch = applyRepairUpdate(
      repair(),
      update({ expected_done_date: "2026-09-15", requested_amount: 0 }),
    );
    expect(patch.expected_done_date).toBe("2026-09-15");
    expect(patch.requested_amount).toBe(0);
  });
});

// ---------- ผลการอนุมัติ ----------

describe("applyApproval", () => {
  it("อนุมัติ — ตั้งยอดที่อนุมัติและเลื่อนสถานะเบิกเงิน", () => {
    const patch = applyApproval(doc(), approval({ approved_amount: 3000 }));
    expect(patch).toEqual({
      approve_status: "approved",
      reject_reason: null,
      approved_amount: 3000,
      pay_status: "approved",
    });
  });

  it("อนุมัติโดยไม่กรอกยอด ใช้ยอดที่ขอเบิกเป็นยอดอนุมัติ", () => {
    const patch = applyApproval(doc(), approval({ approved_amount: 0 }));
    expect(patch.approved_amount).toBe(3500);
  });

  it("ไม่อนุมัติ — ยอดอนุมัติเป็น 0 เก็บสาเหตุไว้ และย้อนสถานะเบิกเงิน", () => {
    const patch = applyApproval(
      doc({ pay_status: "approved" }),
      approval({ decision: "rejected", reject_reason: "price_high", approved_amount: 3000 }),
    );
    expect(patch).toEqual({
      approve_status: "rejected",
      reject_reason: "price_high",
      approved_amount: 0,
      pay_status: "requested",
    });
  });

  it("ให้ไปหาราคาใหม่ — กลับไปสถานะรออนุมัติ", () => {
    const patch = applyApproval(
      doc(),
      approval({ decision: "recheck", reject_reason: "find_new", approved_amount: 0 }),
    );
    expect(patch.approve_status).toBe("pending");
    expect(patch.reject_reason).toBe("find_new");
    expect(patch.approved_amount).toBe(0);
  });

  it("เอกสารที่จ่ายเงินไปแล้ว ไม่ย้อนสถานะเบิกเงินกลับ", () => {
    const patch = applyApproval(
      doc({ pay_status: "settled" }),
      approval({ decision: "rejected", reject_reason: "use_old" }),
    );
    expect(patch.pay_status).toBe("settled");
  });
});

// ---------- ตรวจค่าก่อนบันทึก ----------

describe("validateRepair", () => {
  it("ผ่านเมื่อกรอกครบ", () => {
    expect(validateRepair(repair())).toBeNull();
  });

  it("ต้องกรอกรายการที่ต้องซ่อม", () => {
    expect(validateRepair(repair({ item_name: "   " }))).toContain("รายการที่ต้องซ่อม");
  });

  it("จำนวนเงินติดลบไม่ได้", () => {
    expect(validateRepair(repair({ requested_amount: -1 }))).toContain("ติดลบ");
  });

  it("ไม่อนุมัติแต่ไม่ระบุเหตุผล ไม่ผ่าน", () => {
    expect(validateRepair(repair({ approve_status: "rejected" }))).toContain("เหตุผลไม่อนุมัติ");
    expect(
      validateRepair(repair({ approve_status: "rejected", reject_reason: "price_high" })),
    ).toBeNull();
  });

  it("งานที่แก้ไขแล้วต้องมีวันที่ได้รับการแก้ไข", () => {
    expect(validateRepair(repair({ job_status: "done" }))).toContain("วันที่ที่ได้รับการแก้ไข");
    expect(validateRepair(repair({ job_status: "done", fixed_date: "2026-09-05" }))).toBeNull();
  });

  it("วันที่คาดว่าจะเสร็จต้องไม่ก่อนวันที่แจ้ง", () => {
    expect(validateRepair(repair({ expected_done_date: "2026-08-31" }))).toContain(
      "ไม่ก่อนวันที่แจ้งซ่อม",
    );
  });
});

describe("validateRepairUpdate", () => {
  it("ต้องมีอย่างน้อยหนึ่งอย่างที่เปลี่ยนจริง", () => {
    expect(validateRepairUpdate(update())).toContain("อย่างน้อยหนึ่งอย่าง");
  });

  it("มีแค่รูปแนบก็ถือว่าเป็นการ update ที่มีความหมาย", () => {
    expect(validateRepairUpdate({ ...update(), photoCount: 2 })).toBeNull();
  });

  it("ยอดที่ขออนุมัติเป็น 0 นับว่าเป็นการเปลี่ยน", () => {
    expect(validateRepairUpdate(update({ requested_amount: 0 }))).toBeNull();
  });

  it("ต้องเลือกใบขอซ่อมก่อน", () => {
    expect(validateRepairUpdate(update({ repair_id: "", job_status: "done" }))).toContain(
      "เลือกใบขอซ่อม",
    );
  });
});

describe("validatePurchase", () => {
  it("ผ่านเมื่อกรอกครบ", () => {
    expect(validatePurchase(purchase())).toBeNull();
  });

  it("ต้องกรอกรายการที่ขอซื้อ", () => {
    expect(validatePurchase(purchase({ item_name: "" }))).toContain("รายการที่ขอซื้อ");
  });

  it("วันที่ได้รับวัสดุต้องไม่ก่อนวันที่ขอซื้อ", () => {
    expect(validatePurchase(purchase({ received_date: "2026-08-20" }))).toContain(
      "ไม่ก่อนวันที่ขอจัดซื้อ",
    );
  });
});

describe("validateApproval", () => {
  const target = doc();

  it("อนุมัติเกินยอดที่ขอเบิกไม่ได้", () => {
    expect(validateApproval(approval({ approved_amount: 4000 }), target)).toContain("ไม่เกิน");
    expect(validateApproval(approval({ approved_amount: 3500 }), target)).toBeNull();
  });

  it("ไม่อนุมัติต้องเลือกสาเหตุ", () => {
    expect(validateApproval(approval({ decision: "rejected" }), target)).toContain("สาเหตุ");
    expect(
      validateApproval(approval({ decision: "rejected", reject_reason: "use_old" }), target),
    ).toBeNull();
  });

  it("เอกสารที่ถูกยกเลิกหรือหายไปแล้ว อนุมัติไม่ได้", () => {
    expect(validateApproval(approval(), null)).toContain("ไม่พบเอกสาร");
    expect(validateApproval(approval(), doc({ doc_status: "cancelled" }))).toContain("ยกเลิก");
  });

  // ---------- เปลี่ยนใจภายหลัง (ปุ่มแก้ไขผลอนุมัติ) ----------

  it("เอกสารที่อนุมัติแล้วแต่ยังไม่จ่ายเงิน เปลี่ยนเป็นไม่อนุมัติได้", () => {
    const approved = doc({ approve_status: "approved", approved_amount: 3000, actual_amount: 0 });
    expect(
      validateApproval(approval({ decision: "rejected", reject_reason: "price_high" }), approved),
    ).toBeNull();
  });

  it("จ่ายเงินไปแล้ว เปลี่ยนเป็นไม่อนุมัติหรือให้หาราคาใหม่ไม่ได้", () => {
    const paid = doc({ approve_status: "approved", approved_amount: 3000, actual_amount: 3000 });
    expect(
      validateApproval(approval({ decision: "rejected", reject_reason: "price_high" }), paid),
    ).toContain("จ่ายเงินไปแล้ว");
    expect(validateApproval(approval({ decision: "recheck" }), paid)).toContain("จ่ายเงินไปแล้ว");
  });

  it("จ่ายบางส่วนแล้ว ยังปรับยอดที่อนุมัติขึ้นหรือเท่าเดิมได้ แต่ลดต่ำกว่ายอดที่จ่ายไม่ได้", () => {
    const partly = doc({ approve_status: "approved", approved_amount: 3000, actual_amount: 2000 });
    expect(validateApproval(approval({ approved_amount: 2500 }), partly)).toBeNull();
    expect(validateApproval(approval({ approved_amount: 2000 }), partly)).toBeNull();
    expect(validateApproval(approval({ approved_amount: 1500 }), partly)).toContain(
      "ต่ำกว่ายอดที่จ่ายไปแล้ว",
    );
  });
});

describe("validatePayment (ใบเบิกเงินสดย่อย)", () => {
  const approved = doc({ approve_status: "approved", approved_amount: 3000, actual_amount: 0 });
  const targets = new Map([["r1", approved]]);
  const items: PaymentItem[] = [{ repair_id: "r1", purchase_id: null, amount: 3000 }];

  const base = {
    pay_date: "2026-09-10",
    paid_amount: 3000,
    payee_name: "ร้านแอร์ดี",
    expense_detail: "ค่าซ่อมแอร์ห้องประชุม",
    company_id: "co1",
    branch_id: "br1",
  };

  it("อ้างใบขอซ่อมที่อนุมัติแล้ว ผ่าน", () => {
    expect(validatePayment(base, items, targets)).toBeNull();
  });

  it("รายการทั่วไปที่ไม่อ้างเอกสารเลย ก็จ่ายได้", () => {
    expect(validatePayment(base, [], new Map())).toBeNull();
  });

  it("เอกสารที่ยังไม่ผ่านอนุมัติ ก็จ่ายจากหน้าเงินสดย่อยได้", () => {
    const pending = new Map([["r1", doc({ approve_status: "pending" })]]);
    expect(validatePayment(base, items, pending)).toBeNull();
  });

  it("ต้องเลือกบริษัทและสาขา เพราะเลขที่ใบเบิกรันแยกตามสาขา", () => {
    expect(validatePayment({ ...base, company_id: null }, [], new Map())).toContain("บริษัท");
    expect(validatePayment({ ...base, branch_id: null }, [], new Map())).toContain("สาขา");
  });

  it("ต้องกรอกชื่อผู้รับเงิน", () => {
    expect(validatePayment({ ...base, payee_name: "  " }, [], new Map())).toContain("ผู้รับเงิน");
  });

  it("ต้องกรอกรายการค่าใช้จ่าย", () => {
    expect(validatePayment({ ...base, expense_detail: " " }, [], new Map())).toContain(
      "รายการค่าใช้จ่าย",
    );
  });

  it("จำนวนเงินต้องมากกว่า 0", () => {
    expect(validatePayment({ ...base, paid_amount: 0 }, [], new Map())).toContain("มากกว่า 0");
  });

  it("ยอดที่กระจายลงเอกสารต้องไม่เกินจำนวนเงินที่จ่ายจริง", () => {
    const over: PaymentItem[] = [{ repair_id: "r1", purchase_id: null, amount: 4000 }];
    expect(validatePayment(base, over, targets)).toContain("มากกว่าจำนวนเงินที่จ่ายจริง");
  });

  it("จ่ายมากกว่ายอดที่กระจายลงเอกสารได้ (ส่วนต่างเป็นรายการทั่วไปในใบเดียวกัน)", () => {
    expect(validatePayment({ ...base, paid_amount: 3500 }, items, targets)).toBeNull();
  });
});

describe("validateAccount (ผังบัญชี)", () => {
  const input = {
    code: "5110",
    name: "ค่าซ่อมแซมอาคาร",
    category: "expense" as const,
    parent_id: null,
    sort_order: 0,
    is_active: true,
  };

  it("ผ่านเมื่อกรอกครบ", () => {
    expect(validateAccount(input, null)).toBeNull();
  });

  it("ต้องมีรหัสและชื่อบัญชี", () => {
    expect(validateAccount({ ...input, code: "" }, null)).toContain("รหัสบัญชี");
    expect(validateAccount({ ...input, name: " " }, null)).toContain("ชื่อบัญชี");
  });

  it("บัญชีย่อยต้องอยู่หมวดเดียวกับบัญชีคุม", () => {
    const parent = { id: "a1", code: "1000", category: "asset" as const };
    expect(validateAccount({ ...input, parent_id: "a1" }, parent)).toContain("หมวดเดียวกับบัญชีคุม");
    expect(
      validateAccount({ ...input, category: "asset", parent_id: "a1" }, parent),
    ).toBeNull();
  });

  it("เลือกตัวเองเป็นบัญชีคุมไม่ได้", () => {
    const self = { id: "x1", code: "5000", category: "expense" as const };
    expect(validateAccount({ ...input, parent_id: "x1" }, self, "x1")).toContain("ตัวมันเอง");
  });
});

describe("validatePrType", () => {
  it("ต้องมีทั้งรหัสและชื่อ", () => {
    expect(validatePrType({ code: "", name: "แอร์", sort_order: 0, is_active: true }, "ประเภททรัพย์สิน")).toContain(
      "รหัสประเภททรัพย์สิน",
    );
    expect(validatePrType({ code: "AS01", name: "", sort_order: 0, is_active: true }, "ประเภทวัสดุ")).toContain(
      "ชื่อประเภทวัสดุ",
    );
    expect(
      validatePrType({ code: "AS01", name: "เครื่องปรับอากาศ", sort_order: 0, is_active: true }, "ประเภททรัพย์สิน"),
    ).toBeNull();
  });
});

// ---------- ยอดเงิน ----------

describe("ยอดคงเหลือและผลรวม", () => {
  it("จ่ายบางส่วน จ่ายครบ และจ่ายเกิน", () => {
    expect(remainingToPay({ approved_amount: 3000, actual_amount: 1000 })).toBe(2000);
    expect(remainingToPay({ approved_amount: 3000, actual_amount: 3000 })).toBe(0);
    expect(remainingToPay({ approved_amount: 3000, actual_amount: 3500 })).toBe(0);
  });

  it("รวมยอดรายการโดยไม่มีเศษทศนิยมเพี้ยน", () => {
    expect(
      sumItems([
        { repair_id: "r1", purchase_id: null, amount: 0.1 },
        { repair_id: null, purchase_id: "p1", amount: 0.2 },
      ]),
    ).toBe(0.3);
  });

  it("บอกเหตุผลที่เอกสารยังเบิกจ่ายไม่ได้", () => {
    expect(payableProblem(doc({ approve_status: "approved", approved_amount: 3000 }))).toBeNull();
    expect(payableProblem(doc())).toBe("รออนุมัติ");
    expect(payableProblem(doc({ doc_status: "cancelled" }))).toBe("เอกสารถูกยกเลิกแล้ว");
    expect(
      payableProblem(doc({ approve_status: "approved", approved_amount: 3000, actual_amount: 3000 })),
    ).toBe("เบิกจ่ายครบแล้ว");
  });
});

// ---------- สรุปสำหรับ dashboard ----------

describe("summarizeDocs", () => {
  it("รวมยอดและนับแยกตามสถานะ พร้อมนับงานเกินกำหนด", () => {
    const rows = [
      doc({ requested_amount: 1000, approved_amount: 900, actual_amount: 900, approve_status: "approved", pay_status: "settled", job_status: "done", done_date: "2026-09-04" }),
      doc({ id: "r2", requested_amount: 2000, urgency: "d1_2" }),
      doc({ id: "p1", kind: "purchase", requested_amount: 500, job_status: null, doc_status: "cancelled" }),
    ];
    const summary = summarizeDocs(rows, "2026-09-20");

    expect(summary.total).toBe(3);
    expect(summary.requested).toBe(3500);
    expect(summary.approved).toBe(900);
    expect(summary.actual).toBe(900);
    expect(summary.overdue).toBe(1);
    expect(summary.byJobStatus.done).toBe(1);
    expect(summary.byJobStatus.wait_tech).toBe(1);
    expect(summary.byApproveStatus.approved).toBe(1);
    expect(summary.byDocStatus.cancelled).toBe(1);
    expect(summary.byUrgency.d1_2).toBe(1);
  });

  it("ไม่มีข้อมูลก็ต้องได้ศูนย์ครบทุกช่อง ไม่ใช่ undefined", () => {
    const summary = summarizeDocs([], "2026-09-20");
    expect(summary.total).toBe(0);
    expect(summary.byPayStatus.settled).toBe(0);
    expect(summary.byJobStatus.in_progress).toBe(0);
  });
});

// ---------- ข้อความบนหน้าจอ ----------

describe("ข้อความสรุป", () => {
  it("อธิบายใบ update ตามสิ่งที่บันทึกจริง", () => {
    expect(
      describeRepairUpdate({
        job_status: "in_progress",
        expected_done_date: "2026-09-10",
        requested_amount: 3500,
        detail: "ช่างสั่งอะไหล่แล้ว",
        photo_count: 2,
      }),
    ).toBe("อยู่ระหว่างการซ่อม · คาดว่าเสร็จ 2026-09-10 · ขออนุมัติ 3,500 บาท · ช่างสั่งอะไหล่แล้ว · แนบรูป 2 รูป");
  });

  it("ไม่ได้บันทึกอะไรเลย ใช้ข้อความกลาง", () => {
    expect(
      describeRepairUpdate({
        job_status: null,
        expected_done_date: null,
        requested_amount: null,
        detail: null,
      }),
    ).toBe("บันทึกเพิ่มเติม");
  });

  it("ป้ายกำกับเอกสารในกล่องตัวเลือก", () => {
    expect(docOptionLabel(doc())).toBe("RQ-2569-0001 · แอร์ห้องประชุมไม่เย็น · 3,500 บาท");
  });
});

// ---------- ป้ายกำกับ ----------

describe("parseTags / tagSlug", () => {
  it("รับได้ทั้งแบบมี # และแบบคั่นด้วยจุลภาค", () => {
    expect(parseTags("#ค่าน้ำมัน #ซ่อมด่วน").map((t) => t.name)).toEqual(["ค่าน้ำมัน", "ซ่อมด่วน"]);
    expect(parseTags("ค่าน้ำมัน, ซ่อมด่วน").map((t) => t.name)).toEqual(["ค่าน้ำมัน", "ซ่อมด่วน"]);
  });

  it("ป้ายที่ต่างกันแค่ตัวพิมพ์หรือช่องว่าง ถือเป็นป้ายเดียวกัน", () => {
    expect(tagSlug("#Fuel")).toBe(tagSlug("fuel"));
    expect(tagSlug("  ค่า  น้ำมัน  ")).toBe("ค่า น้ำมัน");
    expect(parseTags("Fuel, fuel, FUEL")).toHaveLength(1);
  });

  it("ตัดป้ายว่างและป้ายที่ยาวเกินไปทิ้ง", () => {
    expect(parseTags("#, ,  ")).toEqual([]);
    expect(parseTags("ก".repeat(61))).toEqual([]);
  });

  it("จำกัดจำนวนป้ายตามที่กำหนด", () => {
    expect(parseTags("a,b,c,d,e,f", 3)).toHaveLength(3);
  });

  it("เก็บชื่อที่แสดงตามที่ผู้ใช้พิมพ์ แต่ตัด # กับช่องว่างส่วนเกินออก", () => {
    expect(parseTags("  #ค่าน้ำมัน รถส่งของ  ")[0]).toEqual({
      name: "ค่าน้ำมัน รถส่งของ",
      slug: "ค่าน้ำมัน รถส่งของ",
    });
  });
});

describe("summarizeByTag", () => {
  const row = (payment_id: string, amount: number, tag_id: string | null, tag_name: string | null) =>
    ({ payment_id, paid_amount: amount, tag_id, tag_name }) as const;

  it("รวมยอดและนับใบแยกตามป้าย", () => {
    const s = summarizeByTag([
      row("p1", 100, "t1", "ค่าน้ำมัน"),
      row("p2", 200, "t1", "ค่าน้ำมัน"),
      row("p3", 50, "t2", "ซ่อมด่วน"),
    ]);
    expect(s.lines[0]).toEqual({ tag_id: "t1", tag_name: "ค่าน้ำมัน", count: 2, amount: 300 });
    expect(s.lines[1]).toEqual({ tag_id: "t2", tag_name: "ซ่อมด่วน", count: 1, amount: 50 });
    expect(s.totalPayments).toBe(3);
    expect(s.totalAmount).toBe(350);
  });

  it("ใบที่ติดหลายป้าย นับเข้าทุกป้าย แต่ยอดรวมทั้งหมดนับใบละครั้ง", () => {
    const s = summarizeByTag([
      row("p1", 100, "t1", "ค่าน้ำมัน"),
      row("p1", 100, "t2", "ซ่อมด่วน"),
    ]);
    expect(s.lines.find((l) => l.tag_id === "t1")?.amount).toBe(100);
    expect(s.lines.find((l) => l.tag_id === "t2")?.amount).toBe(100);
    expect(s.totalPayments).toBe(1);
    expect(s.totalAmount).toBe(100);
  });

  it("ใบที่ยังไม่ติดป้ายรวมเป็นกลุ่มเดียว และอยู่ท้ายสุดเสมอ", () => {
    const s = summarizeByTag([
      row("p1", 10, null, null),
      row("p2", 999, "t1", "ค่าน้ำมัน"),
      row("p3", 20, null, null),
    ]);
    const last = s.lines[s.lines.length - 1];
    expect(last.tag_id).toBeNull();
    expect(last.tag_name).toContain("ยังไม่ติดป้าย");
    expect(last.count).toBe(2);
    expect(last.amount).toBe(30);
  });

  it("ไม่มีข้อมูลก็ต้องได้ผลลัพธ์ว่างที่ใช้งานได้", () => {
    expect(summarizeByTag([])).toEqual({ lines: [], totalPayments: 0, totalAmount: 0 });
  });
});

describe("validateCancel", () => {
  const owner = { userId: "e1", canCancelOthers: false, isApprover: false };
  const other = { userId: "e9", canCancelOthers: false, isApprover: false };
  const manager = { userId: "e9", canCancelOthers: true, isApprover: false };
  const approver = { userId: "e9", canCancelOthers: false, isApprover: true };

  it("เจ้าของใบยกเลิกใบที่ยังรออนุมัติของตัวเองได้", () => {
    expect(validateCancel(doc(), owner)).toBeNull();
  });

  it("ใบที่ให้หาราคาใหม่ เจ้าของก็ยังยกเลิกได้", () => {
    expect(validateCancel(doc({ approve_status: "recheck" }), owner)).toBeNull();
  });

  it("คนอื่นที่ไม่มีสิทธิ์ ยกเลิกใบของคนอื่นไม่ได้", () => {
    expect(validateCancel(doc(), other)).toContain("ตัวเองเป็นคนบันทึก");
  });

  it("ผู้ที่ได้รับสิทธิ์ยกเลิกเอกสารของผู้อื่น ยกเลิกใบของคนอื่นได้", () => {
    expect(validateCancel(doc(), manager)).toBeNull();
  });

  it("ใบที่อนุมัติแล้ว เจ้าของยกเลิกเองไม่ได้", () => {
    expect(validateCancel(doc({ approve_status: "approved" }), owner)).toContain("ผู้มีอำนาจอนุมัติ");
  });

  it("ใบที่อนุมัติแล้ว ผู้ที่มีสิทธิ์ยกเลิกใบคนอื่นก็ยังยกเลิกไม่ได้", () => {
    expect(validateCancel(doc({ approve_status: "approved" }), manager)).toContain(
      "ผู้มีอำนาจอนุมัติ",
    );
  });

  it("ใบที่ไม่อนุมัติแล้ว ผู้มีอำนาจอนุมัติยกเลิกได้", () => {
    expect(validateCancel(doc({ approve_status: "rejected" }), approver)).toBeNull();
  });

  it("ใบที่จ่ายเงินไปแล้ว ยกเลิกไม่ได้แม้แต่ผู้มีอำนาจอนุมัติ", () => {
    const paid = doc({ approve_status: "approved", approved_amount: 3000, actual_amount: 3000 });
    expect(validateCancel(paid, approver)).toContain("จ่ายเงินไปแล้ว");
    expect(validateCancel(paid, owner)).toContain("จ่ายเงินไปแล้ว");
  });

  it("ใบที่ยกเลิกไปแล้ว ยกเลิกซ้ำไม่ได้", () => {
    expect(validateCancel(doc({ doc_status: "cancelled" }), approver)).toContain("ยกเลิกไปแล้ว");
  });

  it("ไม่พบเอกสารก็บอกให้รู้", () => {
    expect(validateCancel(null, approver)).toContain("ไม่พบเอกสาร");
  });
});

describe("validateRestore", () => {
  const owner = { userId: "e1", canCancelOthers: false, isApprover: false };
  const other = { userId: "e9", canCancelOthers: false, isApprover: false };
  const approver = { userId: "e9", canCancelOthers: false, isApprover: true };
  const cancelled = (over: Partial<PrDocRow> = {}) => doc({ doc_status: "cancelled", ...over });

  it("เจ้าของใบดึงใบที่ตัวเองยกเลิกกลับมาได้", () => {
    expect(validateRestore(cancelled(), owner)).toBeNull();
  });

  it("คนอื่นที่ไม่มีสิทธิ์ ดึงกลับไม่ได้", () => {
    expect(validateRestore(cancelled(), other)).toContain("ตัวเองเป็นคนบันทึก");
  });

  it("ใบที่ยังใช้งานอยู่ ไม่ต้องดึงกลับ", () => {
    expect(validateRestore(doc(), owner)).toContain("ยังใช้งานอยู่");
  });

  it("ใบที่ผ่านการพิจารณาแล้ว ดึงกลับได้เฉพาะผู้มีอำนาจอนุมัติ", () => {
    expect(validateRestore(cancelled({ approve_status: "approved" }), owner)).toContain(
      "ผู้มีอำนาจอนุมัติ",
    );
    expect(validateRestore(cancelled({ approve_status: "approved" }), approver)).toBeNull();
  });
});
