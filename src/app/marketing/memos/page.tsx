import Link from "next/link";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { formatPeriod, isPeriodExpired, summarizeMemos } from "@/lib/marketing";
import { listMaster } from "@/lib/marketing-db";
import { listMemos } from "@/lib/memo-db";
import {
  MEMO_STATUS_LABEL,
  MEMO_STATUS_ORDER,
  type MktMemoStatus,
} from "@/lib/marketing-types";
import { ActiveBadge, MemoBadge } from "@/components/marketing/StatusBadge";

export const dynamic = "force-dynamic";

export default async function MemosPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; status?: string; company_id?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status ?? "") as MktMemoStatus | "";
  const today = workDateOf();

  const [rows, companies] = await Promise.all([
    listMemos({ status: status || undefined, company_id: params.company_id || undefined }),
    listMaster("company"),
  ]);
  const totals = summarizeMemos(rows);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">7. บันทึก Memo</h1>
          <p className="text-sm text-slate-500">
            ข้อตกลง/โครงการกับบริษัทรถ พร้อมไฟล์แนบและช่วงเวลา · {rows.length} รายการ
          </p>
        </div>
        <Link href="/marketing/memos/new" className="btn-primary">
          + เพิ่ม Memo ใหม่
        </Link>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {MEMO_STATUS_ORDER.map((s) => (
          <Link key={s} href={`/marketing/memos?status=${s}`} className="card hover:border-brand-300">
            <p className="text-xs text-slate-500">{MEMO_STATUS_LABEL[s]}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{totals.byStatus[s]}</p>
          </Link>
        ))}
      </div>

      <form className="card flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-56">
          <label className="label">สถานะ</label>
          <select name="status" defaultValue={status} className="input">
            <option value="">ทั้งหมด</option>
            {MEMO_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {MEMO_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-56">
          <label className="label">บริษัทที่ขอเบิก</label>
          <select name="company_id" defaultValue={params.company_id ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          กรอง
        </button>
        <Link href="/marketing/memos" className="btn-secondary">
          ล้าง
        </Link>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-report">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>วันที่</th>
              <th>บริษัท</th>
              <th>รายละเอียด</th>
              <th>ระยะเวลา</th>
              <th>ผู้บันทึก</th>
              <th>ไฟล์</th>
              <th>สถานะ</th>
              <th>เอกสาร</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-slate-500">
                  ยังไม่มี Memo ตามเงื่อนไขนี้
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={r.active_status === "cancelled" ? "text-slate-400" : ""}>
                  <td>
                    <Link
                      href={`/marketing/memos/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.doc_no}
                    </Link>
                  </td>
                  <td>{formatThaiDate(r.memo_date)}</td>
                  <td>{r.company_name ?? "-"}</td>
                  <td className="!text-left">
                    <span className="line-clamp-2 max-w-md">{r.detail ?? "-"}</span>
                  </td>
                  <td>
                    {formatPeriod(r.period_from, r.period_to, formatThaiDate)}
                    {isPeriodExpired(r.period_to, today) && r.status !== "closed" && (
                      <span className="ml-1 text-xs text-rose-600">(เลยกำหนด)</span>
                    )}
                  </td>
                  <td>{r.created_by_name ?? "-"}</td>
                  <td>{r.file_count > 0 ? `📎 ${r.file_count}` : "-"}</td>
                  <td>
                    <MemoBadge status={r.status} />
                  </td>
                  <td>
                    <ActiveBadge status={r.active_status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
