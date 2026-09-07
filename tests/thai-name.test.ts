import { describe, expect, it } from "vitest";
import {
  firstNameOf,
  looseThaiName,
  matchByName,
  normalizeThaiName,
  parsePastedCodes,
} from "../src/lib/thai-name";

describe("normalizeThaiName", () => {
  it("ตัดคำนำหน้าและช่องว่างออกให้เทียบกันได้", () => {
    const forms = [
      "น.ส.เสาวนีย์  ดิษเทศ",
      "นส.เสาวนีย์ ดิษเทศ",
      "นางสาวเสาวนีย์ดิษเทศ",
      "  เสาวนีย์   ดิษเทศ ",
    ];
    const normalized = forms.map(normalizeThaiName);
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe("เสาวนีย์ดิษเทศ");
  });

  it('แก้ "เเ" ที่พิมพ์ผิดให้เป็น "แ"', () => {
    expect(normalizeThaiName("นายไกรศร เเก้วไทรเพ็ง")).toBe(normalizeThaiName("นายไกรศร แก้วไทรเพ็ง"));
  });

  it("ชื่อคนละคนต้องไม่ตรงกัน", () => {
    expect(normalizeThaiName("นายสมชาย ใจดี")).not.toBe(normalizeThaiName("นายสมศักดิ์ ใจดี"));
  });
});

describe("looseThaiName", () => {
  it("ต่างแค่วรรณยุกต์ถือว่าเหมือนกัน", () => {
    expect(looseThaiName("นายรัฐภูมิ อุ่มน้อย")).toBe(looseThaiName("นาย รัฐภูมิ อุ้มน้อย"));
  });
});

describe("firstNameOf", () => {
  it("ได้ชื่อต้นหลังคำนำหน้า", () => {
    expect(firstNameOf("น.ส.รุ่งฟ้า  เจียระสถิตย์")).toBe("รุ่งฟ้า");
    expect(firstNameOf("นายปุญญพัฒน์  อินสว่าง")).toBe("ปุญญพัฒน์");
    expect(firstNameOf("")).toBe("");
  });
});

describe("matchByName", () => {
  const staff = [
    { id: "1", full_name: "น.ส. รุ่งฟ้า เจียรสถิตย์", nickname: "ฟ้า" },
    { id: "2", full_name: "นายปุญญพัฒน์ จันทร์สว่าง", nickname: "โอม" },
    { id: "3", full_name: "นายมนตรี นาคสมพันธ์", nickname: null },
    { id: "4", full_name: "นาย รัฐภูมิ อุ้มน้อย", nickname: null },
    { id: "5", full_name: "น.ส.สมหญิง ใจงาม", nickname: "หญิง" },
    { id: "6", full_name: "น.ส.สมหญิง รักดี", nickname: "หญิง" },
  ];

  it("ชื่อตรงเป๊ะ (ต่างแค่คำนำหน้า/ช่องว่าง)", () => {
    const m = matchByName("นางสาวสมหญิง  ใจงาม", "หญิง", staff);
    expect(m?.employee.id).toBe("5");
    expect(m?.level).toBe("exact");
  });

  it("ต่างแค่วรรณยุกต์", () => {
    const m = matchByName("นายรัฐภูมิ  อุ่มน้อย", "ฟิล์ม", staff);
    expect(m?.employee.id).toBe("4");
    expect(m?.level).toBe("loose");
  });

  it("นามสกุลสะกดต่าง แต่ชื่อต้นและชื่อเล่นตรง", () => {
    const m = matchByName("น.ส.รุ่งฟ้า  เจียระสถิตย์", "ฟ้า", staff);
    expect(m?.employee.id).toBe("1");
    expect(m?.level).toBe("first");
  });

  it("ชื่อต้นซ้ำกันหลายคนและชื่อเล่นก็ซ้ำ = ไม่เดา", () => {
    expect(matchByName("น.ส.สมหญิง เก่งกาจ", "หญิง", staff)).toBeNull();
  });

  it("ไม่มีใครชื่อนี้เลย", () => {
    expect(matchByName("นายทรงศักดิ์ อินอนันต์", "อาร์ม", staff)).toBeNull();
  });

  it("ชื่อเล่นขัดกันไม่จับคู่ข้ามคน", () => {
    expect(matchByName("นายปุญญพัฒน์ อินสว่าง", "บอย", staff)).toBeNull();
  });
});

describe("parsePastedCodes", () => {
  it("อ่านข้อความที่ก๊อปจาก Excel (คั่นด้วย Tab) และข้ามหัวตาราง", () => {
    const rows = parsePastedCodes(
      ["รหัสพนักงาน\tชื่อ พนักงาน\tชื่อเล่น", "K2009\tน.ส.กาญจนรินทร์ ปรีดา\tแก้ว", "", "K0004\tน.ส.สุทธิลักษณ์ กันบัว"].join("\n"),
    );
    expect(rows).toEqual([
      { code: "K2009", name: "น.ส.กาญจนรินทร์ ปรีดา", nickname: "แก้ว" },
      { code: "K0004", name: "น.ส.สุทธิลักษณ์ กันบัว", nickname: null },
    ]);
  });

  it("รองรับคั่นด้วยจุลภาค และแบบเว้นวรรค (คำแรก = รหัส ที่เหลือ = ชื่อ)", () => {
    expect(parsePastedCodes("002,น.ส.ณัฐกานต์ เพ่งพิศ")).toEqual([
      { code: "002", name: "น.ส.ณัฐกานต์ เพ่งพิศ", nickname: null },
    ]);
    expect(parsePastedCodes("012   นายมนตรี นาคสมพันธุ์")).toEqual([
      { code: "012", name: "นายมนตรี นาคสมพันธุ์", nickname: null },
    ]);
  });

  it("ชื่อไทยที่มีเว้นวรรคสองช่องต้องไม่ถูกหั่นเป็นคนละคอลัมน์", () => {
    const [row] = parsePastedCodes("K2009\tน.ส.กาญจนรินทร์  ปรีดา\tแก้ว");
    expect(row.name).toBe("น.ส.กาญจนรินทร์  ปรีดา");
    expect(row.nickname).toBe("แก้ว");
  });

  it("บรรทัดที่มีคอลัมน์เดียวถูกข้าม", () => {
    expect(parsePastedCodes("K2\nพนักงานKMS")).toEqual([]);
  });
});
