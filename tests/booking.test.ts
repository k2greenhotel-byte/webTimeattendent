import { describe, expect, it } from "vitest";
import {
  NO_BRANCH,
  NO_MODEL,
  NO_STAFF,
  TOP_N,
  applyUpdate,
  buildOverview,
  buildRankings,
  bookingOptionLabel,
  buildCalendar,
  countByBrandModel,
  countByKey,
  deliveryPipeline,
  describeUpdate,
  describeVehicle,
  formatBaht,
  groupByDate,
  isAwaitingDelivery,
  isOpenBooking,
  isOutOfStock,
  monthlyTrend,
  parseAmount,
  queryFromParams,
  resolveDocStatus,
  shiftMonth,
  staffNameOf,
  summarize,
  summarizeByStaff,
  validateBooking,
  validateUpdate,
} from "../src/lib/booking";
import type { Booking, BookingRow, BookingUpdate } from "../src/lib/booking-types";

function booking(over: Partial<BookingRow> = {}): BookingRow {
  return {
    id: "b1",
    doc_no: "BK-2569-0001",
    branch_id: null,
    ref_no: null,
    booking_date: "2026-09-01",
    customer_id: "c1",
    customer_phone: "0812345678",
    brand_id: "br1",
    model_id: "md1",
    variant_id: null,
    color_id: null,
    purchase_type: "installment",
    pickup_date: "2026-09-10",
    vehicle_status: "in_stock",
    deposit_amount: 3000,
    receipt_no: null,
    contract_status: "pending",
    doc_status: "active",
    booking_status: "wait_contract",
    cancel_reason: null,
    sale_contract_no: null,
    sale_date: null,
    refunded: false,
    taken_by: "e1",
    taken_by_name: "พนักงานขาย A",
    taken_by_full_name: "พนักงานขาย A",
    note: null,
    company_id: null,
    created_by: null,
    created_at: "2026-09-01T03:00:00Z",
    updated_at: "2026-09-01T03:00:00Z",
    customer_code: "C000001",
    customer_name: "นายสมชาย ใจดี",
    branch_name: "สาขาหลัก",
    brand_name: "Honda",
    model_name: "Wave 110i",
    variant_name: null,
    color_name: "ดำ-แดง",
    file_count: 0,
    update_count: 0,
    ...over,
  };
}

function update(over: Partial<BookingUpdate> = {}): BookingUpdate {
  return {
    id: "u1",
    doc_no: "BKU-2569-0001",
    update_date: "2026-09-05",
    booking_id: "b1",
    vehicle_status: null,
    contract_status: null,
    booking_status: null,
    cancel_reason: null,
    recorded_by: null,
    recorded_by_name: "พนักงานขาย A",
    sale_contract_no: null,
    sale_date: null,
    refunded: false,
    note: null,
    created_at: "2026-09-05T03:00:00Z",
    ...over,
  };
}

describe("จำนวนเงิน", () => {
  it("อ่านตัวเลขที่มีลูกน้ำหรือสัญลักษณ์บาทได้", () => {
    expect(parseAmount("12,000")).toBe(12000);
    expect(parseAmount("฿ 1,500.50")).toBe(1500.5);
    expect(parseAmount(2000)).toBe(2000);
  });

  it("ค่าว่างหรืออ่านไม่ออกคืน 0 ไม่ใช่ NaN", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("มัดจำ")).toBe(0);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(Number.NaN)).toBe(0);
  });

  it("จำนวนเต็มไม่แสดงทศนิยม แต่มีเศษแล้วแสดง 2 ตำแหน่ง", () => {
    expect(formatBaht(12000)).toBe("12,000 บาท");
    expect(formatBaht(1500.5)).toBe("1,500.50 บาท");
    expect(formatBaht(null)).toBe("0 บาท");
  });
});

