import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cancelAdvanceForm } from "@/app/hr/actions";
import AdvanceDecisionCard from "@/components/hr/AdvanceDecisionCard";
import { AdvanceStatusBadge } from "@/components/hr/StatusBadges";
import { listRejectReasons } from "@/lib/approval-db";
import { formatStampThai, formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/leave";
import { getAdvanceRequest } from "@/lib/leave-db";
import { advanceAuthorityFor } from "@/lib/leave-session";
import { checkPermission, isApproverAuthed, requireActiveUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdvanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requireActiveUser();
  const { id } = await params;
  const query = await searchParams;

  const row = await getAdvanceRequest(id);
  if (!row) notFound();

  const isOwner = row.employee_id === user.id;
  const canSeeAll = await checkPermission("HR_ADV_APPROVE", "read");
  if (!isOwner && !canSeeAll) {
    redirect(`/hr/advance?err=${encodeURIComponent("ดูได้เฉพาะใบขอเบิกของตัวเอง")}`);
  }

  const [canDecide, approverAuthed, reasons, authority] = await Promise.all([
    checkPermission("HR_ADV_APPROVE", "write"),
    isApproverAuthed(),
    listRejectReasons(true),
    advanceAuthorityFor(user, row.company_id),
  ]);

  const facts: { label: string; value: string }[] = [
    { label: "1. เลขที่ใบขอเบิก", value: row.doc_no },
    { label: "2. วันที่ขอเบิก", value: formatThaiDate(row.request_date) },
    { label: "3. รายการขอเบิกเพื่อ", value: row.purpose },
    { label: "4. ผู้ขอเบิก", value: row.employee_name },
    { label: "5. ยอดเงินที่ขอเบิก", value: formatBaht(row.amount) },
    {
      label: "6. ยอดเงินที่อนุมัติให้เบิก",
      value: row.status === "pending" ? "ยังไม่พิจารณา" : formatBaht(row.approved_amount),
    },
    { label: "บริษัท / สาขา", value: `${row.company_name ?? "-"} · ${row.branch_name ?? "-"}` },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            ใบขอเบิกเงิน {row.doc_no} <AdvanceStatusBadge status={row.status} />
          </h1>
          <p className="text-sm text-slate-500">{row.employee_name}</p>
        </div>
        <Link href="/hr/advance" className="text-sm text-brand-600 hover:underline">
          ← กลับไปรายการ
        </Link>
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      <section className="card space-y-3">
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="flex gap-2 text-sm">
              <dt className="w-44 shrink-0 text-slate-500">{f.label}</dt>
              <dd className="font-medium text-slate-800">{f.value}</dd>
            </div>
          ))}
        </dl>

        {row.detail && (
          <div>
            <p className="text-sm text-slate-500">รายละเอียดเพิ่มเติม</p>
            <p className="whitespace-pre-line text-slate-800">{row.detail}</p>
          </div>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold text-slate-800">7–8. สถานะและผู้อนุมัติ</h2>
        <p className="text-sm">
          สถานะ: <AdvanceStatusBadge status={row.status} />
        </p>
        {row.decided_by_name ? (
          <p className="text-sm text-slate-600">
            ผู้อนุมัติ: <strong>{row.decided_by_name}</strong> ·{" "}
            {row.decided_at ? `${formatStampThai(row.decided_at)} น.` : "-"}
          </p>
        ) : (
          <p className="text-sm text-slate-500">ยังไม่มีผู้พิจารณา</p>
        )}
        {row.reason_name && (
          <p className="text-sm text-rose-700">เหตุผลที่ไม่อนุมัติ: {row.reason_name}</p>
        )}
        {row.decision_note && (
          <p className="whitespace-pre-line text-sm text-slate-700">
            หมายเหตุจากผู้อนุมัติ: {row.decision_note}
          </p>
        )}
      </section>

      {canDecide && approverAuthed && row.status === "pending" && (
        <section className="space-y-2">
          <h2 className="font-semibold text-slate-800">พิจารณาใบนี้</h2>
          <AdvanceDecisionCard
            row={row}
            reasons={reasons}
            backTo={`/hr/advance/${row.id}`}
            canDecide
            limitText={authority ? `อำนาจอนุมัติของคุณ: ${authority.reason}` : null}
          />
        </section>
      )}

      {canDecide && !approverAuthed && row.status === "pending" && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
          ต้องยืนยันรหัสผ่านผู้อนุมัติก่อนจึงจะพิจารณาได้ —{" "}
          <Link href="/hr/approvals/advance" className="text-brand-600 hover:underline">
            ไปหน้าอนุมัติขอเบิกเงิน
          </Link>
        </p>
      )}

      {isOwner && row.status === "pending" && (
        <form action={cancelAdvanceForm} className="card flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={row.id} />
          <label className="flex items-center gap-2 text-sm text-rose-700">
            <input type="checkbox" name="confirm" />
            ยืนยันยกเลิกใบขอเบิกนี้
          </label>
          <button type="submit" className="btn-secondary text-rose-600">
            ยกเลิกใบขอเบิก
          </button>
        </form>
      )}
    </main>
  );
}
