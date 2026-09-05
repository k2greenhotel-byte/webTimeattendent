import Link from "next/link";
import LeaveTable from "@/components/hr/LeaveTable";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { listLeaveRequests, listLeaveTypes } from "@/lib/leave-db";
import { LEAVE_STATUS_LABEL, LEAVE_STATUS_ORDER, type LeaveStatus } from "@/lib/leave-types";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** ใบแจ้งลาของฉัน (ข้อ 2 ของเมนู) */
export default async function MyLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; msg?: string; err?: string }>;
}) {
  const user = await requirePermission("HR_LEAVE_MINE", "read");
  const params = await searchParams;
  const today = workDateOf();

  const status = (LEAVE_STATUS_ORDER as string[]).includes(params.status ?? "")
    ? (params.status as LeaveStatus)
    : undefined;

  const [rows, types] = await Promise.all([
    listLeaveRequests({
      employeeId: user.id,
      statuses: status ? [status] : undefined,
      typeId: params.type || undefined,
    }),
    listLeaveTypes(true),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ใบแจ้งลาของฉัน</h1>
          <p className="text-sm text-slate-500">
            {formatThaiDate(today)} · {user.full_name} · ทั้งหมด {rows.length} ใบ
          </p>
        </div>
        <Link href="/hr/leave/new" className="btn-primary">
          + แจ้งลาใหม่
        </Link>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <section className="card space-y-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">สถานะ</label>
            <select name="status" defaultValue={params.status ?? ""} className="input w-48">
              <option value="">ทุกสถานะ</option>
              {LEAVE_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {LEAVE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">ประเภทการลา</label>
            <select name="type" defaultValue={params.type ?? ""} className="input w-56">
              <option value="">ทุกประเภท</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary">
            กรอง
          </button>
        </form>

        <LeaveTable
          rows={rows}
          today={today}
          showEmployee={false}
          emptyText="ยังไม่มีใบแจ้งลา — กด &quot;แจ้งลาใหม่&quot; เพื่อเริ่ม"
        />
      </section>
    </main>
  );
}
