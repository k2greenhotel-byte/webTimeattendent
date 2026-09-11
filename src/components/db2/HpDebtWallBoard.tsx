"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * จอ War Room ลูกหนี้เช่าซื้อ — เปิดค้างบนจอมอนิเตอร์ รีเฟรชเองทุก 60 วินาที
 *
 * สี่เรื่องที่จอนี้ต้องตอบให้ได้:
 *   1. ยอดลูกหนี้เช่าซื้อคงเหลือเท่าไร กี่สัญญา และเกินกำหนดไปแล้วเท่าไร
 *   2. กระจุกอยู่ตรงไหน — เลือกมิติได้เอง (สาขา · กลุ่มอาชีพ · ช่วงค้างงวด · ผู้เก็บเงิน ฯลฯ)
 *   3. สัญญาไหนที่ยังไม่มีใครตาม (ตัวเลขที่หัวหน้าต้องเห็นก่อนเพื่อน)
 *   4. ผลการติดตามล่าสุดว่าอย่างไร — ทั้งรายสัญญาและฟีดรวมเรียงตามเวลา
 *
 * ตัวเลขทั้งหมดมาจาก /api/db2/hpdebt (proxy → แอป Db2 ในบริษัท) ฝั่งนี้ไม่คำนวณซ้ำ
 * ยกเว้นการเรียง/กรองรายการที่ส่งมาแล้ว
 */

type Item = {
  key: string;
  label: string | null;
  contracts: number;
  balance: number;
  overdueAmt: number;
  overdueContracts: number;
};
type Dim = "branch" | "group" | "overdue" | "collector" | "salesman" | "contstat" | "follow";
type Note = {
  date: string | null;
  followDate: string | null;
  by: string;
  byName: string | null;
  memo: string;
};
type Contract = {
  locat: string;
  contno: string;
  customer: string;
  mobile: string;
  tel: string;
  saleDate: string | null;
  balance: number;
  overdueCount: number;
  overdueAmt: number;
  firstOverdue: string | null;
  nextDue: string | null;
  lastPayDate: string | null;
  lastPayAmt: number;
  group: string;
  groupName: string | null;
  salesman: string | null;
  collector: string | null;
  contstat: string;
  ystat: string;
  noteCount: number;
  lastNoteDate: string | null;
  lastNoteDays: number | null;
  lastNote: Note | null;
};
type Debt = {
  generatedAt: string;
  today: string;
  locat: string | null;
  truncated: boolean;
  totals: {
    contracts: number;
    balance: number;
    overdueAmt: number;
    overdueContracts: number;
    noNoteContracts: number;
    avgBalance: number;
  };
  dims: Record<Dim, { title: string; items: Item[] }>;
  contracts: Contract[];
  notes: (Note & { locat: string; contno: string; customer: string; balance: number })[];
  monthly: { year: number; month: number; payments: number; amount: number }[];
  branches: string[];
};
type Metric = "balance" | "overdueAmt" | "contracts";
type Sort = "balance" | "overdue" | "stale";

const DIM_LIST: { key: Dim; label: string }[] = [
  { key: "branch", label: "สาขา" },
  { key: "overdue", label: "ช่วงค้างงวด" },
  { key: "follow", label: "ความสดของการติดตาม" },
  { key: "group", label: "ประเภทกลุ่มลูกค้า" },
  { key: "collector", label: "พนักงานเก็บเงิน" },
  { key: "salesman", label: "พนักงานขาย" },
  { key: "contstat", label: "สถานะสัญญา (รหัสดิบ)" },
];
const METRICS: { key: Metric; label: string }[] = [
  { key: "balance", label: "ยอดคงเหลือ" },
  { key: "overdueAmt", label: "ยอดเกินกำหนด" },
  { key: "contracts", label: "จำนวนสัญญา" },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: "balance", label: "ยอดคงเหลือมากสุด" },
  { key: "overdue", label: "ค้างงวดมากสุด" },
  { key: "stale", label: "ไม่ได้ตามนานสุด" },
];
const REFRESH_MS = 60_000;
const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const int = (n: number) => Math.round(n).toLocaleString("th-TH");
const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const compact = (n: number) =>
  Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ล้าน` : baht(n);
const thDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_M[m - 1]} ${y + 543}`;
};
const metricValue = (i: Item, m: Metric) => (m === "contracts" ? i.contracts : m === "balance" ? i.balance : i.overdueAmt);
const fmtMetric = (v: number, m: Metric) => (m === "contracts" ? int(v) : compact(v));

