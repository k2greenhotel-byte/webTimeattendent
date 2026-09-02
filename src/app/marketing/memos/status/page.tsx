import Link from "next/link";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { formatPeriod, isPeriodExpired } from "@/lib/marketing";
import { listMemos } from "@/lib/memo-db";
import { MEMO_STATUS_LABEL, MEMO_STATUS_ORDER, type MktMemoStatus } from "@/lib/marketing-types";
import { MemoBadge } from "@/components/marketing/StatusBadge";

export const dynamic = "force-dynamic";

/** หน้าจอ 8 — เลือก Memo ที่ต้องการเปลี่ยนสถานะ แล้วไปที่ฟอร์มบนหน้ารายละเอียด */
export default async function MemoStatusListPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; status?: string; all?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status ?? "") as MktMemoStatus | "";
  const showAll = params.all === "1";
  const today = workDateOf();

  const rows = await listMemos({ active_status: "active", status: status || undefined });
  const list = showAll ? rows : rows.filter((r) => r.status !== "closed");

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">8. บันทึกเปลี่ยนสถานะ Memo</h1>
          <p className="text-sm text-slate-500">
            {showAll ? "Memo ที่ใช้งานอยู่ทั้งหมด" : "Memo ที่ยังไม่จบโครงการ"} — เลือกใบที่ต้องการอัปเดต
          </p>
        </div>
        <Link
          href={showAll ? "/marketing/memos/status" : "/marketing/memos/status?all=1"}
          className="btn-secondary"
        >
          {showAll ? "ดูเฉพาะที่ยังไม่จบโครงการ" : "ดูทั้งหมด"}
        </Link>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form className="card flex flex-wrap items-end gap-3" method="get">
        {showAll && <input type="hidden" name="all" value="1" />}
        <div className="min-w-56">
          <label className="label">กรองตามสถานะ</label>
          <select name="status" defaultValue={status} className="input">
            <option value="">ทั้งหมด</option>
            {MEMO_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {MEMO_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          กรอง
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-report">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>วันที่</th>
              <th>บริษัท</th>
              <th>ระยะเวลา</th>
              <th>สถานะปัจจุบัน</th>
              <th>เปลี่ยนล่าสุด</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-slate-500">
                  ไม่มี Memo ตามเงื่อนไขนี้
                </td>
              </tr>
            ) : (
              list.map((r) => (
                <tr key={r.id}>
                  <td>{r.doc_no}</td>
                  <td>{formatThaiDate(r.memo_date)}</td>
                  <td>{r.company_name ?? "-"}</td>
                  <td>
                    {formatPeriod(r.period_from, r.period_to, formatThaiDate)}
                    {isPeriodExpired(r.period_to, today) && r.status !== "closed" && (
                      <span className="ml-1 text-xs text-rose-600">(เลยกำหนด)</span>
                    )}
                  </td>
                  <td>
                    <MemoBadge status={r.status} />
                  </td>
                  <td>
                    {r.last_status_changed_on ? formatThaiDate(r.last_status_changed_on) : "-"}
                    <span className="ml-1 text-xs text-slate-400">({r.status_log_count} ครั้ง)</span>
                  </td>
                  <td>
                    <Link
                      href={`/marketing/memos/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      เปลี่ยนสถานะ
                    </Link>
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
