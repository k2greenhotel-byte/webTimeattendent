import Link from "next/link";
import RequestTable from "@/components/approval/RequestTable";
import { listRequests } from "@/lib/approval-db";
import { workDateOf } from "@/lib/datetime";
import { checkPermission, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requirePermission("APV_MINE", "read");
  const params = await searchParams;

  const rows = await listRequests({ requesterId: user.id });
  const canCreate = await checkPermission("APV_NEW", "write");

  const open = rows.filter((r) => ["pending", "endorsed"].includes(r.status));
  const done = rows.filter((r) => !["pending", "endorsed"].includes(r.status));
  const today = workDateOf();

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">เรื่องของฉัน</h1>
          <p className="text-sm text-slate-500">
            เรื่องที่คุณยื่นขออนุมัติทั้งหมด {rows.length} เรื่อง · รอผล {open.length} เรื่อง
          </p>
        </div>
        {canCreate && (
          <Link href="/approvals/new" className="btn-primary">
            + ยื่นเรื่องใหม่
          </Link>
        )}
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">รอผลอนุมัติ ({open.length})</h2>
        <RequestTable
          rows={open}
          today={today}
          showRequester={false}
          actionLabel="ดูรายละเอียด"
          emptyText="ไม่มีเรื่องที่รอผลอยู่"
          note={(row) =>
            row.status === "endorsed" && row.endorse_by_name
              ? `${row.endorse_by_name} เสนอขึ้นผู้บริหารแล้ว`
              : null
          }
        />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">เรื่องที่จบแล้ว ({done.length})</h2>
        <RequestTable
          rows={done}
          today={today}
          showRequester={false}
          actionLabel="ดูผล"
          emptyText="ยังไม่มีเรื่องที่จบ"
        />
      </section>
    </main>
  );
}
