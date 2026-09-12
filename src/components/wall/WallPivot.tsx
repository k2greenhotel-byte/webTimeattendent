"use client";

import { useMemo, useState } from "react";
import { buildPivotTable, cellAt, type PivotDim, type PivotMetric } from "@/lib/wall-pivot";

/**
 * ตารางไขว้สองมิติของจอ War Room — ใช้ร่วมกันทุกโปรแกรม
 *
 * คิดจากข้อมูลที่ API ส่งมาแล้วทั้งหมดในฝั่งหน้าเว็บ เปลี่ยนแกนแล้วเห็นผลทันที
 * ไม่ต้องยิง API ใหม่ (แพตเทิร์นเดียวกับตารางไขว้ของจอลูกหนี้เช่าซื้อ)
 *
 * แต่ละจอแค่บอกว่า "มีแกนอะไรให้เลือกบ้าง" (dims) และ "นับเป็นอะไร" (metrics)
 * ตัวตารางไม่รู้จักข้อมูลของโปรแกรมไหนเลย จึงเอาไปใช้ซ้ำได้หมด
 *
 * ตัวเลขคิดที่ src/lib/wall-pivot.ts ที่เดียว (มี unit test คุมว่ายอดรวมไม่เพี้ยน
 * ตอนยุบส่วนที่เกินเป็น "อื่นๆ") ไฟล์นี้รับผิดชอบแค่การแสดงผล
 */

export type { PivotDim, PivotMetric };

const SELECT =
  "rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100";

export default function WallPivot<T>({
  rows,
  dims,
  metrics,
  initialRow,
  initialCol,
  title = "ตารางไขว้",
  note,
  maxCols = 12,
  maxRows = 25,
  truncated,
}: {
  rows: T[];
  dims: PivotDim<T>[];
  metrics: PivotMetric<T>[];
  initialRow?: string;
  initialCol?: string;
  title?: string;
  /** ข้อความอธิบายท้ายหัวข้อ เช่น บอกว่าตารางนี้นับจากช่วงไหน */
  note?: string;
  maxCols?: number;
  maxRows?: number;
  /** true = ข้อมูลถูกตัดจำนวนมาจาก server ตัวเลขจึงยังไม่ครบ */
  truncated?: boolean;
}) {
  const [rowDim, setRowDim] = useState(initialRow ?? dims[0]?.key ?? "");
  const [colDim, setColDim] = useState(initialCol ?? dims[1]?.key ?? dims[0]?.key ?? "");
  const [metricKey, setMetricKey] = useState(metrics[0]?.key ?? "");

  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];
  const rDim = dims.find((d) => d.key === rowDim) ?? dims[0];
  const cDim = dims.find((d) => d.key === colDim) ?? dims[1] ?? dims[0];

  const table = useMemo(
    () =>
      rDim && cDim && metric
        ? buildPivotTable(rows, rDim, cDim, metric, { maxRows, maxCols })
        : null,
    [rows, rDim, cDim, metric, maxCols, maxRows],
  );

  if (!rDim || !cDim || !metric || !table) return null;

  const fmt = metric.fmt;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold text-slate-200">
          {title}
          {note && <span className="ml-2 text-xs font-normal text-slate-500">{note}</span>}
        </h2>

        <span className="text-xs text-slate-500">แถว</span>
        <select value={rDim.key} onChange={(e) => setRowDim(e.target.value)} className={SELECT}>
          {dims.map((d) => (
            <option key={d.key} value={d.key} disabled={d.key === cDim.key}>
              {d.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            setRowDim(cDim.key);
            setColDim(rDim.key);
          }}
          className="rounded-md border border-slate-700 px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
          title="สลับแถวกับคอลัมน์"
        >
          ⇄
        </button>

        <span className="text-xs text-slate-500">คอลัมน์</span>
        <select value={cDim.key} onChange={(e) => setColDim(e.target.value)} className={SELECT}>
          {dims.map((d) => (
            <option key={d.key} value={d.key} disabled={d.key === rDim.key}>
              {d.label}
            </option>
          ))}
        </select>

        {metrics.length > 1 && (
          <div className="flex rounded-lg bg-slate-800 p-1">
            {metrics.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetricKey(m.key)}
                className={`rounded-md px-2.5 py-1 text-sm ${
                  m.key === metric.key
                    ? "bg-emerald-500 font-medium text-white"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {truncated && (
        <p className="mb-2 rounded-lg border border-amber-800 bg-amber-950 px-3 py-1.5 text-xs text-amber-200">
          ข้อมูลมากเกินกว่าที่ดึงมาแสดงได้ทั้งหมด ตัวเลขในตารางนี้จึงยังไม่ครบทุกรายการ
        </p>
      )}

      {table.rowKeys.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">ไม่มีข้อมูลในช่วงที่เลือก</p>
      ) : (
        <div className="max-h-[24rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-900 text-xs text-slate-400">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-900 px-2 py-1 text-left whitespace-nowrap">
                  {rDim.label} \ {cDim.label}
                </th>
                {table.colKeys.map((k) => (
                  <th key={k} className="px-2 py-1 text-right whitespace-nowrap">
                    {table.colLabel.get(k)}
                  </th>
                ))}
                <th className="px-2 py-1 text-right font-semibold text-slate-200">รวม</th>
              </tr>
            </thead>
            <tbody>
              {table.rowKeys.map((r) => (
                <tr key={r} className="border-t border-slate-800">
                  <td className="sticky left-0 z-10 bg-slate-900 px-2 py-1 whitespace-nowrap text-slate-100">
                    {table.rowLabel.get(r)}
                  </td>
                  {table.colKeys.map((k) => {
                    const v = table.cell.get(cellAt(r, k)) ?? 0;
                    return (
                      <td
                        key={k}
                        className="px-2 py-1 text-right tabular-nums"
                        style={
                          v > 0
                            ? {
                                background: `rgba(56,189,248,${0.08 + (v / table.max) * 0.35})`,
                                color: "#e2e8f0",
                              }
                            : { color: "#475569" }
                        }
                      >
                        {v > 0 ? fmt(v) : "—"}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-right font-semibold tabular-nums text-slate-100">
                    {fmt(table.rowTotal.get(r) ?? 0)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-700">
                <td className="sticky left-0 z-10 bg-slate-900 px-2 py-1 font-semibold text-slate-200">
                  รวม
                </td>
                {table.colKeys.map((k) => (
                  <td
                    key={k}
                    className="px-2 py-1 text-right font-semibold tabular-nums text-slate-200"
                  >
                    {fmt(table.colTotal.get(k) ?? 0)}
                  </td>
                ))}
                <td className="px-2 py-1 text-right font-bold tabular-nums text-sky-400">
                  {fmt(table.grand)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