describe("ข้อ 1.2.13 สถานะเอกสารคำนวณจากข้อเท็จจริง", () => {
  it("ปกติเป็น 'ใช้งาน'", () => {
    expect(resolveDocStatus({ booking_status: "wait_contract" })).toBe("active");
    expect(resolveDocStatus({ booking_status: "wait_delivery" })).toBe("active");
  });

  it("บันทึกเลขที่สัญญาขายแล้วถือว่าปิดงาน", () => {
    expect(
      resolveDocStatus({ booking_status: "delivered", sale_contract_no: "SO-6900123" }),
    ).toBe("closed");
  });

  it("บันทึกคืนเงินลูกค้าแล้วถือว่าปิดงาน แม้สถานะการจองจะเป็นยกเลิก", () => {
    expect(resolveDocStatus({ booking_status: "cancelled", refunded: true })).toBe("closed");
  });

  it("ยกเลิกแต่ยังไม่คืนเงิน = สถานะเอกสารเป็น 'ยกเลิก' (ยังต้องตามคืนเงินอยู่)", () => {
    expect(resolveDocStatus({ booking_status: "cancelled" })).toBe("cancelled");
  });

  it("เลขที่สัญญาขายที่เป็นช่องว่างล้วน ไม่ถือว่าขายแล้ว", () => {
    expect(resolveDocStatus({ booking_status: "wait_delivery", sale_contract_no: "   " })).toBe(
      "active",
    );
  });

  it("ใบจองที่ยังต้องติดตาม = สถานะเอกสารใช้งานเท่านั้น", () => {
    expect(isOpenBooking(booking())).toBe(true);
    expect(isOpenBooking(booking({ doc_status: "closed" }))).toBe(false);
    expect(isOpenBooking(booking({ doc_status: "cancelled" }))).toBe(false);
  });
});

describe("ข้อ 1.2 ใบ update เปลี่ยนสถานะใบจอง", () => {
  it("ช่องที่เว้นว่างไว้ = ไม่เปลี่ยน คงค่าเดิมทุกช่อง", () => {
    const result = applyUpdate(booking(), update());
    expect(result.vehicle_status).toBe("in_stock");
    expect(result.contract_status).toBe("pending");
    expect(result.booking_status).toBe("wait_contract");
    expect(result.doc_status).toBe("active");
  });

  it("บันทึกสัญญาผ่านและรอรับรถ อัปเดตเฉพาะช่องที่เลือก", () => {
    const result = applyUpdate(
      booking(),
      update({ contract_status: "approved", booking_status: "wait_delivery" }),
    );
    expect(result.contract_status).toBe("approved");
    expect(result.booking_status).toBe("wait_delivery");
    expect(result.vehicle_status).toBe("in_stock");
    expect(result.doc_status).toBe("active");
  });

  it("บันทึกเลขที่สัญญาขาย → ปิดงานทันที", () => {
    const result = applyUpdate(
      booking(),
      update({
        booking_status: "delivered",
        sale_contract_no: "SO-6900123",
        sale_date: "2026-09-12",
      }),
    );
    expect(result.sale_contract_no).toBe("SO-6900123");
    expect(result.sale_date).toBe("2026-09-12");
    expect(result.doc_status).toBe("closed");
  });

  it("บันทึกคืนเงินลูกค้า → ปิดงาน และเก็บสาเหตุยกเลิกไว้", () => {
    const result = applyUpdate(
      booking(),
      update({ booking_status: "cancelled", cancel_reason: "contract_rejected", refunded: true }),
    );
    expect(result.refunded).toBe(true);
    expect(result.cancel_reason).toBe("contract_rejected");
    expect(result.doc_status).toBe("closed");
  });

  it("ใบ update ใหม่ไม่ล้างเลขที่สัญญาขายหรือธงคืนเงินที่บันทึกไว้แล้ว", () => {
    const sold = booking({ sale_contract_no: "SO-6900123", refunded: true, doc_status: "closed" });
    const result = applyUpdate(sold, update({ vehicle_status: "ordered" }));
    expect(result.sale_contract_no).toBe("SO-6900123");
    expect(result.refunded).toBe(true);
    expect(result.doc_status).toBe("closed");
  });

  it("กลับมาสถานะที่ไม่ใช่ยกเลิก สาเหตุยกเลิกต้องถูกล้าง", () => {
    const cancelled = booking({ booking_status: "cancelled", cancel_reason: "changed_mind" });
    const result = applyUpdate(cancelled, update({ booking_status: "wait_delivery" }));
    expect(result.cancel_reason).toBeNull();
  });
});

