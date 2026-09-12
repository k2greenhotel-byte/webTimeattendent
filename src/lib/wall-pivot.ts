/**
 * การคำนวณตารางไขว้ของจอ War Room — แยกออกจากตัวหน้าจอเพื่อให้ทดสอบตัวเลขได้
 *
 * กติกาสำคัญ: ไม่ว่าจะยุบแถว/คอลัมน์ส่วนที่เกินเป็น "อื่นๆ" หรือไม่
 * ผลรวมแต่ละแถว แต่ละคอลัมน์ และยอดรวมใหญ่ ต้องเท่าเดิมเสมอ
 * (จอนี้ผู้บริหารใช้ตัดสินใจ ตัวเลขเพี้ยนเพราะการแสดงผลไม่ได้)
 */

/** หนึ่งแกนที่เลือกได้ — of() บอกว่าแถวนี้ตกอยู่กลุ่มไหน */
export type PivotDim<T> = {
  key: string;
  label: string;
  of: (row: T) => { key: string; label?: string | null };
};

/** หน่วยที่นับในช่อง — of() คืนค่าของแถวนั้น (นับจำนวนก็คืน 1) */
export type PivotMetric<T> = {
  key: string;
  label: string;
  of: (row: T) => number;
  fmt: (value: number) => string;
};

/** คีย์ของกลุ่ม "อื่นๆ" ที่ยุบส่วนที่เกินมารวมกัน */
export const PIVOT_OTHER = "__other__";

export type PivotTable = {
  rowKeys: string[];
  colKeys: string[];
  rowLabel: Map<string, string>;
  colLabel: Map<string, string>;
  /** ค่าในช่อง — คีย์คือ `${rowKey} ${colKey}` */
  cell: Map<string, number>;
  rowTotal: Map<string, number>;
  colTotal: Map<string, number>;
  grand: number;
  /** ค่าสูงสุดในช่องที่แสดงจริง — ใช้ไล่เฉดสีความเข้ม */
  max: number;
};

export const cellAt = (rowKey: string, colKey: string) => `${rowKey} ${colKey}`;

export function buildPivotTable<T>(
  rows: T[],
  rowDim: PivotDim<T>,
  colDim: PivotDim<T>,
  metric: PivotMetric<T>,
  limits: { maxRows: number; maxCols: number },
): PivotTable {
  const cell = new Map<string, number>();
  const rowTotal = new Map<string, number>();
  const colTotal = new Map<string, number>();
  const rowLabel = new Map<string, string>();
  const colLabel = new Map<string, string>();
  let grand = 0;

  for (const row of rows) {
    const r = rowDim.of(row);
    const c = colDim.of(row);
    const v = metric.of(row);
    rowLabel.set(r.key, r.label ?? r.key);
    colLabel.set(c.key, c.label ?? c.key);
    const at = cellAt(r.key, c.key);
    cell.set(at, (cell.get(at) ?? 0) + v);
    rowTotal.set(r.key, (rowTotal.get(r.key) ?? 0) + v);
    colTotal.set(c.key, (colTotal.get(c.key) ?? 0) + v);
    grand += v;
  }

  const byTotal = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const rowKeysAll = byTotal(rowTotal);
  const colKeysAll = byTotal(colTotal);

  /** ยุบส่วนที่เกินเป็นกลุ่มเดียว แล้วยกยอดรวมของกลุ่มนั้นมาไว้ที่ "อื่นๆ" */
  const fold = (
    keys: string[],
    limit: number,
    total: Map<string, number>,
    label: Map<string, string>,
  ) => {
    if (keys.length <= limit) return keys;
    const rest = keys.slice(limit);
    total.set(PIVOT_OTHER, rest.reduce((acc, k) => acc + (total.get(k) ?? 0), 0));
    label.set(PIVOT_OTHER, `อื่นๆ (${rest.length})`);
    return [...keys.slice(0, limit), PIVOT_OTHER];
  };

  const rowKeys = fold(rowKeysAll, limits.maxRows, rowTotal, rowLabel);
  const colKeys = fold(colKeysAll, limits.maxCols, colTotal, colLabel);

  const foldedRows = rowKeysAll.slice(limits.maxRows);
  const foldedCols = colKeysAll.slice(limits.maxCols);
  const add = (r: string, c: string, v: number) =>
    cell.set(cellAt(r, c), (cell.get(cellAt(r, c)) ?? 0) + v);

  // ต้องเติมคอลัมน์ "อื่นๆ" ก่อน เพราะช่องมุม (อื่นๆ × อื่นๆ) อ่านค่าต่อจากตรงนี้
  if (foldedCols.length > 0) {
    for (const r of rowKeysAll) {
      for (const c of foldedCols) add(r, PIVOT_OTHER, cell.get(cellAt(r, c)) ?? 0);
    }
  }
  if (foldedRows.length > 0) {
    const cols = [
      ...colKeysAll.slice(0, limits.maxCols),
      ...(foldedCols.length > 0 ? [PIVOT_OTHER] : []),
    ];
    for (const c of cols) {
      for (const r of foldedRows) add(PIVOT_OTHER, c, cell.get(cellAt(r, c)) ?? 0);
    }
  }

  const shown = rowKeys.flatMap((r) => colKeys.map((c) => cell.get(cellAt(r, c)) ?? 0));

  return {
    rowKeys,
    colKeys,
    rowLabel,
    colLabel,
    cell,
    rowTotal,
    colTotal,
    grand,
    max: Math.max(1, ...shown),
  };
}
