import { describe, expect, it } from "vitest";
import {
  comboIndex,
  comboKey,
  groupBookingsByCombo,
  matchStockWithBookings,
  summarizeMatches,
  unitBookingOf,
  type BookingForMatch,
  type StockCombo,
} from "../src/lib/booking-stock";

function bk(over: Partial<BookingForMatch> = {}): BookingForMatch {
  return {
    id: "b1",
    doc_no: "BK-2569-0001",
    db2_model_code: "WAVE 125-I",
    db2_variant_code: "BJKC00",
    db2_color_code: "ดำ",
    ...over,
  };
}

const combo = (model: string, variant: string, color: string, units: number): StockCombo => ({
  model,
  variant,
  color,
  units,
});

describe("รหัสกลุ่ม รุ่น+แบบ+สี", () => {
  it("ตัดช่องว่างและไม่สนตัวพิมพ์ (Db2 เก็บเป็น CHAR ความยาวคงที่)", () => {
    expect(comboKey("WAVE ", "BJKC00", "ดำ")).toBe(comboKey("wave", " bjkc00 ", "ดำ"));
  });

  it("ค่าว่างยังได้รหัสที่เทียบกันได้ ไม่พัง", () => {
    expect(comboKey(null, undefined, "")).toBe("||");
  });
});

describe("จัดใบจองเข้ากลุ่ม", () => {
  it("ใบที่ระบุรถไม่ครบทั้ง 3 ช่อง ไม่ถูกนับ", () => {
    const map = groupBookingsByCombo([
      bk({ id: "ok" }),
      bk({ id: "noVariant", db2_variant_code: null }),
      bk({ id: "noColor", db2_color_code: null }),
      bk({ id: "noModel", db2_model_code: null }),
    ]);
    expect(map.size).toBe(1);
    expect(map.get(comboKey("WAVE 125-I", "BJKC00", "ดำ"))?.map((b) => b.id)).toEqual(["ok"]);
  });
});

describe("จับคู่สต็อกกับใบจอง", () => {
  it("นับติดจอง เหลือขายได้ และของขาด ให้แต่ละกลุ่ม", () => {
    const combos = [combo("WAVE 125-I", "BJKC00", "ดำ", 3)];
    const bookings = [bk({ id: "1", doc_no: "BK-1" }), bk({ id: "2", doc_no: "BK-2" })];

    const [m] = matchStockWithBookings(combos, bookings);
    expect(m.units).toBe(3);
    expect(m.booked).toBe(2);
    expect(m.free).toBe(1);
    expect(m.shortage).toBe(0);
    expect(m.bookings.map((b) => b.doc_no)).toEqual(["BK-1", "BK-2"]);
  });

  it("จองมากกว่ารถที่มี → เหลือ 0 และขึ้นยอดขาด", () => {
    const [m] = matchStockWithBookings(
      [combo("FINO", "AAA", "แดง", 1)],
      [bk({ id: "1", db2_model_code: "FINO", db2_variant_code: "AAA", db2_color_code: "แดง" }),
       bk({ id: "2", db2_model_code: "FINO", db2_variant_code: "AAA", db2_color_code: "แดง" }),
       bk({ id: "3", db2_model_code: "FINO", db2_variant_code: "AAA", db2_color_code: "แดง" })],
    );
    expect(m.free).toBe(0);
    expect(m.shortage).toBe(2);
  });

  it("กลุ่มที่มีใบจองแต่ไม่มีรถในสต็อกเลย ต้องโผล่ในผลลัพธ์ (units = 0)", () => {
    const matches = matchStockWithBookings(
      [combo("WAVE 125-I", "BJKC00", "ดำ", 2)],
      [bk({ id: "x", db2_model_code: "NMAX", db2_variant_code: "ZZ", db2_color_code: "น้ำเงิน" })],
    );
    const missing = matches.find((m) => m.model === "NMAX");
    expect(missing).toBeDefined();
    expect(missing?.units).toBe(0);
    expect(missing?.booked).toBe(1);
    expect(missing?.shortage).toBe(1);
  });

  it("เรียงกลุ่มที่ของขาดขึ้นก่อน แล้วค่อยกลุ่มที่ติดจอง", () => {
    const matches = matchStockWithBookings(
      [combo("A", "v", "c", 5), combo("B", "v", "c", 1), combo("C", "v", "c", 9)],
      [
        bk({ id: "1", db2_model_code: "B", db2_variant_code: "v", db2_color_code: "c" }),
        bk({ id: "2", db2_model_code: "B", db2_variant_code: "v", db2_color_code: "c" }),
        bk({ id: "3", db2_model_code: "A", db2_variant_code: "v", db2_color_code: "c" }),
      ],
    );
    expect(matches.map((m) => m.model)).toEqual(["B", "A", "C"]);
  });

  it("ไม่มีใบจองเลย ทุกกลุ่มว่างหมด", () => {
    const [m] = matchStockWithBookings([combo("A", "v", "c", 4)], []);
    expect(m.booked).toBe(0);
    expect(m.free).toBe(4);
  });
});

describe("ยอดรวมและการอ่านสถานะรายคัน", () => {
  const combos = [combo("A", "v", "c", 2), combo("B", "v", "c", 3)];
  const bookings = [bk({ id: "1", db2_model_code: "A", db2_variant_code: "v", db2_color_code: "c" })];

  it("รวมยอดทุกกลุ่ม", () => {
    const t = summarizeMatches(matchStockWithBookings(combos, bookings));
    expect(t).toEqual({ combos: 2, units: 5, booked: 1, free: 4, shortage: 0 });
  });

  it("รถหนึ่งคันอ่านสถานะจากกลุ่มที่ตัวเองสังกัด", () => {
    const index = comboIndex(matchStockWithBookings(combos, bookings));
    expect(unitBookingOf({ model: "A", variant: "v", color: "c" }, index).booked).toBe(1);
    expect(unitBookingOf({ model: "B", variant: "v", color: "c" }, index).booked).toBe(0);
  });

  it("คันที่ไม่มีกลุ่มตรงเลย คืนค่าศูนย์ ไม่ throw", () => {
    const index = comboIndex(matchStockWithBookings(combos, bookings));
    expect(unitBookingOf({ model: "ZZZ", variant: "?", color: "?" }, index)).toEqual({
      booked: 0,
      units: 0,
      free: 0,
      bookings: [],
    });
  });
});
