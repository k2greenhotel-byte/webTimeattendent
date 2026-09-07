import ClaimUpdateForm from "@/components/claim/ClaimUpdateForm";
import { listClaims } from "@/lib/claim-db";
import { requirePermission } from "@/lib/session";
import { createClaimUpdateForm } from "../../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 1.5 — บันทึก Update งานเคลมของใบขอเคลมหนึ่งใบ */
export default async function NewClaimUpdatePage({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string; err?: string; msg?: string }>;
}) {
  const user = await requirePermission("CLM_UPDATE", "write");
  const params = await searchParams;

  // ตัวเลือกใบขอเคลมแสดงเฉพาะที่ยังใช้งานอยู่ — แต่ถ้าเปิดมาจากใบที่ยกเลิกแล้ว ให้เห็นใบนั้นด้วย
  const [openClaims, selectedList] = await Promise.all([
    listClaims({ doc_status: "active" }),
    params.claim ? listClaims({}) : Promise.resolve([]),
  ]);

  const selected = selectedList.find((c) => c.id === params.claim) ?? null;
  const claims =
    selected && !openClaims.some((c) => c.id === selected.id) ? [selected, ...openClaims] : openClaims;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">บันทึก Update งานเคลม</h1>
        <p className="text-sm text-slate-500">
          ช่องที่เว้นว่างไว้จะไม่ถูกเปลี่ยน — บันทึกเฉพาะสิ่งที่เกิดขึ้นจริงในครั้งนี้
        </p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <ClaimUpdateForm
        claims={claims}
        defaultClaimId={params.claim}
        defaultRecorderName={user.full_name}
        action={createClaimUpdateForm}
      />
    </main>
  );
}
