import { notFound } from "next/navigation";
import DocPrintSheet from "@/components/procurement/DocPrintSheet";
import { formatThaiDate } from "@/lib/datetime";
import { getRepair, listRepairPhotos } from "@/lib/procurement-db";
import { JOB_STATUS_LABEL, REPAIR_PAY_STATUS_LABEL, TECH_KIND_LABEL } from "@/lib/procurement-types";
import { formatPhone } from "@/lib/phone";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** พิมพ์ใบขอซ่อมเป็นเอกสารประกอบการจ่ายเงิน — มีเลขที่และวันที่อนุมัติครบ */
export default async function RepairPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("PR_REPAIR", "read");
  const { id } = await params;

  const repair = await getRepair(id);
  if (!repair) notFound();

  const photos = await listRepairPhotos(id);

  return (
    <DocPrintSheet
      kind="repair"
      docNo={repair.doc_no}
      docDate={repair.request_date}
      companyName={repair.company_name}
      branchName={repair.branch_name}
      itemName={repair.item_name}
      typeName={repair.asset_type_name}
      typeLabel="ประเภททรัพย์สิน"
      urgency={repair.urgency}
      detailLabel="อธิบายความเสียหาย"
      detail={repair.damage_detail}
      requestedAmount={repair.requested_amount}
      approvedAmount={repair.approved_amount}
      actualAmount={repair.actual_amount}
      approvalNo={repair.approval_no}
      approvedDate={repair.approved_date}
      approveStatus={repair.approve_status}
      payStatusLabel={REPAIR_PAY_STATUS_LABEL[repair.pay_status]}
      docStatus={repair.doc_status}
      rejectReason={repair.reject_reason}
      rejectNote={repair.reject_note}
      createdByName={repair.created_by_name ?? repair.created_by_full_name}
      note={repair.note}
      photos={photos}
      extraFields={[
        { label: "สถานะงาน", value: JOB_STATUS_LABEL[repair.job_status] },
        { label: "ผู้ดำเนินการแก้ไข", value: repair.tech_name },
        { label: "เบอร์โทรผู้แก้ไข", value: formatPhone(repair.tech_phone) },
        { label: "แก้ไขโดย", value: TECH_KIND_LABEL[repair.tech_kind] },
        {
          label: "วันที่ช่างเข้ามาแก้ไข",
          value: repair.tech_visit_date ? formatThaiDate(repair.tech_visit_date) : "—",
        },
        {
          label: "วันที่คาดว่าจะซ่อมเสร็จ",
          value: repair.expected_done_date ? formatThaiDate(repair.expected_done_date) : "—",
        },
        {
          label: "วันที่ได้รับการแก้ไขแล้ว",
          value: repair.fixed_date ? formatThaiDate(repair.fixed_date) : "—",
        },
      ]}
    />
  );
}
