"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * จอ War Room ยอดขาย — ออกแบบให้เปิดค้างไว้บนจอมอนิเตอร์/ทีวี
 * พื้นมืด ตัวเลขใหญ่ รีเฟรชเองทุก 60 วินาที ไม่ต้องแตะ
 */

type Money = { sale: number; vat: number; gross: number; cost: number; profit: number };
type Kpi = Money & { units: number };
type Rank = Money & { key: string; name: string | null; units: number };
type Wall = {
  generatedAt: string;
  today: string;
  period: "today" | "mtd" | "ytd" | "30d";
  range: { from: string; to: string };
  locat: string | null;
  kpis: { today: Kpi; mtd: Kpi; ytd: Kpi };
  byBranch: Rank[];
  bySalesman: Rank[];
  byModel: Rank[];
  daily: (Money & { date: string | null; units: number })[];
  branches: string[];
};

const PERIODS: { key: Wall["period"]; label: string }[] = [
  { key: "today", label: "วันนี้" },
  { key: "mtd", label: "เดือนนี้" },
  { key: "30d", label: "30 วัน" },
  { key: "ytd", label: "ปีนี้" },
];

const REFRESH_MS = 60_000;

const int = (n: number) => Math.round(n).toLocaleString("th-TH");
const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const compact = (n: number) =>
  Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ล้าน` : baht(n);
const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_M[m - 1]} ${y + 543}`;
};

export default function WallBoard() {
  const [period, setPeriod] = useState<Wall["period"]>("mtd");
  const [locat, setLocat] = useState("");
  const [data, setData] = useState<Wall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ period });
      if (locat) qs.set("locat", locat);
      const res = await fetch(`/api/db2/wall?${qs}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [period, locat]);

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
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  const k = data?.kpis;
  const sel = data ? data.kpis[period === "30d" ? "mtd" : period] : null;

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 lg:p-6">
      {/* แถบบน */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">ยอดขายสด</h1>
        <div className="flex rounded-lg bg-slate-800 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3 py-1 text-sm ${period === p.key ? "bg-sky-500 text-white" : "text-slate-300 hover:text-white"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={locat}
          onChange={(e) => setLocat(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-100"
        >
          <option value="">ทุกสาขา</option>
          {(data?.branches ?? []).map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
          {data && (
            <span>
              {thDate(data.range.from)} – {thDate(data.range.to)} · อัปเดต{" "}
              {new Date(data.generatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <span className="font-mono text-lg text-slate-200 tabular-nums">
            {now ? now.toLocaleTimeString("th-TH") : ""}
          </span>
          <button onClick={fullscreen} className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800">
            เต็มจอ
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-800 bg-rose-950 px-4 py-3 text-rose-200">{error}</p>
      )}

      {k && sel && data && (
        <>
          {/* KPI */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Big label="วันนี้ (คัน)" value={int(k.today.units)} accent />
            <Big label="วันนี้ ยอดขายก่อน VAT" value={compact(k.today.sale)} />
            <Big label="เดือนนี้ (คัน)" value={int(k.mtd.units)} accent />
            <Big label="เดือนนี้ ยอดขายก่อน VAT" value={compact(k.mtd.sale)} sub={`กำไรขั้นต้น ${compact(k.mtd.profit)}`} />
            <Big label="ปีนี้ (คัน)" value={int(k.ytd.units)} accent />
            <Big label="ปีนี้ ยอดขายก่อน VAT" value={compact(k.ytd.sale)} sub={`กำไรขั้นต้น ${compact(k.ytd.profit)}`} />
          </div>

          {/* 3 อันดับ */}
          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <RankPanel title="ตามสาขา" rows={data.byBranch} />
            <RankPanel title="ตามพนักงานขาย" rows={data.bySalesman} showName />
            <RankPanel title="ตามรุ่นรถ" rows={data.byModel} />
          </div>

          {/* รายวัน 30 วัน */}
          <div className="rounded-2xl bg-slate-900 p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-semibold text-slate-200">ยอดขายรายวัน 30 วันล่าสุด (คัน)</h2>
              <span className="text-xs text-slate-500">ตัวเลขบนแท่ง = จำนวนคัน</span>
            </div>
            <DailyBars rows={data.daily} />
          </div>
        </>
      )}

      {!data && !error && <p className="text-slate-400">กำลังโหลด…</p>}
    </div>
  );
}

function Big({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${accent ? "text-sky-400" : "text-slate-100"}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function RankPanel({ title, rows, showName }: { title: string; rows: Rank[]; showName?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.units));
  const total = rows.reduce((s, r) => s + r.units, 0);
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold text-slate-200">{title}</h2>
        <span className="text-xs text-slate-500">รวม {int(total)} คัน</span>
      </div>
      {rows.length === 0 && <p className="text-sm text-slate-500">ยังไม่มียอดขายในช่วงนี้</p>}
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="truncate pr-2">
                <span className="mr-2 inline-block w-5 text-right text-slate-500">{i + 1}</span>
                <span className="text-slate-100">{showName && r.name ? r.name : r.key}</span>
                {showName && r.name && <span className="ml-1 text-xs text-slate-500">{r.key}</span>}
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="text-lg font-semibold text-slate-100">{int(r.units)}</span>
                <span className="ml-2 text-xs text-slate-400">{compact(r.sale)}</span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-sky-500" style={{ width: `${(r.units / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DailyBars({ rows }: { rows: Wall["daily"] }) {
  const W = 1000;
  const H = 160;
  const pad = { l: 8, r: 8, t: 20, b: 26 };
  const max = Math.max(1, ...rows.map((r) => r.units));
  const slot = (W - pad.l - pad.r) / Math.max(rows.length, 1);
  const bw = Math.max(6, slot - 4);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {rows.map((r, i) => {
        const x = pad.l + i * slot + (slot - bw) / 2;
        const top = y(r.units);
        const d = r.date ? Number(r.date.slice(8, 10)) : "";
        return (
          <g key={r.date ?? i}>
            <rect x={x} y={top} width={bw} height={H - pad.b - top} rx={3} fill="#38bdf8" />
            {r.units > 0 && (
              <text x={x + bw / 2} y={top - 5} textAnchor="middle" fontSize="11" fill="#e2e8f0">
                {r.units}
              </text>
            )}
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {d}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
