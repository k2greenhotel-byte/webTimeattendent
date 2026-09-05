import {
  APPROVE_STATUS_CLASS,
  APPROVE_STATUS_LABEL,
  DOC_KIND_CLASS,
  DOC_KIND_LABEL,
  JOB_STATUS_CLASS,
  JOB_STATUS_LABEL,
  PAY_STATUS_CLASS,
  PR_DOC_STATUS_CLASS,
  PR_DOC_STATUS_LABEL,
  PURCHASE_PAY_STATUS_LABEL,
  REPAIR_PAY_STATUS_LABEL,
  URGENCY_CLASS,
  URGENCY_LABEL,
  type ApproveStatus,
  type DocKind,
  type JobStatus,
  type PayStatus,
  type PrDocStatus,
  type Urgency,
} from "@/lib/procurement-types";

/** ป้ายสถานะทุกชุดของระบบจัดซื้อ/แจ้งซ่อม — สีกับข้อความมาจากที่เดียวกันทุกหน้า */

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <span className={`badge whitespace-nowrap ${URGENCY_CLASS[urgency]}`}>
      {URGENCY_LABEL[urgency]}
    </span>
  );
}

export function PrDocStatusBadge({ status }: { status: PrDocStatus }) {
  return (
    <span className={`badge whitespace-nowrap ${PR_DOC_STATUS_CLASS[status]}`}>
      {PR_DOC_STATUS_LABEL[status]}
    </span>
  );
}

export function JobStatusBadge({ status }: { status: JobStatus | null }) {
  if (!status) return <span className="text-slate-300">—</span>;
  return (
    <span className={`badge whitespace-nowrap ${JOB_STATUS_CLASS[status]}`}>
      {JOB_STATUS_LABEL[status]}
    </span>
  );
}

export function ApproveStatusBadge({ status }: { status: ApproveStatus }) {
  return (
    <span className={`badge whitespace-nowrap ${APPROVE_STATUS_CLASS[status]}`}>
      {APPROVE_STATUS_LABEL[status]}
    </span>
  );
}

/** สถานะการเบิกเงิน — คำต่างกันระหว่างงานซ่อม (รับเงินแล้ว) กับงานซื้อ (จ่ายเงินแล้ว) */
export function PayStatusBadge({ status, kind }: { status: PayStatus; kind: DocKind }) {
  const label = kind === "repair" ? REPAIR_PAY_STATUS_LABEL[status] : PURCHASE_PAY_STATUS_LABEL[status];
  return <span className={`badge whitespace-nowrap ${PAY_STATUS_CLASS[status]}`}>{label}</span>;
}

export function DocKindBadge({ kind }: { kind: DocKind }) {
  return (
    <span className={`badge whitespace-nowrap ${DOC_KIND_CLASS[kind]}`}>{DOC_KIND_LABEL[kind]}</span>
  );
}

/** ป้ายเตือนงานเลยกำหนด — ส่งข้อความว่างมาจะไม่แสดงอะไรเลย */
export function OverdueBadge({ text }: { text: string }) {
  if (!text) return null;
  return <span className="badge whitespace-nowrap bg-rose-600 text-white">{text}</span>;
}
