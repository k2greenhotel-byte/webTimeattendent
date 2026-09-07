"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * ส่วน "ลูกหนี้" บนจอ war room — ข้อมูลสดจาก /api/db2/receivables
 *
 * 1. ลูกหนี้บริษัทไฟแนนซ์ (ARFINC): ค้างดาวน์ = TOTDWN − PAYDWN · ค้างไฟแนนซ์ = TOTFIN − PAYFIN
 *    สรุปตามบริษัท + รายสัญญา (ลูกค้า พนักงานขาย วันค้างนับจากวันขาย เพราะไม่มีวันครบกำหนดในตาราง)
 * 2. ลูกหนี้ขายเครดิต (ARCRED): ค้าง = TKANG − SMPAY · รายสัญญาพร้อมวันครบกำหนด/เกินกำหนด
 */

type FinContract = {
  locat: string;
  contno: string;
  saleDate: string | null;
  cuscod: string;
  customer: string;
  salcod: string;
  salesman: string | null;
  fincod: string;
  finance: string | null;
  totalDown: number;
  paidDown: number;
  downOutstanding: number;
  totalFin: number;
  paidFin: number;
  finOutstanding: number;
  lastPayDate: string | null;
  lastPayAmount: number | null;
  daysSinceSale: number;
};
type CredContract = {
  locat: string;
  contno: string;
  saleDate: string | null;
  dueDate: string | null;
  lastPayDate: string | null;
  cuscod: string;
  customer: string;
  salcod: string;
  salesman: string | null;
  total: number;
  paid: number;
  paidCash: number;
  paidCheque: number;
  outstanding: number;
  daysSinceSale: number;
  daysOverdue: number | null;
};
type Recv = {
  generatedAt: string;
  finance: {
    totals: { contracts: number; downOutstanding: number; finOutstanding: number; overpaid: number; truncated: boolean };
    byCompany: { key: string; label: string | null; contracts: number; downOutstanding: number; finOutstanding: number; overpaid: number }[];
    contracts: FinContract[];
  };
  credit: {
    totals: { contracts: number; outstanding: number; pastDue: number; overpaid: number; truncated: boolean };
    contracts: CredContract[];
  };
};

