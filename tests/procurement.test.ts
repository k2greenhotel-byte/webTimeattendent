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
  summarizeDocs,
  validateApproval,
  validatePayment,
  validatePrType,
  validatePurchase,
  validateRepair,
  validateRepairUpdate,
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
    requested_amount: 8000,
    approved_amount: 0,
    actual_amount: 0,
    doc_status: "active",
    pay_status: "requested",
    approve_status: "pending",
    reject_reason: null,
    reject_note: null,
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
    job_status: "wait_tech",
    expected_done_date: null,
    done_date: null,
    created_by: "e1",
    created_by_name: "สมชาย ใจดี",
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
});

describe("validatePayment", () => {
  const approved = doc({
    approve_status: "approved",
    approved_amount: 3000,
    actual_amount: 0,
  });
  const targets = new Map([["r1", approved]]);
  const items: PaymentItem[] = [{ repair_id: "r1", purchase_id: null, amount: 3000 }];

  it("ผ่านเมื่อยอดตรงกับผลรวมรายการ", () => {
    expect(validatePayment({ pay_date: "2026-09-10", paid_amount: 3000 }, items, targets)).toBeNull();
  });

  it("ไม่เลือกเอกสารสักใบ ไม่ผ่าน", () => {
    expect(validatePayment({ pay_date: "2026-09-10", paid_amount: 0 }, [], targets)).toContain(
      "อย่างน้อยหนึ่งใบ",
    );
  });

  it("เบิกเกินยอดที่ยังเบิกได้ ไม่ผ่าน", () => {
    const over: PaymentItem[] = [{ repair_id: "r1", purchase_id: null, amount: 3500 }];
    expect(
      validatePayment({ pay_date: "2026-09-10", paid_amount: 3500 }, over, targets),
    ).toContain("เกินยอดที่ยังเบิกได้");
  });

  it("เอกสารที่ยังไม่อนุมัติ เบิกไม่ได้", () => {
    const pending = new Map([["r1", doc({ approve_status: "pending" })]]);
    expect(
      validatePayment({ pay_date: "2026-09-10", paid_amount: 3000 }, items, pending),
    ).toContain("ยังไม่ได้รับอนุมัติ");
  });

  it("ยอดจ่ายจริงต้องเท่ากับผลรวมของรายการ", () => {
    expect(
      validatePayment({ pay_date: "2026-09-10", paid_amount: 2500 }, items, targets),
    ).toContain("เท่ากับผลรวม");
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
