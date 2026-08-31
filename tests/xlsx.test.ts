import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { buildXlsx } from "../src/lib/xlsx";

describe("ตัวสร้างไฟล์ Excel", () => {
  const file = buildXlsx({
    sheetName: "รายงาน",
    title: "รายงานการลงเวลารายวัน: จ. 31 ส.ค. 2569",
    headers: ["วันที่", "ชื่อ-สกุล", "สาขา", "สาย (นาที)", "ชั่วโมงทำงาน"],
    rows: [
      ["จ. 31 ส.ค. 2569", "สมชาย ใจดี", "สาขาหลัก", 75, 7.67],
      ["จ. 31 ส.ค. 2569", 'สมหญิง "รักงาน" <ทดสอบ> & Co', "สาขาสยาม", 15, 7.67],
    ],
    summary: ["รวมชั่วโมงทำงาน: 15 ชม. 20 นาที"],
  });

  it("เป็นไฟล์ zip ที่ถูกต้อง (magic bytes PK)", () => {
    expect(file[0]).toBe(0x50);
    expect(file[1]).toBe(0x4b);
    expect(file.length).toBeGreaterThan(500);
  });

  it("มีชิ้นส่วนครบตามมาตรฐาน xlsx", () => {
    const files = Object.keys(unzipSync(file));
    expect(files).toEqual(
      expect.arrayContaining([
        "[Content_Types].xml",
        "_rels/.rels",
        "xl/workbook.xml",
        "xl/_rels/workbook.xml.rels",
        "xl/styles.xml",
        "xl/worksheets/sheet1.xml",
      ]),
    );
  });

  it("ข้อมูลภาษาไทยและอักขระพิเศษถูก escape อย่างถูกต้อง", () => {
    const sheet = strFromU8(unzipSync(file)["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain("สมชาย ใจดี");
    expect(sheet).toContain("&quot;รักงาน&quot;");
    expect(sheet).toContain("&lt;ทดสอบ&gt;");
    expect(sheet).toContain("&amp; Co");
    // ตัวเลขต้องเก็บเป็นตัวเลข ไม่ใช่ข้อความ (เอาไปคำนวณต่อใน Excel ได้)
    expect(sheet).toContain("<v>75</v>");
    expect(sheet).toContain("<v>7.67</v>");
  });
});
