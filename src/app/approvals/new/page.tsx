import RequestForm from "@/components/approval/RequestForm";
import { listTypes } from "@/lib/approval-db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewApprovalRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requirePermission("APV_NEW", "write");
  const params = await searchParams;
  const types = (await listTypes(true)).filter((t) => t.form_enabled);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ยื่นเรื่องขออนุมัติ</h1>
        <p className="text-sm text-slate-500">
          เลือกประเภทเรื่อง กรอกรายละเอียดและจำนวน แล้วส่งให้ผู้มีอำนาจพิจารณา
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {types.length === 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ยังไม่มีประเภทเรื่องที่เปิดให้ยื่นจากฟอร์มกลาง — ให้ผู้ดูแลระบบเปิดที่เมนูตั้งค่าประเภทเรื่อง
        </p>
      )}

      <RequestForm types={types} />
    </main>
  );
}
