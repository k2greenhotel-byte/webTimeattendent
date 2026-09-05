import Link from "next/link";
import PhotoThumbs from "@/components/PhotoThumbs";
import { formatDuration, formatThaiDate, formatTime } from "@/lib/datetime";
import type { ReportRow } from "@/lib/reports";
import { DAY_STATUS_LABEL, type DayStatus } from "@/lib/types";

const STATUS_CLASS: Record<DayStatus, string> = {
  complete: "bg-emerald-50 text-emerald-700",
  incomplete: "bg-amber-50 text-amber-700",
  absent: "bg-rose-50 text-rose-700",
  holiday: "bg-slate-100 text-slate-500",
  off: "bg-sky-50 text-sky-600",
};

export default function ReportTable({
  rows,
  showEmployee = false,
  showPhotos = true,
  editBase,
}: {
  rows: ReportRow[];
  showEmployee?: boolean;
  showPhotos?: boolean;
  /** ใส่ "/admin/records" เพื่อแสดงปุ่มแก้ไข (เฉพาะแอดมิน) */
  editBase?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">ไม่พบข้อมูลในช่วงที่เลือก</p>;
  }

  return (
    <div className="table-wrap">
      <table className="table-report">
        <thead>
          <tr>
            <th>วันที่</th>
            {showEmployee && <th>รหัส</th>}
            {showEmployee && <th>ชื่อ-สกุล</th>}
            {showEmployee && <th>สาขา</th>}
            <th>กะ</th>
            <th>เข้าเช้า</th>
            <th>ออกพัก</th>
            <th>เข้าบ่าย</th>
            <th>เลิกงาน</th>
            <th>สาย<br />(นาที)</th>
            <th>กลับก่อน<br />(นาที)</th>
            <th>พัก<br />(นาที)</th>
            <th>ชั่วโมงทำงาน</th>
            <th>OT<br />(นาที)</th>
            <th>สถานะ</th>
            {showPhotos && <th className="no-print">รูปถ่าย</th>}
            {editBase && <th className="no-print">จัดการ</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const s = row.summary;
            return (
              <tr key={`${row.employeeId}-${s.workDate}`} className="hover:bg-slate-50">
                <td className="text-left">{formatThaiDate(s.workDate)}</td>
                {showEmployee && <td>{row.empCode}</td>}
                {showEmployee && <td className="text-left">{row.fullName}</td>}
                {showEmployee && (
                  <td>
                    {row.branchName ?? "-"}
                    {row.siteName && <div className="text-[11px] text-violet-700">📍 {row.siteName}</div>}
                  </td>
                )}
                <td className="text-xs text-slate-600">
                  {row.scheduleName}
                  {!showEmployee && row.siteName && (
                    <div className="text-[11px] text-violet-700">📍 {row.siteName}</div>
                  )}
                </td>
                <td className={s.lateMinutes > 0 ? "text-rose-600" : ""}>{formatTime(s.checkInAt)}</td>
                <td>{formatTime(s.breakOutAt)}</td>
                <td>{formatTime(s.breakInAt)}</td>
                <td className={s.earlyLeaveMinutes > 0 ? "text-rose-600" : ""}>
                  {formatTime(s.checkOutAt)}
                </td>
                <td>{s.lateMinutes || "-"}</td>
                <td>{s.earlyLeaveMinutes || "-"}</td>
                <td className={s.overBreakMinutes > 0 ? "text-amber-600" : ""}>
                  {s.breakMinutes || "-"}
                </td>
                <td>{s.workMinutes > 0 ? formatDuration(s.workMinutes) : "-"}</td>
                <td>{s.otMinutes || "-"}</td>
                <td>
                  <span className={`badge ${STATUS_CLASS[s.status]}`}>
                    {DAY_STATUS_LABEL[s.status]}
                  </span>
                  {row.hasManual && (
                    <span className="badge ml-1 bg-slate-100 text-slate-500">แก้ไข</span>
                  )}
                </td>
                {showPhotos && (
                  <td className="no-print">
                    <PhotoThumbs
                      photos={row.photos}
                      caption={`${row.fullName} · ${formatThaiDate(s.workDate)}`}
                    />
                  </td>
                )}
                {editBase && (
                  <td className="no-print">
                    <Link
                      href={`${editBase}/${row.employeeId}/${s.workDate}`}
                      className="text-brand-600 hover:underline"
                    >
                      แก้ไข
                    </Link>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
