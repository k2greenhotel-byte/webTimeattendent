import Link from "next/link";
import AdvanceTable from "@/components/hr/AdvanceTable";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { formatBaht } from "@/lib/leave";
import { listAdvanceRequests } from "@/lib/leave-db";
import { ADVANCE_STATUS_LABEL, ADVANCE_STATUS_ORDER, type AdvanceStatus } from "@/lib/leave-types";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** ใบขอเบิกของฉัน (ข้อ 4 ของเมนู) */
export default async function MyAdvancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string; err?: string }>;
}) {
  const user = await requirePermission("HR_ADV_MINE", "read");
  const params = await searchParams;

  const status = (ADVANCE_STATUS_ORDER as string[]).includes(params.status ?? "")
    ? (params.status as AdvanceStatus)
    : undefined;

  const rows = await listAdvanceRequests({
    employeeId: user.id,
    statuses: status ? [status] : undefined,
  });

  const requested = rows.reduce((sum, r) => sum + r.amount, 0);
  const approved = rows.reduce((sum, r) => sum + r.approved_amount, 0);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ใบขอเบิกเงินเดือนของฉัน</h1>
          <p className="text-sm text-slate-500">
            {formatThaiDate(workDateOf())} · ขอไปแล้ว {formatBaht(requested)} · อนุมัติแล้ว{" "}
            {formatBaht(approved)}
          </p>
        </div>
        <Link href="/hr/advance/new" className="btn-primary">
          + ขอเบิกใหม่
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
            <select name="status" defaultValue={params.status ?? ""} className="input w-52">
              <option value="">ทุกสถานะ</option>
              {ADVANCE_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {ADVANCE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary">
            กรอง
          </button>
        </form>

        <AdvanceTable rows={rows} showEmployee={false} emptyText="ยังไม่มีใบขอเบิกเงิน" />
      </section>
    </main>
  );
}
