"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OPEN_BUCKET, OPEN_BUCKET_ORDER, OPEN_STATUS, SW_STATUS_LABEL, type Db2OpenBucket } from "@/lib/db2-jobs";

/**
 * จอ War Room งานซ่อม — เปิดค้างบนจอมอนิเตอร์/ทีวี พื้นมืด ตัวเลขใหญ่ รีเฟรชเองทุก 60 วินาที
 *
 * สามเรื่องที่จอนี้ต้องตอบให้ได้ในแวบเดียว:
 *   1. วันนี้/ช่วงนี้ทำงานไปกี่ใบ ได้เงินเท่าไร กำไรเท่าไร (เทียบเดือนก่อน/ปีก่อน)
 *   2. สาขาไหน ช่างคนไหน ทำได้เท่าไร (กระดานอันดับเลือกมิติได้)
 *   3. งานค้างปิด job ค้างกี่ใบ ค้างนานแค่ไหน อยู่สาขาไหน ใบไหนเก่าสุด
 *
 * ตัวเลขทั้งหมดมาจาก /api/db2/jobs (proxy → แอป Db2 ในบริษัท) — ไม่มีการคำนวณซ้ำฝั่งนี้
 * ยกเว้นเปอร์เซ็นต์เทียบ ซึ่งคิดจากตัวเลขชุดเดียวกันที่ API ส่งมา
 */

type Agg = {
  jobs: number;
  net: number;
  vat: number;
  gross: number;
  cost: number;
  profit: number;
  labour: number;
  open: number;
};
type Item = Agg & { key: string; label: string | null };
type Dim = "branch" | "tech" | "reptype" | "receiver" | "model";
type OpenJob = {
  jobno: string;
  locat: string;
  branch: string | null;
  recvDate: string | null;
  ageDays: number;
  repcod: string;
  repName: string | null;
  reptype: string;
  reptypeName: string | null;
  swstatus: string;
  bucket: Bucket;
  billable: number;
  modelName: string | null;
  model: string;
  regno: string;
  customer: string;
  mobile: string;
  tel: string;
};
type Jobs = {
  generatedAt: string;
  today: string;
  range: { from: string; to: string; days: number };
  filters: { locat: string | null };
  truncated: boolean;
  kpi: Agg;
  today_kpi: Agg;
  quality: { leadDaysAvg: number | null; sameDayPct: number | null; finished: number; noTax: number };
  compare: {
    prev: { kpi: Agg; label: string };
    lastYear: { kpi: Agg; label: string };
  };
  dims: Record<Dim, { title: string; items: Item[] }>;
  daily: (Agg & { date: string })[];
  monthly: (Agg & { year: number; month: number })[];
  open: {
    totals: { jobs: number; net: number; age: { d7: number; d30: number; d90: number; d365: number; over: number } };
    byBranch: {
      key: string;
      label: string | null;
      jobs: number;
      oldest: string | null;
      overYear: number;
      nonClaim: number;
      waiting: number;
      withMoney: number;
      billable: number;
    }[];
    byBucket: { key: Bucket; jobs: number; billable: number; overYear: number }[];
    byType: { key: string; label: string | null; jobs: number; overYear: number }[];
    listLimit: number;
    list: OpenJob[];
  };
  branches: { key: string; label: string | null }[];
};
type Bucket = Db2OpenBucket;
type Metric = "jobs" | "net" | "profit" | "labour";
type Preset = "today" | "mtd" | "month" | "ytd" | "custom";

const DIM_LIST: { key: Dim; label: string }[] = [
  { key: "branch", label: "สาขา" },
  { key: "tech", label: "ช่างซ่อม" },
  { key: "reptype", label: "ประเภทงานซ่อม" },
  { key: "receiver", label: "ผู้รับรถ" },
  { key: "model", label: "รุ่นรถ" },
];
const METRICS: { key: Metric; label: string }[] = [
  { key: "jobs", label: "จำนวนใบงาน" },
  { key: "net", label: "รายได้ก่อน VAT" },
  { key: "profit", label: "กำไรขั้นต้น" },
  { key: "labour", label: "ค่าแรง" },
];
const REFRESH_MS = 60_000;
const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MF = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
/** กลุ่มสาเหตุที่ใบยังไม่ปิด — ป้ายชุดเดียวกับหน้า dashboard (src/lib/db2-jobs.ts) */
const BUCKETS = OPEN_BUCKET_ORDER.map((key) => ({ key, ...OPEN_BUCKET[key] }));

