import { notFound } from "next/navigation";
import DocPrintSheet from "@/components/procurement/DocPrintSheet";
import { formatThaiDate } from "@/lib/datetime";
import { getPurchase, listPurchasePhotos } from "@/lib/procurement-db";
import { PURCHASE_PAY_STATUS_LABEL } from "@/lib/procurement-types";
import { formatPhone } from "@/lib/phone";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** พิมพ์ใบขอจัดซื้อเป็นเอกสารประกอบการจ่ายเงิน — มีเลขที่และวันที่อนุมัติครบ */
export default async function PurchasePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("PR_PURCHASE", "read");
  const { id } = await params;

  const purchase = await getPurchase(id);
  if (!purchase) notFound();

  const photos = await listPurchasePhotos(id);

  return (
    <DocPrintSheet
      kind="purchase"
      docNo={purchase.doc_no}
      docDate={purchase.request_date}
      companyName={purchase.company_name}
      branchName={purchase.branch_name}
      itemName={purchase.item_name}
      typeName={purchase.material_type_name}
      typeLabel="ประเภทวัสดุ"
      urgency={purchase.urgency}
      detailLabel="สาเหตุหรือความจำเป็นในการซื้อ"
      detail={purchase.reason}
      requestedAmount={purchase.requested_amount}
      approvedAmount={purchase.approved_amount}
      actualAmount={purchase.actual_amount}
      approvalNo={purchase.approval_no}
      approvedDate={purchase.approved_date}
      approveStatus={purchase.approve_status}
      payStatusLabel={PURCHASE_PAY_STATUS_LABEL[purchase.pay_status]}
      docStatus={purchase.doc_status}
      rejectReason={purchase.reject_reason}
      rejectNote={purchase.reject_note}
      createdByName={purchase.created_by_name ?? purchase.created_by_full_name}
      note={purchase.note}
      photos={photos}
      extraFields={[
        { label: "ผู้ขาย / Supplier", value: purchase.supplier_name },
        { label: "เบอร์โทรผู้ขาย", value: formatPhone(purchase.supplier_phone) },
        {
          label: "วันที่ได้รับวัสดุแล้ว",
          value: purchase.received_date ? formatThaiDate(purchase.received_date) : "—",
        },
      ]}
    />
  );
}