describe("ตรวจใบจองก่อนบันทึก", () => {
  const base = {
    booking_date: "2026-09-01",
    customer_id: "c1",
    brand_id: "br1",
    model_id: "md1",
    pickup_date: "2026-09-10",
    deposit_amount: 3000,
    booking_status: "wait_contract" as const,
    cancel_reason: null,
    taken_by_name: "พนักงานขาย A",
  };

  it("ข้อมูลครบผ่าน", () => {
    expect(validateBooking(base)).toBeNull();
  });

  it("ต้องมีชื่อพนักงานที่รับจองเสมอ (ระบบเติมจากบัญชีที่ล็อกอินให้)", () => {
    expect(validateBooking({ ...base, taken_by_name: "" })).toContain("พนักงานที่รับจอง");
    expect(validateBooking({ ...base, taken_by_name: "   " })).toContain("พนักงานที่รับจอง");
    expect(validateBooking({ ...base, taken_by_name: null })).toContain("พนักงานที่รับจอง");
  });

  it("ต้องมีลูกค้า ยี่ห้อ และรุ่นรถ", () => {
    expect(validateBooking({ ...base, customer_id: null })).toContain("เลือกลูกค้า");
    expect(validateBooking({ ...base, brand_id: null })).toContain("ยี่ห้อรถ");
    expect(validateBooking({ ...base, model_id: null })).toContain("รุ่นรถ");
  });

  it("วันที่นัดรับรถห้ามก่อนวันที่จอง", () => {
    expect(validateBooking({ ...base, pickup_date: "2026-08-31" })).toContain("วันที่นัดรับรถ");
  });

  it("ยกเลิกต้องระบุสาเหตุ", () => {
    expect(validateBooking({ ...base, booking_status: "cancelled" })).toContain("สาเหตุ");
    expect(
      validateBooking({ ...base, booking_status: "cancelled", cancel_reason: "got_other" }),
    ).toBeNull();
  });

  it("มีวันที่ขายแต่ไม่มีเลขที่สัญญาขาย ไม่ผ่าน", () => {
    expect(validateBooking({ ...base, sale_date: "2026-09-12" })).toContain("เลขที่สัญญาขาย");
  });

  it("เงินมัดจำติดลบไม่ได้", () => {
    expect(validateBooking({ ...base, deposit_amount: -1 })).toContain("ติดลบ");
  });
});

describe("ตรวจใบ update ก่อนบันทึก", () => {
  const base = {
    update_date: "2026-09-05",
    booking_id: "b1",
    vehicle_status: null,
    contract_status: null,
    booking_status: null,
    cancel_reason: null,
    sale_contract_no: null,
    sale_date: null,
    refunded: false,
    recorded_by_name: "พนักงานขาย A",
  };

  it("ใบเปล่าที่ไม่ได้เปลี่ยนอะไรเลย ไม่ให้บันทึก", () => {
    expect(validateUpdate(base)).toContain("ยังไม่ได้บันทึกอะไรเลย");
  });

  it("แนบเอกสารอย่างเดียวก็ถือว่าเป็นการบันทึก", () => {
    expect(validateUpdate({ ...base, fileCount: 1 })).toBeNull();
  });

  it("ต้องมีชื่อผู้บันทึกเสมอ (ข้อ 1.2.10)", () => {
    expect(validateUpdate({ ...base, recorded_by_name: "  ", contract_status: "approved" })).toContain(
      "ชื่อผู้บันทึก",
    );
  });

  it("บันทึกยกเลิกต้องมีสาเหตุ", () => {
    expect(validateUpdate({ ...base, booking_status: "cancelled" })).toContain("สาเหตุ");
  });
});

describe("ข้อความสรุป", () => {
  it("บอกรถเป็นบรรทัดเดียว ข้ามช่องที่ยังไม่เลือก", () => {
    expect(describeVehicle(booking())).toBe("Honda · Wave 110i · ดำ-แดง");
    expect(describeVehicle({})).toBe("— ยังไม่ระบุรถ —");
  });

  it("สรุปสิ่งที่ใบ update เปลี่ยน", () => {
    const text = describeUpdate(
      update({ contract_status: "approved", booking_status: "wait_delivery" }),
    );
    expect(text).toContain("สัญญาผ่านแล้ว");
    expect(text).toContain("รอรับรถ");
  });

  it("ใบ update ที่มีแต่ไฟล์แนบ บอกว่าเป็นการแนบเอกสาร", () => {
    expect(describeUpdate(update())).toBe("แนบเอกสารเพิ่มเติม");
  });

  it("ตัวเลือกใบจองใน dropdown มีเลขที่ ชื่อลูกค้า รถ และสถานะ", () => {
    const label = bookingOptionLabel(booking());
    expect(label).toContain("BK-2569-0001");
    expect(label).toContain("นายสมชาย ใจดี");
    expect(label).toContain("รอสัญญา");
  });
});