const int = (n: number) => Math.round(n).toLocaleString("th-TH");
const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const compact = (n: number) =>
  Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ล้าน` : baht(n);
const thDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_M[m - 1]} ${y + 543}`;
};
const todayTH = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const endOfMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const metricValue = (a: Agg, m: Metric) => a[m];
const fmtMetric = (v: number, m: Metric) => (m === "jobs" ? int(v) : compact(v));

export default function JobWallBoard() {
  const today = todayTH();
  const [preset, setPreset] = useState<Preset>("mtd");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [custom, setCustom] = useState({ from: `${today.slice(0, 4)}-01-01`, to: today });
  const [locat, setLocat] = useState("");
  const [metric, setMetric] = useState<Metric>("jobs");
  const [panels, setPanels] = useState<Dim[]>(["branch", "tech", "reptype"]);
  const [data, setData] = useState<Jobs | null>(null);
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
      // จอนี้โชว์ใบที่ค้างนานสุดแค่ 10 ใบ — ดึงมา 20 พอ (เต็มชุดคือพันกว่าใบ ~800KB ทุกนาที)
      qs.set("openLimit", "20");
      const res = await fetch(`/api/db2/jobs?${qs}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || body.ok === false) {
        // 404 = แอป Db2 บนเซิร์ฟเวอร์ยังไม่ได้ build เวอร์ชันที่มี /api/jobs
        // (proxy แปลงมาเป็นข้อความไทยที่บอกวิธีแก้ให้แล้ว — คนละกรณีกับเครื่องดับ)
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
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
  const age = data?.open.totals.age;
  const waitingTotal = data ? data.open.byBranch.reduce((s, b) => s + (b.waiting ?? 0), 0) : 0;

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-2xl font-bold tracking-tight">งานซ่อม</h1>
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
            <option key={b.key} value={b.key}>
              {b.label ? `${b.label} (${b.key})` : b.key}
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
              {thDate(data.range.from)} – {thDate(data.range.to)} · {data.range.days} วัน
              {data.filters.locat ? ` · สาขา ${data.filters.locat}` : ""}
            </span>
            {data.truncated && <span className="text-sm text-amber-400">ช่วงกว้างเกิน แสดงเฉพาะ 20,000 ใบแรก</span>}
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Big
              label="ใบงานซ่อม"
              value={int(data.kpi.jobs)}
              accent
              compare={[
                { label: data.compare.prev.label, pct: pctChange(data.kpi.jobs, data.compare.prev.kpi.jobs), base: int(data.compare.prev.kpi.jobs) },
                { label: "ปีก่อน", pct: pctChange(data.kpi.jobs, data.compare.lastYear.kpi.jobs), base: int(data.compare.lastYear.kpi.jobs) },
              ]}
            />
            <Big
              label="รายได้ก่อน VAT"
              value={compact(data.kpi.net)}
              sub={`รวม VAT ${compact(data.kpi.gross)}`}
              compare={[
                { label: data.compare.prev.label, pct: pctChange(data.kpi.net, data.compare.prev.kpi.net), base: compact(data.compare.prev.kpi.net) },
                { label: "ปีก่อน", pct: pctChange(data.kpi.net, data.compare.lastYear.kpi.net), base: compact(data.compare.lastYear.kpi.net) },
              ]}
            />
            <Big
              label="กำไรขั้นต้น"
              value={compact(data.kpi.profit)}
              sub={`มาร์จิ้น ${data.kpi.net > 0 ? ((data.kpi.profit / data.kpi.net) * 100).toFixed(1) : "—"}%`}
              compare={[
                { label: data.compare.prev.label, pct: pctChange(data.kpi.profit, data.compare.prev.kpi.profit), base: compact(data.compare.prev.kpi.profit) },
                { label: "ปีก่อน", pct: pctChange(data.kpi.profit, data.compare.lastYear.kpi.profit), base: compact(data.compare.lastYear.kpi.profit) },
              ]}
            />
            <Big
              label="ค่าแรง / เฉลี่ยต่อใบ"
              value={compact(data.kpi.labour)}
              sub={data.kpi.jobs ? `รายได้เฉลี่ย ${baht(data.kpi.net / data.kpi.jobs)} บาท/ใบ` : undefined}
            />
            <Big
              label={`วันนี้ ${thDate(data.today)}`}
              value={`${int(data.today_kpi.jobs)} ใบ`}
              sub={`รายได้ ${compact(data.today_kpi.net)}`}
              accent
            />
          </div>

          {/* งานค้างปิด job — จุดหลักของจอนี้ วางไว้ก่อนกระดานอันดับ */}
          {age && (
            <div className="mb-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-amber-700/50 bg-slate-900 p-4">
                <h2 className="mb-1 font-semibold text-amber-300">งานค้างปิด job (ทั้งหมด ณ ตอนนี้)</h2>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-bold tabular-nums text-amber-400">{int(data.open.totals.jobs)}</span>
                  <span className="text-sm text-slate-400">
                    {/* ทุกใบที่ยังไม่ปิดเป็น W หรือ R อย่างใดอย่างหนึ่ง → R = ยอดรวม − W */}
                    <span style={{ color: OPEN_STATUS.W.color }}>
                      ค้างซ่อม (W){" "}
                      <span className="text-lg font-semibold">{int(waitingTotal)}</span> ใบ
                    </span>{" "}
                    ·{" "}
                    <span style={{ color: OPEN_STATUS.R.color }}>
                      เปิดงานค้าง (R){" "}
                      <span className="text-lg font-semibold">{int(data.open.totals.jobs - waitingTotal)}</span> ใบ
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  นับทั้งฐาน ไม่ขึ้นกับช่วงวันที่ · ยอดที่ยังต้องเก็บจากลูกค้า{" "}
                  <span className="font-semibold text-rose-300">
                    {baht((data.open.byBucket ?? []).reduce((s, b) => s + b.billable, 0))} บาท
                  </span>
                </p>
                <div className="mt-3 space-y-1.5 text-sm">
                  {BUCKETS.map((b) => {
                    const row = (data.open.byBucket ?? []).find((x) => x.key === b.key);
                    const v = row?.jobs ?? 0;
                    return (
                      <div key={b.key} className="flex items-center gap-2">
                        <span className="w-40 shrink-0 truncate text-slate-300">{b.label}</span>
                        <div className="h-2 flex-1 rounded-full bg-slate-800">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${data.open.totals.jobs ? (v / data.open.totals.jobs) * 100 : 0}%`,
                              background: b.color,
                            }}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right font-semibold tabular-nums" style={{ color: b.color }}>
                          {int(v)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  อายุ: ≤7 วัน {int(age.d7)} · 8–30 {int(age.d30)} · 31–90 {int(age.d90)} · 91–365 {int(age.d365)} ·{" "}
                  <span className="text-rose-400">เกิน 1 ปี {int(age.over)}</span>
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900 p-4">
                <h2 className="mb-2 font-semibold text-slate-200">งานค้างแยกตามสาขา</h2>
                <ol className="space-y-1.5 text-sm">
                  {data.open.byBranch.slice(0, 10).map((b) => (
                    <li key={b.key} className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-slate-200">{b.label ?? b.key}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className="text-lg font-semibold text-amber-400">{int(b.jobs)}</span>
                        {(b.waiting ?? 0) > 0 && (
                          <span className="ml-2 text-xs font-semibold" style={{ color: OPEN_STATUS.W.color }}>
                            W {int(b.waiting)}
                          </span>
                        )}
                        <span className="ml-2 text-xs" style={{ color: OPEN_STATUS.R.color }}>
                          R {int(b.jobs - (b.waiting ?? 0))}
                        </span>
                        <span className="ml-2 text-xs text-rose-400">เกิน 1 ปี {int(b.overYear)}</span>
                        <span className="ml-2 text-xs text-slate-500">เก่าสุด {thDate(b.oldest)}</span>
                      </span>
                    </li>
                  ))}
                  {data.open.byBranch.length === 0 && <li className="text-slate-500">ไม่มีงานค้าง</li>}
                </ol>
              </div>

              <div className="rounded-2xl bg-slate-900 p-4">
                <h2 className="mb-2 font-semibold text-slate-200">ใบที่ค้างนานที่สุด</h2>
                <ol className="space-y-1.5 text-sm">
                  {data.open.list.slice(0, 10).map((j) => (
                    <li key={j.jobno} className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-xs text-slate-400">{j.jobno}</span>
                        <span className="ml-2 text-slate-200">{j.customer || j.regno || j.modelName || j.model || "—"}</span>
                        <span className="ml-2 text-xs text-slate-500">
                          {j.branch ?? j.locat} · {j.repName ?? j.repcod} · {SW_STATUS_LABEL[j.swstatus] ?? j.swstatus}
                        </span>
                        <span
                          className="ml-2 text-xs"
                          style={{ color: BUCKETS.find((b) => b.key === j.bucket)?.color ?? "#94a3b8" }}
                        >
                          {BUCKETS.find((b) => b.key === j.bucket)?.label ?? j.bucket}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-rose-400">{int(j.ageDays)} วัน</span>
                    </li>
                  ))}
                  {data.open.list.length === 0 && <li className="text-slate-500">ไม่มีงานค้าง</li>}
                </ol>
              </div>
            </div>
          )}

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

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-2 font-semibold text-slate-200">
                รายวันในช่วงที่เลือก ({METRICS.find((m) => m.key === metric)?.label})
              </h2>
              <Bars
                rows={data.daily.map((d) => ({ label: String(Number(d.date.slice(8, 10))), value: metricValue(d, metric), hint: d.date }))}
                metric={metric}
              />
            </div>
            <div className="rounded-2xl bg-slate-900 p-4">
              <h2 className="mb-2 font-semibold text-slate-200">
                แนวโน้มรายเดือน 13 เดือน ({METRICS.find((m) => m.key === metric)?.label})
              </h2>
              <Bars
                rows={data.monthly.map((m) => ({
                  label: `${TH_M[m.month - 1]}${String(m.year + 543).slice(-2)}`,
                  value: metricValue(m, metric),
                  hint: `${TH_MF[m.month - 1]} ${m.year + 543}`,
                }))}
                metric={metric}
                highlightLast
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            ปิดงานในช่วงนี้ {int(data.quality.finished)} ใบ · เสร็จภายในวันเดียว{" "}
            {data.quality.sameDayPct === null ? "—" : `${data.quality.sameDayPct.toFixed(0)}%`} · เฉลี่ย{" "}
            {data.quality.leadDaysAvg === null ? "—" : data.quality.leadDaysAvg.toFixed(1)} วัน/ใบ
            {data.quality.noTax > 0 && ` · ยังไม่มีใบกำกับภาษี ${int(data.quality.noTax)} ใบ`} · รายได้ก่อน VAT =
            อะไหล่+น้ำมัน+ค่าแรง+งานนอก+งานสี · กำไรขั้นต้น = รายได้ก่อน VAT − ต้นทุนอะไหล่และน้ำมัน
          </p>
        </>
      )}
    </div>
  );
}

