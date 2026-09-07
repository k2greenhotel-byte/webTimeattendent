import { describe, expect, it } from "vitest";
import {
  applyClaimUpdate,
  claimOptionLabel,
  customerSourceText,
  deadlineOf,
  describeClaimUpdate,
  dueDateOf,
  isOverdue,
  jobText,
  overdueDays,
  summarizeClaims,
  validateClaim,
  validateClaimUpdate,
  vehicleText,
} from "../src/lib/claim";
import type {
  ClaimInput,
  ClaimItem,
  ClaimRow,
  ClaimUpdateInput,
} from "../src/lib/claim-types";

// ---------- ตัวช่วยสร้างข้อมูลทดสอบ ----------

function claim(over: Partial<ClaimInput> = {}): ClaimInput {
  return {
    claim_date: "2026-09-01",
    company_id: "co1",
    branch_id: "br1",
    chassis_no: "MLEUE364111416724",
    engine_no: "E34RE-120992",
    db2_brand_code: "YAMAHA",
    db2_brand_name: "YAMAHA",
    db2_model_code: "FINN 2022",
    db2_model_name: "FINN",
    db2_variant_code: "DT0300",
    db2_variant_name: "FINN 2025",
    db2_color_code: "เขียว",
    db2_color_name: "เขียว",
    db2_contno: "USF-26060014",
    db2_locat: "KMS05",
    db2_sale_date: "2026-06-29",
    db2_cuscod: "URPM-0004157",
    customer_name: "นาย สมชาย พุทธรักษา",
    customer_phone: "0653076881",
    customer_address: "26 ม.4 หนองฝ้าย 71210",
    is_external: false,
    damage_detail: "ไฟหน้าดับข้างซ้าย",
    urgency: "d2_5",
    created_by: "u1",
    created_by_name: "สมหญิง",
    maker_vendor_id: null,
    maker_name: "ไทยยามาฮ่ามอเตอร์",
    maker_agent_name: "คุณเอ",
    maker_phone: "0812345678",
    doc_status: "active",
    job_status: "wait_notify",
    reject_reason: null,
    result_date: null,
    fixed_date: null,
    delivered_date: null,
    expected_done_date: null,
    requested_amount: 0,
    job_no: null,
    job_open_date: null,
    job_close_date: null,
    job_deliver_date: null,
    note: null,
    ...over,
  };
}

const ITEMS: ClaimItem[] = [{ item_name: "ไฟหน้า", qty: 1, note: null }];

function row(over: Partial<ClaimRow> = {}): ClaimRow {
  return {
    ...claim(),
    id: "c1",
    doc_no: "CM-2569-0001",
    created_at: "2026-09-01T02:00:00Z",
    updated_at: "2026-09-01T02:00:00Z",
    company_name: "บริษัท ก",
    company_code: "CO1",
    branch_name: "สาขาหลัก",
    branch_code: "BR1",
    created_by_full_name: "สมหญิง",
    maker_vendor_code: null,
    maker_vendor_name: null,
    photo_count: 0,
    item_count: 1,
    update_count: 0,
    item_summary: "ไฟหน้า",
    ...over,
  } as ClaimRow;
}

function update(over: Partial<ClaimUpdateInput> = {}): ClaimUpdateInput {
  return {
    update_date: "2026-09-05",
    claim_id: "c1",
    job_status: null,
    detail: null,
    expected_done_date: null,
    requested_amount: null,
    reject_reason: null,
    job_no: null,
    job_open_date: null,
    job_close_date: null,
    job_deliver_date: null,
    recorded_by: "u1",
    recorded_by_name: "สมหญิง",
    ...over,
  };
}

// ---------- ความเร่งด่วนและกำหนดเสร็จ ----------

describe("กำหนดเสร็จตามความเร่งด่วน", () => {
  it("นับวันตามความเร่งด่วนแต่ละระดับ", () => {
    expect(dueDateOf("2026-09-01", "d1_2")).toBe("2026-09-03");
    expect(dueDateOf("2026-09-01", "d2_5")).toBe("2026-09-06");
    expect(dueDateOf("2026-09-01", "d5_plus")).toBe("2026-09-11");
  });

  it("ข้ามเดือนได้ถูกต้อง", () => {
    expect(dueDateOf("2026-08-30", "d2_5")).toBe("2026-09-04");
  });

  it("ถ้ามีวันที่คาดว่าจะเสร็จ ให้ยึดวันนั้นแทนความเร่งด่วน", () => {
    expect(deadlineOf(claim({ expected_done_date: "2026-09-20" }))).toBe("2026-09-20");
    expect(deadlineOf(claim())).toBe("2026-09-06");
  });
});