describe("สรุปตัวเลขสำหรับ dashboard", () => {
  const rows = [
    booking({ id: "1" }),
    booking({ id: "2", booking_status: "wait_delivery", vehicle_status: "need_order", deposit_amount: 5000 }),
    booking({ id: "3", booking_status: "delivered", doc_status: "closed", brand_name: "Yamaha", model_name: "Fino" }),
  ];

  it("นับแยกตามสถานะทุกชุดและรวมเงินมัดจำ", () => {
    const s = summarize(rows);
    expect(s.total).toBe(3);
    expect(s.deposit).toBe(11000);
    expect(s.byBookingStatus.wait_contract).toBe(1);
    expect(s.byBookingStatus.wait_delivery).toBe(1);
    expect(s.byBookingStatus.delivered).toBe(1);
    expect(s.byBookingStatus.cancelled).toBe(0);
    expect(s.byVehicleStatus.need_order).toBe(1);
    expect(s.byDocStatus.closed).toBe(1);
  });

  it("นับตามยี่ห้อ เรียงจากมากไปน้อย", () => {
    expect(countByKey(rows, (r) => r.brand_name)).toEqual([
      { label: "Honda", count: 2 },
      { label: "Yamaha", count: 1 },
    ]);
  });

  it("ค่าว่างถูกจัดเข้ากลุ่ม 'ไม่ระบุ'", () => {
    const result = countByKey([booking({ brand_name: null })], (r) => r.brand_name);
    expect(result).toEqual([{ label: "— ไม่ระบุ —", count: 1 }]);
  });

  it("แยกยี่ห้อ → รุ่น สองชั้น", () => {
    const grouped = countByBrandModel(rows);
    expect(grouped[0].brand).toBe("Honda");
    expect(grouped[0].count).toBe(2);
    expect(grouped[0].models).toEqual([{ label: "Wave 110i", count: 2 }]);
    expect(grouped[1].brand).toBe("Yamaha");
  });
});