function Big({
  label,
  value,
  sub,
  accent,
  compare,
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
              <span>
                {c.label} {c.base}
              </span>
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
  dim,
  metric,
  data,
  onChangeDim,
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
        <select
          value={dim}
          onChange={(e) => onChangeDim(e.target.value as Dim)}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 font-semibold text-slate-100"
        >
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
      {rows.length === 0 && <p className="text-sm text-slate-500">ยังไม่มีใบงานในช่วงนี้</p>}
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
                    {metric === "jobs" ? compact(r.net) : `${int(r.jobs)} ใบ`} · {total > 0 ? ((v / total) * 100).toFixed(0) : 0}%
                  </span>
                  {r.open > 0 && <span className="ml-2 text-xs text-amber-400">ค้าง {int(r.open)}</span>}
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

function Bars({
  rows,
  metric,
  highlightLast,
}: {
  rows: { label: string; value: number; hint?: string }[];
  metric: Metric;
  highlightLast?: boolean;
}) {
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
            <title>
              {r.hint ?? r.label}: {fmtMetric(r.value, metric)}
            </title>
            <rect x={x} y={top} width={bw} height={H - pad.b - top} rx={3} fill={last ? "#34d399" : "#38bdf8"} />
            {r.value > 0 && rows.length <= 40 && (
              <text x={x + bw / 2} y={top - 5} textAnchor="middle" fontSize="11" fill="#e2e8f0">
                {metric === "jobs" ? int(r.value) : compact(r.value).replace(" ล้าน", "M")}
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
