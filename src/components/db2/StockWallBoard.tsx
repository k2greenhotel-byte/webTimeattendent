"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * จอ War Room สต็อกรถคงเหลือ — เปิดค้างบนจอมอนิเตอร์/ทีวี พื้นมืด ตัวเลขใหญ่ รีเฟรชเองทุก 60 วินาที
 *
 * - กรอง: สาขาที่เก็บ · สภาพรถ (ใหม่/เก่า) · หน่วยที่ดู: จำนวนคัน / มูลค่าต้นทุนก่อน VAT
 * - KPI: คงเหลือ มูลค่าต้นทุน อายุเฉลี่ย รับเข้าเก่าสุด ค้างเกิน 1 ปี
 * - อายุสต็อก 5 ช่วง · กระดานอันดับ 2 ช่องเลือกมิติได้ (ประเภท ยี่ห้อ รุ่น แบบ สี สาขา สภาพ)
 * - ตารางไขว้ (cross tab) เลือกแกนตั้ง/แกนนอนได้เอง
 *
 * ข้อมูลมาจากแอป Db2: /api/db2/stock (สรุป+อายุ) และ /api/db2/stock/pivot (มิติ+ตารางไขว้)
 */

type Dim = "group" | "brand" | "model" | "variant" | "color" | "branch" | "condition";
type Metric = "units" | "cost";
const DIMS: { key: Dim; label: string }[] = [
  { key: "group", label: "ประเภทรถ" },
  { key: "brand", label: "ยี่ห้อ" },
  { key: "model", label: "รุ่น" },
  { key: "variant", label: "แบบ" },
  { key: "color", label: "สี" },
  { key: "branch", label: "สาขาที่เก็บ" },
  { key: "condition", label: "สภาพรถ" },
];
const COND_LABEL: Record<string, string> = { N: "รถใหม่", O: "รถเก่า" };
const REFRESH_MS = 60_000;

type DimValue = { key: string; label: string; units: number; cost: number };
type Cell = { r: string; rLabel: string; c: string; cLabel: string; units: number; cost: number };
type Pivot = {
  row: Dim;
  col: Dim;
  cells: Cell[];
  total: { units: number; cost: number };
  dims: Record<Dim, { title: string; values: DimValue[] }>;
};
type Stock = {
  summary: { units: number; cost: number; avgAgeDays: number | null; oldest: string | null };
  aging: { bucket: number; label: string; units: number; cost: number }[];
  branches: string[];
};

const int = (n: number) => Math.round(n).toLocaleString("th-TH");
const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const compact = (n: number) =>
  Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ล้าน` : baht(n);
const metricOf = (a: { units: number; cost: number }, m: Metric) => (m === "units" ? a.units : a.cost);
const fmt = (v: number, m: Metric) => (m === "units" ? int(v) : compact(v));
const thDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d} ${TH[m - 1]} ${y + 543}`;
};
const labelOf = (dim: Dim, key: string, label: string) =>
  dim === "condition" ? (COND_LABEL[key] ?? key) : label || key;