describe("ภาพรวมทั้งหมด (1.4)", () => {
  const TODAY = "2026-09-10";

  it("นับยอดรวม สถานะ และเงินมัดจำแยกใบที่ยังเปิดอยู่", () => {
    const rows = [
      booking({ id: "1", deposit_amount: 3000 }),
      booking({ id: "2", deposit_amount: 5000, doc_status: "closed", sale_contract_no: "SO-1", booking_status: "delivered" }),
      booking({ id: "3", deposit_amount: 1000, doc_status: "cancelled", booking_status: "cancelled", cancel_reason: "changed_mind" }),
    ];
    const o = buildOverview(rows, TODAY);

    expect(o.total).toBe(3);
    expect(o.open).toBe(1);
    expect(o.closed).toBe(1);
    expect(o.cancelledDoc).toBe(1);
    expect(o.sold).toBe(1);
    expect(o.deposit).toBe(9000);
    expect(o.depositOpen).toBe(3000);
    expect(o.byBookingStatus.delivered).toBe(1);
  });

  it("อัตราปิดการขายคิดจากใบทั้งหมด ทศนิยม 1 ตำแหน่ง", () => {
    const rows = [
      booking({ id: "1", sale_contract_no: "SO-1" }),
      booking({ id: "2" }),
      booking({ id: "3" }),
    ];
    expect(buildOverview(rows, TODAY).closeRate).toBe(33.3);
    expect(buildOverview([], TODAY).closeRate).toBe(0);
  });

  it("แยกใบที่เลยนัด / นัดวันนี้ / นัดใน 7 วัน ให้ถูกช่อง", () => {
    const rows = [
      booking({ id: "late", pickup_date: "2026-09-08" }),
      booking({ id: "today", pickup_date: TODAY }),
      booking({ id: "soon", pickup_date: "2026-09-17" }),
      booking({ id: "far", pickup_date: "2026-09-18" }),
    ];
    const o = buildOverview(rows, TODAY);

    expect(o.overdue.map((r) => r.id)).toEqual(["late"]);
    expect(o.dueToday.map((r) => r.id)).toEqual(["today"]);
    expect(o.dueSoon.map((r) => r.id)).toEqual(["soon"]);
  });

  it("ใบที่รับรถแล้วหรือปิดงานแล้ว ไม่ถือว่าเลยนัด", () => {
    const rows = [
      booking({ id: "1", pickup_date: "2026-09-01", booking_status: "delivered" }),
      booking({ id: "2", pickup_date: "2026-09-01", doc_status: "closed" }),
      booking({ id: "3", pickup_date: null }),
    ];
    expect(buildOverview(rows, TODAY).overdue).toEqual([]);
  });

  it("ยกเลิกแล้วยังไม่คืนเงิน ขึ้นรายการค้างคืนเงิน", () => {
    const rows = [
      booking({ id: "1", booking_status: "cancelled", cancel_reason: "got_other", refunded: false }),
      booking({ id: "2", booking_status: "cancelled", cancel_reason: "got_other", refunded: true }),
    ];
    expect(buildOverview(rows, TODAY).refundPending.map((r) => r.id)).toEqual(["1"]);
  });

  it("นับรถที่ต้องสั่งเฉพาะใบที่ยังดำเนินการอยู่", () => {
    const rows = [
      booking({ id: "1", vehicle_status: "need_order" }),
      booking({ id: "2", vehicle_status: "need_order", doc_status: "closed" }),
    ];
    expect(buildOverview(rows, TODAY).needOrder).toBe(1);
  });

  it("เรียงใบที่เลยนัดจากค้างนานสุดขึ้นก่อน", () => {
    const rows = [
      booking({ id: "b", pickup_date: "2026-09-05" }),
      booking({ id: "a", pickup_date: "2026-09-01" }),
    ];
    expect(buildOverview(rows, TODAY).overdue.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("อันดับสูงสุดและรายการเฝ้าระวังสต็อก (1.4)", () => {
  const TODAY = "2026-09-10";

  it("รถที่ยังไม่มีในสต็อก = ต้องสั่ง หรือสั่งมาแล้วแต่ยังไม่ถึง", () => {
    expect(isOutOfStock({ vehicle_status: "in_stock" })).toBe(false);
    expect(isOutOfStock({ vehicle_status: "need_order" })).toBe(true);
    expect(isOutOfStock({ vehicle_status: "ordered" })).toBe(true);
  });

  it("จัดอันดับรุ่นรถ พนักงาน และสาขา สูงสุด 5 อันดับ", () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) =>
        booking({ id: `a${i}`, model_name: "Wave 110i", taken_by_name: "สมชาย", branch_name: "กาญ1" }),
      ),
      booking({ id: "b", model_name: "PCX 160", taken_by_name: "มาลี", branch_name: "กาญ2" }),
      booking({ id: "c", model_name: "PCX 160", taken_by_name: "มาลี", branch_name: "กาญ2" }),
      booking({ id: "d", model_name: "Fino", taken_by_name: "วิชัย", branch_name: "กาญ2" }),
    ];
    const r = buildRankings(rows, TODAY);

    expect(r.topModels).toEqual([
      { label: "Wave 110i", count: 3 },
      { label: "PCX 160", count: 2 },
      { label: "Fino", count: 1 },
    ]);
    expect(r.topStaff[0]).toEqual({ label: "สมชาย", count: 3 });

    // จำนวนเท่ากันเรียงตามชื่อ เพื่อให้ลำดับคงที่ทุกครั้งที่เปิดหน้า
    expect(r.topBranches).toEqual([
      { label: "กาญ1", count: 3 },
      { label: "กาญ2", count: 3 },
    ]);
  });

  it("ตัดให้เหลือ 5 อันดับเท่านั้น", () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      booking({ id: `m${i}`, model_name: `รุ่น ${i}` }),
    );
    expect(buildRankings(rows, TODAY).topModels).toHaveLength(TOP_N);
  });

  it("อันดับรุ่นที่รถยังไม่มีในสต็อก นับเฉพาะใบที่ยังดำเนินการอยู่", () => {
    const rows = [
      booking({ id: "1", model_name: "Wave 110i", vehicle_status: "need_order" }),
      booking({ id: "2", model_name: "Wave 110i", vehicle_status: "ordered" }),
      booking({ id: "3", model_name: "Wave 110i", vehicle_status: "in_stock" }),
      // ปิดงาน/ยกเลิกแล้ว ไม่ต้องตามสต็อกอีก
      booking({ id: "4", model_name: "PCX 160", vehicle_status: "need_order", doc_status: "closed" }),
      booking({ id: "5", model_name: "PCX 160", vehicle_status: "need_order", doc_status: "cancelled" }),
    ];
    expect(buildRankings(rows, TODAY).topModelsOutOfStock).toEqual([
      { label: "Wave 110i", count: 2 },
    ]);
  });

  it("ใบที่ไม่ระบุสาขา/รุ่น เข้ากลุ่มไม่ระบุ ไม่หายไปจากอันดับ", () => {
    const rows = [booking({ model_name: null, branch_name: null })];
    const r = buildRankings(rows, TODAY);
    expect(r.topModels).toEqual([{ label: NO_MODEL, count: 1 }]);
    expect(r.topBranches).toEqual([{ label: NO_BRANCH, count: 1 }]);
  });

  it("ข้อ 5: นัดรับรถภายใน 3 วันและรถยังไม่มา (รวมใบที่เลยนัดแล้ว)", () => {
    const rows = [
      booking({ id: "late", pickup_date: "2026-09-05", vehicle_status: "need_order" }),
      booking({ id: "today", pickup_date: TODAY, vehicle_status: "ordered" }),
      booking({ id: "edge", pickup_date: "2026-09-13", vehicle_status: "need_order" }),
      booking({ id: "far", pickup_date: "2026-09-14", vehicle_status: "need_order" }),
      booking({ id: "hasCar", pickup_date: TODAY, vehicle_status: "in_stock" }),
      booking({ id: "done", pickup_date: TODAY, vehicle_status: "need_order", booking_status: "delivered" }),
      booking({ id: "noDate", pickup_date: null, vehicle_status: "need_order" }),
    ];
    expect(buildRankings(rows, TODAY).pickupSoonNoStock.map((r) => r.id)).toEqual([
      "late",
      "today",
      "edge",
    ]);
  });

  it("ข้อ 6: ยกเลิกใน 7 วันล่าสุดตอนรถยังไม่มีในสต็อก เรียงใหม่สุดขึ้นก่อน", () => {
    const cancelled = (id: string, updatedAt: string, vehicle: "need_order" | "in_stock") =>
      booking({
        id,
        booking_status: "cancelled",
        cancel_reason: "got_other",
        doc_status: "cancelled",
        vehicle_status: vehicle,
        updated_at: updatedAt,
      });

    const rows = [
      cancelled("old", "2026-09-01T03:00:00Z", "need_order"), // เกิน 7 วัน
      cancelled("recent", "2026-09-08T03:00:00Z", "need_order"),
      cancelled("newest", "2026-09-09T03:00:00Z", "need_order"),
      cancelled("hasCar", "2026-09-09T03:00:00Z", "in_stock"), // มีรถอยู่แล้ว ไม่เกี่ยวกับสต็อก
      booking({ id: "active", vehicle_status: "need_order", updated_at: "2026-09-09T03:00:00Z" }),
    ];

    expect(buildRankings(rows, TODAY).cancelledNoStockRecent.map((r) => r.id)).toEqual([
      "newest",
      "recent",
    ]);
  });

  it("ปรับจำนวนวันของข้อ 5 และ 6 ได้", () => {
    const rows = [
      booking({ id: "d7", pickup_date: "2026-09-16", vehicle_status: "need_order" }),
    ];
    expect(buildRankings(rows, TODAY).pickupSoonNoStock).toHaveLength(0);
    expect(
      buildRankings(rows, TODAY, { pickupWithinDays: 7 }).pickupSoonNoStock.map((r) => r.id),
    ).toEqual(["d7"]);
  });
});

