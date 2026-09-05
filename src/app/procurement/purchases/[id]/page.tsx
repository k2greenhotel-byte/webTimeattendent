import { notFound } from "next/navigation";
import PhotoGrid from "@/components/procurement/PhotoGrid";
import PurchaseForm from "@/components/procurement/PurchaseForm";
import { PrDocStatusBadge } from "@/components/procurement/StatusBadges";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { formatBaht } from "@/lib/procurement";
import { getPurchase, listPrTypes, listPurchasePhotos } from "@/lib/procurement-db";
import { checkPermission, requirePermission } from "@/lib/session";
import { deletePurchaseForm, updatePurchaseForm } from "../../actions";

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

  const [photos, companies, branches, materialTypes, canEdit, canDelete] = await Promise.all([
    listPurchasePhotos(id),
    listCompanies(true),
    listBranches(true),
    listPrTypes("material"),
    checkPermission("PR_PURCHASE", "edit"),
    checkPermission("PR_PURCHASE", "delete"),
  ]);

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
      </div>

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
