import PaymentForm from "@/components/procurement/PaymentForm";
import { remainingToPay } from "@/lib/procurement";
import { listDocs } from "@/lib/procurement-db";
import { requirePermission } from "@/lib/session";
import { createPaymentForm } from "../actions";

export const dynamic = "force-dynamic";

/** หน้าจอ 4 — บันทึกใบเบิกจ่ายใหม่ เลือกเอกสารที่อนุมัติแล้วและยังเบิกได้ */
export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; msg?: string }>;
}) {
  const user = await requirePermission("PR_PAYMENT", "write");
  const params = await searchParams;

  const approved = await listDocs({ approve_status: "approved" });
  const docs = approved.filter((d) => remainingToPay(d) > 0);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">บันทึกประกอบการจ่ายเงิน</h1>
        <p className="text-sm text-slate-500">
          เลขที่เบิกจ่ายระบบออกให้ตอนกดบันทึก · เลือกได้หลายใบขอซ่อม/ใบขอซื้อพร้อมกัน
        </p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <PaymentForm
        docs={docs}
        defaultRecorderName={user.full_name}
        action={createPaymentForm}
        submitLabel="บันทึกใบเบิกจ่าย"
      />
    </main>
  );
}
