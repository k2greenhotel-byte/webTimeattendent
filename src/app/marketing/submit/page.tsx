import Link from "next/link";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/marketing";
import { listActivities } from "@/lib/marketing-db";
import { FlowBadge } from "@/components/marketing/StatusBadge";

export const dynamic = "force-dynamic";

export default async function SubmitListPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; all?: string }>;
}) {
  const params = await searchParams;
  const showAll = params.all === "1";

  const rows = await listActivities(
    showAll ? { active_status: "active" } : { flow_status: "draft", active_status: "active" },
  );

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">2. บันทึกส่งเรื่องเบิกเงิน</h1>
          <p className="text-sm text-slate-500">
            {showAll
              ? "ใบกิจกรรมที่ใช้งานอยู่ทั้งหมด"
              : "ใบกิจกรรมที่ยังอยู่ในขั้น “ทำเรื่องตั้งเบิก” — เลือกใบที่ต้องการบันทึกการส่ง"}
          </p>
        </div>
        <Link href={showAll ? "/marketing/submit" : "/marketing/submit?all=1"} className="btn-secondary">
          {showAll ? "ดูเฉพาะที่ยังไม่ส่งเบิก" : "ดูทั้งหมด (แก้ไขใบที่ส่งแล้ว)"}
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
              <th>ขอเบิก</th>
              <th>อนุมัติ</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-slate-500">
                  ไม่มีใบกิจกรรมที่รอส่งเบิก
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.doc_no}</td>
                  <td>{formatThaiDate(r.activity_date)}</td>
                  <td className="!text-left">{r.title}</td>
                  <td>{r.company_name ?? "-"}</td>
                  <td className="!text-right">{formatBaht(r.request_amount)}</td>
                  <td className="!text-right">{formatBaht(r.approved_amount)}</td>
                  <td>
                    <FlowBadge status={r.flow_status} />
                  </td>
                  <td>
                    <Link
                      href={`/marketing/submit/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.submission_id ? "แก้ไขการส่งเบิก" : "บันทึกส่งเบิก"}
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
