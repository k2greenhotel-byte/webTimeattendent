import { describe, expect, it } from "vitest";
import {
  MOTO_MASTERS,
  filterOptions,
  masterTitle,
  normalizeCode,
  parentNameOf,
  specOf,
  specOfSlug,
  validateMasterInput,
} from "../src/lib/moto";
import type { MotoOption } from "../src/lib/moto-types";

const brand = specOf("brand")!;
const model = specOf("model")!;

function option(over: Partial<MotoOption> = {}): MotoOption {
  return { id: "1", code: "BR01", name: "Yamaha", is_active: true, ...over };
}

describe("ทะเบียนข้อมูลหลัก", () => {
  it("มีครบ 10 ชุดตามที่กำหนด และเรียงลำดับ 1-10", () => {
    expect(MOTO_MASTERS).toHaveLength(10);
    expect(MOTO_MASTERS.map((m) => m.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("รหัส kind / slug / ตาราง / รหัสเมนู ต้องไม่ซ้ำกัน", () => {
    for (const key of ["kind", "slug", "table", "menuCode"] as const) {
      const values = MOTO_MASTERS.map((m) => m[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("หานิยามจาก kind และจาก slug ได้ตัวเดียวกัน", () => {
    expect(specOfSlug("brands")).toBe(brand);
    expect(specOfSlug("BRANDS")).toBe(brand);
    expect(specOf("brand")).toBe(brand);
  });

  it("ไม่รู้จักคืน null ไม่ throw", () => {
    expect(specOf("ไม่มีจริง")).toBeNull();
    expect(specOfSlug("ไม่มีจริง")).toBeNull();
  });

  it("ตัวแม่ที่อ้างถึงต้องมีอยู่จริงในทะเบียน", () => {
    for (const spec of MOTO_MASTERS) {
      if (spec.parent) expect(specOf(spec.parent.kind)).not.toBeNull();
    }
  });

  it("แสดงหัวข้อพร้อมลำดับ", () => {
    expect(masterTitle(brand)).toBe("1. ยี่ห้อรถ");
    expect(masterTitle(model)).toBe("2. รุ่นรถ");
  });
});

describe("normalizeCode", () => {
  it("ตัดช่องว่างและทำเป็นตัวพิมพ์ใหญ่", () => {
    expect(normalizeCode("  br 01 ")).toBe("BR01");
    expect(normalizeCode("md-01")).toBe("MD-01");
  });

  it("รหัสภาษาไทยไม่ถูกทำลาย", () => {
    expect(normalizeCode(" ยห01 ")).toBe("ยห01");
  });
});

describe("validateMasterInput", () => {
  const base = { code: "BR09", name: "Suzuki", is_active: true, parent_id: null };

  it("ค่าครบถ้วนผ่าน", () => {
    expect(validateMasterInput(brand, base)).toBeNull();
  });

  it("ไม่กรอกรหัส/ชื่อ บอกชื่อช่องที่ขาดเป็นภาษาไทย", () => {
    expect(validateMasterInput(brand, { ...base, code: "" })).toBe("กรุณากรอกรหัสยี่ห้อ");
    expect(validateMasterInput(brand, { ...base, name: "" })).toBe("กรุณากรอกชื่อยี่ห้อรถ");
  });

  it("ยาวเกินกำหนดไม่ผ่าน", () => {
    expect(validateMasterInput(brand, { ...base, code: "X".repeat(21) })).toContain("ยาวเกินไป");
    expect(validateMasterInput(brand, { ...base, name: "ก".repeat(121) })).toContain("ยาวเกินไป");
  });
});

describe("parentNameOf", () => {
  const brands = [option(), option({ id: "2", code: "BR02", name: "Honda" })];

  it("คืนรหัสและชื่อของตัวแม่", () => {
    const row = option({ id: "9", code: "MD01", name: "Wave 110i", brand_id: "2" });
    expect(parentNameOf(row, brands)).toBe("BR02 · Honda");
  });

  it("ยังไม่เลือกตัวแม่ หรือตัวแม่ถูกลบไปแล้ว แสดงว่าไม่ระบุ", () => {
    expect(parentNameOf(option({ brand_id: null }), brands)).toBe("— ไม่ระบุ —");
    expect(parentNameOf(option({ brand_id: "ไม่มีแล้ว" }), brands)).toBe("— ไม่ระบุ —");
  });
});

describe("filterOptions", () => {
  const rows = [
    option({ id: "1", code: "BR01", name: "Yamaha" }),
    option({ id: "2", code: "BR02", name: "Honda" }),
    option({ id: "3", code: "CH01", name: "Facebook" }),
  ];

  it("คำว่างคืนทั้งหมด", () => {
    expect(filterOptions(rows, "   ")).toHaveLength(3);
  });

  it("ค้นได้ทั้งรหัสและชื่อ โดยไม่สนตัวพิมพ์", () => {
    expect(filterOptions(rows, "br0").map((r) => r.code)).toEqual(["BR01", "BR02"]);
    expect(filterOptions(rows, "honda").map((r) => r.code)).toEqual(["BR02"]);
  });

  it("ไม่ตรงเลยคืนอาร์เรย์ว่าง", () => {
    expect(filterOptions(rows, "zzz")).toEqual([]);
  });
});
