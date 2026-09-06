import { Db2ApiError, STAT_LABEL, db2Stock, fmtBaht, fmtDate, fmtInt, fmtPct, type Db2Stock } from "@/lib/db2-api";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Db2StockPage({
  searchParams,
}: {
  searchParams: Promise<{ locat?: string; stat?: string }>;
}) {
  await requirePermission("DB2_STOCK");
  const p = await searchParams;
  const locat = (p.locat ?? "").toUpperCase();
  const stat = (p.stat ?? "").toUpperCase();

  let data: Db2Stock | null = null;
  let error: string | null = null;
  try {
    data = await db2Stock({ locat, stat });
  } catch (err) {
    error = err instanceof Db2ApiError ? err.message : "เกิดข้อผิดพลาดที่ไม่คาดคิด";
  }

  const s = data?.summary;
  const total = s?.units ?? 0;

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">สต็อกรถคงเหลือ</h1>
        <p className="text-sm text-slate-500">รถที่ยังไม่ขาย ณ ตอนนี้ · อายุสต็อกนับจากวันรับเข้าถึงวันนี้</p>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-slate-500">คลัง / สาขา</span>
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
      </form>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {data && s && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="คงเหลือ (คัน)" value={fmtInt(s.units)} />
            <Stat label="มูลค่าต้นทุน (บาท)" value={fmtBaht(s.cost)} />
            <Stat label="อายุสต็อกเฉลี่ย" value={s.avgAgeDays === null ? "—" : `${fmtInt(s.avgAgeDays)} วัน`} />
            <Stat label="รับเข้าเก่าสุด" value={fmtDate(s.oldest)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <SimpleTable title="ตามอายุสต็อก" keyLabel="อายุ" rows={data.aging.map((a) => ({ key: a.label, units: a.units, cost: a.cost }))} total={total} />
            <SimpleTable title="ตามสาขา" keyLabel="สาขา" rows={data.byBranch} total={total} />
            <SimpleTable title="ตามรุ่น (12 อันดับ)" keyLabel="รุ่น" rows={data.byModel} total={total} />
          </div>

          <section className="card">
            <h2 className="mb-2 font-semibold text-slate-800">รถค้างสต็อกนานสุด 50 คัน</h2>
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-1">เลขตัวถัง</th>
                    <th className="py-1">รุ่น</th>
                    <th className="py-1">สี</th>
                    <th className="py-1">สาขา</th>
                    <th className="py-1">สภาพ</th>
                    <th className="py-1">รับเข้า</th>
                    <th className="py-1 text-right">อายุ (วัน)</th>
                    <th className="py-1 text-right">ต้นทุน</th>
                  </tr>
                </thead>
                <tbody>
                  {data.oldest.map((o) => (
                    <tr key={o.strno} className="border-t border-slate-100">
                      <td className="py-1 font-mono text-xs">{o.strno}</td>
                      <td className="py-1">{o.model || "—"}</td>
                      <td className="py-1">{o.color || "—"}</td>
                      <td className="py-1">{o.locat || "—"}</td>
                      <td className="py-1">{STAT_LABEL[o.stat] ?? o.stat ?? "—"}</td>
                      <td className="py-1">{fmtDate(o.receivedDate)}</td>
                      <td className={`py-1 text-right tabular-nums ${o.ageDays > 365 ? "text-rose-600" : ""}`}>{fmtInt(o.ageDays)}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBaht(o.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums text-slate-800">{value}</div>
    </div>
  );
}

function SimpleTable({
  title,
  keyLabel,
  rows,
  total,
}: {
  title: string;
  keyLabel: string;
  rows: { key: string; units: number; cost: number }[];
  total: number;
}) {
  return (
    <section className="card">
      <h2 className="mb-2 font-semibold text-slate-800">{title}</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr>
            <th className="py-1">{keyLabel}</th>
            <th className="py-1 text-right">คัน</th>
            <th className="py-1 text-right">สัดส่วน</th>
            <th className="py-1 text-right">ต้นทุน</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-slate-100">
              <td className="py-1">{r.key}</td>
              <td className="py-1 text-right tabular-nums">{fmtInt(r.units)}</td>
              <td className="py-1 text-right tabular-nums">{fmtPct(total ? (r.units / total) * 100 : null)}</td>
              <td className="py-1 text-right tabular-nums">{fmtBaht(r.cost)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-center text-slate-500">
                ไม่มีข้อมูล
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
