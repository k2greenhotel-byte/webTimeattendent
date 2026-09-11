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
type Dim =
  | "branch"
  | "productGroup"
  | "group"
  | "overdue"
  | "collector"
  | "salesman"
  | "contstat"
  | "follow"
  | "brand"
  | "model"
  | "condition";
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
  productGroup: string;
  productGroupName: string | null;
  brand: string;
  model: string;
  modelName: string | null;
  carStat: string;
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
  { key: "productGroup", label: "กลุ่มสินค้า" },
  { key: "branch", label: "สาขา" },
  { key: "overdue", label: "ช่วงค้างงวด" },
  { key: "follow", label: "ความสดของการติดตาม" },
  { key: "group", label: "ประเภทกลุ่มลูกค้า" },
  { key: "collector", label: "พนักงานเก็บเงิน" },
  { key: "salesman", label: "พนักงานขาย" },
  { key: "brand", label: "ยี่ห้อ" },
  { key: "model", label: "รุ่น" },
  { key: "condition", label: "สภาพ (ใหม่/เก่า)" },
  { key: "contstat", label: "สถานะสัญญา (รหัสดิบ)" },
];

/** ค่าที่ใช้จัดกลุ่มของสัญญาหนึ่งใบ — ใช้ทั้งกระดานอันดับและตารางไขว้ */
const dimValue = (c: Contract, d: Dim): { key: string; label: string | null } => {
  switch (d) {
    case "branch":
      return { key: c.locat, label: null };
    case "productGroup":
      return { key: c.productGroup || "(ไม่ระบุ)", label: c.productGroupName };
    case "group":
      return { key: c.group || "(ไม่ระบุกลุ่ม)", label: c.groupName };
    case "collector":
      return { key: c.collector ?? "(ไม่ระบุ)", label: null };
    case "salesman":
      return { key: c.salesman ?? "(ไม่ระบุ)", label: null };
    case "brand":
      return { key: c.brand || "(ไม่ระบุ)", label: null };
    case "model":
      return { key: c.model || "(ไม่ระบุ)", label: c.modelName };
    case "condition":
      return { key: c.carStat || "(ไม่ระบุ)", label: c.carStat === "N" ? "ใหม่" : c.carStat === "O" ? "เก่า" : null };
    case "contstat":
      return { key: c.contstat || "(ว่าง)", label: null };
    case "overdue":
      return c.overdueCount === 0
        ? { key: "none", label: "ยังไม่ค้างงวด" }
        : c.overdueCount <= 1
          ? { key: "d1", label: "ค้าง 1 งวด" }
          : c.overdueCount <= 3
            ? { key: "d3", label: "ค้าง 2-3 งวด" }
            : c.overdueCount <= 6
              ? { key: "d6", label: "ค้าง 4-6 งวด" }
              : { key: "over", label: "ค้างเกิน 6 งวด" };
    case "follow":
      return c.noteCount === 0 || c.lastNoteDays === null
        ? { key: "never", label: "ไม่เคยมีบันทึกติดตาม" }
        : c.lastNoteDays <= 30
          ? { key: "d30", label: "ติดตามใน 30 วัน" }
          : c.lastNoteDays <= 90
            ? { key: "d90", label: "ติดตาม 31-90 วัน" }
            : { key: "old", label: "ไม่ได้ติดตามเกิน 90 วัน" };
  }
};
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
  const [panels, setPanels] = useState<Dim[]>(["productGroup", "branch", "follow"]);
  const [pivotRow, setPivotRow] = useState<Dim>("productGroup");
  const [pivotCol, setPivotCol] = useState<Dim>("branch");
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

  /**
   * กลุ่มที่ต้องตามด่วน = ค้างชำระอยู่ **และ** ไม่มีใครตาม (ไม่เคยตามเลย หรือทิ้งช่วงเกิน 90 วัน)
   *
   * ที่ต้องแยกแบบนี้เพราะ "ไม่เคยมีบันทึกติดตาม" อย่างเดียวหลอก — ลูกค้าที่จ่ายตรงทุกงวด
   * ก็ไม่มีบันทึกติดตามเป็นเรื่องปกติ ไม่ใช่งานที่หลุด
   */
  const chase = useMemo(() => {
    const all = data?.contracts ?? [];
    const overdue = all.filter((c) => c.overdueCount > 0);
    const need = overdue
      .filter((c) => c.noteCount === 0 || (c.lastNoteDays ?? 9999) > 90)
      .sort((a, b) => b.overdueAmt - a.overdueAmt);
    const managed = overdue.filter((c) => c.noteCount > 0 && (c.lastNoteDays ?? 9999) <= 90);
    const neverButOk = all.filter((c) => c.noteCount === 0 && c.overdueCount === 0);
    const sum = (xs: Contract[], f: (c: Contract) => number) => xs.reduce((s, c) => s + f(c), 0);
    return {
      need,
      needAmt: sum(need, (c) => c.overdueAmt),
      neverNeed: need.filter((c) => c.noteCount === 0).length,
      managed: managed.length,
      managedAmt: sum(managed, (c) => c.overdueAmt),
      neverButOk: neverButOk.length,
      neverButOkAmt: sum(neverButOk, (c) => c.balance),
      noPhone: need.filter((c) => !c.mobile && !c.tel).length,
    };
  }, [data]);

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
              label="ค้างชำระแต่ไม่มีใครตาม"
              value={compact(chase.needAmt)}
              sub={`${int(chase.need.length)} สัญญา · ไม่เคยตามเลย ${int(chase.neverNeed)} · มีคนตามอยู่ ${int(chase.managed)} สัญญา`}
              tone={chase.need.length > 0 ? "bad" : undefined}
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

          {/* รายการที่ต้องตามด่วน — จุดตั้งต้นของงานประจำวัน วางไว้บนสุดรองจาก KPI */}
          {chase.need.length > 0 && (
            <div className="mb-4 rounded-2xl border border-rose-700/60 bg-slate-900 p-4">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-rose-300">
                  ต้องตามด่วน — ค้างชำระอยู่และไม่มีใครตาม {int(chase.need.length)} สัญญา{" "}
                  <span className="text-rose-400">{compact(chase.needAmt)} บาท</span>
                </h2>
                <span className="text-xs text-slate-400">
                  ไม่เคยตามเลย {int(chase.neverNeed)} · ทิ้งช่วงเกิน 90 วัน {int(chase.need.length - chase.neverNeed)}
                  {chase.noPhone > 0 && ` · ไม่มีเบอร์ติดต่อ ${int(chase.noPhone)}`}
                </span>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                อีก {int(chase.managed)} สัญญาที่ค้างชำระมีคนตามอยู่แล้วใน 90 วัน ({compact(chase.managedAmt)} บาท) ·
                และ {int(chase.neverButOk)} สัญญาที่ไม่มีบันทึกติดตามแต่จ่ายตรงทุกงวด ({compact(chase.neverButOkAmt)} บาท)
                ไม่นับเป็นงานค้าง
              </p>
              <div className="max-h-[20rem] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900 text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-1 text-right">ยอดค้าง</th>
                      <th className="py-1 pl-3">สัญญา / ลูกค้า</th>
                      <th className="py-1">สาขา</th>
                      <th className="py-1 text-right">ค้าง</th>
                      <th className="py-1">โทร</th>
                      <th className="py-1">สถานะการตาม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chase.need.map((c) => (
                      <tr key={`${c.locat}-${c.contno}`} className="border-t border-slate-800">
                        <td className="py-1 text-right font-semibold tabular-nums text-rose-300">{baht(c.overdueAmt)}</td>
                        <td className="py-1 pl-3">
                          <span className="font-mono text-xs text-slate-500">{c.contno}</span>
                          <span className="ml-2 text-slate-100">{c.customer || "—"}</span>
                          {c.productGroupName && (
                            <span className="ml-2 text-xs text-slate-500">{c.productGroupName}</span>
                          )}
                        </td>
                        <td className="py-1 text-xs text-slate-400">{c.locat}</td>
                        <td className="py-1 text-right tabular-nums text-slate-300">{int(c.overdueCount)} งวด</td>
                        <td className="py-1 whitespace-nowrap text-xs">
                          {c.mobile || c.tel ? (
                            <span className="text-sky-300">{c.mobile || c.tel}</span>
                          ) : (
                            <span className="text-rose-400">ไม่มีเบอร์</span>
                          )}
                        </td>
                        <td className="py-1 text-xs">
                          {c.noteCount === 0 ? (
                            <span className="font-semibold text-rose-400">ไม่เคยตามเลย</span>
                          ) : (
                            <span className="text-amber-400">ตามล่าสุด {int(c.lastNoteDays ?? 0)} วันก่อน</span>
                          )}
                          {c.lastPayDate && (
                            <span className="ml-2 text-slate-500">ชำระล่าสุด {thDate(c.lastPayDate)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ตารางไขว้ — "แยกตามกลุ่มสินค้า แยกสาขา" ในตารางเดียว เลือกแกนได้ทั้งสองด้าน */}
          <div className="mb-4">
            <Pivot data={data} row={pivotRow} col={pivotCol} metric={metric} onRow={setPivotRow} onCol={setPivotCol} />
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
            ประเภทกลุ่มลูกค้าว่างในหลายสัญญา (ทะเบียนลูกค้าไม่ได้กรอกไว้) ·
            กลุ่มสินค้า/ยี่ห้อ/รุ่น มาจากทะเบียนสินค้าที่ผูกกับเลขตัวถังในสัญญา (ตรง 82 จาก 84 สัญญา)
            {data.truncated && " · รายการเกินขีดจำกัด แสดงเฉพาะส่วนแรก"}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * ตารางไขว้สองมิติ — คำนวณจากรายสัญญาที่ API ส่งมาแล้ว (ไม่กี่สิบแถว จึงทำฝั่งนี้ได้)
 * ค่าในช่องเปลี่ยนตามหน่วยที่เลือกด้านบน (ยอดคงเหลือ / ยอดเกินกำหนด / จำนวนสัญญา)
 */
function Pivot({
  data,
  row,
  col,
  metric,
  onRow,
  onCol,
}: {
  data: Debt;
  row: Dim;
  col: Dim;
  metric: Metric;
  onRow: (d: Dim) => void;
  onCol: (d: Dim) => void;
}) {
  const valueOf = (c: Contract) =>
    metric === "contracts" ? 1 : metric === "balance" ? c.balance : c.overdueAmt;

  const cell = new Map<string, number>();
  const rowTotal = new Map<string, number>();
  const colTotal = new Map<string, number>();
  const rowLabel = new Map<string, string>();
  const colLabel = new Map<string, string>();
  let grand = 0;
  for (const c of data.contracts) {
    const r = dimValue(c, row);
    const k = dimValue(c, col);
    const v = valueOf(c);
    rowLabel.set(r.key, r.label ?? r.key);
    colLabel.set(k.key, k.label ?? k.key);
    cell.set(`${r.key}|${k.key}`, (cell.get(`${r.key}|${k.key}`) ?? 0) + v);
    rowTotal.set(r.key, (rowTotal.get(r.key) ?? 0) + v);
    colTotal.set(k.key, (colTotal.get(k.key) ?? 0) + v);
    grand += v;
  }
  const rowKeys = [...rowTotal.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const colKeys = [...colTotal.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const max = Math.max(1, ...[...cell.values()]);

  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold text-slate-200">ตารางไขว้</h2>
        <span className="text-xs text-slate-500">แถว</span>
        <select
          value={row}
          onChange={(e) => onRow(e.target.value as Dim)}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
        >
          {DIM_LIST.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">คอลัมน์</span>
        <select
          value={col}
          onChange={(e) => onCol(e.target.value as Dim)}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
        >
          {DIM_LIST.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          หน่วย: {METRICS.find((m) => m.key === metric)?.label}
        </span>
      </div>
      <div className="max-h-[22rem] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900 text-xs text-slate-400">
            <tr>
              <th className="px-2 py-1 text-left">{DIM_LIST.find((d) => d.key === row)?.label}</th>
              {colKeys.map((k) => (
                <th key={k} className="px-2 py-1 text-right whitespace-nowrap">
                  {colLabel.get(k)}
                </th>
              ))}
              <th className="px-2 py-1 text-right font-semibold text-slate-200">รวม</th>
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((r) => (
              <tr key={r} className="border-t border-slate-800">
                <td className="px-2 py-1 text-slate-100">{rowLabel.get(r)}</td>
                {colKeys.map((k) => {
                  const v = cell.get(`${r}|${k}`) ?? 0;
                  return (
                    <td
                      key={k}
                      className="px-2 py-1 text-right tabular-nums"
                      style={
                        v > 0
                          ? { background: `rgba(56,189,248,${0.08 + (v / max) * 0.35})`, color: "#e2e8f0" }
                          : { color: "#475569" }
                      }
                    >
                      {v > 0 ? fmtMetric(v, metric) : "—"}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-right font-semibold tabular-nums text-slate-100">
                  {fmtMetric(rowTotal.get(r) ?? 0, metric)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-700">
              <td className="px-2 py-1 font-semibold text-slate-200">รวม</td>
              {colKeys.map((k) => (
                <td key={k} className="px-2 py-1 text-right font-semibold tabular-nums text-slate-200">
                  {fmtMetric(colTotal.get(k) ?? 0, metric)}
                </td>
              ))}
              <td className="px-2 py-1 text-right font-bold tabular-nums text-sky-400">{fmtMetric(grand, metric)}</td>
            </tr>
          </tbody>
        </table>
      </div>
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
