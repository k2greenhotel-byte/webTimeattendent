import RepairUpdateForm from "@/components/procurement/RepairUpdateForm";
import { listDocs } from "@/lib/procurement-db";
import { requirePermission } from "@/lib/session";
import { createRepairUpdateForm } from "../../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.2 — บันทึก Update งานซ่อมของใบขอซ่อมหนึ่งใบ */
export default async function NewRepairUpdatePage({
  searchParams,
}: {
  searchParams: Promise<{ repair?: string; err?: string; msg?: string }>;
}) {
  const user = await requirePermission("PR_REPAIR_UPD", "write");
  const params = await searchParams;

  // ตัวเลือกใบขอซ่อมแสดงเฉพาะที่ยังใช้งานอยู่ — แต่ถ้าเปิดมาจากใบที่ยกเลิกแล้ว ให้เห็นใบนั้นด้วย
  const [openRepairs, selectedList] = await Promise.all([
    listDocs({ kind: "repair", doc_status: "active" }),
    params.repair ? listDocs({ kind: "repair" }) : Promise.resolve([]),
  ]);

  const selected = selectedList.find((r) => r.id === params.repair) ?? null;
  const repairs =
    selected && !openRepairs.some((r) => r.id === selected.id) ? [selected, ...openRepairs] : openRepairs;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">บันทึก Update งานซ่อม</h1>
        <p className="text-sm text-slate-500">
          ช่องที่เว้นว่างไว้จะไม่ถูกเปลี่ยน — บันทึกเฉพาะสิ่งที่เกิดขึ้นจริงในครั้งนี้
        </p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <RepairUpdateForm
        repairs={repairs}
        defaultRepairId={params.repair}
        defaultRecorderName={user.full_name}
        action={createRepairUpdateForm}
      />
    </main>
  );
}
