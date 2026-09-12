import { describe, expect, it } from "vitest";
import {
  buildPivotTable,
  cellAt,
  PIVOT_OTHER,
  type PivotDim,
  type PivotMetric,
} from "../src/lib/wall-pivot";

/**
 * ตารางไขว้ของจอ War Room — สิ่งที่ต้องคุมคือ "ยอดรวมห้ามเพี้ยน"
 *
 * ตารางยุบแถว/คอลัมน์ส่วนที่เกินเป็น "อื่นๆ" เพื่อให้อ่านบนจอไหว
 * การยุบเป็นเรื่องการแสดงผลล้วน ๆ ผลรวมรายแถว รายคอลัมน์ และยอดรวมใหญ่
 * ต้องเท่ากับตอนไม่ยุบเสมอ ไม่งั้นผู้บริหารอ่านตัวเลขผิด
 */

type Row = { a: string; b: string; n: number };

const dimA: PivotDim<Row> = { key: "a", label: "A", of: (r) => ({ key: r.a }) };
const dimB: PivotDim<Row> = { key: "b", label: "B", of: (r) => ({ key: r.b }) };
const count: PivotMetric<Row> = { key: "n", label: "n", of: (r) => r.n, fmt: String };

const wide = { maxRows: 100, maxCols: 100 };

/** ผลรวมของช่องที่แสดงจริงในแถวนั้น */
const rowSum = (t: ReturnType<typeof buildPivotTable>, r: string) =>
  t.colKeys.reduce((s, c) => s + (t.cell.get(cellAt(r, c)) ?? 0), 0);

/** ผลรวมของช่องที่แสดงจริงในคอลัมน์นั้น */
const colSum = (t: ReturnType<typeof buildPivotTable>, c: string) =>
  t.rowKeys.reduce((s, r) => s + (t.cell.get(cellAt(r, c)) ?? 0), 0);

