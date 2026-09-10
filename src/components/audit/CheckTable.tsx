import Link from "next/link";
import { formatBaht, rowTone } from "@/lib/audit";
import {
  AUD_CALL_RESULT_LABEL,
  AUD_DOC_RESULT_CLASS,
  AUD_DOC_RESULT_LABEL,
  AUD_INFO_RESULT_CLASS,
  AUD_INFO_RESULT_SHORT,
  AUD_RESULT_CLASS,
  AUD_RESULT_LABEL,
  type AudCheckRow,
} from "@/lib/audit-types";
import { formatThaiDate } from "@/lib/datetime";

/** ตารางผลการตรวจรายเอกสาร — ใช้ทั้งหน้าสอบถาม รายงาน และ dashboard */
export default function CheckTable({
  rows,
  empty = "ไม่พบผลการตรวจตามเงื่อนไขนี้",
}: {
  rows: AudCheckRow[];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="py-6 text-sm text-slate-500">{empty}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="table-report">
        <thead>
          <tr>
            <th className="w-28">วันที่ตรวจ</th>
            <th className="w-36">ใบคุมงาน</th>
            <th>รายการตรวจ</th>
            <th>เลขที่เอกสาร</th>
            <th>รายละเอียด</th>
            <th className="w-24">สาขา</th>
            <th className="w-28 text-right">จำนวนเงิน</th>
            <th className="w-24">ผลตรวจ</th>
            <th className="w-28">เอกสาร</th>
            <th className="w-36">การโทรถาม</th>
            <th>หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={rowTone(r)}>
              <td>{formatThaiDate(r.audit_date)}</td>
              <td>
                <Link href={`/audit/audits/${r.audit_id}`} className="text-brand-700 hover:underline">
                  {r.audit_no}
                </Link>
                <span className="block text-xs text-slate-400">{r.auditor_name}</span>
              </td>
              <td className="text-left">{r.type_name}</td>
              <td className="text-left font-medium">{r.ref_no ?? "—"}</td>
              <td className="text-left">
                {r.title ?? "—"}
                {r.party && <span className="block text-xs text-slate-400">{r.party}</span>}
              </td>
              <td>{r.branch_label ?? r.branch_name ?? "—"}</td>
              <td className="text-right tabular-nums">{formatBaht(r.amount)}</td>
              <td>
                <span className={`badge ${AUD_RESULT_CLASS[r.result]}`}>{AUD_RESULT_LABEL[r.result]}</span>
              </td>
              <td>
                <span className={`badge ${AUD_DOC_RESULT_CLASS[r.doc_result]}`}>
                  {AUD_DOC_RESULT_LABEL[r.doc_result]}
                </span>
                {r.missing_docs.length > 0 && (
                  <span className="block text-xs text-amber-700">ขาด: {r.missing_docs.join(", ")}</span>
                )}
              </td>
              <td>
                {AUD_CALL_RESULT_LABEL[r.call_result]}
                {r.info_result !== "pending" && (
                  <span className={`ml-1 badge ${AUD_INFO_RESULT_CLASS[r.info_result]}`}>
                    {AUD_INFO_RESULT_SHORT[r.info_result]}
                  </span>
                )}
              </td>
              <td className="text-left text-xs text-slate-500">
                {[r.result_note, r.doc_note, r.call_note].filter(Boolean).join(" · ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
