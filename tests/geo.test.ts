import { describe, expect, it } from "vitest";
import { distanceMeters, formatLatLng, googleMapsUrl, parseLatLng } from "../src/lib/geo";

describe("อ่านพิกัดจาก Google Maps", () => {
  it("พิกัดที่คัดลอกมาตรง ๆ", () => {
    expect(parseLatLng("13.756331, 100.501765")).toEqual({ lat: 13.756331, lng: 100.501765 });
    expect(parseLatLng("13.756331,100.501765")).toEqual({ lat: 13.756331, lng: 100.501765 });
    expect(parseLatLng("  13.7563 100.5018 ")).toEqual({ lat: 13.7563, lng: 100.5018 });
  });

  it("ลิงก์แผนที่แบบ /@lat,lng,zoom", () => {
    expect(parseLatLng("https://www.google.com/maps/@13.7563,100.5018,17z")).toEqual({
      lat: 13.7563,
      lng: 100.5018,
    });
  });

  it("ลิงก์แบบ place ใช้พิกัดหมุดจริง (!3d!4d) ไม่ใช่จุดกึ่งกลางจอ", () => {
    const url =
      "https://www.google.com/maps/place/ร้าน/@13.70,100.40,17z/data=!3m1!4b1!4m5!3m4!1s0x0:0x0!8m2!3d13.756331!4d100.501765";
    expect(parseLatLng(url)).toEqual({ lat: 13.756331, lng: 100.501765 });
  });

  it("ลิงก์แบบ ?q=lat,lng", () => {
    expect(parseLatLng("https://maps.google.com/?q=13.7563,100.5018")).toEqual({
      lat: 13.7563,
      lng: 100.5018,
    });
  });

  it("ค่าที่อ่านไม่ได้หรือเกินขอบเขตต้องเป็น null", () => {
    expect(parseLatLng("")).toBeNull();
    expect(parseLatLng("ร้านสาขาเณรแก้ว")).toBeNull();
    expect(parseLatLng("https://maps.app.goo.gl/abcd1234")).toBeNull();
    expect(parseLatLng("200, 500")).toBeNull();
  });

  it("แปลงกลับเป็นข้อความและลิงก์แผนที่", () => {
    expect(formatLatLng(13.7563, 100.5018)).toBe("13.7563, 100.5018");
    expect(formatLatLng(null, null)).toBe("");
    expect(googleMapsUrl(13.7563, 100.5018)).toBe("https://www.google.com/maps?q=13.7563,100.5018");
  });
});

describe("ระยะทาง", () => {
  it("คำนวณระยะห่างเป็นเมตรได้ใกล้เคียงความจริง", () => {
    // อนุสาวรีย์ชัยฯ → สยาม ประมาณ 2.5 กม.
    const d = distanceMeters(13.7649, 100.5383, 13.7455, 100.5342);
    expect(d).toBeGreaterThan(2000);
    expect(d).toBeLessThan(2600);
  });

  it("จุดเดียวกัน = 0 เมตร", () => {
    expect(distanceMeters(13.7563, 100.5018, 13.7563, 100.5018)).toBe(0);
  });
});