describe("buildPivotTable", () => {
  it("รวมแถวที่แกนตรงกันเข้าช่องเดียว", () => {
    const rows: Row[] = [
      { a: "x", b: "p", n: 2 },
      { a: "x", b: "p", n: 3 },
      { a: "x", b: "q", n: 4 },
      { a: "y", b: "p", n: 1 },
    ];
    const t = buildPivotTable(rows, dimA, dimB, count, wide);

    expect(t.cell.get(cellAt("x", "p"))).toBe(5);
    expect(t.cell.get(cellAt("x", "q"))).toBe(4);
    expect(t.cell.get(cellAt("y", "p"))).toBe(1);
    expect(t.rowTotal.get("x")).toBe(9);
    expect(t.colTotal.get("p")).toBe(6);
    expect(t.grand).toBe(10);
  });

  it("เรียงแถวและคอลัมน์จากยอดมากไปน้อย", () => {
    const rows: Row[] = [
      { a: "เล็ก", b: "p", n: 1 },
      { a: "ใหญ่", b: "q", n: 9 },
      { a: "กลาง", b: "q", n: 5 },
    ];
    const t = buildPivotTable(rows, dimA, dimB, count, wide);
    expect(t.rowKeys).toEqual(["ใหญ่", "กลาง", "เล็ก"]);
    expect(t.colKeys).toEqual(["q", "p"]);
  });

  it("ไม่ยุบอะไรเลยถ้าจำนวนแกนไม่เกินเพดาน", () => {
    const rows: Row[] = [
      { a: "x", b: "p", n: 1 },
      { a: "y", b: "q", n: 1 },
    ];
    const t = buildPivotTable(rows, dimA, dimB, count, { maxRows: 2, maxCols: 2 });
    expect(t.rowKeys).not.toContain(PIVOT_OTHER);
    expect(t.colKeys).not.toContain(PIVOT_OTHER);
  });

  it("ยุบคอลัมน์ที่เกินเป็น อื่นๆ โดยยอดรวมรายแถวยังเท่าเดิม", () => {
    const rows: Row[] = [
      { a: "x", b: "c1", n: 10 },
      { a: "x", b: "c2", n: 6 },
      { a: "x", b: "c3", n: 3 },
      { a: "x", b: "c4", n: 1 },
    ];
    const t = buildPivotTable(rows, dimA, dimB, count, { maxRows: 10, maxCols: 2 });

    expect(t.colKeys).toEqual(["c1", "c2", PIVOT_OTHER]);
    // c3 + c4 ถูกยุบมารวมกัน
    expect(t.cell.get(cellAt("x", PIVOT_OTHER))).toBe(4);
    expect(t.colTotal.get(PIVOT_OTHER)).toBe(4);
    // ยอดรวมของแถวยังเท่ากับผลบวกของช่องที่แสดงอยู่
    expect(rowSum(t, "x")).toBe(t.rowTotal.get("x"));
    expect(t.rowTotal.get("x")).toBe(20);
    expect(t.grand).toBe(20);
  });

  it("ยุบแถวที่เกินเป็น อื่นๆ โดยยอดรวมรายคอลัมน์ยังเท่าเดิม", () => {
    const rows: Row[] = [
      { a: "r1", b: "p", n: 10 },
      { a: "r2", b: "p", n: 6 },
      { a: "r3", b: "p", n: 3 },
      { a: "r4", b: "p", n: 1 },
    ];
    const t = buildPivotTable(rows, dimA, dimB, count, { maxRows: 2, maxCols: 10 });

    expect(t.rowKeys).toEqual(["r1", "r2", PIVOT_OTHER]);
    expect(t.cell.get(cellAt(PIVOT_OTHER, "p"))).toBe(4);
    expect(colSum(t, "p")).toBe(t.colTotal.get("p"));
    expect(t.grand).toBe(20);
  });

  it("ยุบพร้อมกันทั้งแถวและคอลัมน์แล้วช่องมุมต้องได้ยอดของส่วนที่ยุบไขว้กัน", () => {
    // r3,r4 × c3,c4 คือส่วนที่ถูกยุบทั้งสองแกน ต้องไปโผล่ที่ช่องมุม (อื่นๆ × อื่นๆ)
    const rows: Row[] = [
      { a: "r1", b: "c1", n: 100 },
      { a: "r2", b: "c2", n: 50 },
      { a: "r1", b: "c3", n: 7 },
      { a: "r3", b: "c1", n: 6 },
      { a: "r3", b: "c3", n: 2 },
      { a: "r4", b: "c4", n: 3 },
    ];
    const t = buildPivotTable(rows, dimA, dimB, count, { maxRows: 2, maxCols: 2 });

    expect(t.rowKeys).toEqual(["r1", "r2", PIVOT_OTHER]);
    expect(t.colKeys).toEqual(["c1", "c2", PIVOT_OTHER]);

    // ช่องมุม = r3×c3 (2) + r4×c4 (3)
    expect(t.cell.get(cellAt(PIVOT_OTHER, PIVOT_OTHER))).toBe(5);
    // แถวที่ยุบ × คอลัมน์ที่เหลืออยู่ = r3×c1
    expect(t.cell.get(cellAt(PIVOT_OTHER, "c1"))).toBe(6);
    // แถวที่เหลืออยู่ × คอลัมน์ที่ยุบ = r1×c3
    expect(t.cell.get(cellAt("r1", PIVOT_OTHER))).toBe(7);

    // ทุกแถว/ทุกคอลัมน์ที่แสดง ผลบวกต้องตรงกับยอดรวมที่เก็บไว้
    for (const r of t.rowKeys) expect(rowSum(t, r)).toBe(t.rowTotal.get(r));
    for (const c of t.colKeys) expect(colSum(t, c)).toBe(t.colTotal.get(c));

    // และยอดรวมใหญ่ต้องเท่ากับผลบวกของทุกช่องที่แสดง
    const shown = t.rowKeys.reduce((s, r) => s + rowSum(t, r), 0);
    expect(shown).toBe(t.grand);
    expect(t.grand).toBe(168);
  });

  it("ยอดรวมไม่เปลี่ยนไม่ว่าจะตั้งเพดานเท่าไหร่", () => {
    const rows: Row[] = Array.from({ length: 60 }, (_, i) => ({
      a: `r${i % 9}`,
      b: `c${i % 7}`,
      n: i + 1,
    }));

    const full = buildPivotTable(rows, dimA, dimB, count, wide);
    const folded = buildPivotTable(rows, dimA, dimB, count, { maxRows: 3, maxCols: 2 });

    expect(folded.grand).toBe(full.grand);
    const shown = folded.rowKeys.reduce((s, r) => s + rowSum(folded, r), 0);
    expect(shown).toBe(full.grand);
  });

  it("ใช้ label ที่ส่งมาแทนคีย์ และคืนตารางว่างเมื่อไม่มีข้อมูล", () => {
    const labelled: PivotDim<Row> = {
      key: "a",
      label: "A",
      of: (r) => ({ key: r.a, label: `สาขา ${r.a}` }),
    };
    const t = buildPivotTable([{ a: "x", b: "p", n: 1 }], labelled, dimB, count, wide);
    expect(t.rowLabel.get("x")).toBe("สาขา x");
    expect(t.colLabel.get("p")).toBe("p");

    const empty = buildPivotTable([], dimA, dimB, count, wide);
    expect(empty.rowKeys).toEqual([]);
    expect(empty.grand).toBe(0);
    expect(empty.max).toBe(1);
  });
});
