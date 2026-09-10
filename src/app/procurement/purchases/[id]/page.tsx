import Link from "next/link";
import { notFound } from "next/navigation";
import CancelDocPanel from "@/components/procurement/CancelDocPanel";
import PhotoGrid from "@/components/procurement/PhotoGrid";
import PurchaseForm from "@/components/procurement/PurchaseForm";
import { PrDocStatusBadge } from "@/components/procurement/StatusBadges";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { formatBaht, validateCancel, validateRestore } from "@/lib/procurement";
import { getPurchase, listPrTypes, listPurchasePhotos } from "@/lib/procurement-db";
import { checkPermission, requirePermission } from "@/lib/session";
import {
  cancelPurchaseForm,
  deletePurchaseForm,
  restorePurchaseForm,
  updatePurchaseForm,
} from "../../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.3 — แก้ไขใบขอจัดซื้อ */
export default async function PurchaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requirePermission("PR_PURCHASE", "read");
  const { id } = await params;
  const query = await searchParams;

  const purchase = await getPurchase(id);
  if (!purchase) notFound();

  const [photos, companies, branches, materialTypes, canEdit, canDelete, canCancelOthers, isApprover] = await Promise.all([
    listPurchasePhotos(id),
    listCompanies(true),
    listBranches(true),
    listPrTypes("material"),
    checkPermission("PR_PURCHASE", "edit"),
    checkPermission("PR_PURCHASE", "delete"),
    checkPermission("PR_CANCEL", "delete"),
    checkPermission("PR_APPROVE", "write"),
  ]);

  // ใช้กฎชุดเดียวกับ server action จะได้ไม่มีทางที่ปุ่มโผล่แต่กดแล้วไม่ผ่าน
  const cancelActor = { userId: user.id, canCancelOthers, isApprover };
  const cancelDoc = {
    created_by: purchase.created_by,
    doc_status: purchase.doc_status,
    approve_status: purchase.approve_status,
    actual_amount: purchase.actual_amount,
  };
  const cancelProblem =
    purchase.doc_status === "cancelled"
      ? validateRestore(cancelDoc, cancelActor)
      : validateCancel(cancelDoc, cancelActor);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-800 sm:text-xl">
            ใบขอจัดซื้อเลขที่ {purchase.doc_no} <PrDocStatusBadge status={purchase.doc_status} />
          </h1>
          <p className="text-sm text-slate-500">
            ขอวันที่ {formatThaiDate(purchase.request_date)} · ขอเบิก {formatBaht(purchase.requested_amount)}
            {purchase.received_date ? ` · ได้รับวัสดุ ${formatThaiDate(purchase.received_date)}` : ""}
          </p>
        </div>
        <Link href={`/procurement/purchases/${purchase.id}/print`} className="btn-secondary">
          🖨 พิมพ์เอกสาร
        </Link>
      </div>

      {purchase.approval_no && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          อนุมัติแล้วตามใบอนุมัติเลขที่ <span className="font-semibold">{purchase.approval_no}</span>
          {purchase.approved_date ? ` วันที่ ${formatThaiDate(purchase.approved_date)}` : ""} — กด "พิมพ์เอกสาร"
          เพื่อใช้ประกอบการจ่ายเงินได้เลย
        </p>
      )}

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      {canEdit ? (
        <PurchaseForm
          purchase={purchase}
          photos={photos}
          companies={companies}
          branches={branches}
          materialTypes={materialTypes}
          defaultRecorderName={user.full_name}
          action={updatePurchaseForm}
          submitLabel="บันทึกการแก้ไข"
        />
      ) : (
        <section className="card space-y-2">
          <h2 className="font-semibold text-slate-800">รูปภาพประกอบ</h2>
          <PhotoGrid paths={photos} caption={`รูปใบขอจัดซื้อ ${purchase.doc_no}`} />
          <p className="text-xs text-slate-500">บัญชีนี้ไม่มีสิทธิ์แก้ไขใบขอจัดซื้อ (ดูอย่างเดียว)</p>
        </section>
      )}

      {/* ---------- ยกเลิก / ดึงกลับ ---------- */}
      <CancelDocPanel
        docId={purchase.id}
        docNo={purchase.doc_no}
        docStatus={purchase.doc_status}
        cancelledByName={purchase.cancelled_by_name}
        cancelledAt={purchase.cancelled_at}
        cancelReason={purchase.cancel_reason}
        allowed={cancelProblem === null}
        blockedReason={cancelProblem}
        cancelAction={cancelPurchaseForm}
        restoreAction={restorePurchaseForm}
        label="ใบขอจัดซื้อ"
      />

      {/* ---------- ลบใบขอจัดซื้อ ---------- */}
      {canDelete && (
        <section className="card space-y-2 border-rose-200">
          <h2 className="font-semibold text-rose-700">ลบใบขอจัดซื้อนี้</h2>
          <p className="text-sm text-slate-600">
            ลบแล้วรูปภาพและรายการเบิกจ่ายที่อ้างถึงจะได้รับผลกระทบ ย้อนกลับไม่ได้
          </p>
          <form action={deletePurchaseForm} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={purchase.id} />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="confirm" />
              ยืนยันลบใบขอจัดซื้อ {purchase.doc_no}
            </label>
            <button type="submit" className="btn-danger">
              ลบใบขอจัดซื้อ
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
