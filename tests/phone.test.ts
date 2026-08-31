import { describe, expect, it } from "vitest";
import { formatPhone, isValidPhone, normalizePhone } from "../src/lib/phone";

describe("เบอร์มือถือ (ใช้เป็นรหัสเข้าระบบ)", () => {
  it("ตัดขีด ช่องว่าง และวงเล็บออกให้เหลือตัวเลขล้วน", () => {
    expect(normalizePhone("081-234-5678")).toBe("0812345678");
    expect(normalizePhone("081 234 5678")).toBe("0812345678");
    expect(normalizePhone(" (081)234-5678 ")).toBe("0812345678");
  });

  it("แปลงรูปแบบสากล +66 เป็น 0 นำหน้า", () => {
    expect(normalizePhone("+66812345678")).toBe("0812345678");
    expect(normalizePhone("+66 81 234 5678")).toBe("0812345678");
  });

  it("กรอกคนละรูปแบบแต่ได้ค่าเดียวกัน = login ได้เหมือนกัน", () => {
    expect(normalizePhone("081-234-5678")).toBe(normalizePhone("+66812345678"));
  });

  it("ตรวจความถูกต้องของเบอร์", () => {
    expect(isValidPhone("0812345678")).toBe(true);
    expect(isValidPhone("081-234-5678")).toBe(true);
    expect(isValidPhone("021234567")).toBe(true); // เบอร์บ้าน 9 หลัก
    expect(isValidPhone("812345678")).toBe(false); // ไม่ขึ้นต้นด้วย 0
    expect(isValidPhone("08123")).toBe(false); // สั้นเกินไป
    expect(isValidPhone("08123456789")).toBe(false); // ยาวเกินไป
    expect(isValidPhone("")).toBe(false);
  });

  it("แสดงผลแบบอ่านง่าย", () => {
    expect(formatPhone("0812345678")).toBe("081-234-5678");
    expect(formatPhone("021234567")).toBe("02-123-4567");
    expect(formatPhone(null)).toBe("-");
  });
});
