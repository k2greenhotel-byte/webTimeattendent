import {
  CLAIM_DOC_STATUS_CLASS,
  CLAIM_DOC_STATUS_LABEL,
  CLAIM_JOB_STATUS_CLASS,
  CLAIM_JOB_STATUS_LABEL,
  CLAIM_URGENCY_CLASS,
  CLAIM_URGENCY_LABEL,
  type ClaimDocStatus,
  type ClaimJobStatus,
  type ClaimUrgency,
} from "@/lib/claim-types";

/** ป้ายสถานะทุกชุดของระบบแจ้งเคลม — สีกับข้อความมาจากที่เดียวกันทุกหน้า */

export function UrgencyBadge({ urgency }: { urgency: ClaimUrgency }) {
  return (
    <span className={`badge whitespace-nowrap ${CLAIM_URGENCY_CLASS[urgency]}`}>
      {CLAIM_URGENCY_LABEL[urgency]}
    </span>
  );
}

export function ClaimDocStatusBadge({ status }: { status: ClaimDocStatus }) {
  return (
    <span className={`badge whitespace-nowrap ${CLAIM_DOC_STATUS_CLASS[status]}`}>
      {CLAIM_DOC_STATUS_LABEL[status]}
    </span>
  );
}

export function ClaimJobStatusBadge({ status }: { status: ClaimJobStatus | null }) {
  if (!status) return <span className="text-slate-300">—</span>;
  return (
    <span className={`badge whitespace-nowrap ${CLAIM_JOB_STATUS_CLASS[status]}`}>
      {CLAIM_JOB_STATUS_LABEL[status]}
    </span>
  );
}

/** ป้ายเตือนงานเลยกำหนด — ส่งข้อความว่างมาจะไม่แสดงอะไรเลย */
export function OverdueBadge({ text }: { text: string }) {
  if (!text) return null;
  return <span className="badge whitespace-nowrap bg-rose-600 text-white">{text}</span>;
}

/** ลูกค้าภายนอกที่ไม่มีข้อมูลในระบบขาย (ข้อ 1.4.9) */
export function ExternalBadge({ isExternal }: { isExternal: boolean }) {
  if (!isExternal) return null;
  return <span className="badge whitespace-nowrap bg-amber-100 text-amber-700">ลูกค้าภายนอก</span>;
}