const REFRESH_MS = 120_000;
const PREVIEW = 8;
const baht = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("th-TH", { maximumFractionDigits: 0 }));
const int = (n: number) => Math.round(n).toLocaleString("th-TH");
const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_M[m - 1]} ${String(y + 543).slice(-2)}`;
};
const dayColor = (d: number | null) => (d === null ? "text-slate-400" : d > 90 ? "text-rose-400" : d > 30 ? "text-amber-400" : "text-slate-200");

export default function ReceivablesPanel({ locat }: { locat: string }) {
  const [data, setData] = useState<Recv | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllFin, setShowAllFin] = useState(false);
  const [showAllCred, setShowAllCred] = useState(false);
  const [finSort, setFinSort] = useState<"days" | "amount">("days");

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (locat) qs.set("locat", locat);
      const res = await fetch(`/api/db2/receivables?${qs}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [locat]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  if (error) return <p className="rounded-xl border border-rose-800 bg-rose-950 px-4 py-3 text-rose-200">ลูกหนี้: {error}</p>;
  if (!data) return <p className="text-slate-400">กำลังโหลดลูกหนี้…</p>;

  const f = data.finance;
  const c = data.credit;
  const finSorted = [...f.contracts].sort((a, b) =>
    finSort === "days" ? b.daysSinceSale - a.daysSinceSale : b.finOutstanding + b.downOutstanding - (a.finOutstanding + a.downOutstanding),
  );
  const finRows = showAllFin ? finSorted : finSorted.slice(0, PREVIEW);
  const credSorted = [...c.contracts].sort((a, b) => (b.daysOverdue ?? -1) - (a.daysOverdue ?? -1));
  const credRows = showAllCred ? credSorted : credSorted.slice(0, PREVIEW);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-xl font-semibold text-white">ลูกหนี้ค้างชำระ</h2>
        <span className="text-sm text-slate-400">ยอด ณ ตอนนี้ ไม่ขึ้นกับช่วงเวลาที่เลือกด้านบน{locat ? ` · สาขา ${locat}` : ""}</span>
      </div>

      {/* KPI */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="ไฟแนนซ์ค้างโอน" value={baht(f.totals.finOutstanding)} sub={`${int(f.totals.contracts)} สัญญา${f.totals.overpaid ? ` · จ่ายเกิน ${f.totals.overpaid}` : ""}`} tone="sky" />
        <Kpi label="ลูกค้าค้างเงินดาวน์ (ขายไฟแนนซ์)" value={baht(f.totals.downOutstanding)} sub={`${int(f.contracts.filter((x) => x.downOutstanding > 0).length)} สัญญา`} tone="amber" />
        <Kpi label="ขายเครดิตค้างชำระ" value={baht(c.totals.outstanding)} sub={`${int(c.totals.contracts)} สัญญา · เลยกำหนด ${int(c.totals.pastDue)}`} tone="rose" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ตามบริษัทไฟแนนซ์ */}
        <div className="rounded-2xl bg-slate-900 p-4">
          <h3 className="mb-2 font-semibold text-slate-200">ค้างตามบริษัทไฟแนนซ์</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1">บริษัท</th>
                <th className="py-1 text-right">สัญญา</th>
                <th className="py-1 text-right">ค้างไฟแนนซ์</th>
                <th className="py-1 text-right">ค้างดาวน์</th>
              </tr>
            </thead>
            <tbody>
              {f.byCompany.map((x) => (
                <tr key={x.key} className="border-t border-slate-800">
                  <td className="py-1 pr-2">
                    <span className="text-slate-100">{x.label ?? x.key}</span>
                    {x.label && <span className="ml-1 text-xs text-slate-500">{x.key}</span>}
                  </td>
                  <td className="py-1 text-right tabular-nums">{int(x.contracts)}</td>
                  <td className="py-1 text-right tabular-nums text-sky-300">{baht(x.finOutstanding)}</td>
                  <td className="py-1 text-right tabular-nums text-amber-300">{x.downOutstanding ? baht(x.downOutstanding) : "·"}</td>
                </tr>
              ))}
              {f.byCompany.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-2 text-slate-500">ไม่มียอดค้าง</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-700 font-semibold">
                <td className="py-1">รวม</td>
                <td className="py-1 text-right tabular-nums">{int(f.totals.contracts)}</td>
                <td className="py-1 text-right tabular-nums text-sky-300">{baht(f.totals.finOutstanding)}</td>
                <td className="py-1 text-right tabular-nums text-amber-300">{baht(f.totals.downOutstanding)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* รายสัญญาไฟแนนซ์ */}
        <div className="rounded-2xl bg-slate-900 p-4 lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-200">รายสัญญาขายไฟแนนซ์ที่ค้าง</h3>
            <span className="text-xs text-slate-500">วันค้างนับจากวันขาย (ระบบไม่มีวันครบกำหนด)</span>
            <div className="ml-auto flex rounded-lg bg-slate-800 p-0.5 text-xs">
              {(
                [
                  ["days", "ค้างนานสุด"],
                  ["amount", "ยอดมากสุด"],
                ] as const
              ).map(([k, v]) => (
                <button key={k} onClick={() => setFinSort(k)} className={`rounded-md px-2 py-0.5 ${finSort === k ? "bg-sky-500 text-white" : "text-slate-300"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1">เลขสัญญา</th>
                  <th className="py-1">ลูกค้า</th>
                  <th className="py-1">พนักงานขาย</th>
                  <th className="py-1">ไฟแนนซ์</th>
                  <th className="py-1">วันขาย</th>
                  <th className="py-1 text-right">ค้างดาวน์</th>
                  <th className="py-1 text-right">ค้างไฟแนนซ์</th>
                  <th className="py-1 text-right">ค้าง (วัน)</th>
                  <th className="py-1">รับล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {finRows.map((x) => (
                  <tr key={`${x.locat}/${x.contno}`} className="border-t border-slate-800">
                    <td className="py-1 font-mono text-xs">
                      {x.contno}
                      <span className="ml-1 text-slate-500">{x.locat}</span>
                    </td>
                    <td className="py-1 max-w-[16rem] truncate">{x.customer || x.cuscod}</td>
                    <td className="py-1 max-w-[10rem] truncate">{x.salesman ?? x.salcod}</td>
                    <td className="py-1 max-w-[12rem] truncate" title={x.finance ?? x.fincod}>{x.finance ?? x.fincod}</td>
                    <td className="py-1 whitespace-nowrap">{thDate(x.saleDate)}</td>
                    <td className="py-1 text-right tabular-nums text-amber-300">{x.downOutstanding ? baht(x.downOutstanding) : "·"}</td>
                    <td className="py-1 text-right tabular-nums text-sky-300">{x.finOutstanding ? baht(x.finOutstanding) : "·"}</td>
                    <td className={`py-1 text-right font-semibold tabular-nums ${dayColor(x.daysSinceSale)}`}>{int(x.daysSinceSale)}</td>
                    <td className="py-1 whitespace-nowrap text-slate-400">{x.lastPayDate ? `${thDate(x.lastPayDate)} · ${baht(x.lastPayAmount)}` : "—"}</td>
                  </tr>
                ))}
                {f.contracts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-2 text-slate-500">ไม่มีสัญญาค้าง</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {f.contracts.length > PREVIEW && (
            <button onClick={() => setShowAllFin((v) => !v)} className="mt-2 text-xs text-sky-400 hover:underline">
              {showAllFin ? "แสดงเฉพาะรายการแรก" : `แสดงทั้งหมด ${int(f.contracts.length)} สัญญา`}
            </button>
          )}
        </div>
      </div>

      {/* ขายเครดิต */}
      <div className="rounded-2xl bg-slate-900 p-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          <h3 className="font-semibold text-slate-200">รายสัญญาขายเครดิตที่ค้างชำระ</h3>
          <span className="text-xs text-slate-500">ค้าง = ยอดค้างชำระ (TKANG) − ชำระแล้ว (เงินสด SMPAY + เช็ค SMCHQ) · เกินกำหนดนับจากวันครบกำหนด</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1">เลขสัญญา</th>
                <th className="py-1">ลูกค้า</th>
                <th className="py-1">พนักงานขาย</th>
                <th className="py-1">วันขาย</th>
                <th className="py-1">ครบกำหนด</th>
                <th className="py-1 text-right">ยอดค้าง</th>
                <th className="py-1 text-right">ชำระแล้ว (สด+เช็ค)</th>
                <th className="py-1 text-right">คงค้าง</th>
                <th className="py-1 text-right">เกินกำหนด (วัน)</th>
                <th className="py-1">ชำระล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {credRows.map((x) => (
                <tr key={`${x.locat}/${x.contno}`} className="border-t border-slate-800">
                  <td className="py-1 font-mono text-xs">
                    {x.contno}
                    <span className="ml-1 text-slate-500">{x.locat}</span>
                  </td>
                  <td className="py-1 max-w-[16rem] truncate">{x.customer || x.cuscod}</td>
                  <td className="py-1 max-w-[10rem] truncate">{x.salesman ?? x.salcod}</td>
                  <td className="py-1 whitespace-nowrap">{thDate(x.saleDate)}</td>
                  <td className="py-1 whitespace-nowrap">{thDate(x.dueDate)}</td>
                  <td className="py-1 text-right tabular-nums">{baht(x.total)}</td>
                  <td className="py-1 text-right tabular-nums text-slate-400" title={`เงินสด ${baht(x.paidCash)} · เช็ค ${baht(x.paidCheque)}`}>
                    {baht(x.paid)}
                    {x.paidCheque > 0 && <span className="ml-1 text-[10px] text-slate-500">เช็ค {baht(x.paidCheque)}</span>}
                  </td>
                  <td className="py-1 text-right font-semibold tabular-nums text-rose-300">{baht(x.outstanding)}</td>
                  <td className={`py-1 text-right font-semibold tabular-nums ${dayColor(x.daysOverdue)}`}>{x.daysOverdue === null ? "—" : int(x.daysOverdue)}</td>
                  <td className="py-1 whitespace-nowrap text-slate-400">{thDate(x.lastPayDate)}</td>
                </tr>
              ))}
              {c.contracts.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-2 text-slate-500">ไม่มีสัญญาค้าง</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {c.contracts.length > PREVIEW && (
          <button onClick={() => setShowAllCred((v) => !v)} className="mt-2 text-xs text-sky-400 hover:underline">
            {showAllCred ? "แสดงเฉพาะรายการแรก" : `แสดงทั้งหมด ${int(c.contracts.length)} สัญญา`}
          </button>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "sky" | "amber" | "rose" }) {
  const color = tone === "sky" ? "text-sky-400" : tone === "amber" ? "text-amber-400" : "text-rose-400";
  return (
    <div className="rounded-2xl bg-slate-900 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
