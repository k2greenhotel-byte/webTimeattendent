"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * จอ War Room ยอดขาย — เปิดค้างบนจอมอนิเตอร์/ทีวี พื้นมืด ตัวเลขใหญ่ รีเฟรชเองทุก 60 วินาที
 *
 * - ช่วงเวลา: วันนี้ · เดือนนี้ · เลือกเดือน (ย้อนหลังได้) · ปีนี้ · กำหนดช่วงเอง
 * - เทียบกับช่วงก่อนหน้า (เดือนก่อน) และช่วงเดียวกันปีก่อน
 * - กระดานอันดับ 3 ช่อง เลือกมิติได้เอง (สาขา พนักงานขาย รุ่น ยี่ห้อ ช่องทาง สภาพ สี ประเภท ไฟแนนซ์)
 * - หน่วยที่จัดอันดับ: จำนวนคัน / ยอดขายก่อน VAT / กำไรขั้นต้น
 * - สัดส่วนช่องทางการขาย + รถใหม่/เก่า · ยอดรายวันในช่วง · แนวโน้มรายเดือน 13 เดือน
 */

type Money = { sale: number; vat: number; gross: number; cost: number; profit: number };
type Agg = Money & { units: number };
type Item = Agg & { key: string; label: string | null };
type Dim = "branch" | "salesman" | "model" | "brand" | "channel" | "condition" | "color" | "group" | "finance";
type Wall = {
  generatedAt: string;
  today: string;
  range: { from: string; to: string; days: number };
  locat: string | null;
  truncated: boolean;
  kpi: Agg;
  today_kpi: Agg;
  compare: {
    prev: { range: { from: string; to: string }; kpi: Agg; label: string };
    lastYear: { range: { from: string; to: string }; kpi: Agg; label: string };
  };
  dims: Record<Dim, { title: string; items: Item[] }>;
  daily: (Agg & { date: string })[];
  monthly: (Agg & { year: number; month: number })[];
  branches: string[];
};
type Metric = "units" | "sale" | "profit";
type Preset = "today" | "mtd" | "month" | "ytd" | "custom";

const DIM_LIST: { key: Dim; label: string }[] = [
  { key: "branch", label: "สาขา" },
  { key: "salesman", label: "พนักงานขาย" },
  { key: "model", label: "รุ่นรถ" },
  { key: "brand", label: "ยี่ห้อ" },
  { key: "channel", label: "ช่องทางการขาย" },
  { key: "condition", label: "สภาพรถ" },
  { key: "color", label: "สี" },
  { key: "group", label: "ประเภทรถ" },
  { key: "finance", label: "บริษัทไฟแนนซ์" },
];
const METRICS: { key: Metric; label: string }[] = [
  { key: "units", label: "จำนวนคัน" },
  { key: "sale", label: "ยอดขายก่อน VAT" },
  { key: "profit", label: "กำไรขั้นต้น" },
];
const REFRESH_MS = 60_000;
const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MF = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const int = (n: number) => Math.round(n).toLocaleString("th-TH");
const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const compact = (n: number) =>
  Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ล้าน` : baht(n);
const thDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_M[m - 1]} ${y + 543}`;
};
const todayTH = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const endOfMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const metricValue = (a: Agg, m: Metric) => (m === "units" ? a.units : m === "sale" ? a.sale : a.profit);
const fmtMetric = (v: number, m: Metric) => (m === "units" ? int(v) : compact(v));

