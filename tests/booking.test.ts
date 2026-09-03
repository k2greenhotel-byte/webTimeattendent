import { describe, expect, it } from "vitest";
import {
  applyUpdate,
  bookingOptionLabel,
  buildCalendar,
  countByBrandModel,
  countByKey,
  describeUpdate,
  describeVehicle,
  formatBaht,
  groupByDate,
  isOpenBooking,
  parseAmount,
  resolveDocStatus,
  shiftMonth,
  summarize,
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
    note: null,
    company_id: null,
    created_by: null,
    created_at: "2026-09-01T03:00:00Z",
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
  };

  it("ข้อมูลครบผ่าน", () => {
    expect(validateBooking(base)).toBeNull();
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
