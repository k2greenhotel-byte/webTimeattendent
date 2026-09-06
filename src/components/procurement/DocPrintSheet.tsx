import PrintButton from "@/components/procurement/PrintButton";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/procurement";
import {
  APPROVE_STATUS_LABEL,
  DOC_KIND_LABEL,
  JOB_STATUS_LABEL,
  PR_DOC_STATUS_LABEL,
  PURCHASE_PAY_STATUS_LABEL,
  REJECT_REASON_LABEL,
  REPAIR_PAY_STATUS_LABEL,
  TECH_KIND_LABEL,
  URGENCY_LABEL,
  type PurchaseRow,
  type RepairRow,
} from "@/lib/procurement-types";

const ENDPOINT = "/api/procurement/photo";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="break-words text-sm text-slate-800">{value || "—"}</div>
    </div>
  );
}

/**
 * เอกสารใบขอซ่อม / ใบขอจัดซื้อ สำหรับพิมพ์ประกอบการจ่ายเงิน
 *
 * ตัวเดียวใช้ได้ทั้งสองชนิด เพราะช่องที่ต่างกันส่งเข้ามาเป็น extraFields
 * จอเล็กเรียงช่องละบรรทัด จอใหญ่และตอนพิมพ์เรียง 3 ช่องต่อแถว (A4 แนวตั้ง)
 */
export default function DocPrintSheet({
  kind,
  docNo,
  docDate,
  companyName,
  branchName,
  itemName,
  typeName,
  typeLabel,
  urgency,
  detailLabel,
  detail,
  requestedAmount,
  approvedAmount,
  actualAmount,
  approvalNo,
  approvedDate,
  approveStatus,
  payStatusLabel,
  docStatus,
  rejectReason,
  rejectNote,
  createdByName,
  note,
  photos,
  extraFields,
}: {
  kind: "repair" | "purchase";
  docNo: string;
  docDate: string;
  companyName: string | null;
  branchName: string | null;
  itemName: string;
  typeName: string | null;
  typeLabel: string;
  urgency: RepairRow["urgency"];
  detailLabel: string;
  detail: string | null;
  requestedAmount: number;
  approvedAmount: number;
  actualAmount: number;
  approvalNo: string | null;
  approvedDate: string | null;
  approveStatus: RepairRow["approve_status"];
  payStatusLabel: string;
  docStatus: RepairRow["doc_status"];
  rejectReason: RepairRow["reject_reason"];
  rejectNote: string | null;
  createdByName: string | null;
  note: string | null;
  photos: string[];
  extraFields: { label: string; value: React.ReactNode }[];
}) {
  const approved = approveStatus === "approved";

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-3 sm:p-4 print:max-w-full print:p-0">
      {/* เอกสารนี้พิมพ์แนวตั้ง ต่างจากค่าเริ่มต้นของระบบที่เป็น A4 แนวนอน */}
      <style>{"@media print { @page { size: A4 portrait; margin: 12mm; } }"}</style>

      <div className="no-print flex justify-end">
        <PrintButton />
      </div>

      <header className="space-y-1 border-b border-slate-300 pb-3 text-center">
        <h1 className="text-lg font-bold text-slate-800">
          {DOC_KIND_LABEL[kind]}
          {approved ? " (อนุมัติแล้ว)" : ""}
        </h1>
        <p className="text-sm text-slate-600">
          {companyName ?? "—"}
          {branchName ? ` · สาขา ${branchName}` : ""}
        </p>
        <p className="text-sm text-slate-500">
          เลขที่ {docNo} · วันที่ {formatThaiDate(docDate)}
        </p>
      </header>

      {/* ---------- แถบเลขที่อนุมัติ — เป็นสิ่งที่ฝ่ายบัญชีต้องเห็นเป็นอย่างแรก ---------- */}
      <section
        className={`rounded-xl border p-3 ${
          approved ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
        }`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="เลขที่ใบอนุมัติ" value={approvalNo} />
          <Field label="วันที่อนุมัติ" value={approvedDate ? formatThaiDate(approvedDate) : "—"} />
          <Field label="สถานะอนุมัติ" value={APPROVE_STATUS_LABEL[approveStatus]} />
          <Field label="จำนวนเงินที่อนุมัติ" value={formatBaht(approvedAmount)} />
        </div>
        {!approved && (
          <p className="mt-2 text-xs text-amber-800">
            เอกสารนี้ยังไม่ผ่านการอนุมัติ — ใช้ประกอบการจ่ายเงินได้ต่อเมื่อผ่านการอนุมัติแล้ว
          </p>
        )}
      </section>

      {/* ---------- รายละเอียดเอกสาร ---------- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3">
          <Field label="รายการ" value={itemName} />
        </div>
        <Field label={typeLabel} value={typeName} />
        <Field label="ความเร่งด่วน" value={URGENCY_LABEL[urgency]} />
        <Field label="ผู้บันทึกจัดทำ" value={createdByName} />
        {extraFields.map((f) => (
          <Field key={f.label} label={f.label} value={f.value} />
        ))}
        <div className="col-span-2 sm:col-span-3">
          <Field label={detailLabel} value={detail} />
        </div>
      </section>

      {/* ---------- ยอดเงินและสถานะ ---------- */}
      <section className="rounded-xl border border-slate-300">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="p-2 text-slate-500">จำนวนเงินที่ขอเบิก</td>
              <td className="p-2 text-right font-medium">{formatBaht(requestedAmount)}</td>
              <td className="p-2 text-slate-500">สถานะการเบิกเงิน</td>
              <td className="p-2">{payStatusLabel}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="p-2 text-slate-500">จำนวนเงินที่อนุมัติเบิก</td>
              <td className="p-2 text-right font-medium">{formatBaht(approvedAmount)}</td>
              <td className="p-2 text-slate-500">สถานะเอกสาร</td>
              <td className="p-2">{PR_DOC_STATUS_LABEL[docStatus]}</td>
            </tr>
            <tr>
              <td className="p-2 text-slate-500">จำนวนเงินที่เบิกจริง</td>
              <td className="p-2 text-right font-medium">{formatBaht(actualAmount)}</td>
              <td className="p-2 text-slate-500">คงเหลือเบิกได้</td>
              <td className="p-2">{formatBaht(Math.max(0, approvedAmount - actualAmount))}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {rejectReason && (
        <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
          เหตุผลไม่อนุมัติ: {REJECT_REASON_LABEL[rejectReason]}
          {rejectNote ? ` · ${rejectNote}` : ""}
        </p>
      )}

      {note && (
        <p className="text-sm text-slate-600">
          <span className="text-slate-500">หมายเหตุ:</span> {note}
        </p>
      )}

      {/* ---------- รูปประกอบ ---------- */}
      {photos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">รูปภาพประกอบ</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((path) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={path}
                src={`${ENDPOINT}?path=${encodeURIComponent(path)}`}
                alt="รูปประกอบ"
                className="h-24 w-full rounded-lg border border-slate-200 object-cover"
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------- ช่องลงนาม ---------- */}
      <section className="grid grid-cols-1 gap-6 pt-6 sm:grid-cols-3">
        {["ผู้จัดทำ", "ผู้อนุมัติ", "ผู้รับเงิน"].map((role) => (
          <div key={role} className="text-center text-sm">
            <div className="mx-auto mb-1 h-10 border-b border-dotted border-slate-400" />
            <div className="text-slate-600">ลงชื่อ {role}</div>
            <div className="mt-1 text-xs text-slate-400">วันที่ ......../......../........</div>
          </div>
        ))}
      </section>
    </main>
  );
}