export default function WallBoard() {
  const today = todayTH();
  const [preset, setPreset] = useState<Preset>("mtd");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [custom, setCustom] = useState({ from: `${today.slice(0, 4)}-01-01`, to: today });
  const [locat, setLocat] = useState("");
  const [metric, setMetric] = useState<Metric>("units");
  const [panels, setPanels] = useState<Dim[]>(["branch", "salesman", "model"]);
  const [data, setData] = useState<Wall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);

  const range = useMemo(() => {
    if (preset === "today") return { from: today, to: today };
    if (preset === "mtd") return { from: `${today.slice(0, 7)}-01`, to: today };
    if (preset === "month") return { from: `${month}-01`, to: month === today.slice(0, 7) ? today : endOfMonth(month) };
    if (preset === "ytd") return { from: `${today.slice(0, 4)}-01-01`, to: today };
    return custom;
  }, [preset, month, custom, today]);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams(range);
      if (locat) qs.set("locat", locat);
      const res = await fetch(`/api/db2/wall?${qs}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [range, locat]);

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

  const title = useMemo(() => {
    if (preset === "today") return `วันนี้ ${thDate(today)}`;
    if (preset === "mtd") return `${TH_MF[Number(today.slice(5, 7)) - 1]} ${Number(today.slice(0, 4)) + 543} (ถึงวันนี้)`;
    if (preset === "month") return `${TH_MF[Number(month.slice(5, 7)) - 1]} ${Number(month.slice(0, 4)) + 543}`;
    if (preset === "ytd") return `ปี ${Number(today.slice(0, 4)) + 543} (ถึงวันนี้)`;
    return `${thDate(custom.from)} – ${thDate(custom.to)}`;
  }, [preset, month, custom, today]);

  const pctChange = (cur: number, base: number) => (base > 0 ? ((cur - base) / base) * 100 : null);

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 lg:p-6">
      {/* แถบควบคุม */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-2xl font-bold tracking-tight">ยอดขายสด</h1>
        <div className="flex rounded-lg bg-slate-800 p-1">
          {(
            [
              ["today", "วันนี้"],
              ["mtd", "เดือนนี้"],
              ["month", "เลือกเดือน"],
              ["ytd", "ปีนี้"],
              ["custom", "กำหนดเอง"],
            ] as [Preset, string][]
          ).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setPreset(k)}
              className={`rounded-md px-3 py-1 text-sm ${preset === k ? "bg-sky-500 text-white" : "text-slate-300 hover:text-white"}`}
            >
              {v}
            </button>
          ))}
        </div>
        {preset === "month" && (
          <input
            type="month"
            value={month}
            max={today.slice(0, 7)}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          />
        )}
        {preset === "custom" && (
          <span className="flex items-center gap-1 text-sm">
            <input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100" />
            –
            <input type="date" value={custom.to} min={custom.from} max={today} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100" />
          </span>
        )}
        <select value={locat} onChange={(e) => setLocat(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-100">
          <option value="">ทุกสาขา</option>
          {(data?.branches ?? []).map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg bg-slate-800 p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded-md px-3 py-1 text-sm ${metric === m.key ? "bg-emerald-500 text-white" : "text-slate-300 hover:text-white"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
          {data && (
            <span>
              อัปเดต {new Date(data.generatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <span className="font-mono text-lg text-slate-200 tabular-nums">{now ? now.toLocaleTimeString("th-TH") : ""}</span>
          <button onClick={fullscreen} className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">
            เต็มจอ
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl border border-rose-800 bg-rose-950 px-4 py-3 text-rose-200">{error}</p>}
      {!data && !error && <p className="text-slate-400">กำลังโหลด…</p>}

      {data && (
        <>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-4 text-slate-300">
            <span className="text-xl font-semibold text-white">{title}</span>
            <span className="text-sm text-slate-400">
              {thDate(data.range.from)} – {thDate(data.range.to)} · {data.range.days} วัน{data.locat ? ` · สาขา ${data.locat}` : ""}
            </span>
            {data.truncated && <span className="text-sm text-amber-400">ช่วงกว้างเกิน แสดงเฉพาะ 20,000 รายการแรก</span>}
          </div>

          {/* KPI + เทียบ */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Big label="จำนวนคัน" value={int(data.kpi.units)} accent
              compare={[
                { label: data.compare.prev.label, pct: pctChange(data.kpi.units, data.compare.prev.kpi.units), base: int(data.compare.prev.kpi.units) },
                { label: "ปีก่อน", pct: pctChange(data.kpi.units, data.compare.lastYear.kpi.units), base: int(data.compare.lastYear.kpi.units) },
              ]}
            />
            <Big label="ยอดขายก่อน VAT" value={compact(data.kpi.sale)} sub={`รวม VAT ${compact(data.kpi.gross)}`}
              compare={[
                { label: data.compare.prev.label, pct: pctChange(data.kpi.sale, data.compare.prev.kpi.sale), base: compact(data.compare.prev.kpi.sale) },
                { label: "ปีก่อน", pct: pctChange(data.kpi.sale, data.compare.lastYear.kpi.sale), base: compact(data.compare.lastYear.kpi.sale) },
              ]}
            />
            <Big label="กำไรขั้นต้น" value={compact(data.kpi.profit)}
              sub={`มาร์จิ้น ${data.kpi.sale > 0 ? ((data.kpi.profit / data.kpi.sale) * 100).toFixed(1) : "—"}%`}
              compare={[
                { label: data.compare.prev.label, pct: pctChange(data.kpi.profit, data.compare.prev.kpi.profit), base: compact(data.compare.prev.kpi.profit) },
                { label: "ปีก่อน", pct: pctChange(data.kpi.profit, data.compare.lastYear.kpi.profit), base: compact(data.compare.lastYear.kpi.profit) },
              ]}
            />
            <Big label="เฉลี่ยต่อคัน (ก่อน VAT)" value={data.kpi.units ? baht(data.kpi.sale / data.kpi.units) : "—"}
              sub={data.kpi.units ? `กำไร/คัน ${baht(data.kpi.profit / data.kpi.units)}` : undefined} />
            <Big label={`วันนี้ ${thDate(data.today)}`} value={`${int(data.today_kpi.units)} คัน`} sub={`ยอด ${compact(data.today_kpi.sale)}`} accent />
          </div>

          {/* กระดานอันดับ 3 ช่อง เลือกมิติได้ */}
          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            {panels.map((dim, i) => (
              <RankPanel
                key={i}
                dim={dim}
                metric={metric}
                data={data.dims[dim]}
                onChangeDim={(d) => setPanels((p) => p.map((x, j) => (j === i ? d : x)))}
              />
            ))}
          </div>

          {/* สัดส่วน ช่องทาง / สภาพรถ */}
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <SharePanel title="สัดส่วนช่องทางการขาย" items={data.dims.channel.items} metric={metric} colors={["#38bdf8", "#34d399", "#fbbf24", "#f472b6"]} />
            <SharePanel title="รถใหม่ / รถเก่า" items={data.dims.condition.items} metric={metric} colors={["#38bdf8", "#f97316"]} />
          </div>

          {/* รายวัน + รายเดือน */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-2 font-semibold text-slate-200">รายวันในช่วงที่เลือก ({METRICS.find((m) => m.key === metric)?.label})</h2>
              <Bars rows={data.daily.map((d) => ({ label: String(Number(d.date.slice(8, 10))), value: metricValue(d, metric), hint: d.date }))} metric={metric} />
            </div>
            <div className="rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-2 font-semibold text-slate-200">แนวโน้มรายเดือน 13 เดือน ({METRICS.find((m) => m.key === metric)?.label})</h2>
              <Bars
                rows={data.monthly.map((m) => ({ label: `${TH_M[m.month - 1]}${String(m.year + 543).slice(-2)}`, value: metricValue(m, metric), hint: `${TH_MF[m.month - 1]} ${m.year + 543}` }))}
                metric={metric}
                highlightLast
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Big({
  label, value, sub, accent, compare,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  compare?: { label: string; pct: number | null; base: string }[];
}) {
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${accent ? "text-sky-400" : "text-slate-100"}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
      {compare && (
        <div className="mt-2 space-y-0.5 text-xs">
          {compare.map((c) => (
            <div key={c.label} className="flex justify-between text-slate-400">
              <span>{c.label} {c.base}</span>
              <span className={c.pct === null ? "text-slate-500" : c.pct >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {c.pct === null ? "—" : `${c.pct >= 0 ? "▲" : "▼"} ${Math.abs(c.pct).toFixed(0)}%`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RankPanel({
  dim, metric, data, onChangeDim,
}: {
  dim: Dim;
  metric: Metric;
  data: { title: string; items: Item[] };
  onChangeDim: (d: Dim) => void;
}) {
  const rows = [...data.items].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)).slice(0, 12);
  const max = Math.max(1, ...rows.map((r) => metricValue(r, metric)));
  const total = data.items.reduce((s, r) => s + metricValue(r, metric), 0);
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <select value={dim} onChange={(e) => onChangeDim(e.target.value as Dim)} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 font-semibold text-slate-100">
          {DIM_LIST.map((d) => (
            <option key={d.key} value={d.key}>
              ตาม{d.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          {data.items.length} รายการ · รวม {fmtMetric(total, metric)}
        </span>
      </div>
      {rows.length === 0 && <p className="text-sm text-slate-500">ยังไม่มียอดขายในช่วงนี้</p>}
      <ol className="space-y-2">
        {rows.map((r, i) => {
          const v = metricValue(r, metric);
          return (
            <li key={r.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="truncate pr-2">
                  <span className="mr-2 inline-block w-5 text-right text-slate-500">{i + 1}</span>
                  <span className="text-slate-100">{r.label ?? r.key}</span>
                  {r.label && <span className="ml-1 text-xs text-slate-500">{r.key}</span>}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="text-lg font-semibold text-slate-100">{fmtMetric(v, metric)}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {metric === "units" ? compact(r.sale) : `${int(r.units)} คัน`} · {total > 0 ? ((v / total) * 100).toFixed(0) : 0}%
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

function SharePanel({ title, items, metric, colors }: { title: string; items: Item[]; metric: Metric; colors: string[] }) {
  const total = items.reduce((s, r) => s + Math.max(metricValue(r, metric), 0), 0);
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <h2 className="mb-2 font-semibold text-slate-200">{title}</h2>
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-800">
        {items.map((r, i) => (
          <div key={r.key} style={{ width: `${total ? (Math.max(metricValue(r, metric), 0) / total) * 100 : 0}%`, background: colors[i % colors.length] }} title={r.label ?? r.key} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {items.map((r, i) => (
          <span key={r.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colors[i % colors.length] }} />
            <span className="text-slate-200">{r.label ?? r.key}</span>
            <span className="tabular-nums text-slate-400">
              {fmtMetric(metricValue(r, metric), metric)} ({total ? ((Math.max(metricValue(r, metric), 0) / total) * 100).toFixed(0) : 0}%)
            </span>
          </span>
        ))}
        {items.length === 0 && <span className="text-slate-500">ไม่มีข้อมูล</span>}
      </div>
    </div>
  );
}

function Bars({ rows, metric, highlightLast }: { rows: { label: string; value: number; hint?: string }[]; metric: Metric; highlightLast?: boolean }) {
  const W = 1000;
  const H = 170;
  const pad = { l: 8, r: 8, t: 22, b: 26 };
  const max = Math.max(1, ...rows.map((r) => r.value));
  const slot = (W - pad.l - pad.r) / Math.max(rows.length, 1);
  const bw = Math.max(6, slot - 4);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - Math.max(v, 0) / max);
  if (rows.length === 0) return <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {rows.map((r, i) => {
        const x = pad.l + i * slot + (slot - bw) / 2;
        const top = y(r.value);
        const last = highlightLast && i === rows.length - 1;
        return (
          <g key={i}>
            <title>{r.hint ?? r.label}: {fmtMetric(r.value, metric)}</title>
            <rect x={x} y={top} width={bw} height={H - pad.b - top} rx={3} fill={last ? "#34d399" : "#38bdf8"} />
            {r.value > 0 && rows.length <= 40 && (
              <text x={x + bw / 2} y={top - 5} textAnchor="middle" fontSize="11" fill="#e2e8f0">
                {metric === "units" ? int(r.value) : compact(r.value).replace(" ล้าน", "M")}
              </text>
            )}
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {rows.length > 40 && i % 2 === 1 ? "" : r.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
