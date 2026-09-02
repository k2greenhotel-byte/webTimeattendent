import Link from "next/link";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht, summarize } from "@/lib/marketing";
import { listActivities, listMaster } from "@/lib/marketing-db";
import { FLOW_STATUS_LABEL, type MktFlowStatus } from "@/lib/marketing-types";
import { ActiveBadge, FlowBadge } from "@/components/marketing/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; flow_status?: string; company_id?: string }>;
}) {
  const params = await searchParams;
  const flowStatus = (params.flow_status ?? "") as MktFlowStatus | "";

  const [rows, companies] = await Promise.all([
    listActivities({
      flow_status: flowStatus || undefined,
      company_id: params.company_id || undefined,
    }),
    listMaster("company"),
  ]);
  const totals = summarize(rows);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">1. บันทึกงานกิจกรรม</h1>
          <p className="text-sm text-slate-500">รายการใบกิจกรรมทั้งหมด · {rows.length} รายการ</p>
        </div>
        <Link href="/marketing/activities/new" className="btn-primary">
          + เพิ่มกิจกรรมใหม่
        </Link>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form className="card flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-48">
          <label className="label">สถานะการเบิก</label>
          <select name="flow_status" defaultValue={flowStatus} className="input">
            <option value="">ทั้งหมด</option>
            {(Object.keys(FLOW_STATUS_LABEL) as MktFlowStatus[]).map((s) => (
              <option key={s} value={s}>
                {FLOW_STATUS_LABEL[s]}
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
      </form>

      <div className="card overflow-x-auto">
        <table className="table-report">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>วันที่</th>
              <th>ชื่อกิจกรรม</th>
              <th>ประเภท</th>
              <th>บริษัท</th>
              <th>ผู้จัดทำ</th>
              <th>ขอเบิก</th>
              <th>อนุมัติ</th>
              <th>ได้รับ</th>
              <th>รูป</th>
              <th>สถานะการเบิก</th>
              <th>เอกสาร</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-6 text-slate-500">
                  ยังไม่มีข้อมูลตามเงื่อนไขนี้
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={r.active_status === "cancelled" ? "text-slate-400" : ""}>
                  <td>
                    <Link
                      href={`/marketing/activities/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.doc_no}
                    </Link>
                  </td>
                  <td>{formatThaiDate(r.activity_date)}</td>
                  <td className="!text-left">{r.title}</td>
                  <td>{r.activity_type_name ?? "-"}</td>
                  <td>{r.company_name ?? "-"}</td>
                  <td>{r.created_by_name ?? "-"}</td>
                  <td className="!text-right">{formatBaht(r.request_amount)}</td>
                  <td className="!text-right">{formatBaht(r.approved_amount)}</td>
                  <td className="!text-right">
                    {r.receipt_status === "cancelled" ? "-" : formatBaht(r.received_amount)}
                  </td>
                  <td>{r.letter_photo_path || r.ack_photo_path ? "📎" : ""}</td>
                  <td>
                    <FlowBadge status={r.flow_status} />
                  </td>
                  <td>
                    <ActiveBadge status={r.active_status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={6}>รวม (ไม่นับใบที่ยกเลิก)</td>
                <td className="!text-right">{formatBaht(totals.request)}</td>
                <td className="!text-right">{formatBaht(totals.approved)}</td>
                <td className="!text-right">{formatBaht(totals.received)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </main>
  );
}