export default function StockWallBoard() {
  const [locat, setLocat] = useState("");
  const [stat, setStat] = useState("");
  const [metric, setMetric] = useState<Metric>("units");
  const [panels, setPanels] = useState<Dim[]>(["brand", "model"]);
  const [row, setRow] = useState<Dim>("model");
  const [col, setCol] = useState<Dim>("branch");
  const [stock, setStock] = useState<Stock | null>(null);
  const [pivot, setPivot] = useState<Pivot | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const sq = new URLSearchParams();
      if (locat) sq.set("locat", locat);
      if (stat) sq.set("stat", stat);
      const pq = new URLSearchParams({ row, col });
      if (locat) pq.append("branch", locat);
      if (stat) pq.append("condition", stat);
      const [sRes, pRes] = await Promise.all([
        fetch(`/api/db2/stock?${sq}`, { cache: "no-store" }),
        fetch(`/api/db2/stock/pivot?${pq}`, { cache: "no-store" }),
      ]);
      const sBody = await sRes.json();
      const pBody = await pRes.json();
      if (!sRes.ok || sBody.ok === false) throw new Error(sBody.error ?? `HTTP ${sRes.status}`);
      if (!pRes.ok || pBody.ok === false) throw new Error(pBody.error ?? `HTTP ${pRes.status}`);
      setStock(sBody);
      setPivot(pBody);
      setGeneratedAt(new Date().toISOString());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [locat, stat, row, col]);

  useEffect(() => {
    load();
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(load, REFRESH_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [load]);

  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  // ประกอบตารางไขว้: แถว/คอลัมน์เรียงตามหน่วยที่เลือก
  const table = useMemo(() => {
    if (!pivot) return null;
    const rows = new Map<string, { label: string; units: number; cost: number }>();
    const cols = new Map<string, { label: string; units: number; cost: number }>();
    const cell = new Map<string, Cell>();
    for (const c of pivot.cells) {
      const r = rows.get(c.r) ?? { label: c.rLabel, units: 0, cost: 0 };
      r.units += c.units;
      r.cost += c.cost;
      rows.set(c.r, r);
      const k = cols.get(c.c) ?? { label: c.cLabel, units: 0, cost: 0 };
      k.units += c.units;
      k.cost += c.cost;
      cols.set(c.c, k);
      cell.set(`${c.r} ${c.c}`, c);
    }
    const sortBy = <T extends { units: number; cost: number }>(m: Map<string, T>) =>
      [...m.entries()].sort((a, b) => metricOf(b[1], metric) - metricOf(a[1], metric));
    return { rows: sortBy(rows), cols: sortBy(cols), cell };
  }, [pivot, metric]);

  const over1y = stock?.aging.find((a) => a.bucket === 5);

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 lg:p-6">
      {/* แถบควบคุม */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-2xl font-bold tracking-tight">สต็อกรถคงเหลือ</h1>
        <select value={locat} onChange={(e) => setLocat(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-100">
          <option value="">ทุกสาขา</option>
          {(stock?.branches ?? []).map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg bg-slate-800 p-1">
          {(
            [
              ["", "ทั้งหมด"],
              ["N", "รถใหม่"],
              ["O", "รถเก่า"],
            ] as [string, string][]
          ).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setStat(k)}
              className={`rounded-md px-3 py-1 text-sm ${stat === k ? "bg-sky-500 text-white" : "text-slate-300 hover:text-white"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg bg-slate-800 p-1">
          {(
            [
              ["units", "จำนวนคัน"],
              ["cost", "มูลค่าต้นทุน"],
            ] as [Metric, string][]
          ).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={`rounded-md px-3 py-1 text-sm ${metric === k ? "bg-emerald-500 text-white" : "text-slate-300 hover:text-white"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
          {generatedAt && (
            <span>อัปเดต {new Date(generatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span>
          )}
          <span className="font-mono text-lg text-slate-200 tabular-nums">{now ? now.toLocaleTimeString("th-TH") : ""}</span>
          <button onClick={fullscreen} className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">
            เต็มจอ
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl border border-rose-800 bg-rose-950 px-4 py-3 text-rose-200">{error}</p>}
      {!stock && !error && <p className="text-slate-400">กำลังโหลด…</p>}

      {stock && (
        <>
          {/* KPI */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Big label="คงเหลือ (คัน)" value={int(stock.summary.units)} accent />
            <Big label="มูลค่าต้นทุนก่อน VAT" value={compact(stock.summary.cost)} sub={`${baht(stock.summary.cost)} บาท`} />
            <Big label="อายุสต็อกเฉลี่ย" value={stock.summary.avgAgeDays === null ? "—" : `${int(stock.summary.avgAgeDays)} วัน`} />
            <Big label="รับเข้าเก่าสุด" value={thDate(stock.summary.oldest)} />
            <Big
              label="ค้างเกิน 1 ปี"
              value={`${int(over1y?.units ?? 0)} คัน`}
              sub={`ต้นทุน ${compact(over1y?.cost ?? 0)}`}
              warn={(over1y?.units ?? 0) > 0}
            />
          </div>

          {/* อายุสต็อก + กระดานอันดับ */}
          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-3 font-semibold text-slate-200">ตามอายุสต็อก ({metric === "units" ? "จำนวนคัน" : "มูลค่าต้นทุน"})</h2>
              <AgingBars rows={stock.aging} metric={metric} />
            </div>
            {panels.map((dim, i) => (
              <RankPanel
                key={i}
                dim={dim}
                metric={metric}
                values={pivot?.dims[dim]?.values ?? []}
                onChangeDim={(d) => setPanels((p) => p.map((x, j) => (j === i ? d : x)))}
              />
            ))}
          </div>

          {/* ตารางไขว้ */}
          {pivot && table && (
            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="mr-2 font-semibold text-slate-200">
                  ตารางไขว้ · {metric === "units" ? "จำนวนคัน" : "มูลค่าต้นทุน"}
                </h2>
                <label className="text-sm text-slate-300">
                  แถว{" "}
                  <select value={row} onChange={(e) => setRow(e.target.value as Dim)} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100">
                    {DIMS.map((d) => (
                      <option key={d.key} value={d.key} disabled={d.key === col}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setRow(col);
                    setCol(row);
                  }}
                  className="rounded-md border border-slate-700 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                  title="สลับแกน"
                >
                  ⇄
                </button>
                <label className="text-sm text-slate-300">
                  คอลัมน์{" "}
                  <select value={col} onChange={(e) => setCol(e.target.value as Dim)} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100">
                    {DIMS.map((d) => (
                      <option key={d.key} value={d.key} disabled={d.key === row}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="ml-auto text-sm text-slate-400">
                  รวม <b className="text-slate-100">{fmt(metricOf(pivot.total, metric), metric)}</b>
                  {metric === "cost" && " บาท"} · {table.rows.length} × {table.cols.length}
                </span>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-20 border-b border-r border-slate-700 bg-slate-800 px-2 py-1 text-left text-slate-200 whitespace-nowrap">
                        {DIMS.find((d) => d.key === row)?.label} \ {DIMS.find((d) => d.key === col)?.label}
                      </th>
                      {table.cols.map(([ck, cv]) => (
                        <th key={ck} className="sticky top-0 z-10 border-b border-slate-700 bg-slate-800 px-2 py-1 text-right text-slate-200 whitespace-nowrap">
                          {labelOf(col, ck, cv.label)}
                        </th>
                      ))}
                      <th className="sticky top-0 z-10 border-b border-l border-slate-700 bg-slate-700 px-2 py-1 text-right font-semibold text-white">
                        รวม
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map(([rk, rv]) => (
                      <tr key={rk} className="hover:bg-slate-800/60">
                        <td className="sticky left-0 z-10 border-b border-r border-slate-800 bg-slate-900 px-2 py-1 text-slate-100 whitespace-nowrap">
                          {labelOf(row, rk, rv.label)}
                        </td>
                        {table.cols.map(([ck]) => {
                          const c = table.cell.get(`${rk} ${ck}`);
                          const v = c ? metricOf(c, metric) : 0;
                          return (
                            <td key={ck} className="border-b border-slate-800 px-2 py-1 text-right tabular-nums text-slate-200">
                              {v === 0 ? <span className="text-slate-600">·</span> : fmt(v, metric)}
                            </td>
                          );
                        })}
                        <td className="border-b border-l border-slate-800 bg-slate-800/60 px-2 py-1 text-right font-semibold tabular-nums text-slate-100">
                          {fmt(metricOf(rv, metric), metric)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="sticky left-0 z-10 border-t border-r border-slate-700 bg-slate-700 px-2 py-1 font-semibold text-white">รวม</td>
                      {table.cols.map(([ck, cv]) => (
                        <td key={ck} className="border-t border-slate-700 bg-slate-700 px-2 py-1 text-right font-semibold tabular-nums text-slate-100">
                          {fmt(metricOf(cv, metric), metric)}
                        </td>
                      ))}
                      <td className="border-l border-t border-slate-600 bg-slate-600 px-2 py-1 text-right font-bold tabular-nums text-white">
                        {fmt(metricOf(pivot.total, metric), metric)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Big({ label, value, sub, accent, warn }: { label: string; value: string; sub?: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${warn ? "text-rose-400" : accent ? "text-sky-400" : "text-slate-100"}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function RankPanel({
  dim,
  metric,
  values,
  onChangeDim,
}: {
  dim: Dim;
  metric: Metric;
  values: DimValue[];
  onChangeDim: (d: Dim) => void;
}) {
  const rows = [...values].sort((a, b) => metricOf(b, metric) - metricOf(a, metric)).slice(0, 12);
  const max = Math.max(1, ...rows.map((r) => metricOf(r, metric)));
  const total = values.reduce((s, r) => s + metricOf(r, metric), 0);
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <select value={dim} onChange={(e) => onChangeDim(e.target.value as Dim)} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 font-semibold text-slate-100">
          {DIMS.map((d) => (
            <option key={d.key} value={d.key}>
              ตาม{d.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          {values.length} รายการ · รวม {fmt(total, metric)}
        </span>
      </div>
      {rows.length === 0 && <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>}
      <ol className="space-y-2">
        {rows.map((r, i) => {
          const v = metricOf(r, metric);
          return (
            <li key={r.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="truncate pr-2">
                  <span className="mr-2 inline-block w-5 text-right text-slate-500">{i + 1}</span>
                  <span className="text-slate-100">{labelOf(dim, r.key, r.label)}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="text-lg font-semibold text-slate-100">{fmt(v, metric)}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {metric === "units" ? compact(r.cost) : `${int(r.units)} คัน`} · {total > 0 ? ((v / total) * 100).toFixed(0) : 0}%
                  </span>
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-sky-500" style={{ width: `${(Math.max(v, 0) / max) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AgingBars({ rows, metric }: { rows: { label: string; units: number; cost: number }[]; metric: Metric }) {
  const max = Math.max(1, ...rows.map((r) => metricOf(r, metric)));
  const total = rows.reduce((s, r) => s + metricOf(r, metric), 0);
  const colors = ["#34d399", "#38bdf8", "#fbbf24", "#fb923c", "#f43f5e"];
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => {
        const v = metricOf(r, metric);
        return (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-200">{r.label}</span>
              <span className="tabular-nums">
                <span className="font-semibold text-slate-100">{fmt(v, metric)}</span>
                <span className="ml-2 text-xs text-slate-400">{total > 0 ? ((v / total) * 100).toFixed(0) : 0}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-800">
              <div className="h-2 rounded-full" style={{ width: `${(Math.max(v, 0) / max) * 100}%`, background: colors[i % colors.length] }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
