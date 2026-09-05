import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelRequestForm } from "@/app/approvals/actions";
import DecisionForm from "@/components/approval/DecisionForm";
import { ApvDecisionBadge, ApvStatusBadge, TypeBadge } from "@/components/approval/StatusBadges";
import { amountText, canDecideFinal, formatBaht, hasAnyAuthority } from "@/lib/approval";
import { getRequest, listDecisionsOf, listRejectReasons } from "@/lib/approval-db";
import { authorityFor, getLimits } from "@/lib/approval-session";
import { APV_STATUS_LABEL } from "@/lib/approval-types";
import { formatStampThai, formatThaiDate } from "@/lib/datetime";
import { ACCESS_LEVEL_LABEL } from "@/lib/core-types";
import { checkPermission, isApproverAuthed, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ApprovalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser();

  const row = await getRequest(id);
  if (!row) notFound();

  const isOwner = row.requester_id === user.id;
  const canSeeInbox = await checkPermission("APV_INBOX", "read");
  if (!isOwner && !canSeeInbox) {
    notFound();
  }

  const [decisions, reasons, limits] = await Promise.all([
    listDecisionsOf(id),
    listRejectReasons(true),
    getLimits(),
  ]);

  const authority = authorityFor(limits, user, row);
  const canDecideNow =
    (await checkPermission("APV_INBOX", "write")) &&
    (await isApproverAuthed()) &&
    hasAnyAuthority(authority) &&
    ["pending", "endorsed"].includes(row.status);

  const facts: { label: string; value: string }[] = [
    { label: "เลขที่", value: row.doc_no },
    { label: "ประเภทเรื่อง", value: `${row.type_icon ?? ""} ${row.type_name}` },
    { label: "ผู้ขอ", value: row.requester_name },
    { label: "วันที่ยื่น", value: formatThaiDate(row.request_date) },
    { label: "ต้องการภายใน", value: row.needed_by ? formatThaiDate(row.needed_by) : "-" },
    {
      label: "บริษัท / สาขา",
      value: [row.company_name, row.branch_name].filter(Boolean).join(" · ") || "-",
    },
    { label: row.amount_label, value: row.has_amount ? formatBaht(row.requested_amount) : "-" },
    {
      label: "อนุมัติแล้ว",
      value: row.has_amount && row.approved_amount > 0 ? formatBaht(row.approved_amount) : "-",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800">{row.subject}</h1>
            <ApvStatusBadge status={row.status} />
            <TypeBadge icon={row.type_icon} name={row.type_name} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {row.doc_no} · ยื่นโดย {row.requester_name} · {formatThaiDate(row.request_date)}
          </p>
        </div>
        <Link href={canSeeInbox ? "/approvals" : "/approvals/mine"} className="btn-secondary">
          ← กลับ
        </Link>
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      <section className="card space-y-3">
        <dl className="grid gap-3 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-slate-500">{f.label}</dt>
              <dd className="text-sm font-medium text-slate-800">{f.value}</dd>
            </div>
          ))}
        </dl>

        {row.detail && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">รายละเอียด</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{row.detail}</p>
          </div>
        )}

        {row.source_url && (
          <p className="text-sm">
            <Link href={row.source_url} className="text-brand-600 hover:underline">
              เปิดเอกสารต้นทางในโปรแกรมที่ส่งเรื่องมา →
            </Link>
          </p>
        )}

        {row.status === "endorsed" && row.endorse_by_name && (
          <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <strong>{row.endorse_by_name}</strong> เสนอเรื่องนี้ขึ้นมา: {row.endorse_note ?? "-"}
          </p>
        )}

        {row.decided_at && (
          <p className="text-sm text-slate-500">
            ผลสุดท้าย: {APV_STATUS_LABEL[row.status]} โดย {row.decided_by_name} ·{" "}
            {formatStampThai(row.decided_at)}
          </p>
        )}
      </section>

      {canDecideNow && (
        <DecisionForm
          row={row}
          authority={authority}
          reasons={reasons}
          canDecideFinal={canDecideFinal(authority, row)}
        />
      )}

      {!canDecideNow && canSeeInbox && ["pending", "endorsed"].includes(row.status) && (
        <p className="card text-sm text-slate-600">
          {hasAnyAuthority(authority)
            ? "ยืนยันรหัสผ่านที่หน้ากล่องรออนุมัติก่อน จึงจะพิจารณาเรื่องได้"
            : "บัญชีของคุณยังไม่ได้รับอำนาจอนุมัติ — ให้ผู้ดูแลระบบตั้งค่าที่เมนูอำนาจอนุมัติ"}
        </p>
      )}

      {/* ผู้ขอยกเลิกเรื่องของตัวเองได้ ตราบใดที่ยังไม่มีใครตัดสิน */}
      {isOwner && ["pending", "endorsed"].includes(row.status) && (
        <form action={cancelRequestForm} className="card flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={row.id} />
          <div className="mr-auto">
            <h2 className="font-semibold text-slate-800">ยกเลิกเรื่องนี้</h2>
            <p className="text-sm text-slate-500">ยกเลิกได้เฉพาะเรื่องที่ยังไม่มีใครตัดสิน</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="confirm" />
            ยืนยัน
          </label>
          <button type="submit" className="btn-secondary text-rose-600">
            ยกเลิกเรื่อง
          </button>
        </form>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ประวัติการพิจารณา ({decisions.length} ครั้ง)</h2>

        {decisions.length === 0 ? (
          <p className="py-2 text-sm text-slate-500">ยังไม่มีการพิจารณา</p>
        ) : (
          <ol className="space-y-2">
            {decisions.map((d) => (
              <li key={d.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">ครั้งที่ {d.seq}</span>
                  <ApvDecisionBadge decision={d.decision} />
                  <span className="text-sm font-medium text-slate-800">{d.approver_name}</span>
                  {d.approver_level && (
                    <span className="text-xs text-slate-500">
                      ({ACCESS_LEVEL_LABEL[d.approver_level]})
                    </span>
                  )}
                  <span className="ml-auto text-xs text-slate-500">
                    {formatStampThai(d.decided_at)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-slate-600">
                  {d.decision === "partial" && <span>อนุมัติ {formatBaht(d.approved_amount)}</span>}
                  {d.reason_name && <span>เหตุผล: {d.reason_name}</span>}
                  {d.authority_limit !== null && (
                    <span className="text-xs text-slate-400">
                      วงเงินขณะตัดสิน {d.authority_limit.toLocaleString("th-TH")} บาท
                    </span>
                  )}
                </div>
                {d.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{d.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
