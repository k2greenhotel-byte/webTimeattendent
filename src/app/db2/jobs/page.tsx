import Link from "next/link";
import {
  Db2ApiError,
  db2Jobs,
  fmtBaht,
  fmtDate,
  fmtInt,
  fmtMonth,
  fmtPct,
  todayTH,
  type Db2JobItem,
  type Db2Jobs,
} from "@/lib/db2-api";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** ป้ายสถานะงานในระบบซ่อม (SWSTATUS) — ค่าที่ยืนยันจากข้อมูลจริงเท่านั้น */
const SW_LABEL: Record<string, string> = { F: "ปิดงานแล้ว", R: "กำลังซ่อม", W: "รอ" };

export default async function Db2JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; locat?: string; reptype?: string; repcod?: string }>;
}) {
  await requirePermission("DB2_JOBS");
  const p = await searchParams;
  const today = todayTH();
  const from = DATE_RE.test(p.from ?? "") ? p.from! : `${today.slice(0, 7)}-01`;
  const to = DATE_RE.test(p.to ?? "") ? p.to! : today;
  const locat = (p.locat ?? "").toUpperCase();
  const reptype = (p.reptype ?? "").toUpperCase();
  const repcod = (p.repcod ?? "").toUpperCase();

  let data: Db2Jobs | null = null;
  let error: string | null = null;
  try {
    data = await db2Jobs({ from, to, locat, reptype, repcod });
  } catch (err) {
    error =
      err instanceof Db2ApiError && err.status === 404
        ? "แอป Db2 ในบริษัทยังไม่มีเอนด์พอยต์ /api/jobs — ต้องอัปเดตแอป Db2 บนเซิร์ฟเวอร์ก่อน (ดู D:\\claude code\\DB2\\_deploy-jobs)"
        : err instanceof Db2ApiError
          ? err.message
          : "เกิดข้อผิดพลาดที่ไม่คาดคิด";
  }

  const k = data?.kpi;
  const keep = (extra: Record<string, string>) => {
    const qs = new URLSearchParams({ from, to, locat, reptype, repcod, ...extra });
    for (const [key, v] of [...qs.entries()]) if (!v) qs.delete(key);
    return `?${qs}`;
  };

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard งานซ่อม</h1>
          <p className="text-sm text-slate-500">
            ใบงานซ่อมจากระบบเดิม แยกตามสาขาและช่างซ่อม · รายได้ก่อน VAT = อะไหล่ + น้ำมัน + ค่าแรง + งานนอก + งานสี ·
            กำไรขั้นต้น = รายได้ก่อน VAT − ต้นทุนอะไหล่และน้ำมัน · ไม่รวมใบที่ยกเลิก
          </p>
        </div>
        <Link href="/db2/jobs/wall" className="btn-secondary shrink-0">
          เปิดจอ War Room →
        </Link>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-slate-500">วันรับรถ ตั้งแต่</span>
          <input type="date" name="from" defaultValue={from} className="input" />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-slate-500">ถึง</span>
          <input type="date" name="to" defaultValue={to} className="input" />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-slate-500">สาขา</span>
          <select name="locat" defaultValue={locat} className="input">
            <option value="">ทุกสาขา</option>
            {(data?.branches ?? (locat ? [{ key: locat, label: null }] : [])).map((b) => (
              <option key={b.key} value={b.key}>
                {b.label ? `${b.label} (${b.key})` : b.key}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-slate-500">ประเภทงานซ่อม</span>
          <select name="reptype" defaultValue={reptype} className="input">
            <option value="">ทุกประเภท</option>
            {(data?.repTypes ?? []).map((t) => (
              <option key={t.key} value={t.key}>
                {t.label || t.key}
              </option>
            ))}
          </select>
        </label>
        {repcod && <input type="hidden" name="repcod" value={repcod} />}
        <button type="submit" className="btn-primary">
          แสดงผล
        </button>
        <span className="flex flex-wrap gap-1 text-xs">
          <a className="btn-secondary px-2 py-1" href={`?from=${today}&to=${today}`}>
            วันนี้
          </a>
          <a className="btn-secondary px-2 py-1" href={`?from=${today.slice(0, 7)}-01&to=${today}`}>
            เดือนนี้
          </a>
          <a className="btn-secondary px-2 py-1" href={`?from=${today.slice(0, 4)}-01-01&to=${today}`}>
            ปีนี้
          </a>
        </span>
        {repcod && (
          <a className="text-xs text-brand-600 underline" href={keep({ repcod: "" })}>
            ล้างตัวกรองช่าง {repcod}
          </a>
        )}
      </form>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {data && k && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat
              label="ใบงานซ่อม"
              value={fmtInt(k.jobs)}
              hint={`วันนี้ ${fmtInt(data.today_kpi.jobs)} ใบ · ${data.compare.prev.label} ${fmtInt(data.compare.prev.kpi.jobs)} ใบ`}
            />
            <Stat label="รายได้ก่อน VAT (บาท)" value={fmtBaht(k.net)} hint={`รวม VAT ${fmtBaht(k.gross)}`} />
            <Stat label="ค่าแรงล้วน (บาท)" value={fmtBaht(k.labour)} hint={`${fmtPct(k.net > 0 ? (k.labour / k.net) * 100 : null)} ของรายได้`} />
            <Stat label="ต้นทุนอะไหล่+น้ำมัน (บาท)" value={fmtBaht(k.cost)} />
            <Stat
              label="กำไรขั้นต้น (บาท)"
              value={fmtBaht(k.profit)}
              hint={`มาร์จิ้น ${fmtPct(k.net > 0 ? (k.profit / k.net) * 100 : null)} · เฉลี่ย ${k.jobs ? fmtBaht(k.net / k.jobs) : "—"} บาท/ใบ`}
            />
          </div>

          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            ในช่วงนี้ปิดงานไปแล้ว {fmtInt(data.quality.finished)} ใบ · เสร็จภายในวันเดียว{" "}
            {fmtPct(data.quality.sameDayPct)} · เฉลี่ย{" "}
            {data.quality.leadDaysAvg === null ? "—" : data.quality.leadDaysAvg.toFixed(1)} วันต่อใบ
            {data.quality.noTax > 0 && <> · ยังไม่มีวันที่ใบกำกับภาษี {fmtInt(data.quality.noTax)} ใบ</>}
            {k.open > 0 && <> · ในจำนวนนี้ยังไม่ปิด job {fmtInt(k.open)} ใบ</>}
          </p>

          {/* งานค้างปิด job — ยอดสะสมทั้งฐาน ไม่ขึ้นกับช่วงวันที่ด้านบน */}
          <section className="card border-amber-200 bg-amber-50/40">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-slate-800">
                งานซ่อมที่ค้างปิด job — {fmtInt(data.open.totals.jobs)} ใบ
                {locat ? ` (สาขา ${locat})` : " (ทุกสาขา)"}
              </h2>
              <span className="text-xs text-slate-500">
                นับทั้งฐานข้อมูล ไม่ขึ้นกับช่วงวันที่ที่เลือก · เงินที่ลงไว้แล้วในใบเหล่านี้ {fmtBaht(data.open.totals.net)} บาท
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              <AgeBox label="ค้าง ≤ 7 วัน" value={data.open.totals.age.d7} tone="ok" />
              <AgeBox label="8–30 วัน" value={data.open.totals.age.d30} tone="ok" />
              <AgeBox label="31–90 วัน" value={data.open.totals.age.d90} tone="warn" />
              <AgeBox label="91–365 วัน" value={data.open.totals.age.d365} tone="warn" />
              <AgeBox label="เกิน 1 ปี" value={data.open.totals.age.over} tone="bad" />
            </div>

            <h3 className="mt-4 mb-1 text-sm font-semibold text-slate-700">แยกตามสาขา</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-1">สาขา</th>
                    <th className="py-1 text-right">ใบค้าง</th>
                    <th className="py-1 text-right">เกิน 1 ปี</th>
                    <th className="py-1">ใบเก่าสุดรับเมื่อ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.open.byBranch.map((b) => (
                    <tr key={b.key} className="border-t border-amber-100">
                      <td className="py-1">
                        {b.label ?? b.key} <span className="text-slate-400">({b.key})</span>
                      </td>
                      <td className="py-1 text-right tabular-nums font-semibold">{fmtInt(b.jobs)}</td>
                      <td className="py-1 text-right tabular-nums text-rose-700">{fmtInt(b.overYear)}</td>
                      <td className="py-1">{fmtDate(b.oldest)}</td>
                    </tr>
                  ))}
                  {data.open.byBranch.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-slate-500">
                        ไม่มีงานค้างปิด
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h3 className="mt-4 mb-1 text-sm font-semibold text-slate-700">
              รายการค้างนานที่สุด {fmtInt(Math.min(data.open.list.length, data.open.listLimit))} ใบแรก
              {data.open.totals.jobs > data.open.list.length && (
                <span className="ml-1 font-normal text-slate-500">
                  (จากทั้งหมด {fmtInt(data.open.totals.jobs)} ใบ — เลือกสาขาเพื่อดูให้ครบ)
                </span>
              )}
            </h3>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-amber-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-1">เลขที่ใบงาน</th>
                    <th className="py-1">สาขา</th>
                    <th className="py-1">รับรถ</th>
                    <th className="py-1 text-right">ค้าง (วัน)</th>
                    <th className="py-1">สถานะ</th>
                    <th className="py-1">ช่าง</th>
                    <th className="py-1">ประเภทงาน</th>
                    <th className="py-1">รถ / ทะเบียน</th>
                    <th className="py-1">ลูกค้า</th>
                    <th className="py-1">โทร</th>
                    <th className="py-1 text-right">เงินในใบ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.open.list.map((j) => (
                    <tr key={j.jobno} className="border-t border-amber-100 align-top">
                      <td className="py-1 font-mono text-xs">{j.jobno}</td>
                      <td className="py-1">{j.branch ?? j.locat}</td>
                      <td className="py-1 whitespace-nowrap">{fmtDate(j.recvDate)}</td>
                      <td
                        className={`py-1 text-right tabular-nums ${j.ageDays > 365 ? "font-semibold text-rose-700" : j.ageDays > 30 ? "text-amber-700" : ""}`}
                      >
                        {fmtInt(j.ageDays)}
                      </td>
                      <td className="py-1">{SW_LABEL[j.swstatus] ?? (j.swstatus || "—")}</td>
                      <td className="py-1">{j.repName ?? (j.repcod || "—")}</td>
                      <td className="py-1">{j.reptypeName ?? j.reptype}</td>
                      <td className="py-1">
                        {j.modelName ?? j.model}
                        {j.regno && <span className="block text-xs text-slate-500">{j.regno}</span>}
                      </td>
                      <td className="py-1">{j.customer || "—"}</td>
                      <td className="py-1 whitespace-nowrap">{j.mobile || j.tel || "—"}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBaht(j.net)}</td>
                    </tr>
                  ))}
                  {data.open.list.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-3 text-center text-slate-500">
                        ไม่มีงานค้างปิด
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2 className="mb-2 font-semibold text-slate-800">รายเดือน 13 เดือนล่าสุด</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-1">เดือน</th>
                    <th className="py-1 text-right">ใบงาน</th>
                    <th className="py-1 text-right">รายได้ก่อน VAT</th>
                    <th className="py-1 text-right">ค่าแรง</th>
                    <th className="py-1 text-right">รวม VAT</th>
                    <th className="py-1 text-right">ต้นทุน</th>
                    <th className="py-1 text-right">กำไรขั้นต้น</th>
                    <th className="py-1 text-right">มาร์จิ้น</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((m) => (
                    <tr key={`${m.year}-${m.month}`} className="border-t border-slate-100">
                      <td className="py-1">{fmtMonth(m.year, m.month)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtInt(m.jobs)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBaht(m.net)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBaht(m.labour)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBaht(m.gross)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBaht(m.cost)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBaht(m.profit)}</td>
                      <td className="py-1 text-right tabular-nums">
                        {fmtPct(m.net > 0 ? (m.profit / m.net) * 100 : null)}
                      </td>
                    </tr>
                  ))}
                  {data.monthly.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-3 text-center text-slate-500">
                        ไม่มีข้อมูล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <DimTable title="ตามสาขา" keyLabel="สาขา" rows={data.dims.branch.items} totalJobs={k.jobs} />
          <DimTable
            title="ตามช่างซ่อม (ผู้รับผิดชอบในใบงาน)"
            keyLabel="ช่าง"
            rows={data.dims.tech.items}
            totalJobs={k.jobs}
            linkTo={(key) => keep({ repcod: key })}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <DimTable title="ตามประเภทงานซ่อม" keyLabel="ประเภท" rows={data.dims.reptype.items} totalJobs={k.jobs} compact />
            <DimTable title="ตามผู้รับรถ (คนเปิดใบงาน)" keyLabel="ผู้รับรถ" rows={data.dims.receiver.items.slice(0, 15)} totalJobs={k.jobs} compact />
          </div>
          <DimTable title="15 รุ่นรถที่เข้าซ่อมมากที่สุด" keyLabel="รุ่น" rows={data.dims.model.items.slice(0, 15)} totalJobs={k.jobs} />

          <p className="text-xs text-slate-400">
            ข้อมูล ณ {new Date(data.generatedAt).toLocaleString("th-TH")} · ช่วง {fmtDate(data.range.from)} –{" "}
            {fmtDate(data.range.to)} ({data.range.days} วัน)
            {data.truncated && " · ช่วงกว้างเกิน แสดงเฉพาะ 20,000 ใบแรก"}
          </p>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums text-slate-800">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function AgeBox({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "bad" }) {
  const color =
    tone === "bad" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : "text-slate-700";
  return (
    <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${color}`}>{fmtInt(value)}</div>
    </div>
  );
}

function DimTable({
  title,
  keyLabel,
  rows,
  totalJobs,
  compact,
  linkTo,
}: {
  title: string;
  keyLabel: string;
  rows: Db2JobItem[];
  totalJobs: number;
  compact?: boolean;
  linkTo?: (key: string) => string;
}) {
  return (
    <section className="card">
      <h2 className="mb-2 font-semibold text-slate-800">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1">{keyLabel}</th>
              <th className="py-1 text-right">ใบงาน</th>
              <th className="py-1 text-right">สัดส่วน</th>
              <th className="py-1 text-right">รายได้ก่อน VAT</th>
              <th className="py-1 text-right">ค่าแรง</th>
              {!compact && <th className="py-1 text-right">ต้นทุน</th>}
              <th className="py-1 text-right">กำไรขั้นต้น</th>
              {!compact && <th className="py-1 text-right">เฉลี่ย/ใบ</th>}
              <th className="py-1 text-right">ค้างปิด</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-slate-100">
                <td className="py-1">
                  {linkTo ? (
                    <a className="text-brand-600 hover:underline" href={linkTo(r.key)}>
                      {r.label ?? r.key}
                    </a>
                  ) : (
                    (r.label ?? r.key)
                  )}
                  {r.label && <span className="text-slate-400"> ({r.key})</span>}
                </td>
                <td className="py-1 text-right tabular-nums">{fmtInt(r.jobs)}</td>
                <td className="py-1 text-right tabular-nums">{fmtPct(totalJobs ? (r.jobs / totalJobs) * 100 : null)}</td>
                <td className="py-1 text-right tabular-nums">{fmtBaht(r.net)}</td>
                <td className="py-1 text-right tabular-nums">{fmtBaht(r.labour)}</td>
                {!compact && <td className="py-1 text-right tabular-nums">{fmtBaht(r.cost)}</td>}
                <td className="py-1 text-right tabular-nums">{fmtBaht(r.profit)}</td>
                {!compact && (
                  <td className="py-1 text-right tabular-nums">{r.jobs ? fmtBaht(r.net / r.jobs) : "—"}</td>
                )}
                <td className={`py-1 text-right tabular-nums ${r.open > 0 ? "text-amber-700" : "text-slate-400"}`}>
                  {fmtInt(r.open)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={compact ? 7 : 9} className="py-3 text-center text-slate-500">
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
