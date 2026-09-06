import PaymentForm from "@/components/procurement/PaymentForm";
import { getSelectableContext } from "@/lib/core-db";
import { remainingToPay } from "@/lib/procurement";
import { listAccounts, listDocs } from "@/lib/procurement-db";
import { requirePermission } from "@/lib/session";
import { PAY_SOURCES, type PaySource } from "@/lib/procurement-types";
import { createPaymentForm } from "@/app/procurement/payments/actions";

export const dynamic = "force-dynamic";

/**
 * หน้าจอ 4 — จ่ายเงินจากเงินสดย่อย (ใบใหม่)
 * เลือกใบขอซ่อม/ใบขอซื้อมาอ้างก็ได้ หรือจ่ายเป็นรายการทั่วไปโดยไม่ต้องผ่านอนุมัติก็ได้
 */
export default async function PaymentNewView({
  source,
  params,
}: {
  source: PaySource;
  params: { err?: string; msg?: string };
}) {
  const spec = PAY_SOURCES[source];
  const user = await requirePermission(spec.menuCode, "write");

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
        <h1 className="text-xl font-bold text-slate-800">{spec.title}</h1>
        <p className="text-sm text-slate-500">
          {spec.description} · เลขที่เอกสารระบบออกให้ตอนกดบันทึก โดยรันแยกตามบริษัทและสาขาที่ทำจ่าย
        </p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <PaymentForm
        source={source}
        docs={docs}
        accounts={accounts}
        companies={context.companies}
        branches={context.branches}
        defaultCompanyId={user.company_id ?? null}
        defaultBranchId={user.branch_id ?? null}
        defaultRecorderName={user.full_name}
        action={createPaymentForm}
        submitLabel={`บันทึก${spec.docLabel}`}
      />
    </main>
  );
}
