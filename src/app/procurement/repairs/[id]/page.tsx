import Link from "next/link";
import { notFound } from "next/navigation";
import PhotoGrid from "@/components/procurement/PhotoGrid";
import RepairForm from "@/components/procurement/RepairForm";
import RepairUpdateList from "@/components/procurement/RepairUpdateList";
import { PrDocStatusBadge } from "@/components/procurement/StatusBadges";
import { listCompanies } from "@/lib/core-db";
import { formatThaiDate } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { formatBaht } from "@/lib/procurement";
import {
  getRepair,
  listPrTypes,
  listRepairPhotos,
  listRepairUpdates,
  listUpdatePhotos,
} from "@/lib/procurement-db";
import { checkPermission, requirePermission } from "@/lib/session";
import { deleteRepairForm, deleteRepairUpdateForm, updateRepairForm } from "../../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.1 — แก้ไขใบขอซ่อม พร้อมประวัติการ update (1.2) ของใบนี้ */
export default async function RepairDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requirePermission("PR_REPAIR", "read");
  const { id } = await params;
  const query = await searchParams;

  const repair = await getRepair(id);
  if (!repair) notFound();

  const [photos, updates, companies, branches, assetTypes, canEdit, canDelete, canAddUpdate, canDeleteUpdate] =
    await Promise.all([
      listRepairPhotos(id),
      listRepairUpdates({ repair_id: id }),
      listCompanies(true),
      listBranches(true),
      listPrTypes("asset"),
      checkPermission("PR_REPAIR", "edit"),
      checkPermission("PR_REPAIR", "delete"),
      checkPermission("PR_REPAIR_UPD", "write"),
      checkPermission("PR_REPAIR_UPD", "delete"),
    ]);

  const updatePhotos = await Promise.all(updates.map((u) => listUpdatePhotos(u.id)));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-800 sm:text-xl">
            ใบขอซ่อมเลขที่ {repair.doc_no} <PrDocStatusBadge status={repair.doc_status} />
          </h1>
          <p className="text-sm text-slate-500">
            แจ้งวันที่ {formatThaiDate(repair.request_date)} · ขอเบิก {formatBaht(repair.requested_amount)}
            {repair.fixed_date ? ` · แก้ไขเสร็จ ${formatThaiDate(repair.fixed_date)}` : ""}
          </p>
        </div>
        {canAddUpdate && (
          <Link href={`/procurement/updates/new?repair=${repair.id}`} className="btn-primary">
            + บันทึก Update งานซ่อม
          </Link>
        )}
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      {canEdit ? (
        <RepairForm
          repair={repair}
          photos={photos}
          companies={companies}
          branches={branches}
          assetTypes={assetTypes}
          defaultRecorderName={user.full_name}
          action={updateRepairForm}
          submitLabel="บันทึกการแก้ไข"
        />
      ) : (
        <section className="card space-y-2">
          <h2 className="font-semibold text-slate-800">รูปภาพความเสียหาย</h2>
          <PhotoGrid paths={photos} caption={`รูปใบขอซ่อม ${repair.doc_no}`} />
          <p className="text-xs text-slate-500">บัญชีนี้ไม่มีสิทธิ์แก้ไขใบขอซ่อม (ดูอย่างเดียว)</p>
        </section>
      )}

      {/* ---------- ประวัติการ update (1.2) ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ประวัติการ Update ({updates.length} ครั้ง)</h2>
        <RepairUpdateList
          rows={updates}
          photos={updatePhotos}
          deleteAction={canDeleteUpdate ? deleteRepairUpdateForm : undefined}
          emptyText="ยังไม่มีการบันทึก update ของใบขอซ่อมนี้"
        />
      </section>

      {/* ---------- ลบใบขอซ่อม ---------- */}
      {canDelete && (
        <section className="card space-y-2 border-rose-200">
          <h2 className="font-semibold text-rose-700">ลบใบขอซ่อมนี้</h2>
          <p className="text-sm text-slate-600">
            ลบแล้วใบ update {updates.length} ใบ รูปภาพ และรายการเบิกจ่ายที่อ้างถึงจะได้รับผลกระทบ ย้อนกลับไม่ได้
          </p>
          <form action={deleteRepairForm} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={repair.id} />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="confirm" />
              ยืนยันลบใบขอซ่อม {repair.doc_no}
            </label>
            <button type="submit" className="btn-danger">
              ลบใบขอซ่อม
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