describe("รอส่งมอบ: สัญญาผ่านแล้ว + รอรับรถ แยกตามสถานะรถ", () => {
  const awaiting = (over: Partial<BookingRow>) =>
    booking({ contract_status: "approved", booking_status: "wait_delivery", ...over });

  it("นับแยก 3 กลุ่มตามสถานะรถ พร้อมยอดมัดจำของแต่ละกลุ่ม", () => {
    const rows = [
      awaiting({ id: "1", vehicle_status: "need_order", deposit_amount: 3000 }),
      awaiting({ id: "2", vehicle_status: "need_order", deposit_amount: 2000 }),
      awaiting({ id: "3", vehicle_status: "ordered", deposit_amount: 5000 }),
      awaiting({ id: "4", vehicle_status: "in_stock", deposit_amount: 1000 }),
    ];
    const p = deliveryPipeline(rows);

    expect(p.total).toBe(4);
    expect(p.byVehicleStatus.need_order).toBe(2);
    expect(p.byVehicleStatus.ordered).toBe(1);
    expect(p.byVehicleStatus.in_stock).toBe(1);
    expect(p.depositByVehicleStatus.need_order).toBe(5000);
    expect(p.depositByVehicleStatus.in_stock).toBe(1000);
  });

  it("ต้องเข้าครบทั้งสัญญาผ่านแล้วและรอรับรถเท่านั้น", () => {
    expect(isAwaitingDelivery({ contract_status: "approved", booking_status: "wait_delivery" })).toBe(true);
    // สัญญายังไม่ผ่าน
    expect(isAwaitingDelivery({ contract_status: "pending", booking_status: "wait_delivery" })).toBe(false);
    // รับรถไปแล้ว
    expect(isAwaitingDelivery({ contract_status: "approved", booking_status: "delivered" })).toBe(false);
    // ยกเลิกไปแล้ว
    expect(isAwaitingDelivery({ contract_status: "approved", booking_status: "cancelled" })).toBe(false);
  });

  it("ใบที่ไม่เข้าเงื่อนไขไม่ถูกนับเข้ามาเลย", () => {
    const rows = [
      booking({ id: "1", contract_status: "pending", booking_status: "wait_contract" }),
      booking({ id: "2", contract_status: "approved", booking_status: "delivered" }),
      booking({
        id: "3",
        contract_status: "rejected",
        booking_status: "cancelled",
        cancel_reason: "contract_rejected",
      }),
    ];
    const p = deliveryPipeline(rows);

    expect(p.total).toBe(0);
    expect(p.byVehicleStatus.in_stock).toBe(0);
    expect(p.depositByVehicleStatus.in_stock).toBe(0);
  });

  it("ไม่มีใบจองเลย ทุกกลุ่มเป็นศูนย์ ไม่ใช่ค่าว่าง", () => {
    const p = deliveryPipeline([]);
    expect(p.total).toBe(0);
    expect(p.byVehicleStatus).toEqual({ in_stock: 0, need_order: 0, ordered: 0 });
  });
});

