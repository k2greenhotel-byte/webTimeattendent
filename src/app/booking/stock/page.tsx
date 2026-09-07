import Link from "next/link";
import { listBookings } from "@/lib/booking-db";
import {
  comboIndex,
  matchStockWithBookings,
  summarizeMatches,
  unitBookingOf,
  type BookingForMatch,
  type StockLocation,
} from "@/lib/booking-stock";
import { Db2ApiError, db2StockList, fmtDate, fmtInt, STAT_LABEL } from "@/lib/db2-api";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const FILTER_FIELDS = [
  { key: "brand", label: "ยี่ห้อ" },
  { key: "model", label: "รุ่น" },
  { key: "variant", label: "แบบ" },
  { key: "color", label: "สี" },
  { key: "branch", label: "สถานที่เก็บ" },
] as const;

/**
 * กางดูว่ารถของกลุ่มนี้เก็บอยู่สาขาไหนบ้าง
 * ใช้ <details> ล้วน ๆ ไม่ต้องพึ่ง JavaScript — กดได้ทั้งบนมือถือและ PC และพิมพ์ออกมาก็ยังอ่านได้
 */
function LocationBreakdown({
  locations,
  compact = false,
}: {
  locations: StockLocation[];
  compact?: boolean;
}) {
  if (locations.length === 0) {
    return <span className="text-xs text-slate-300">— ไม่มีรถในสต็อก —</span>;
  }

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs text-brand-600 hover:underline">
        <span className="group-open:hidden">
          ▸ ดูที่เก็บ ({locations.length} สาขา)
        </span>
        <span className="hidden group-open:inline">▾ ซ่อนที่เก็บ</span>
      </summary>
      <ul className={`mt-1 space-y-0.5 ${compact ? "" : "ml-3"}`}>
        {locations.map((l) => (
          <li key={l.locat} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-600">{l.locat}</span>
            <span className="font-medium text-slate-800">{l.units} คัน</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** ป้ายบอกสถานะการจองของกลุ่ม รุ่น+แบบ+สี */
function BookedBadge({ booked, units }: { booked: number; units: number }) {
  if (booked === 0) {
    return <span className="badge bg-emerald-100 text-emerald-700">ว่าง</span>;
  }
  if (booked >= units) {
    return <span className="badge bg-rose-100 text-rose-700">ติดจองครบ {booked} ใบ</span>;
  }
  return <span className="badge bg-amber-100 text-amber-700">ติดจอง {booked} ใบ</span>;
}

/**
 * หน้าจอ 1.5 — สอบถามสต๊อกรถจากระบบขาย (Db2) พร้อมบอกว่าติดจองหรือยัง
 *
 * ข้อมูลรถเป็นของสด ณ เวลาที่เปิดดู · **ไม่มีราคาทุนในหน้านี้** (ตั้งใจ — เปิดให้พนักงานขายทุกคนดู)
 * การจับคู่กับใบจองทำในระดับ รุ่น + แบบ + สี เพราะตอนรับจองยังไม่ได้เลือกคันไหน
 */
export default async function BookingStockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("BOOK_STOCK", "read");
  const params = await searchParams;

  const filter = {
    brand: params.brand ?? "",
    model: params.model ?? "",
    variant: params.variant ?? "",
    color: params.color ?? "",
    branch: params.branch ?? "",
    q: (params.q ?? "").trim(),
  };

  let stock: Awaited<ReturnType<typeof db2StockList>> | null = null;
  let error: string | null = null;
  try {
    stock = await db2StockList({ ...filter, limit: 500 });
  } catch (err) {
    error = err instanceof Db2ApiError ? err.message : "อ่านข้อมูลสต็อกไม่สำเร็จ";
  }

  // ใบจองที่ยังรออยู่เท่านั้น (ปิดงาน/ยกเลิกแล้วไม่กันรถ)
  const bookings = (await listBookings({ doc_status: "active", limit: 1000 })) as BookingForMatch[];

  const matches = stock ? matchStockWithBookings(stock.combos, bookings) : [];
  const totals = summarizeMatches(matches);
  const index = comboIndex(matches);

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div className="no-print">
        <h1 className="text-xl font-bold text-slate-800">1.5 สอบถามสต๊อกรถ</h1>
        <p className="text-sm text-slate-500">
          รถคงเหลือจากระบบขาย ณ เวลาที่เปิดดู · จับคู่กับใบจองในระดับ รุ่น + แบบ + สี
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error} — ลองใหม่อีกครั้ง หรือตรวจว่าเครื่องในบริษัทเปิดอยู่
        </p>
      )}

      {/* ---------- เงื่อนไขค้นหา ---------- */}
      <form method="get" className="card no-print space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {FILTER_FIELDS.map((f) => {
            const values = stock?.dims?.[f.key]?.values ?? [];
            return (
              <div key={f.key}>
                <label className="label" htmlFor={f.key}>
                  {f.label}
                </label>
                <select id={f.key} name={f.key} defaultValue={filter[f.key]} className="input">
                  <option value="">ทั้งหมด</option>
                  {values.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label === v.key ? v.label : `${v.key} · ${v.label}`} ({v.units})
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          <div>
            <label className="label" htmlFor="q">
              คำค้น
            </label>
            <input
              id="q"
              name="q"
              defaultValue={filter.q}
              className="input"
              placeholder="เลขตัวถัง / รุ่น / แบบ / สี"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary w-full sm:w-auto">
            ค้นหา
          </button>
          <Link href="/booking/stock" className="text-sm text-slate-500 hover:underline">
            ล้างเงื่อนไขทั้งหมด
          </Link>
        </div>
      </form>

      {/* ---------- ยอดรวม ---------- */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">รถในสต็อก</p>
          <p className="text-xl font-bold text-slate-800">{fmtInt(stock?.total ?? 0)} คัน</p>
          <p className="text-[11px] text-slate-400">{totals.combos} กลุ่ม รุ่น/แบบ/สี</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-emerald-50 p-3">
          <p className="text-xs text-slate-500">ยังว่าง (ขายได้)</p>
          <p className="text-xl font-bold text-emerald-700">{fmtInt(totals.free)} คัน</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-amber-50 p-3">
          <p className="text-xs text-slate-500">ติดจองแล้ว</p>
          <p className="text-xl font-bold text-amber-700">{fmtInt(totals.booked)} ใบ</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-rose-50 p-3">
          <p className="text-xs text-slate-500">จองเกินของที่มี</p>
          <p className="text-xl font-bold text-rose-700">{fmtInt(totals.shortage)} ใบ</p>
          <p className="text-[11px] text-slate-400">ต้องสั่งรถเพิ่ม</p>
        </div>
      </section>

      {/* ---------- สรุปติดจองรายกลุ่ม ---------- */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-semibold text-slate-800">สรุปตามรุ่น + แบบ + สี</h2>
          <p className="text-sm text-slate-500">กลุ่มที่จองเกินของที่มีอยู่บนสุด</p>
        </div>

        {matches.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่พบรถที่ตรงกับเงื่อนไข</p>
        ) : (
          <>
            {/* มือถือ: การ์ด */}
            <ul className="space-y-2 md:hidden">
              {matches.map((m) => (
                <li key={m.key} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-medium text-slate-800">{m.model}</p>
                    <BookedBadge booked={m.booked} units={m.units} />
                  </div>
                  <p className="text-xs text-slate-500">
                    แบบ {m.variant || "—"}
                    {m.variantName && m.variantName !== m.variant ? ` (${m.variantName})` : ""} · สี{" "}
                    {m.color || "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    ในสต็อก {m.units} คัน · ติดจอง {m.booked} ใบ · เหลือ {m.free} คัน
                    {m.shortage > 0 ? ` · ขาด ${m.shortage} คัน` : ""}
                  </p>
                  {m.bookings.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      ใบจอง: {m.bookings.map((b) => b.doc_no).join(", ")}
                    </p>
                  )}
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <LocationBreakdown locations={m.locations} compact />
                  </div>
                </li>
              ))}
            </ul>

            {/* แท็บเล็ต/PC: ตาราง */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table-report">
                <thead>
                  <tr>
                    <th className="text-left">รุ่น</th>
                    <th className="text-left">แบบ</th>
                    <th className="text-left">สี</th>
                    <th>ในสต็อก</th>
                    <th>ติดจอง</th>
                    <th>เหลือขายได้</th>
                    <th>ขาด</th>
                    <th>สถานะ</th>
                    <th className="text-left">ที่เก็บ</th>
                    <th className="text-left">เลขที่ใบจอง</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.key}>
                      <td className="text-left font-medium">{m.model}</td>
                      <td className="whitespace-normal text-left text-xs">
                        {m.variant || "—"}
                        {m.variantName && m.variantName !== m.variant && (
                          <div className="text-[11px] text-slate-400">{m.variantName}</div>
                        )}
                      </td>
                      <td className="text-left text-xs">{m.color || "—"}</td>
                      <td>{m.units}</td>
                      <td className={m.booked > 0 ? "font-medium text-amber-700" : "text-slate-300"}>
                        {m.booked}
                      </td>
                      <td className={m.free > 0 ? "font-medium text-emerald-700" : "text-slate-300"}>
                        {m.free}
                      </td>
                      <td className={m.shortage > 0 ? "font-medium text-rose-700" : "text-slate-300"}>
                        {m.shortage || "—"}
                      </td>
                      <td>
                        <BookedBadge booked={m.booked} units={m.units} />
                      </td>
                      <td className="whitespace-normal text-left">
                        <LocationBreakdown locations={m.locations} />
                      </td>
                      <td className="whitespace-normal text-left text-xs">
                        {m.bookings.length === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          m.bookings.map((b, i) => (
                            <span key={b.id}>
                              {i > 0 && ", "}
                              <Link
                                href={`/booking/bookings/${b.id}`}
                                className="text-brand-600 hover:underline"
                              >
                                {b.doc_no}
                              </Link>
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ---------- รายคัน ---------- */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-semibold text-slate-800">รายคัน ({stock?.count ?? 0} คัน)</h2>
          {stock?.truncated && (
            <p className="text-sm text-amber-600">
              แสดง {stock.count} จาก {stock.total} คัน — เลือกเงื่อนไขให้แคบลงเพื่อดูครบ
            </p>
          )}
        </div>

        {!stock || stock.units.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่พบรถที่ตรงกับเงื่อนไข</p>
        ) : (
          <>
            {/* มือถือ: การ์ด */}
            <ul className="space-y-2 md:hidden">
              {stock.units.map((u) => {
                const b = unitBookingOf(u, index);
                return (
                  <li key={u.strno} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 text-sm font-medium text-slate-800">{u.modelName}</p>
                      <BookedBadge booked={b.booked} units={b.units} />
                    </div>
                    <p className="text-xs text-slate-500">
                      แบบ {u.variant || "—"} · สี {u.color || "—"}
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                      <div>
                        <dt className="text-slate-400">เลขตัวถัง</dt>
                        <dd className="break-all">{u.strno || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">สถานที่เก็บ</dt>
                        <dd>{u.locat || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">รับเข้า</dt>
                        <dd>{fmtDate(u.receivedDate)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">อายุสต็อก</dt>
                        <dd>{u.ageDays === null ? "—" : `${fmtInt(u.ageDays)} วัน`}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>

            {/* แท็บเล็ต/PC: ตาราง */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table-report">
                <thead>
                  <tr>
                    <th className="text-left">เลขตัวถัง</th>
                    <th>ยี่ห้อ</th>
                    <th className="text-left">รุ่น</th>
                    <th className="text-left">แบบ</th>
                    <th className="text-left">สี</th>
                    <th>สถานที่เก็บ</th>
                    <th>สภาพ</th>
                    <th>รับเข้า</th>
                    <th>อายุ (วัน)</th>
                    <th>ติดจอง</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.units.map((u) => {
                    const b = unitBookingOf(u, index);
                    return (
                      <tr key={u.strno}>
                        <td className="text-left text-xs">{u.strno || "—"}</td>
                        <td className="text-xs">{u.brand || "—"}</td>
                        <td className="text-left text-xs">{u.modelName}</td>
                        <td className="text-left text-xs">{u.variant || "—"}</td>
                        <td className="text-left text-xs">{u.color || "—"}</td>
                        <td className="text-xs">{u.locat || "—"}</td>
                        <td className="text-xs">{STAT_LABEL[u.stat] ?? u.stat}</td>
                        <td className="text-xs">{fmtDate(u.receivedDate)}</td>
                        <td className="text-xs">{u.ageDays === null ? "—" : fmtInt(u.ageDays)}</td>
                        <td>
                          <BookedBadge booked={b.booked} units={b.units} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="text-[11px] text-slate-400">
          หน้านี้ไม่แสดงราคาทุนโดยตั้งใจ · “ติดจอง” เป็นสถานะของกลุ่ม รุ่น+แบบ+สี ไม่ใช่ของคันใดคันหนึ่ง
          เพราะตอนรับจองลูกค้ายังไม่ได้เลือกเลขตัวถัง
        </p>
      </section>
    </main>
  );
}
