import Link from "next/link";
import { computeFieldSession, FIELD_STATUS_LABEL } from "@/lib/attendance";
import { formatDuration, formatThaiDate, formatTime, workDateOf } from "@/lib/datetime";
import type { FieldTask } from "@/lib/types";

/**
 * การ์ด "งานนอกสถานที่วันนี้" บนหน้าลงเวลา
 * แสดงภารกิจที่ตัวเองเป็นสมาชิก พร้อมปุ่มเริ่ม/จบ และปุ่มสร้างงานเองสำหรับงานฉุกเฉิน
 */
export default function FieldTaskCard({
  tasks,
  employeeId,
}: {
  tasks: FieldTask[];
  employeeId: string;
}) {
  const today = workDateOf();

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800">งานนอกสถานที่</p>
          <p className="text-xs text-slate-500">ออกบูธ ส่งรถ หรืองานพิเศษนอกเวลา — กดเริ่มและจบงานพร้อมถ่ายรูป</p>
        </div>
        <Link href="/punch/field/new" className="btn-secondary whitespace-nowrap text-sm">
          + เริ่มงานเอง
        </Link>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500">วันนี้ไม่มีงานนอกสถานที่ที่มอบหมายให้คุณ</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const me = task.members.find((m) => m.employee_id === employeeId);
            const session = computeFieldSession({
              workDate: task.work_date,
              startAt: me?.start?.punched_at,
              endAt: me?.end?.punched_at,
              plannedStart: task.planned_start,
              countsHours: task.counts_hours,
            });
            const place = task.site_name ?? task.place_text ?? "-";
            const planned =
              task.planned_start || task.planned_end
                ? `${task.planned_start ?? "?"} – ${task.planned_end ?? "?"}`
                : "";

            return (
              <li
                key={task.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3 ${
                  session.status === "in_progress" ? "border-brand-500 bg-brand-50/40" : "border-slate-200"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">
                    <span className="badge mr-1 bg-violet-100 text-violet-800">{task.type_name}</span>
                    {task.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    📍 {place}
                    {planned ? ` · ${planned}` : ""}
                    {task.work_date !== today ? ` · งานของ${formatThaiDate(task.work_date)}` : ""}
                    {!task.counts_hours ? " · ไม่นับชั่วโมง" : ""}
                  </p>
                  <p className="text-xs text-slate-600">
                    {me?.start ? `เริ่ม ${formatTime(me.start.punched_at)}` : ""}
                    {me?.end ? ` · จบ ${formatTime(me.end.punched_at)}` : ""}
                    {session.status === "done" ? ` · รวม ${formatDuration(session.minutes)}` : ""}
                  </p>
                </div>

                {session.status === "planned" && (
                  <Link href={`/punch/capture?task=${task.id}&type=start`} className="btn-primary min-h-11">
                    เริ่มงาน
                  </Link>
                )}
                {(session.status === "in_progress" || session.status === "missing_end") && (
                  <Link href={`/punch/capture?task=${task.id}&type=end`} className="btn-primary min-h-11">
                    จบงาน
                  </Link>
                )}
                {session.status === "done" && (
                  <span className="badge bg-emerald-50 text-emerald-700">{FIELD_STATUS_LABEL.done}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
