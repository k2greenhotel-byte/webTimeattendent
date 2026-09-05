import RequestTable from "@/components/approval/RequestTable";
import { formatBaht } from "@/lib/approval";
import { listRequests, listTypes } from "@/lib/approval-db";
import { APV_STATUS_LABEL, APV_STATUS_ORDER, type ApvStatus } from "@/lib/approval-types";
import { monthBounds, workDateOf } from "@/lib/datetime";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ApprovalSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; from?: string; to?: string }>;
}) {
  await requirePermission("APV_SEARCH", "read");
  const params = await searchParams;

  const today = workDateOf();
  const [year, month] = today.split("-").map(Number);
  const bounds = monthBounds(year, month);
  const from = params.from || bounds.from;
  const to = params.to || bounds.to;

  const status = (APV_STATUS_ORDER as string[]).includes(params.status ?? "")
    ? (params.status as ApvStatus)
    : null;

  const [types, rows] = await Promise.all([
    listTypes(),
    listRequests({
      keyword: params.q,
      statuses: status ? [status] : undefined,
      typeId: params.type || undefined,
      from,
      to,
    }),
  ]);

  const approved = rows.filter((r) => ["approved", "partial"].includes(r.status));
  const totalApproved = approved.reduce((sum, r) => sum + r.approved_amount, 0);
  const totalRequested = rows.reduce((sum, r) => sum + (r.has_amount ? r.requested_amount : 0), 0);

  const cards = [
    { label: "เรื่องทั้งหมด", value: String(rows.length) },
    { label: "อนุมัติแล้ว", value: String(approved.length) },
    { label: "ไม่อนุมัติ", value: String(rows.filter((r) => r.status === "rejected").length) },
    { label: "ยอดที่ขอ", value: formatBaht(totalRequested) },
    { label: "ยอดที่อนุมัติ", value: formatBaht(totalApproved) },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">สอบถามประวัติการอนุมัติ</h1>
        <p className="text-sm text-slate-500">ดูย้อนหลังว่าใครขออะไร ใครอนุมัติ เมื่อไร เท่าไร</p>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-2">
        <div>
          <label className="label">ตั้งแต่วันที่</label>
          <input name="from" type="date" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label">ถึงวันที่</label>
          <input name="to" type="date" defaultValue={to} className="input" />
        </div>
        <div>
          <label className="label">สถานะ</label>
          <select name="status" defaultValue={params.status ?? ""} className="input w-40">
            <option value="">ทุกสถานะ</option>
            {APV_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {APV_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ประเภทเรื่อง</label>
          <select name="type" defaultValue={params.type ?? ""} className="input w-48">
            <option value="">ทุกประเภท</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ค้นหา</label>
          <input
            name="q"
            defaultValue={params.q ?? ""}
            className="input w-56"
            placeholder="เลขที่ / เรื่อง / ชื่อผู้ขอ"
          />
        </div>
        <button type="submit" className="btn-secondary">
          ค้นหา
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length})</h2>
        <RequestTable
          rows={rows}
          today={today}
          actionLabel="ดูรายละเอียด"
          emptyText="ไม่พบเรื่องที่ตรงกับเงื่อนไข"
        />
      </section>
    </main>
  );
}
