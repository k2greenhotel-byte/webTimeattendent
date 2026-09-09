import Link from "next/link";
import { GradeBadge, StatusBadge } from "@/components/inspection/StatusBadges";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht, formatScore } from "@/lib/inspection";
import type { InspectionRow } from "@/lib/inspection-types";

/** ตารางรายการใบตรวจ — ใช้ร่วมกันทั้งหน้าบันทึก หน้าสอบถาม และ dashboard */
export default function InspectionTable({
  rows,
  empty = "ยังไม่มีใบตรวจตามเงื่อนไขนี้",
}: {
  rows: InspectionRow[];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="py-6 text-sm text-slate-500">{empty}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="table-report">
        <thead>
          <tr>
            <th className="w-36">เลขที่</th>
            <th className="w-28">วันที่ตรวจ</th>
            <th>สาขา</th>
            <th>แบบฟอร์ม</th>
            <th className="w-32 text-right">คะแนน</th>
            <th className="w-40">ผลการตรวจ</th>
            <th className="w-28 text-right">ค่าปรับ</th>
            <th className="w-28 text-right">เงินรางวัล</th>
            <th className="w-24">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link
                  href={`/inspection/inspections/${r.id}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {r.doc_no}
                </Link>
              </td>
              <td>{formatThaiDate(r.inspect_date)}</td>
              <td>
                <span className="font-medium text-slate-700">{r.branch_name ?? "—"}</span>
                {r.company_name && (
                  <span className="block text-xs text-slate-400">{r.company_name}</span>
                )}
              </td>
              <td>
                {r.template_name}
                {r.inspector_name && (
                  <span className="block text-xs text-slate-400">ผู้ตรวจ {r.inspector_name}</span>
                )}
              </td>
              <td className="text-right tabular-nums">
                {formatScore(r.total_score)}
                <span className="text-slate-400"> / {formatScore(r.max_score)}</span>
                {r.fail_count > 0 && (
                  <span className="block text-xs text-rose-500">ไม่ผ่าน {r.fail_count} ข้อ</span>
                )}
              </td>
              <td>
                {r.status === "submitted" ? (
                  <GradeBadge scorePct={r.score_pct} />
                ) : (
                  <span className="text-xs text-slate-400">ยังไม่ส่งผล</span>
                )}
              </td>
              <td className="text-right tabular-nums text-rose-600">
                {r.total_fine > 0 ? formatBaht(r.total_fine) : "—"}
              </td>
              <td className="text-right tabular-nums text-emerald-600">
                {r.bonus_amount > 0 ? formatBaht(r.bonus_amount) : "—"}
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
