import { describe, expect, it } from "vitest";
import {
  ageFromBirthDate,
  districtLabel,
  formatFullAddress,
  formatNationalId,
  isValidNationalId,
  nextCustomerCode,
  normalizeFacebook,
  normalizeLine,
  normalizeNationalId,
  subdistrictLabel,
} from "../src/lib/customers";

describe("เลขบัตรประชาชน", () => {
  it("ตัดขีดและช่องว่างออกให้เหลือตัวเลขล้วน", () => {
    expect(normalizeNationalId("1-2345-67890-12-3")).toBe("1234567890123");
    expect(normalizeNationalId(" 1 2345 67890 12 3 ")).toBe("1234567890123");
  });

  it("ยอมรับเลขที่หลักตรวจสอบถูกต้อง", () => {
    // 110170014949 → หลักตรวจสอบ 8
    expect(isValidNationalId("1101700149498")).toBe(true);
    expect(isValidNationalId("1-1017-00149-49-8")).toBe(true);
  });

  it("ปฏิเสธเลขที่หลักตรวจสอบผิด", () => {
    expect(isValidNationalId("1101700149491")).toBe(false);
    expect(isValidNationalId("1111111111110")).toBe(false);
  });

  it("ปฏิเสธเลขที่ไม่ครบ 13 หลักหรือมีตัวอักษร", () => {
    expect(isValidNationalId("123")).toBe(false);
    expect(isValidNationalId("")).toBe(false);
    expect(isValidNationalId(null)).toBe(false);
    expect(isValidNationalId("abcdefghijklm")).toBe(false);
  });

  it("จัดรูปแบบให้อ่านง่าย", () => {
    expect(formatNationalId("1101700149498")).toBe("1-1017-00149-49-8");
    expect(formatNationalId(null)).toBe("-");
  });
});

describe("รหัสลูกค้าอัตโนมัติ", () => {
  it("ลูกค้ารายแรกได้ C000001", () => {
    expect(nextCustomerCode(null)).toBe("C000001");
    expect(nextCustomerCode("")).toBe("C000001");
  });

  it("นับต่อจากรหัสล่าสุด และคงจำนวนหลักไว้", () => {
    expect(nextCustomerCode("C000001")).toBe("C000002");
    expect(nextCustomerCode("C000123")).toBe("C000124");
    expect(nextCustomerCode("C000999")).toBe("C001000");
  });

  it("รหัสที่ตั้งเองแบบมีตัวอักษรนำหน้า ก็ยังนับตัวเลขท้ายได้", () => {
    expect(nextCustomerCode("KAN-0007")).toBe("C000008");
  });
});

describe("ที่อยู่ไทย", () => {
  const upcountry = {
    address_detail: "99/1 หมู่ 4 ถ.แสงชูโต",
    subdistrict_name: "ท่ามะกา",
    district_name: "ท่ามะกา",
    province_name: "กาญจนบุรี",
    postal_code: "71120",
  };

  it("ต่างจังหวัดใช้ ตำบล/อำเภอ", () => {
    expect(subdistrictLabel("กาญจนบุรี")).toBe("ตำบล");
    expect(districtLabel("กาญจนบุรี")).toBe("อำเภอ");
    expect(formatFullAddress(upcountry)).toBe(
      "99/1 หมู่ 4 ถ.แสงชูโต ตำบลท่ามะกา อำเภอท่ามะกา จ.กาญจนบุรี 71120",
    );
  });

  it("กรุงเทพฯ ใช้ แขวง/เขต และไม่มีคำว่า จ. นำหน้า", () => {
    expect(subdistrictLabel("กรุงเทพมหานคร")).toBe("แขวง");
    expect(districtLabel("กรุงเทพมหานคร")).toBe("เขต");
    expect(
      formatFullAddress({
        address_detail: "1 ถ.หน้าพระลาน",
        subdistrict_name: "พระบรมมหาราชวัง",
        district_name: "พระนคร",
        province_name: "กรุงเทพมหานคร",
        postal_code: "10200",
      }),
    ).toBe("1 ถ.หน้าพระลาน แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200");
  });

  it("กรอกมาไม่ครบก็ประกอบเท่าที่มี ไม่มีช่องว่างหรือคำเกิน", () => {
    expect(formatFullAddress({ address_detail: "99/1" })).toBe("99/1");
    expect(formatFullAddress({ province_name: "กาญจนบุรี" })).toBe("จ.กาญจนบุรี");
    expect(formatFullAddress({})).toBe("");
  });
});

describe("ลิงก์โซเชียล", () => {
  it("Facebook: ใส่ลิงก์เต็มมาก็ใช้ตามนั้น ใส่ชื่อผู้ใช้มาก็เติมโดเมนให้", () => {
    expect(normalizeFacebook("https://facebook.com/somchai")).toBe("https://facebook.com/somchai");
    expect(normalizeFacebook("somchai")).toBe("https://www.facebook.com/somchai");
    expect(normalizeFacebook("/somchai")).toBe("https://www.facebook.com/somchai");
    expect(normalizeFacebook("  ")).toBeNull();
  });

  it("LINE: บัญชีทางการ (@) กับ ID ธรรมดา ใช้ลิงก์คนละแบบ", () => {
    expect(normalizeLine("@kkmotor")).toBe("https://line.me/R/ti/p/%40kkmotor");
    expect(normalizeLine("somchai99")).toBe("https://line.me/ti/p/~somchai99");
    expect(normalizeLine("https://line.me/ti/p/~somchai99")).toBe(
      "https://line.me/ti/p/~somchai99",
    );
    expect(normalizeLine(null)).toBeNull();
  });
});

describe("อายุจากวันเกิด", () => {
  const today = new Date("2026-09-03T00:00:00Z");

  it("นับเป็นปีเต็ม", () => {
    expect(ageFromBirthDate("1990-09-03", today)).toBe(36);
    expect(ageFromBirthDate("1990-09-02", today)).toBe(36);
  });

  it("ยังไม่ถึงวันเกิดปีนี้ นับน้อยลงหนึ่งปี", () => {
    expect(ageFromBirthDate("1990-09-04", today)).toBe(35);
    expect(ageFromBirthDate("1990-12-31", today)).toBe(35);
  });

  it("ไม่มีวันเกิดหรือกรอกมั่ว คืน null", () => {
    expect(ageFromBirthDate(null, today)).toBeNull();
    expect(ageFromBirthDate("", today)).toBeNull();
    expect(ageFromBirthDate("ไม่ใช่วันที่", today)).toBeNull();
  });
});
