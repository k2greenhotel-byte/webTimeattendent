import Link from "next/link";
import RepairUpdateList from "@/components/procurement/RepairUpdateList";
import { listRepairUpdates } from "@/lib/procurement-db";
import { checkPermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.2 — รายการใบ Update งานซ่อมทั้งหมด */
export default async function RepairUpdateListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; msg?: string; err?: string }>;
}) {
  const params = await searchParams;

  const [rows, canWrite] = await Promise.all([
    listRepairUpdates({
      keyword: params.q,
      from: params.from || undefined,
      to: params.to || undefined,
    }),
    checkPermission("PR_REPAIR_UPD", "write"),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">1.2 Update งานซ่อม</h1>
          <p className="text-sm text-slate-500">
            ทุกครั้งที่บันทึก ระบบจะปรับสถานะบนใบขอซ่อมให้ทันที และเก็บไว้เป็นประวัติว่าใครเปลี่ยนอะไรเมื่อไหร่
          </p>
        </div>
        {canWrite && (
          <Link href="/procurement/updates/new" className="btn-primary">
            + บันทึก Update ใหม่
          </Link>
        )}
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form method="get" className="card flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-auto">
          <label className="label" htmlFor="q">
            คำค้น
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            className="input w-full sm:w-72"
            placeholder="เลขที่ update / เลขที่ใบขอซ่อม / รายการ"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="label" htmlFor="from">
            ตั้งแต่วันที่
          </label>
          <input id="from" name="from" type="date" defaultValue={params.from ?? ""} className="input" />
        </div>
        <div className="w-full sm:w-auto">
          <label className="label" htmlFor="to">
            ถึงวันที่
          </label>
          <input id="to" name="to" type="date" defaultValue={params.to ?? ""} className="input" />
        </div>
        <button type="submit" className="btn-secondary w-full sm:w-auto">
          ค้นหา
        </button>
        <Link href="/procurement/updates" className="pb-2.5 text-sm text-slate-500 hover:underline">
          ล้างเงื่อนไข
        </Link>
      </form>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} รายการ)</h2>
        <RepairUpdateList rows={rows} showRepair emptyText="ยังไม่มีการบันทึก update ที่ตรงกับเงื่อนไข" />
      </section>
    </main>
  );
}