describe("แนวโน้มยอดจองรายเดือน", () => {
  it("คืนครบ 12 เดือนย้อนหลัง จบที่เดือนที่เลือก", () => {
    const points = monthlyTrend([], 2026, 9, 12);
    expect(points).toHaveLength(12);
    expect(points[0].ym).toBe("2025-10");
    expect(points[11].ym).toBe("2026-09");
    expect(points[11].label).toBe("ก.ย. 69");
  });

  it("เดือนที่ไม่มีใบจองยังมีจุดเป็น 0 ไม่หายไปจากกราฟ", () => {
    const points = monthlyTrend([booking({ booking_date: "2026-09-01" })], 2026, 9, 3);
    expect(points.map((p) => p.total)).toEqual([0, 0, 1]);
  });

  it("นับใบจองและใบที่ปิดการขายได้แยกกัน", () => {
    const rows = [
      booking({ id: "1", booking_date: "2026-09-02", deposit_amount: 3000 }),
      booking({ id: "2", booking_date: "2026-09-20", deposit_amount: 2000, sale_contract_no: "SO-1" }),
      booking({ id: "3", booking_date: "2026-08-15", deposit_amount: 1000 }),
    ];
    const points = monthlyTrend(rows, 2026, 9, 2);

    expect(points[0]).toMatchObject({ ym: "2026-08", total: 1, sold: 0, deposit: 1000 });
    expect(points[1]).toMatchObject({ ym: "2026-09", total: 2, sold: 1, deposit: 5000 });
  });

  it("ใบที่อยู่นอกช่วงที่ขอ ไม่ถูกนับเข้ามา", () => {
    const points = monthlyTrend([booking({ booking_date: "2024-01-05" })], 2026, 9, 12);
    expect(points.reduce((sum, p) => sum + p.total, 0)).toBe(0);
  });
});