describe("งานเกินกำหนด", () => {
  it("เลยเส้นตายและงานยังไม่จบ = เกินกำหนด", () => {
    expect(isOverdue(claim(), "2026-09-10")).toBe(true);
    expect(overdueDays(claim(), "2026-09-10")).toBe(4);
  });

  it("ยังไม่ถึงเส้นตาย ไม่นับว่าเกินกำหนด", () => {
    expect(isOverdue(claim(), "2026-09-05")).toBe(false);
    expect(overdueDays(claim(), "2026-09-05")).toBe(0);
  });

  it("งานที่จบแล้วหรือเอกสารที่ยกเลิก ไม่นับว่าเกินกำหนด", () => {
    expect(isOverdue(claim({ job_status: "done", fixed_date: "2026-09-03" }), "2026-09-10")).toBe(false);
    expect(isOverdue(claim({ job_status: "rejected" }), "2026-09-10")).toBe(false);
    expect(isOverdue(claim({ doc_status: "cancelled" }), "2026-09-10")).toBe(false);
  });
});

// ---------- ผลของใบ update ที่ผลักขึ้นใบขอเคลม ----------

describe("applyClaimUpdate", () => {
  it("ช่องที่เว้นว่างไว้ไม่ไปทับค่าเดิม", () => {
    expect(applyClaimUpdate({ result_date: null, fixed_date: null }, update())).toEqual({});
  });

  it("อนุมัติ/ไม่อนุมัติ ลงวันที่แจ้งผลการอนุมัติให้ (1.4.21)", () => {
    expect(
      applyClaimUpdate({ result_date: null, fixed_date: null }, update({ job_status: "approved" })),
    ).toEqual({ job_status: "approved", result_date: "2026-09-05" });

    expect(
      applyClaimUpdate(
        { result_date: null, fixed_date: null },
        update({ job_status: "rejected", reject_reason: " เลยระยะรับประกัน " }),
      ),
    ).toEqual({
      job_status: "rejected",
      result_date: "2026-09-05",
      reject_reason: "เลยระยะรับประกัน",
    });
  });

  it("แก้ไขเรียบร้อย ลงวันที่ซ่อมเสร็จให้ (1.4.22)", () => {
    expect(
      applyClaimUpdate({ result_date: "2026-09-02", fixed_date: null }, update({ job_status: "done" })),
    ).toEqual({ job_status: "done", fixed_date: "2026-09-05" });
  });

  it("ไม่ทับวันที่ที่ใบขอเคลมมีอยู่แล้ว", () => {
    expect(
      applyClaimUpdate(
        { result_date: "2026-09-02", fixed_date: "2026-09-04" },
        update({ job_status: "done" }),
      ),
    ).toEqual({ job_status: "done", fixed_date: "2026-09-04" });
  });

  it("ยอดที่ขออนุมัติเป็น 0 ถือว่าเปลี่ยนจริง (ต่างจากเว้นว่าง)", () => {
    expect(
      applyClaimUpdate({ result_date: null, fixed_date: null }, update({ requested_amount: 0 })),
    ).toEqual({ requested_amount: 0 });
  });

  it("ยกเลขที่ job และวันที่ของ job ขึ้นใบขอเคลม (1.5.10-1.5.13)", () => {
    expect(
      applyClaimUpdate(
        { result_date: null, fixed_date: null },
        update({
          job_no: " JOB-2569-0007 ",
          job_open_date: "2026-09-05",
          job_close_date: "2026-09-08",
          job_deliver_date: "2026-09-09",
        }),
      ),
    ).toEqual({
      job_no: "JOB-2569-0007",
      job_open_date: "2026-09-05",
      job_close_date: "2026-09-08",
      job_deliver_date: "2026-09-09",
    });
  });

  it("ช่องของ job ที่เว้นว่างไม่ไปล้างค่าเดิม", () => {
    expect(
      applyClaimUpdate({ result_date: null, fixed_date: null }, update({ job_no: "   " })),
    ).toEqual({});
  });
});

// ---------- ตรวจข้อมูลก่อนบันทึก ----------

