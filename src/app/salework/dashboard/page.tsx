import { workScope } from "@/app/salework/scope";
import { db2Salesmen } from "@/lib/db2-api";
import { listBranches } from "@/lib/db";
import { daysBetween, formatThaiDate, workDateOf } from "@/lib/datetime";
import { attachDb2Sales, buildStaffSummaries, buildTaskSummaries } from "@/lib/salework";
import { listItemStats, listMappings } from "@/lib/salework-db";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("th-TH");

/** เดือนนี้ตั้งแต่วันที่ 1 ถึงวันนี้ */
function defaultRange(): { from: string; to: string } {
  const today = workDateOf();
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

/**
 * หน้าจอ 3 — Dashboard / war room สรุปการทำงานของพนักงานขายแต่ละคน
 *
 * ยอดขายจริงคอลัมน์ขวาสุดดึงสดจากระบบขาย (Db2) ผ่านคู่ที่จับไว้ในเมนู "จับคู่กับระบบขาย"
 * ถ้าเครื่องในบริษัทปิดอยู่ หน้านี้ยังใช้ได้ตามปกติ แค่ไม่มีตัวเลขยอดขาย
 */
export default async function SaleWorkDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branch?: string }>;
}) {
  const params = await searchParams;
  const scope = await workScope("SW_DASH");

  const fallback = defaultRange();
  const from = params.from || fallback.from;
  const to = params.to || fallback.to;
  const span = daysBetween(from, to) + 1;

  const [rows, branches, mappings] = await Promise.all([
    listItemStats({
      from,
      to,
      owner_id: scope.ownerId,
      branch_id: params.branch || null,
    }),
    listBranches(true),
    listMappings(),
  ]);

  const taskSummaries = buildTaskSummaries(rows);
  let staff = buildStaffSummaries(rows);

  // ยอดขายจริงจากระบบขาย — ข้ามไปถ้ายังไม่มีใครจับคู่ หรือช่วงกว้างเกินที่ Db2 รองรับ (400 วัน)
  let db2Error: string | null = null;
  if (mappings.length > 0 && span <= 400) {
    try {
      const salesmen = await db2Salesmen({ from, to });
      staff = attachDb2Sales(
        staff,
        new Map(mappings.map((m) => [m.employee_id, m.db2_salcod])),
        new Map(salesmen.map((s) => [s.salcod, s.units])),
      );
    } catch (err) {
      db2Error = err instanceof Error ? err.message : "ต่อระบบขาย (Db2) ไม่ได้";
    }
  }

  const totals = {
    staff: staff.length,
    done: staff.reduce((n, s) => n + s.doneCount, 0),
    items: staff.reduce((n, s) => n + s.itemCount, 0),
    media: staff.reduce((n, s) => n + s.mediaCount, 0),
    days: staff.reduce((n, s) => n + s.days, 0),
  };
  const showSales = staff.some((s) => s.db2Units !== null && s.db2Units !== undefined);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">3. Dashboard สรุปงานพนักงานขาย</h1>
        <p className="text-sm text-slate-500">
          {formatThaiDate(from)} – {formatThaiDate(to)}
          {scope.canSeeAll ? "" : " · แสดงเฉพาะผลงานของคุณ"}
        </p>
      </div>

      <form className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <div>
          <label className="label" htmlFor="from">
            ตั้งแต่วันที่
          </label>
          <input id="from" name="from" type="date" defaultValue={from} className="input w-full" />
        </div>
        <div>
          <label className="label" htmlFor="to">
            ถึงวันที่
          </label>
          <input id="to" name="to" type="date" defaultValue={to} className="input w-full" />
        </div>
        <div>
          <label className="label" htmlFor="branch">
            สาขา
          </label>
          <select id="branch" name="branch" defaultValue={params.branch ?? ""} className="input w-full">
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full">
            แสดงผล
          </button>
        </div>
      </form>

      {db2Error && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ยอดขายจริงจากระบบขายดึงไม่ได้ตอนนี้ ({db2Error}) — ตัวเลขงานประจำวันด้านล่างยังถูกต้องตามปกติ
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs text-slate-500">พนักงานที่มีผลงาน</p>
          <p className="text-2xl font-bold text-slate-800">{fmt(totals.staff)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">งานที่ทำ / งานทั้งหมด</p>
          <p className="text-2xl font-bold text-slate-800">
            {fmt(totals.done)}
            <span className="text-base font-normal text-slate-400">/{fmt(totals.items)}</span>
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">วัน-คนที่บันทึกงาน</p>
          <p className="text-2xl font-bold text-slate-800">{fmt(totals.days)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">รูป/คลิปที่แนบ</p>
          <p className="text-2xl font-bold text-slate-800">{fmt(totals.media)}</p>
        </div>
      </div>

      {/* กระดานรายคน — จอเล็กเป็นการ์ด จอใหญ่เป็นตาราง */}
      <section className="space-y-2">
        <h2 className="font-semibold text-slate-800">ผลงานรายคน</h2>

        {staff.length === 0 ? (
          <p className="card text-sm text-slate-600">ยังไม่มีใบบันทึกงานในช่วงที่เลือก</p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:hidden">
              {staff.map((s, i) => (
                <div key={s.owner_id ?? s.owner_name} className="card space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-slate-800">
                      <span className="mr-1 text-slate-400">#{i + 1}</span>
                      {s.owner_name}
                    </p>
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                      {s.donePct}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {s.branch_name ?? "—"} · บันทึก {s.days} วัน (ส่งงาน {s.submittedDays} วัน)
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-lg bg-slate-50 px-2 py-1">
                      ทำแล้ว {fmt(s.doneCount)}/{fmt(s.itemCount)}
                    </span>
                    <span className="rounded-lg bg-slate-50 px-2 py-1">แนบ {fmt(s.mediaCount)}</span>
                    {showSales && (
                      <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">
                        ขายจริง {s.db2Units === null || s.db2Units === undefined ? "ยังไม่จับคู่" : `${fmt(s.db2Units)} คัน`}
                      </span>
                    )}
                  </div>
                  {Object.keys(s.qtyByTask).length > 0 && (
                    <p className="text-xs text-slate-500">
                      {Object.entries(s.qtyByTask)
                        .map(([code, qty]) => `${code} ${fmt(qty)}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="card hidden overflow-x-auto p-0 lg:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">พนักงานขาย</th>
                    <th className="px-3 py-2">สาขา</th>
                    <th className="px-3 py-2 text-right">วันที่บันทึก</th>
                    <th className="px-3 py-2 text-right">ส่งงาน</th>
                    <th className="px-3 py-2 text-right">งานที่ทำ</th>
                    <th className="px-3 py-2 text-right">% งานที่ทำ</th>
                    <th className="px-3 py-2 text-right">ไฟล์แนบ</th>
                    {taskSummaries.map((t) => (
                      <th key={t.task_code} className="px-3 py-2 text-right whitespace-nowrap">
                        {t.task_name}
                        {t.metric_unit ? ` (${t.metric_unit})` : ""}
                      </th>
                    ))}
                    {showSales && <th className="px-3 py-2 text-right">ขายจริง (คัน)</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.map((s, i) => (
                    <tr key={s.owner_id ?? s.owner_name} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{s.owner_name}</td>
                      <td className="px-3 py-2 text-slate-500">{s.branch_name ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{fmt(s.days)}</td>
                      <td className="px-3 py-2 text-right">{fmt(s.submittedDays)}</td>
                      <td className="px-3 py-2 text-right">
                        {fmt(s.doneCount)}/{fmt(s.itemCount)}
                      </td>
                      <td className="px-3 py-2 text-right">{s.donePct}%</td>
                      <td className="px-3 py-2 text-right">{fmt(s.mediaCount)}</td>
                      {taskSummaries.map((t) => (
                        <td key={t.task_code} className="px-3 py-2 text-right">
                          {s.qtyByTask[t.task_code] ? fmt(s.qtyByTask[t.task_code]) : "—"}
                        </td>
                      ))}
                      {showSales && (
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                          {s.db2Units === null || s.db2Units === undefined ? "—" : fmt(s.db2Units)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-slate-800">ผลงานรายประเภทงาน</h2>
        {taskSummaries.length === 0 ? (
          <p className="card text-sm text-slate-600">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {taskSummaries.map((t) => (
              <div key={t.task_code} className="card space-y-1">
                <p className="font-medium text-slate-800">{t.task_name}</p>
                <p className="text-2xl font-bold text-brand-700">
                  {fmt(t.qty)}{" "}
                  <span className="text-sm font-normal text-slate-500">{t.metric_unit ?? ""}</span>
                </p>
                <p className="text-xs text-slate-500">
                  ทำแล้ว {fmt(t.doneCount)} ครั้ง จาก {fmt(t.itemCount)} ครั้งที่ควรทำ · พนักงาน{" "}
                  {fmt(t.staffCount)} คน
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