describe("ยอดจองแยกตามพนักงานขาย", () => {
  it("ใช้ชื่อบนใบก่อน ไม่มีจึงถอยไปใช้ชื่อบัญชีที่บันทึก", () => {
    expect(staffNameOf({ taken_by_name: "สมชาย", taken_by_full_name: "ผู้ดูแลระบบ" })).toBe("สมชาย");
    expect(staffNameOf({ taken_by_name: null, taken_by_full_name: "ผู้ดูแลระบบ" })).toBe("ผู้ดูแลระบบ");
    expect(staffNameOf({ taken_by_name: "   ", taken_by_full_name: "ผู้ดูแลระบบ" })).toBe("ผู้ดูแลระบบ");
  });

  it("ไม่มีชื่อทั้งสองช่อง จัดเข้ากลุ่มไม่ระบุ", () => {
    expect(staffNameOf({})).toBe(NO_STAFF);
    expect(staffNameOf({ taken_by_name: null, taken_by_full_name: null })).toBe(NO_STAFF);
  });

  it("รวมใบจอง เงินมัดจำ และแยกสถานะให้แต่ละคน", () => {
    const rows = [
      booking({ id: "1", taken_by_name: "สมชาย", deposit_amount: 3000 }),
      booking({
        id: "2",
        taken_by_name: "สมชาย",
        deposit_amount: 5000,
        booking_status: "delivered",
        sale_contract_no: "SO-1",
      }),
      booking({ id: "3", taken_by_name: "มาลี", deposit_amount: 1000, booking_status: "cancelled" }),
    ];

    const [first, second] = summarizeByStaff(rows);

    // เรียงจากใบมากไปน้อย
    expect(first.staff).toBe("สมชาย");
    expect(first.total).toBe(2);
    expect(first.deposit).toBe(8000);
    expect(first.byBookingStatus.wait_contract).toBe(1);
    expect(first.byBookingStatus.delivered).toBe(1);
    expect(first.sold).toBe(1);

    expect(second.staff).toBe("มาลี");
    expect(second.total).toBe(1);
    expect(second.byBookingStatus.cancelled).toBe(1);
    expect(second.sold).toBe(0);
  });

  it("ไม่มีใบจองเลย คืนอาร์เรย์ว่าง", () => {
    expect(summarizeByStaff([])).toEqual([]);
  });

  it("เลขที่สัญญาขายที่เป็นช่องว่างล้วน ไม่นับว่าปิดการขายได้", () => {
    const rows = [booking({ taken_by_name: "สมชาย", sale_contract_no: "   " })];
    expect(summarizeByStaff(rows)[0].sold).toBe(0);
  });

  it("กรองพนักงานจาก query string ได้ (ตรงตัว)", () => {
    expect(queryFromParams({ staff: "สมชาย" }).staff).toBe("สมชาย");
    expect(queryFromParams({ staff: "  " }).staff).toBeNull();
    expect(queryFromParams({}).staff).toBeNull();
  });
});

describe("ปฏิทิน (1.4.1)", () => {
  it("กันยายน 2569 เริ่มวันอังคาร มีช่องว่างนำหน้า 2 ช่อง และครบ 30 วัน", () => {
    const weeks = buildCalendar(2026, 9);
    expect(weeks[0][0].date).toBeNull();
    expect(weeks[0][1].date).toBeNull();
    expect(weeks[0][2].date).toBe("2026-09-01");

    const days = weeks.flat().filter((c) => c.date !== null);
    expect(days).toHaveLength(30);
    expect(days[29].date).toBe("2026-09-30");
  });

  it("ทุกสัปดาห์มี 7 ช่องเสมอ", () => {
    for (const month of [1, 2, 6, 12]) {
      for (const week of buildCalendar(2027, month)) expect(week).toHaveLength(7);
    }
  });

  it("จัดใบจองเข้าวันตามช่องที่เลือก และข้ามใบที่ยังไม่มีวันนัด", () => {
    const rows = [
      booking({ id: "1", pickup_date: "2026-09-10" }),
      booking({ id: "2", pickup_date: "2026-09-10" }),
      booking({ id: "3", pickup_date: null }),
    ];
    const byPickup = groupByDate(rows, "pickup_date");
    expect(byPickup.get("2026-09-10")).toHaveLength(2);
    expect(byPickup.size).toBe(1);

    expect(groupByDate(rows, "booking_date").get("2026-09-01")).toHaveLength(3);
  });

  it("เลื่อนเดือนข้ามปีได้ทั้งสองทาง", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 9, 0)).toEqual({ year: 2026, month: 9 });
  });
});