describe("validateClaim", () => {
  it("ใบที่กรอกครบผ่าน", () => {
    expect(validateClaim(claim(), ITEMS)).toBeNull();
  });

  it("ต้องมีเลขตัวถังและชื่อลูกค้า", () => {
    expect(validateClaim(claim({ chassis_no: "  " }), ITEMS)).toMatch(/เลขตัวถัง/);
    expect(validateClaim(claim({ customer_name: "" }), ITEMS)).toMatch(/ชื่อลูกค้า/);
  });

  it("ต้องมีรายการที่ขอเคลมอย่างน้อยหนึ่งรายการ", () => {
    expect(validateClaim(claim(), [])).toMatch(/รายการที่ขอเคลม/);
    expect(validateClaim(claim(), [{ item_name: "   ", qty: 1, note: null }])).toMatch(
      /รายการที่ขอเคลม/,
    );
  });

  it("ลูกค้าภายนอกต้องคีย์เลขเครื่อง ที่อยู่ และเบอร์โทรให้ครบ (1.4.9)", () => {
    const external = { is_external: true, db2_cuscod: null };
    expect(validateClaim(claim({ ...external, engine_no: null }), ITEMS)).toMatch(/เลขเครื่อง/);
    expect(validateClaim(claim({ ...external, customer_address: null }), ITEMS)).toMatch(/ที่อยู่/);
    expect(validateClaim(claim({ ...external, customer_phone: null }), ITEMS)).toMatch(/เบอร์โทร/);
    expect(validateClaim(claim(external), ITEMS)).toBeNull();
  });

  it("ไม่อนุมัติต้องมีเหตุผล และแก้ไขเรียบร้อยต้องมีวันที่ซ่อมเสร็จ", () => {
    expect(validateClaim(claim({ job_status: "rejected" }), ITEMS)).toMatch(/เหตุผลไม่อนุมัติ/);
    expect(validateClaim(claim({ job_status: "done" }), ITEMS)).toMatch(/วันที่ซ่อมเสร็จ/);
    expect(
      validateClaim(claim({ job_status: "done", fixed_date: "2026-09-04" }), ITEMS),
    ).toBeNull();
  });

  it("วันที่ต่าง ๆ ต้องไม่ก่อนวันที่แจ้งเคลม และส่งมอบต้องไม่ก่อนซ่อมเสร็จ", () => {
    expect(validateClaim(claim({ result_date: "2026-08-30" }), ITEMS)).toMatch(/แจ้งผลการอนุมัติ/);
    expect(
      validateClaim(
        claim({ job_status: "done", fixed_date: "2026-09-05", delivered_date: "2026-09-03" }),
        ITEMS,
      ),
    ).toMatch(/ส่งมอบรถคืน/);
  });
});

describe("validateClaimUpdate", () => {
  it("ต้องมีอย่างน้อยหนึ่งอย่างที่เปลี่ยนจริง", () => {
    expect(validateClaimUpdate(update())).toMatch(/อย่างน้อยหนึ่งอย่าง/);
    expect(validateClaimUpdate({ ...update(), photoCount: 2 })).toBeNull();
    expect(validateClaimUpdate(update({ detail: "โทรแจ้งตัวแทนแล้ว" }))).toBeNull();
  });

  it("ไม่อนุมัติต้องระบุเหตุผล", () => {
    expect(validateClaimUpdate(update({ job_status: "rejected" }))).toMatch(/เหตุผลไม่อนุมัติ/);
    expect(
      validateClaimUpdate(update({ job_status: "rejected", reject_reason: "เลยระยะรับประกัน" })),
    ).toBeNull();
  });

  it("ยอดที่ขออนุมัติติดลบไม่ได้", () => {
    expect(validateClaimUpdate(update({ requested_amount: -1 }))).toMatch(/ติดลบ/);
  });

  it("กรอกแค่เลขที่ job หรือวันที่ของ job ก็ถือว่าเปลี่ยนจริง (1.5.10-1.5.13)", () => {
    expect(validateClaimUpdate(update({ job_no: "JOB-2569-0007" }))).toBeNull();
    expect(validateClaimUpdate(update({ job_open_date: "2026-09-05" }))).toBeNull();
  });

  it("วันที่ปิด job และวันที่ส่งมอบงานต้องไม่ก่อนวันที่เปิด job", () => {
    expect(
      validateClaimUpdate(update({ job_open_date: "2026-09-05", job_close_date: "2026-09-04" })),
    ).toMatch(/วันที่ปิด job/);
    expect(
      validateClaimUpdate(update({ job_open_date: "2026-09-05", job_deliver_date: "2026-09-01" })),
    ).toMatch(/ส่งมอบงาน/);
  });
});

// ---------- สรุปตัวเลข ----------

