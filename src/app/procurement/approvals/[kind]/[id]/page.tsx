import Link from "next/link";
import { notFound } from "next/navigation";
import ApprovalForm from "@/components/procurement/ApprovalForm";
import ApproverGate from "@/components/procurement/ApproverGate";
import PhotoGrid from "@/components/procurement/PhotoGrid";
import {
  ApproveStatusBadge,
  JobStatusBadge,
  PayStatusBadge,
  PrDocStatusBadge,
  UrgencyBadge,
} from "@/components/procurement/StatusBadges";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/procurement";
import {
  getDoc,
  listApprovalsOfDoc,
  listRepairPhotos,
  listPurchasePhotos,
} from "@/lib/procurement-db";
import { REJECT_REASON_LABEL } from "@/lib/procurement-types";
import { isApproverAuthed, requirePermission } from "@/lib/session";
import { createApprovalForm } from "../../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 3.1 — พิจารณาอนุมัติเอกสารหนึ่งใบ พร้อมประวัติการอนุมัติที่ผ่านมา */
export default async function ApprovalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ edit?: string; msg?: string; err?: string }>;
}) {
  const user = await requirePermission("PR_APPROVE", "write");
  const { kind, id } = await params;
  const query = await searchParams;

  if (kind !== "repair" && kind !== "purchase") notFound();

  const authed = await isApproverAuthed();
  if (!authed) return <ApproverGate fullName={user.full_name} />;

  const doc = await getDoc(id);
  if (!doc || doc.kind !== kind) notFound();

  const [photos, history] = await Promise.all([
    kind === "repair" ? listRepairPhotos(id) : listPurchasePhotos(id),
    listApprovalsOfDoc(kind, id),
  ]);

  /*
   * เอกสารที่เคยมีผลอนุมัติแล้ว ไม่เปิดฟอร์มค้างไว้ให้กดทับโดยไม่ตั้งใจ
   * แสดงผลเดิมพร้อมปุ่ม "แก้ไขผลการอนุมัติ" แทน กดแล้วค่อยเปิดฟอร์ม (?edit=1)
   * ส่วนเอกสารที่ยังรอพิจารณา เปิดฟอร์มให้เลยเพราะนั่นคืองานหลักของหน้านี้
   */
  const decided = doc.approve_status === "approved" || doc.approve_status === "rejected";
  const showForm = !decided || query.edit === "1";
  const paid = doc.actual_amount > 0;

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-800 sm:text-xl">
            {doc.doc_no} <PrDocStatusBadge status={doc.doc_status} />
          </h1>
          <p className="text-sm text-slate-500">{doc.item_name}</p>
        </div>
        <Link href="/procurement/approvals" className="btn-secondary">
          ← กลับรายการรออนุมัติ
        </Link>
      </div>

      <section className="card space-y-2 text-sm">
        <div className="flex flex-wrap gap-1">
          <UrgencyBadge urgency={doc.urgency} />
          {doc.job_status && <JobStatusBadge status={doc.job_status} />}
          <ApproveStatusBadge status={doc.approve_status} />
          <PayStatusBadge status={doc.pay_status} kind={doc.kind} />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600 sm:grid-cols-4">
          <div>
            <dt className="text-slate-400">วันที่</dt>
            <dd>{formatThaiDate(doc.doc_date)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">บริษัท / สาขา</dt>
            <dd>
              {doc.company_name ?? "—"} {doc.branch_name ? `· ${doc.branch_name}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">ประเภท</dt>
            <dd>{doc.type_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">ผู้บันทึก</dt>
            <dd>{doc.created_by_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">ขอเบิก</dt>
            <dd className="font-medium text-slate-800">{formatBaht(doc.requested_amount)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">อนุมัติแล้ว</dt>
            <dd>{formatBaht(doc.approved_amount)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">เบิกจริง</dt>
            <dd>{formatBaht(doc.actual_amount)}</dd>
          </div>
        </dl>
        {doc.note && <p className="text-slate-600">หมายเหตุ: {doc.note}</p>}
        {doc.reject_note && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
            เหตุผลไม่อนุมัติล่าสุด: {doc.reject_note}
          </p>
        )}

        {photos.length > 0 && (
          <div className="pt-2">
            <p className="mb-1 font-medium text-slate-700">รูปภาพ</p>
            <PhotoGrid paths={photos} caption={doc.doc_no} />
          </div>
        )}
      </section>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      {doc.doc_status === "cancelled" ? (
        <p className="card text-sm text-rose-700">เอกสารนี้ถูกยกเลิกแล้ว อนุมัติไม่ได้</p>
      ) : showForm ? (
        <ApprovalForm
          doc={doc}
          approverName={user.full_name}
          action={createApprovalForm}
          editing={decided}
        />
      ) : (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                ผลการพิจารณา <ApproveStatusBadge status={doc.approve_status} />
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {doc.approval_no ? `ใบอนุมัติเลขที่ ${doc.approval_no}` : "—"}
                {doc.approved_date ? ` · วันที่ ${formatThaiDate(doc.approved_date)}` : ""}
                {doc.approved_by ? ` · โดย ${doc.approved_by}` : ""}
              </p>
              <p className="text-sm text-slate-600">
                อนุมัติให้เบิก {formatBaht(doc.approved_amount)}
                {doc.reject_reason ? ` · ${REJECT_REASON_LABEL[doc.reject_reason]}` : ""}
              </p>
            </div>

            <Link
              href={`/procurement/approvals/${kind}/${id}?edit=1`}
              className="btn-primary w-full sm:w-auto"
            >
              ✏️ แก้ไขผลการอนุมัติ
            </Link>
          </div>

          <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
            {paid
              ? `เอกสารนี้จ่ายเงินไปแล้ว ${formatBaht(doc.actual_amount)} — แก้ไขได้เฉพาะยอดที่อนุมัติ (ไม่ต่ำกว่ายอดที่จ่ายไปแล้ว) จะเปลี่ยนเป็นไม่อนุมัติต้องไปลบใบเบิกจ่ายก่อน`
              : "ยังไม่ได้จ่ายเงิน — เปลี่ยนใจเป็นไม่อนุมัติหรือให้หาราคาใหม่ได้"}
          </p>
        </section>
      )}

      {history.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold text-slate-800">ประวัติการพิจารณา ({history.length} ครั้ง)</h2>
          <ul className="space-y-2">
            {history.map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{a.doc_no}</span>
                  <span className="text-xs text-slate-500">{formatThaiDate(a.approve_date)}</span>
                </div>
                <p className="mt-1 text-slate-600">
                  <ApproveStatusBadge status={a.decision} /> ·{" "}
                  {a.approver_full_name ?? a.approver_name ?? "—"} · อนุมัติ{" "}
                  {formatBaht(a.approved_amount)}
                  {a.reject_reason ? ` · ${REJECT_REASON_LABEL[a.reject_reason]}` : ""}
                </p>
                {a.note && <p className="mt-1 text-xs text-slate-500">{a.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
