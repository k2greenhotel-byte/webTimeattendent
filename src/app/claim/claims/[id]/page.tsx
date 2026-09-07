import Link from "next/link";
import { notFound } from "next/navigation";
import ClaimForm from "@/components/claim/ClaimForm";
import ClaimUpdateList from "@/components/claim/ClaimUpdateList";
import PhotoGrid from "@/components/claim/PhotoGrid";
import {
  ClaimDocStatusBadge,
  ClaimJobStatusBadge,
  ExternalBadge,
  OverdueBadge,
  UrgencyBadge,
} from "@/components/claim/StatusBadges";
import {
  customerSourceText,
  deadlineOf,
  formatBaht,
  jobText,
  overdueText,
  vehicleText,
} from "@/lib/claim";
import {
  getClaim,
  listClaimItems,
  listClaimPhotos,
  listClaimUpdates,
  listUpdatePhotos,
} from "@/lib/claim-db";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { checkPermission, requirePermission } from "@/lib/session";
import { deleteClaimForm, deleteClaimUpdateForm, updateClaimForm } from "../../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.4 — แก้ไขใบขอเคลม พร้อมประวัติการ update (1.5) ของใบนี้ */
export default async function ClaimDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requirePermission("CLM_CLAIM", "read");
  const { id } = await params;
  const query = await searchParams;

  const claim = await getClaim(id);
  if (!claim) notFound();

  const [items, photos, updates, companies, branches, canEdit, canDelete, canAddUpdate, canDeleteUpdate] =
    await Promise.all([
      listClaimItems(id),
      listClaimPhotos(id),
      listClaimUpdates({ claim_id: id }),
      listCompanies(true),
      listBranches(true),
      checkPermission("CLM_CLAIM", "edit"),
      checkPermission("CLM_CLAIM", "delete"),
      checkPermission("CLM_UPDATE", "write"),
      checkPermission("CLM_UPDATE", "delete"),
    ]);

  const updatePhotos = await Promise.all(updates.map((u) => listUpdatePhotos(u.id)));
  const today = workDateOf();

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-800 sm:text-xl">
            ใบขอเคลมเลขที่ {claim.doc_no}
            <ClaimDocStatusBadge status={claim.doc_status} />
            <ClaimJobStatusBadge status={claim.job_status} />
            <ExternalBadge isExternal={claim.is_external} />
            <OverdueBadge text={overdueText(claim, today)} />
          </h1>
          <p className="text-sm text-slate-500">
            แจ้งวันที่ {formatThaiDate(claim.claim_date)} · ครบกำหนด{" "}
            {formatThaiDate(deadlineOf(claim))}
            {claim.requested_amount > 0 ? ` · ขออนุมัติ ${formatBaht(claim.requested_amount)}` : ""}
          </p>
        </div>
        {canAddUpdate && (
          <Link href={`/claim/updates/new?claim=${claim.id}`} className="btn-primary">
            + บันทึก Update งานเคลม
          </Link>
        )}
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      {/* ---------- สรุปใบนี้แบบอ่านเร็ว ---------- */}
      <section className="card space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-semibold text-slate-800">สรุปใบขอเคลม</h2>
          <UrgencyBadge urgency={claim.urgency} />
        </div>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-400">เลขตัวถัง / เลขเครื่อง</dt>
            <dd className="text-slate-700">
              {claim.chassis_no}
              {claim.engine_no ? ` · ${claim.engine_no}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">รถ</dt>
            <dd className="text-slate-700">{vehicleText(claim) || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">ที่มาข้อมูลลูกค้า</dt>
            <dd className="text-slate-700">{customerSourceText(claim)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">ลูกค้า</dt>
            <dd className="text-slate-700">
              {claim.customer_name}
              {claim.customer_phone ? ` · ${claim.customer_phone}` : ""}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-400">รายการที่ขอเคลม ({items.length} รายการ)</dt>
            <dd className="text-slate-700">
              {items.length === 0
                ? "—"
                : items
                    .map((i) => `${i.item_name}${i.qty && i.qty !== 1 ? ` × ${i.qty}` : ""}`)
                    .join(", ")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">บริษัทผู้ผลิต / ตัวแทน</dt>
            <dd className="text-slate-700">
              {[claim.maker_name, claim.maker_agent_name].filter(Boolean).join(" · ") || "—"}
              {claim.maker_phone ? ` · ${claim.maker_phone}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">งานซ่อม (Job)</dt>
            <dd className="text-slate-700">{jobText(claim) || "— ยังไม่ได้เปิด job —"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">แจ้งผล / ซ่อมเสร็จ / ส่งมอบ</dt>
            <dd className="text-slate-700">
              {[claim.result_date, claim.fixed_date, claim.delivered_date]
                .map((d) => (d ? formatThaiDate(d) : "—"))
                .join(" · ")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">ผู้บันทึกจัดทำ</dt>
            <dd className="text-slate-700">
              {claim.created_by_name ?? claim.created_by_full_name ?? "—"}
            </dd>
          </div>
        </dl>
        {claim.job_status === "rejected" && claim.reject_reason && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="font-medium">เหตุผลไม่อนุมัติ</span> {claim.reject_reason}
          </p>
        )}
      </section>

      {canEdit ? (
        <ClaimForm
          claim={claim}
          items={items}
          photos={photos}
          companies={companies}
          branches={branches}
          defaultRecorderName={user.full_name}
          action={updateClaimForm}
          submitLabel="บันทึกการแก้ไข"
        />
      ) : (
        <section className="card space-y-2">
          <h2 className="font-semibold text-slate-800">รูปภาพความเสียหาย</h2>
          <PhotoGrid paths={photos} caption={`รูปใบขอเคลม ${claim.doc_no}`} />
          <p className="text-xs text-slate-500">บัญชีนี้ไม่มีสิทธิ์แก้ไขใบขอเคลม (ดูอย่างเดียว)</p>
        </section>
      )}

      {/* ---------- ประวัติการ update (1.5) ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ประวัติการ Update ({updates.length} ครั้ง)</h2>
        <ClaimUpdateList
          rows={updates}
          photos={updatePhotos}
          deleteAction={canDeleteUpdate ? deleteClaimUpdateForm : undefined}
          emptyText="ยังไม่มีการบันทึก update ของใบขอเคลมนี้"
        />
      </section>

      {/* ---------- ลบใบขอเคลม ---------- */}
      {canDelete && (
        <section className="card space-y-2 border-rose-200">
          <h2 className="font-semibold text-rose-700">ลบใบขอเคลมนี้</h2>
          <p className="text-sm text-slate-600">
            ลบแล้วใบ update {updates.length} ใบ รายการที่ขอเคลม {items.length} รายการ และรูปภาพทั้งหมด
            จะหายตามไปด้วย ย้อนกลับไม่ได้
          </p>
          <form action={deleteClaimForm} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={claim.id} />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="confirm" />
              ยืนยันลบใบขอเคลม {claim.doc_no}
            </label>
            <button type="submit" className="btn-danger">
              ลบใบขอเคลม
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
