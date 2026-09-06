import {
  Db2ApiError,
  STAT_LABEL,
  TSALE_LABEL,
  db2Dashboard,
  fmtBaht,
  fmtInt,
  fmtMonth,
  fmtPct,
  todayTH,
  type Db2Dashboard,
  type Db2Group,
} from "@/lib/db2-api";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function Db2DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; locat?: string; tsale?: string; stat?: string }>;
}) {
  await requirePermission("DB2_DASH");
  const p = await searchParams;
  const today = todayTH();
  const from = DATE_RE.test(p.from ?? "") ? p.from! : `${today.slice(0, 4)}-01-01`;
  const to = DATE_RE.test(p.to ?? "") ? p.to! : today;
  const locat = (p.locat ?? "").toUpperCase();
  const tsale = (p.tsale ?? "").toUpperCase();
  const stat = (p.stat ?? "").toUpperCase();

  let data: Db2Dashboard | null = null;
  let error: string | null = null;
  try {
    data = await db2Dashboard({ from, to, locat, tsale, stat });
  } catch (err) {
    error = err instanceof Db2ApiError ? err.message : "เกิดข้อผิดพลาดที่ไม่คาดคิด";
  }

  const s = data?.summary;

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard ยอดขายสด</h1>
        <p className="text-sm text-slate-500">
          รวมทุกช่องทาง (ผ่อน · สด · ไฟแนนซ์ · ส่งเอเย่นต์) · กำไรขั้นต้น = ราคาขาย − ต้นทุนรถ · ข้อมูล ณ ตอนนี้
        </p>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-slate-500">ตั้งแต่</span>
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
            {(data?.branches ?? (locat ? [locat] : [])).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-slate-500">ประเภทการขาย</span>
          <select name="tsale" defaultValue={tsale} className="input">
            <option value="">ทุกประเภท</option>
            {Object.entries(TSALE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-slate-500">สภาพรถ</span>
          <select name="stat" defaultValue={stat} className="input">
            <option value="">ทั้งหมด</option>
            <option value="N">รถใหม่</option>
            <option value="O">รถเก่า</option>
          </select>
        </label>
        <button type="submit" className="btn-primary">
          แสดงผล
        </button>
        <span className="flex flex-wrap gap-1 text-xs">
          <a className="btn-secondary px-2 py-1" href={`?from=${today.slice(0, 7)}-01&to=${today}`}>
            เดือนนี้
          </a>
          <a className="btn-secondary px-2 py-1" href={`?from=${today.slice(0, 4)}-01-01&to=${today}`}>
            ปีนี้
          </a>
          <a
            className="btn-secondary px-2 py-1"
            href={`?from=${Number(today.slice(0, 4)) - 1}-01-01&to=${Number(today.slice(0, 4)) - 1}-12-31`}
          >
            ปีที่แล้ว
          </a>
        </span>
      </form>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {data && s && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="จำนวนคัน" value={fmtInt(s.units)} />
            <Stat label="ยอดขาย (บาท)" value={fmtBaht(s.sale)} />
            <Stat label="ต้นทุนรถ (บาท)" value={fmtBaht(s.cost)} />
            <Stat label="กำไรขั้นต้น (บาท)" value={fmtBaht(s.profit)} hint={`มาร์จิ้น ${fmtPct(s.marginPct)}`} />
          </div>

          <section className="card">
            <h2 className="mb-2 font-semibold text-slate-800">รายเดือน</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-1">เดือน</th>
                    <th className="py-1 text-right">คัน</th>
                    <th className="py-1 text-right">ยอดขาย</th>
                    <th className="py-1 text-right">ต้นทุน</th>
                    <th className="py-1 text-right">กำไรขั้นต้น</th>
                    <th className="py-1 text-right">มาร์จิ้น</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((m) => (
                    <tr key={`${m.year}-${m.month}`} className="border-t border-slate-100">
                      <td className="py-1">{fmtMonth(m.year, m.month)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtInt(m.units)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBaht(m.sale)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBaht(m.cost)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBaht(m.profit)}</td>
                      <td className="py-1 text-right tabular-nums">
                        {fmtPct(m.sale > 0 ? (m.profit / m.sale) * 100 : null)}
                      </td>
                    </tr>
                  ))}
                  {data.monthly.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-3 text-center text-slate-500">
                        ไม่มีข้อมูลในช่วงที่เลือก
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <GroupTable title="ตามประเภทการขาย" keyLabel="ประเภท" rows={data.byChannel} total={s.units} labelOf={(k) => TSALE_LABEL[k] ?? k} />
            <GroupTable title="ตามสภาพรถ" keyLabel="สภาพ" rows={data.byCondition} total={s.units} labelOf={(k) => STAT_LABEL[k] ?? k} />
          </div>
          <GroupTable title="ตามสาขา" keyLabel="สาขา" rows={data.byBranch} total={s.units} />
          <GroupTable title="10 รุ่นขายดี (ตามจำนวนคัน)" keyLabel="รุ่น" rows={data.byModel} total={s.units} />
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

function GroupTable({
  title,
  keyLabel,
  rows,
  total,
  labelOf,
}: {
  title: string;
  keyLabel: string;
  rows: Db2Group[];
  total: number;
  labelOf?: (k: string) => string;
}) {
  return (
    <section className="card">
      <h2 className="mb-2 font-semibold text-slate-800">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1">{keyLabel}</th>
              <th className="py-1 text-right">คัน</th>
              <th className="py-1 text-right">สัดส่วน</th>
              <th className="py-1 text-right">ยอดขาย</th>
              <th className="py-1 text-right">กำไรขั้นต้น</th>
              <th className="py-1 text-right">มาร์จิ้น</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-slate-100">
                <td className="py-1">
                  {labelOf ? labelOf(r.key) : r.key}
                  {labelOf && labelOf(r.key) !== r.key && <span className="text-slate-400"> ({r.key})</span>}
                </td>
                <td className="py-1 text-right tabular-nums">{fmtInt(r.units)}</td>
                <td className="py-1 text-right tabular-nums">{fmtPct(total ? (r.units / total) * 100 : null)}</td>
                <td className="py-1 text-right tabular-nums">{fmtBaht(r.sale)}</td>
                <td className="py-1 text-right tabular-nums">{fmtBaht(r.profit)}</td>
                <td className="py-1 text-right tabular-nums">{fmtPct(r.sale > 0 ? (r.profit / r.sale) * 100 : null)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-center text-slate-500">
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
