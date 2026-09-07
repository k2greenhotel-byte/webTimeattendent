import Link from "next/link";
import { workScope } from "@/app/salework/scope";
import { listBranches } from "@/lib/db";
import { addDays, formatThaiDate, workDateOf } from "@/lib/datetime";
import { listLogs, listWorkOwners } from "@/lib/salework-db";

export const dynamic = "force-dynamic";

/** หน้าจอ 2 — ประวัติการทำงาน ค้นตามช่วงวัน พนักงาน สาขา และสถานะการส่งงาน */
export default async function SaleWorkSearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    owner?: string;
    branch?: string;
    status?: string;
    q?: string;
    msg?: string;
    err?: string;
  }>;
}) {
  const params = await searchParams;
  const scope = await workScope("SW_SEARCH");

  const today = workDateOf();
  const from = params.from || addDays(today, -30);
  const to = params.to || today;
  const status = params.status ?? "";

  const [rows, branches, owners] = await Promise.all([
    listLogs({
      from,
      to,
      owner_id: scope.canSeeAll ? params.owner || null : scope.ownerId,
      branch_id: params.branch || null,
      submitted: status === "submitted" ? true : status === "draft" ? false : undefined,
      keyword: params.q,
    }),
    listBranches(true),
    scope.canSeeAll ? listWorkOwners() : Promise.resolve([]),
  ]);

  const totals = rows.reduce(
    (acc, r) => ({
      done: acc.done + r.done_count,
      items: acc.items + r.item_count,
      media: acc.media + r.media_count,
      submitted: acc.submitted + (r.submitted_at ? 1 : 0),
    }),
    { done: 0, items: 0, media: 0, submitted: 0 },
  );

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">2. ประวัติการทำงาน</h1>
        <p className="text-sm text-slate-500">
          {scope.canSeeAll
            ? "ค้นใบบันทึกงานประจำวันของพนักงานขายทุกคน"
            : "แสดงเฉพาะใบบันทึกงานของคุณเท่านั้น"}
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
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

        {scope.canSeeAll && (
          <div>
            <label className="label" htmlFor="owner">
              พนักงานขาย
            </label>
            <select id="owner" name="owner" defaultValue={params.owner ?? ""} className="input w-full">
              <option value="">ทุกคน</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}

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

        <div>
          <label className="label" htmlFor="status">
            สถานะ
          </label>
          <select id="status" name="status" defaultValue={status} className="input w-full">
            <option value="">ทั้งหมด</option>
            <option value="submitted">ส่งงานแล้ว</option>
            <option value="draft">ยังเป็นร่าง</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <div className="grow">
            <label className="label" htmlFor="q">
              คำค้น
            </label>
            <input
              id="q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="เลขที่ / ชื่อ / หมายเหตุ"
              className="input w-full"
            />
          </div>
          <button type="submit" className="btn-primary">
            ค้นหา
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs text-slate-500">ใบงานทั้งหมด</p>
          <p className="text-lg font-semibold text-slate-800">{rows.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ส่งงานแล้ว</p>
          <p className="text-lg font-semibold text-emerald-700">{totals.submitted}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">งานที่ทำ / งานทั้งหมด</p>
          <p className="text-lg font-semibold text-slate-800">
            {totals.done}/{totals.items}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ไฟล์แนบ</p>
          <p className="text-lg font-semibold text-slate-800">{totals.media}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="card text-sm text-slate-600">ไม่พบใบบันทึกงานตามเงื่อนไขที่เลือก</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">เลขที่</th>
                <th className="px-3 py-2">วันที่</th>
                <th className="px-3 py-2">พนักงานขาย</th>
                <th className="px-3 py-2">สาขา</th>
                <th className="px-3 py-2 text-right">งานที่ทำ</th>
                <th className="px-3 py-2 text-right">ไฟล์แนบ</th>
                <th className="px-3 py-2">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={`/salework/search/${r.id}`} className="font-mono text-brand-700">
                      {r.doc_no}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{formatThaiDate(r.work_date)}</td>
                  <td className="px-3 py-2">{r.owner_full_name ?? r.owner_name}</td>
                  <td className="px-3 py-2 text-slate-500">{r.branch_name ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {r.done_count}/{r.item_count}
                  </td>
                  <td className="px-3 py-2 text-right">{r.media_count}</td>
                  <td className="px-3 py-2">
                    {r.submitted_at ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        ส่งแล้ว
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        ร่าง
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
