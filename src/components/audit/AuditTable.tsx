import Link from "next/link";
import { AUD_STATUS_CLASS, AUD_STATUS_LABEL, type AudAuditRow } from "@/lib/audit-types";
import { formatThaiDate } from "@/lib/datetime";

/** ตารางใบคุมงาน — ใช้ร่วมกันทั้งหน้าบันทึก หน้าสอบถาม และ dashboard */
export default function AuditTable({
  rows,
  empty = "ยังไม่มีใบคุมงานตามเงื่อนไขนี้",
}: {
  rows: AudAuditRow[];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="py-6 text-sm text-slate-500">{empty}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="table-report">
        <thead>
          <tr>
            <th className="w-40">เลขที่คุมงาน</th>
            <th className="w-28">วันที่ทำงาน</th>
            <th>ผู้ตรวจสอบ</th>
            <th>สาขา / บริษัท</th>
            <th className="w-24 text-right">รายการที่ตรวจ</th>
            <th className="w-20 text-right">ไม่ถูกต้อง</th>
            <th className="w-20 text-right">เอกสารไม่ครบ</th>
            <th className="w-20 text-right">ข้อมูลไม่ตรง</th>
            <th className="w-24">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.wrong_count > 0 ? "bg-rose-50" : undefined}>
              <td>
                <Link href={`/audit/audits/${r.id}`} className="font-medium text-brand-700 hover:underline">
                  {r.doc_no}
                </Link>
              </td>
              <td>{formatThaiDate(r.audit_date)}</td>
              <td className="text-left">{r.auditor_name}</td>
              <td className="text-left">
                <span className="font-medium text-slate-700">{r.branch_name ?? "— ทุกสาขา —"}</span>
                {r.company_name && <span className="block text-xs text-slate-400">{r.company_name}</span>}
              </td>
              <td className="text-right tabular-nums">
                {r.check_count}
                {r.pending_count > 0 && (
                  <span className="block text-xs text-amber-600">ค้าง {r.pending_count}</span>
                )}
              </td>
              <td className="text-right tabular-nums text-rose-600">{r.wrong_count || "—"}</td>
              <td className="text-right tabular-nums text-amber-600">{r.incomplete_count || "—"}</td>
              <td className="text-right tabular-nums text-rose-600">{r.mismatch_count || "—"}</td>
              <td>
                <span className={`badge ${AUD_STATUS_CLASS[r.status]}`}>{AUD_STATUS_LABEL[r.status]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
