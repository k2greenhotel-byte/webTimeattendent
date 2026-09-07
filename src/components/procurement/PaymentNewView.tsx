import PaymentForm from "@/components/procurement/PaymentForm";
import { getSelectableContext } from "@/lib/core-db";
import { remainingToPay } from "@/lib/procurement";
import { listAccounts, listDocs, listTags, listVendors } from "@/lib/procurement-db";
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

  const [all, accounts, tagSuggestions, vendors, context] = await Promise.all([
    listDocs({ doc_status: "active" }),
    listAccounts(),
    listTags(),
    listVendors(),
    getSelectableContext(user.id),
  ]);

  // ส่งใบที่อนุมัติแล้วไปทั้งหมด รวมใบที่จ่ายครบแล้วด้วย
  // เพราะหน้าต่างเลือกเลขที่อนุมัติต้องแสดงใบที่จ่ายแล้วพร้อมป้าย "จ่ายเงินแล้ว" (กดเลือกไม่ได้)
  // ผู้ใช้จะได้รู้ว่าใบนั้นมีอยู่และถูกจ่ายไปแล้ว ไม่ใช่หายไปเฉย ๆ
  const docs = all
    .filter((d) => d.approve_status === "approved")
    .sort((a, b) => Number(remainingToPay(b) > 0) - Number(remainingToPay(a) > 0));

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
        tagSuggestions={tagSuggestions}
        vendors={vendors}
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