describe("summarizeClaims", () => {
  const rows = [
    row({ id: "1", job_status: "wait_notify" }),
    row({ id: "2", job_status: "sent_agent", urgency: "d1_2" }),
    row({ id: "3", job_status: "done", fixed_date: "2026-09-03", delivered_date: null }),
    row({ id: "4", job_status: "done", fixed_date: "2026-09-03", delivered_date: "2026-09-04" }),
    row({ id: "5", job_status: "rejected", reject_reason: "เลยระยะรับประกัน" }),
    row({ id: "6", doc_status: "cancelled" }),
  ];

  const summary = summarizeClaims(rows, "2026-09-10");

  it("นับงานที่ยังไม่จบโดยไม่รวมใบที่ยกเลิก", () => {
    expect(summary.total).toBe(6);
    expect(summary.open).toBe(2);
  });

  it("นับงานเกินกำหนดเฉพาะงานที่ยังไม่จบ", () => {
    expect(summary.overdue).toBe(2);
  });

  it("แยกงานรอผลผู้ผลิต ซ่อมเสร็จรอส่งมอบ และส่งมอบแล้ว", () => {
    expect(summary.waitingMaker).toBe(2);
    expect(summary.waitingDelivery).toBe(1);
    expect(summary.delivered).toBe(1);
  });

  it("นับ job ที่เปิดไว้แล้วยังไม่ปิด (ไม่รวมใบที่ยกเลิก)", () => {
    const withJobs = [
      row({ id: "j1", job_no: "JOB-1", job_open_date: "2026-09-02" }),
      row({ id: "j2", job_no: "JOB-2", job_open_date: "2026-09-02", job_close_date: "2026-09-05" }),
      row({ id: "j3", job_open_date: "2026-09-03" }),
      row({ id: "j4", job_no: "JOB-4", doc_status: "cancelled" }),
      row({ id: "j5" }),
    ];
    expect(summarizeClaims(withJobs, "2026-09-10").openJobs).toBe(2);
  });

  it("นับตามสถานะและความเร่งด่วนครบทุกใบ", () => {
    expect(summary.byJobStatus.done).toBe(2);
    expect(summary.byDocStatus.cancelled).toBe(1);
    expect(summary.byUrgency.d1_2).toBe(1);
    expect(summary.byUrgency.d2_5).toBe(5);
  });
});

// ---------- ข้อความที่ใช้แสดงผล ----------

describe("ข้อความบนหน้าจอ", () => {
  it("รวมชื่อรถเป็นบรรทัดเดียว ข้ามช่องที่ว่าง", () => {
    expect(vehicleText(row())).toBe("YAMAHA · FINN · FINN 2025 · เขียว");
    expect(vehicleText(row({ db2_variant_name: null, db2_color_name: "" }))).toBe("YAMAHA · FINN");
  });

  it("บอกที่มาของข้อมูลลูกค้า", () => {
    expect(customerSourceText(row())).toBe("ระบบขาย URPM-0004157");
    expect(customerSourceText(row({ is_external: true, db2_cuscod: null }))).toBe(
      "ลูกค้าภายนอก (คีย์เอง)",
    );
    expect(customerSourceText(row({ db2_cuscod: null }))).toBe("ระบบขาย");
  });

  it("ย่อใบ update เป็นบรรทัดเดียว", () => {
    expect(
      describeClaimUpdate({
        job_status: "sent_agent",
        detail: "ส่งรูปให้ตัวแทนแล้ว",
        expected_done_date: "2026-09-12",
        requested_amount: 1500,
        photo_count: 2,
      }),
    ).toBe("ส่งเรื่องให้ตัวแทนผู้ผลิต · คาดว่าเสร็จ 2026-09-12 · ขออนุมัติ 1,500 บาท · รูป 2 รูป · ส่งรูปให้ตัวแทนแล้ว");
  });

  it("ใบ update ที่มีเลขที่ job แสดง job ต่อจากสถานะ", () => {
    expect(
      describeClaimUpdate({
        job_status: "in_progress",
        detail: null,
        expected_done_date: null,
        requested_amount: null,
        job_no: "JOB-2569-0007",
        job_open_date: "2026-09-05",
      }),
    ).toBe("อยู่ระหว่างดำเนินการแก้ไข · Job JOB-2569-0007 · เปิด job 2026-09-05");
  });

  it("สรุปสถานะ job บนใบขอเคลม", () => {
    expect(jobText(row())).toBe("");
    expect(jobText(row({ job_no: "JOB-2569-0007", job_open_date: "2026-09-05" }))).toBe(
      "JOB-2569-0007 · เปิด 2026-09-05 · ยังไม่ปิด job",
    );
    expect(
      jobText(
        row({
          job_no: "JOB-2569-0007",
          job_open_date: "2026-09-05",
          job_close_date: "2026-09-08",
          job_deliver_date: "2026-09-09",
        }),
      ),
    ).toBe("JOB-2569-0007 · เปิด 2026-09-05 · ปิด 2026-09-08 · ส่งมอบงาน 2026-09-09");
  });

  it("ป้ายกำกับใบขอเคลมในกล่องตัวเลือก", () => {
    expect(claimOptionLabel(row())).toBe("CM-2569-0001 · MLEUE364111416724 · นาย สมชาย พุทธรักษา");
  });
});
