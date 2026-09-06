import PaymentForm from "@/components/procurement/PaymentForm";
import { getSelectableContext } from "@/lib/core-db";
import { remainingToPay } from "@/lib/procurement";
import { listAccounts, listDocs } from "@/lib/procurement-db";
import { requirePermission } from "@/lib/session";
import { createPaymentForm } from "../actions";

export const dynamic = "force-dynamic";

/**
 * หน้าจอ 4 — จ่ายเงินจากเงินสดย่อย (ใบใหม่)
 * เลือกใบขอซ่อม/ใบขอซื้อมาอ้างก็ได้ หรือจ่ายเป็นรายการทั่วไปโดยไม่ต้องผ่านอนุมัติก็ได้
 */
export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; msg?: string }>;
}) {
  const user = await requirePermission("PR_PAYMENT", "write");
  const params = await searchParams;

  const [all, accounts, context] = await Promise.all([
    listDocs({ doc_status: "active" }),
    listAccounts(),
    getSelectableContext(user.id),
  ]);

  // แสดงเฉพาะใบที่ยังมียอดค้างจ่าย — ใบที่อนุมัติแล้วขึ้นก่อนเพื่อให้หยิบง่าย
  const docs = all
    .filter((d) => remainingToPay(d) > 0 || (d.approve_status !== "approved" && d.actual_amount === 0))
    .sort((a, b) => Number(b.approve_status === "approved") - Number(a.approve_status === "approved"));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">จ่ายเงินจากเงินสดย่อย</h1>
        <p className="text-sm text-slate-500">
          เลขที่ใบเบิกระบบออกให้ตอนกดบันทึก โดยรันแยกตามบริษัทและสาขาที่ทำจ่าย
        </p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <PaymentForm
        docs={docs}
        accounts={accounts}
        companies={context.companies}
        branches={context.branches}
        defaultCompanyId={user.company_id ?? null}
        defaultBranchId={user.branch_id ?? null}
        defaultRecorderName={user.full_name}
        action={createPaymentForm}
        submitLabel="บันทึกใบเบิกเงินสดย่อย"
      />
    </main>
  );
}
