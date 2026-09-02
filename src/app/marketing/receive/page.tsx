import Link from "next/link";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht, outstandingAmount } from "@/lib/marketing";
import { listActivities } from "@/lib/marketing-db";
import { FlowBadge } from "@/components/marketing/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ReceiveListPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; all?: string }>;
}) {
  const params = await searchParams;
  const showAll = params.all === "1";

  const rows = await listActivities({
    active_status: "active",
    flow_status: showAll ? undefined : "submitted",
  });
  const list = showAll ? rows.filter((r) => r.flow_status !== "draft") : rows;

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">3. บันทึกรับเงิน</h1>
          <p className="text-sm text-slate-500">
            {showAll
              ? "ใบที่ส่งเบิกแล้วทั้งหมด (รวมที่รับเงินแล้ว)"
              : "ใบที่ส่งเบิกแล้วและยังไม่ได้รับเงิน"}
          </p>
        </div>
        <Link href={showAll ? "/marketing/receive" : "/marketing/receive?all=1"} className="btn-secondary">
          {showAll ? "ดูเฉพาะที่ยังไม่รับเงิน" : "ดูทั้งหมด (แก้ไขใบที่รับเงินแล้ว)"}
        </Link>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <div className="card overflow-x-auto">
        <table className="table-report">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>วันที่จัดกิจกรรม</th>
              <th>ชื่อกิจกรรม</th>
              <th>บริษัท</th>
              <th>วันที่ส่งเบิก</th>
              <th>ควรได้รับ</th>
              <th>ได้รับแล้ว</th>
              <th>คงค้าง</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-6 text-slate-500">
                  ไม่มีใบที่รอรับเงิน
                </td>
              </tr>
            ) : (
              list.map((r) => (
                <tr key={r.id}>
                  <td>{r.doc_no}</td>
                  <td>{formatThaiDate(r.activity_date)}</td>
                  <td className="!text-left">{r.title}</td>
                  <td>{r.company_name ?? "-"}</td>
                  <td>{r.submit_date ? formatThaiDate(r.submit_date) : "-"}</td>
                  <td className="!text-right">
                    {formatBaht(r.approved_amount ?? r.request_amount)}
                  </td>
                  <td className="!text-right">{formatBaht(r.received_amount)}</td>
                  <td className="!text-right">{formatBaht(outstandingAmount(r))}</td>
                  <td>
                    <FlowBadge status={r.flow_status} />
                  </td>
                  <td>
                    <Link
                      href={`/marketing/receive/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.receipt_id ? "แก้ไขการรับเงิน" : "บันทึกรับเงิน"}
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
