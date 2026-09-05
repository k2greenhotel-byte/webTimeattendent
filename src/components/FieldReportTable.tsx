import type { ReactNode } from "react";
import FieldPhotoThumbs from "@/components/FieldPhotoThumbs";
import { FIELD_STATUS_LABEL, type FieldSessionStatus } from "@/lib/attendance";
import { formatDuration, formatThaiDate, formatTime } from "@/lib/datetime";
import type { FieldReportRow } from "@/lib/reports";

const STATUS_CLASS: Record<FieldSessionStatus, string> = {
  planned: "bg-slate-100 text-slate-500",
  in_progress: "bg-sky-50 text-sky-700",
  done: "bg-emerald-50 text-emerald-700",
  missing_end: "bg-rose-50 text-rose-700",
};

/** ตารางงานนอกสถานที่ (1 แถว = คน 1 คนในภารกิจ 1 งาน) ใช้ทั้งหน้าพนักงานและหลังบ้าน */
export default function FieldReportTable({
  rows,
  showEmployee = false,
  showPhotos = true,
  renderActions,
}: {
  rows: FieldReportRow[];
  showEmployee?: boolean;
  showPhotos?: boolean;
  /** คอลัมน์จัดการ (เฉพาะหลังบ้าน) */
  renderActions?: (row: FieldReportRow) => ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">ไม่มีงานนอกสถานที่ในช่วงที่เลือก</p>;
  }

  return (
    <div className="table-wrap">
      <table className="table-report">
        <thead>
          <tr>
            <th>วันที่</th>
            {showEmployee && <th>รหัส</th>}
            {showEmployee && <th>ชื่อ-สกุล</th>}
            <th>ประเภท</th>
            <th>งาน</th>
            <th>สถานที่</th>
            <th>แผน</th>
            <th>เริ่ม</th>
            <th>จบ</th>
            <th>รวม</th>
            <th>นับ ชม.<br />พิเศษ</th>
            <th>สถานะ</th>
            {showPhotos && <th className="no-print">รูปถ่าย</th>}
            {renderActions && <th className="no-print">จัดการ</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const t = r.task;
            const planned =
              t.planned_start || t.planned_end ? `${t.planned_start ?? "?"}–${t.planned_end ?? "?"}` : "-";
            return (
              <tr key={`${t.id}-${r.employeeId}`} className="hover:bg-slate-50">
                <td className="text-left">{formatThaiDate(t.work_date)}</td>
                {showEmployee && <td>{r.empCode}</td>}
                {showEmployee && <td className="text-left">{r.fullName}</td>}
                <td>{t.type_name}</td>
                <td className="text-left">
                  {t.title}
                  {t.is_cancelled && <span className="badge ml-1 bg-rose-50 text-rose-600">ยกเลิก</span>}
                  {t.note && <div className="text-[11px] text-slate-500">{t.note}</div>}
                </td>
                <td className="text-left">{t.site_name ?? t.place_text ?? "-"}</td>
                <td>{planned}</td>
                <td className={r.session.lateStartMinutes > 0 ? "text-rose-600" : ""}>{formatTime(r.startAt)}</td>
                <td>{formatTime(r.endAt)}</td>
                <td>{r.session.minutes > 0 ? formatDuration(r.session.minutes) : "-"}</td>
                <td>{t.counts_hours ? (r.session.countedMinutes > 0 ? formatDuration(r.session.countedMinutes) : "✓") : "ไม่นับ"}</td>
                <td>
                  <span className={`badge ${STATUS_CLASS[r.session.status]}`}>
                    {FIELD_STATUS_LABEL[r.session.status]}
                  </span>
                  {r.hasManual && <span className="badge ml-1 bg-slate-100 text-slate-500">แก้ไข</span>}
                </td>
                {showPhotos && (
                  <td className="no-print">
                    <FieldPhotoThumbs
                      photos={{ start: r.startPhoto, end: r.endPhoto }}
                      caption={`${r.fullName} · ${t.title} · ${formatThaiDate(t.work_date)}`}
                    />
                  </td>
                )}
                {renderActions && <td className="no-print">{renderActions(r)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
