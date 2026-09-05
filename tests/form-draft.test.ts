import { describe, expect, it } from "vitest";
import {
  PICK_FIELD,
  isPickKind,
  returnUrl,
  safeReturnPath,
} from "../src/lib/form-draft";

describe("เส้นทางที่ให้เด้งกลับได้", () => {
  it("รับเฉพาะ path ภายในเว็บนี้", () => {
    expect(safeReturnPath("/booking/bookings/new")).toBe("/booking/bookings/new");
    expect(safeReturnPath("/booking/bookings/abc-123")).toBe("/booking/bookings/abc-123");
  });

  it("ปฏิเสธลิงก์ออกนอกเว็บ (กัน open redirect)", () => {
    expect(safeReturnPath("//evil.example.com")).toBeNull();
    expect(safeReturnPath("https://evil.example.com")).toBeNull();
    expect(safeReturnPath("http://evil.example.com")).toBeNull();
    expect(safeReturnPath("/\\evil.example.com")).toBeNull();
  });

  it("ค่าว่างหรือไม่ได้ส่งมา คืน null", () => {
    expect(safeReturnPath("")).toBeNull();
    expect(safeReturnPath("   ")).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
    expect(safeReturnPath("booking/new")).toBeNull();
  });
});

describe("ชนิดข้อมูลเบื้องต้นที่กดออกไปเพิ่มได้", () => {
  it("รู้จักครบทุกชนิดตามช่องบนใบจองและใบ Lead", () => {
    expect(Object.keys(PICK_FIELD)).toEqual([
      "customer",
      "brand",
      "model",
      "variant",
      "color",
      "channel",
    ]);
    expect(PICK_FIELD.customer).toBe("customer_id");
    expect(PICK_FIELD.color).toBe("color_id");
    expect(PICK_FIELD.channel).toBe("channel_id");
  });

  it("ค่าที่ไม่รู้จักถูกปฏิเสธ", () => {
    expect(isPickKind("brand")).toBe(true);
    expect(isPickKind("vendor")).toBe(false);
    expect(isPickKind("")).toBe(false);
    expect(isPickKind(null)).toBe(false);
  });
});

describe("URL ที่พากลับไปหน้าเดิม", () => {
  it("มีทั้งธงกู้ร่าง ชนิดข้อมูล และ id ที่เพิ่งเพิ่ม", () => {
    const url = returnUrl("/booking/bookings/new", "color", "abc-123");
    const params = new URLSearchParams(url.split("?")[1]);

    expect(url.startsWith("/booking/bookings/new?")).toBe(true);
    expect(params.get("restore")).toBe("1");
    expect(params.get("pick")).toBe("color");
    expect(params.get("picked")).toBe("abc-123");
  });
});