export default function HpDebtWallBoard() {
  const [locat, setLocat] = useState("");
  const [metric, setMetric] = useState<Metric>("balance");
  const [sort, setSort] = useState<Sort>("balance");
  const [panels, setPanels] = useState<Dim[]>(["branch", "overdue", "follow"]);
  const [data, setData] = useState<Debt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (locat) qs.set("locat", locat);
      const res = await fetch(`/api/db2/hpdebt?${qs}`, { cache: "no-store" });
      const body = await res.json();
      // 404 = แอป Db2 บนเซิร์ฟเวอร์ยังไม่ได้ build เวอร์ชันที่มี /api/hpdebt
      // (proxy แปลงเป็นข้อความไทยที่บอกวิธีแก้ให้แล้ว — คนละกรณีกับเครื่องดับ)
      if (!res.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [locat]);

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

  const rows = useMemo(() => {
    const list = [...(data?.contracts ?? [])];
    if (sort === "overdue") list.sort((a, b) => b.overdueCount - a.overdueCount || b.overdueAmt - a.overdueAmt);
    else if (sort === "stale") list.sort((a, b) => (b.lastNoteDays ?? 99999) - (a.lastNoteDays ?? 99999));
    else list.sort((a, b) => b.balance - a.balance);
    return list.slice(0, 20);
  }, [data, sort]);

  const maxMonthly = Math.max(1, ...(data?.monthly ?? []).map((m) => m.amount));

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-2xl font-bold tracking-tight">ลูกหนี้เช่าซื้อ</h1>
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
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Big label="ยอดคงเหลือทั้งหมด" value={compact(data.totals.balance)} sub={`${int(data.totals.contracts)} สัญญา`} accent />
            <Big
              label="เกินกำหนดชำระ"
              value={compact(data.totals.overdueAmt)}
              sub={`${int(data.totals.overdueContracts)} สัญญา · ${data.totals.balance > 0 ? ((data.totals.overdueAmt / data.totals.balance) * 100).toFixed(0) : 0}% ของยอด`}
              tone="bad"
            />
            <Big
              label="ไม่เคยมีบันทึกติดตาม"
              value={`${int(data.totals.noNoteContracts)} สัญญา`}
              sub="ยังไม่มีใครลงบันทึกตามหนี้เลย"
              tone={data.totals.noNoteContracts > 0 ? "bad" : undefined}
            />
            <Big label="เฉลี่ยต่อสัญญา" value={baht(data.totals.avgBalance)} sub="ยอดคงเหลือ" />
            <Big
              label="รับชำระเดือนนี้"
              value={compact(data.monthly.at(-1)?.amount ?? 0)}
              sub={`${int(data.monthly.at(-1)?.payments ?? 0)} งวด · เดือนก่อน ${compact(data.monthly.at(-2)?.amount ?? 0)}`}
            />
          </div>

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

          <div className="mb-4 grid gap-4 lg:grid-cols-5">
            {/* รายสัญญา — เรียงได้ตามสิ่งที่อยากไล่ */}
            <div className="rounded-2xl bg-slate-900 p-4 lg:col-span-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-200">สัญญาที่ต้องตาม (20 อันดับแรก)</h2>
                <div className="flex rounded-lg bg-slate-800 p-1">
                  {SORTS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setSort(s.key)}
                      className={`rounded-md px-2 py-1 text-xs ${sort === s.key ? "bg-sky-500 text-white" : "text-slate-300 hover:text-white"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-1">สัญญา / ลูกค้า</th>
                      <th className="py-1 text-right">คงเหลือ</th>
                      <th className="py-1 text-right">ค้างงวด</th>
                      <th className="py-1">ติดตามล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={`${c.locat}-${c.contno}`} className="border-t border-slate-800 align-top">
                        <td className="py-1.5 pr-2">
                          <span className="font-mono text-xs text-slate-400">{c.contno}</span>
                          <span className="ml-2 text-slate-100">{c.customer || "—"}</span>
                          <span className="block text-xs text-slate-500">
                            {c.locat}
                            {c.groupName && ` · ${c.groupName}`}
                            {c.collector && ` · เก็บเงิน ${c.collector}`}
                            {(c.mobile || c.tel) && ` · ${c.mobile || c.tel}`}
                          </span>
                        </td>
                        <td className="py-1.5 text-right tabular-nums font-semibold text-slate-100">{baht(c.balance)}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {c.overdueCount > 0 ? (
                            <>
                              <span className="font-semibold text-rose-400">{int(c.overdueCount)} งวด</span>
                              <span className="block text-xs text-rose-300">{baht(c.overdueAmt)}</span>
                            </>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-1.5 text-xs">
                          {c.lastNote ? (
                            <>
                              <span className={c.lastNoteDays !== null && c.lastNoteDays > 90 ? "text-amber-400" : "text-slate-300"}>
                                {thDate(c.lastNote.date)}
                                {c.lastNoteDays !== null && ` (${int(c.lastNoteDays)} วันก่อน)`}
                              </span>
                              <span className="block text-slate-500">
                                {c.lastNote.byName ?? c.lastNote.by} · {c.lastNote.memo.slice(0, 70)}
                                {c.lastNote.memo.length > 70 ? "…" : ""}
                              </span>
                            </>
                          ) : (
                            <span className="font-semibold text-rose-400">ไม่เคยมีบันทึกติดตาม</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-500">
                          ไม่มีลูกหนี้เช่าซื้อค้างในสาขานี้
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ฟีดผลการติดตามล่าสุด */}
            <div className="rounded-2xl bg-slate-900 p-4 lg:col-span-2">
              <h2 className="mb-2 font-semibold text-slate-200">ผลการติดตามล่าสุด</h2>
              <ol className="max-h-[26rem] space-y-2 overflow-auto pr-1 text-sm">
                {data.notes.slice(0, 40).map((n, i) => (
                  <li key={`${n.contno}-${n.date}-${i}`} className="border-b border-slate-800 pb-2 last:border-0">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-slate-400">
                        {thDate(n.date)} · {n.byName ?? n.by}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-500">คงเหลือ {baht(n.balance)}</span>
                    </div>
                    <div className="text-slate-200">{n.customer || n.contno}</div>
                    <div className="text-xs text-slate-400">{n.memo}</div>
                  </li>
                ))}
                {data.notes.length === 0 && <li className="text-slate-500">ยังไม่มีบันทึกการติดตาม</li>}
              </ol>
            </div>
          </div>

          {/* ยอดรับชำระรายเดือน */}
          <div className="rounded-2xl bg-slate-900 p-4">
            <h2 className="mb-2 font-semibold text-slate-200">ยอดรับชำระค่างวดรายเดือน (13 เดือน · ทุกสัญญา)</h2>
            <div className="flex items-end gap-2">
              {data.monthly.map((m, i) => (
                <div key={`${m.year}-${m.month}`} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs tabular-nums text-slate-300">{compact(m.amount).replace(" ล้าน", "M")}</span>
                  <div
                    className={`w-full rounded-t ${i === data.monthly.length - 1 ? "bg-emerald-500" : "bg-sky-600"}`}
                    style={{ height: `${Math.max(4, (m.amount / maxMonthly) * 110)}px` }}
                  />
                  <span className="text-xs text-slate-500">
                    {TH_M[m.month - 1]}
                    {String(m.year + 543).slice(-2)}
                  </span>
                </div>
              ))}
              {data.monthly.length === 0 && <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>}
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            ยอดคงเหลือ = ค่างวดทั้งหมดตามสัญญา − ที่ชำระแล้ว (ไม่ได้ใช้ช่องยอดคงเหลือในตาราง ซึ่งเก็บราคาเต็มไว้) ·
            เกินกำหนด = งวดที่ถึงกำหนดแล้วยังชำระไม่ครบ · ผลการติดตามมาจากบันทึกการติดตามของโปรแกรมเดิม ·
            &ldquo;สถานะสัญญา&rdquo; แสดงเป็นรหัสดิบเพราะยังไม่ได้ยืนยันความหมายกับผู้ใช้ ·
            ประเภทกลุ่มลูกค้าว่างในหลายสัญญา (ทะเบียนลูกค้าไม่ได้กรอกไว้)
            {data.truncated && " · รายการเกินขีดจำกัด แสดงเฉพาะส่วนแรก"}
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
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  tone?: "bad";
}) {
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div
        className={`mt-1 text-3xl font-bold tabular-nums ${tone === "bad" ? "text-rose-400" : accent ? "text-sky-400" : "text-slate-100"}`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
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
  const rows = [...data.items].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)).slice(0, 10);
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
      {rows.length === 0 && <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>}
      <ol className="space-y-2">
        {rows.map((r, i) => {
          const v = metricValue(r, metric);
          return (
            <li key={r.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="truncate pr-2">
                  <span className="mr-2 inline-block w-4 text-right text-slate-500">{i + 1}</span>
                  <span className="text-slate-100">{r.label ?? r.key}</span>
                  {r.label && r.label !== r.key && <span className="ml-1 text-xs text-slate-500">{r.key}</span>}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="text-lg font-semibold text-slate-100">{fmtMetric(v, metric)}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {metric === "contracts" ? compact(r.balance) : `${int(r.contracts)} สัญญา`} ·{" "}
                    {total > 0 ? ((v / total) * 100).toFixed(0) : 0}%
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
