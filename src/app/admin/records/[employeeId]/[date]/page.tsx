import Link from "next/link";
import { notFound } from "next/navigation";
import { computeDaySummary } from "@/lib/attendance";
import { formatDuration, formatThaiDate, formatTime } from "@/lib/datetime";
import { getBranchById, getEmployeeById, getPunchesOfDay, getResolvedSettings } from "@/lib/db";
import { PUNCH_LABEL, PUNCH_ORDER } from "@/lib/types";
import { deletePunchForm, savePunchForm } from "./actions";

export const dynamic = "force-dynamic";

export default async function EditRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string; date: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { employeeId, date } = await params;
  const query = await searchParams;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const [employee, punches] = await Promise.all([
    getEmployeeById(employeeId),
    getPunchesOfDay(employeeId, date),
  ]);

  if (!employee) notFound();

  const branch = await getBranchById(employee.branch_id);
  const settings = await getResolvedSettings(branch?.id ?? null);

  const byType = new Map(punches.map((p) => [p.punch_type, p]));
  const summary = computeDaySummary(
    {
      work_date: date,
      check_in_at: byType.get("check_in")?.punched_at ?? null,
      break_out_at: byType.get("break_out")?.punched_at ?? null,
      break_in_at: byType.get("break_in")?.punched_at ?? null,
      check_out_at: byType.get("check_out")?.punched_at ?? null,
    },
    settings,
  );

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">แก้ไขเวลาย้อนหลัง</h1>
        <p className="text-sm text-slate-500">
          {employee.full_name} ({employee.emp_code})
          {branch ? ` · สาขา ${branch.name}` : ""} · {formatThaiDate(date)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          ชั่วโมงทำงานปัจจุบัน: {formatDuration(summary.workMinutes)} · สาย {summary.lateMinutes} นาที
          {summary.overBreakMinutes > 0 ? ` · พักเกิน ${summary.overBreakMinutes} นาที` : ""}
        </p>
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
        ทุกการแก้ไขจะถูกบันทึกลง audit log และรายการนั้นจะถูกทำเครื่องหมายว่า &quot;แก้ไขย้อนหลัง&quot;
      </p>

      {PUNCH_ORDER.map((type) => {
        const record = byType.get(type);
        return (
          <section key={type} className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">{PUNCH_LABEL[type]}</h2>
              {record?.photo_path ? (
                <a
                  href={`/api/photo?path=${encodeURIComponent(record.photo_path)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand-600 hover:underline"
                >
                  ดูรูปถ่าย
                </a>
              ) : (
                <span className="text-xs text-slate-400">ไม่มีรูป</span>
              )}
            </div>

            <form action={savePunchForm} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="employee_id" value={employeeId} />
              <input type="hidden" name="work_date" value={date} />
              <input type="hidden" name="punch_type" value={type} />
              <input type="hidden" name="record_id" value={record?.id ?? ""} />

              <div>
                <label className="label">เวลา (HH:mm)</label>
                <input
                  name="time"
                  type="time"
                  defaultValue={record ? formatTime(record.punched_at) : ""}
                  className="input w-32"
                  required
                />
              </div>
              <div className="min-w-48 flex-1">
                <label className="label">หมายเหตุ</label>
                <input
                  name="note"
                  defaultValue={record?.note ?? ""}
                  className="input"
                  placeholder="เช่น ลืมลงเวลา / ระบบขัดข้อง"
                />
              </div>
              <button type="submit" className="btn-primary">
                {record ? "บันทึกการแก้ไข" : "เพิ่มรายการ"}
              </button>
            </form>

            {record && (
              <form action={deletePunchForm}>
                <input type="hidden" name="employee_id" value={employeeId} />
                <input type="hidden" name="work_date" value={date} />
                <input type="hidden" name="record_id" value={record.id} />
                <button type="submit" className="text-xs text-rose-600 hover:underline">
                  ลบรายการนี้
                </button>
              </form>
            )}
          </section>
        );
      })}

      <Link href="/admin" className="btn-secondary">
        ← กลับหน้าภาพรวม
      </Link>
    </main>
  );
}
