import Link from "next/link";
import { StatusBadge } from "@/components/hotel/StatusBadges";
import { formatThaiDate } from "@/lib/datetime";
import type { HtlRoundRow } from "@/lib/hotel-types";

/** ตารางใบตรวจเช็คประจำวัน — ใช้ร่วมกันทั้งหน้าบันทึก หน้าสอบถาม และ dashboard */
export default function RoundTable({
  rows,
  empty = "ยังไม่มีใบตรวจเช็คตามเงื่อนไขนี้",
  showRoom = false,
}: {
  rows: HtlRoundRow[];
  empty?: string;
  /** true = โชว์คอลัมน์ห้องพัก (หน้ารายการงานห้องพัก และหน้าสอบถามที่ปนกันสองงาน) */
  showRoom?: boolean;
}) {
  if (rows.length === 0) return <p className="py-6 text-sm text-slate-500">{empty}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="table-report">
        <thead>
          <tr>
            <th className="w-36">เลขที่</th>
            <th className="w-32">วันที่ตรวจเช็ค</th>
            <th>สาขา / โรงแรม</th>
            {showRoom && <th className="w-28">ห้องพัก</th>}
            <th>ผู้ตรวจเช็ค</th>
            <th className="w-28 text-right">ตรวจแล้ว</th>
            <th className="w-24 text-right">ปกติ</th>
            <th className="w-28 text-right">ไม่ปกติ</th>
            <th className="w-32 text-right">ค้างแก้ไข</th>
            <th className="w-24">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link
                  href={`/hotel/rounds/${r.id}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {r.doc_no}
                </Link>
              </td>
              <td>{formatThaiDate(r.check_date)}</td>
              <td>
                <span className="font-medium text-slate-700">{r.branch_name ?? "—"}</span>
                {r.company_name && (
                  <span className="block text-xs text-slate-400">{r.company_name}</span>
                )}
              </td>
              {showRoom && (
                <td>
                  {r.room_code ? (
                    <span className="badge bg-violet-100 text-violet-700">ห้อง {r.room_code}</span>
                  ) : (
                    <span className="text-xs text-slate-400">ทั้งอาคาร</span>
                  )}
                </td>
              )}
              <td>{r.inspector_name ?? "—"}</td>
              <td className="text-right tabular-nums">
                {r.checked_count}
                <span className="text-slate-400"> / {r.total_items}</span>
              </td>
              <td className="text-right tabular-nums text-emerald-600">{r.pass_count}</td>
              <td className="text-right tabular-nums">
                <span className={r.fail_count > 0 ? "text-rose-600" : "text-slate-400"}>
                  {r.fail_count}
                </span>
                {r.urgent_count > 0 && (
                  <span className="block text-xs text-rose-500">เร่งด่วน {r.urgent_count}</span>
                )}
              </td>
              <td className="text-right tabular-nums">
                {r.open_fix_count > 0 ? (
                  <span className="text-amber-600">{r.open_fix_count} ข้อ</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
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
