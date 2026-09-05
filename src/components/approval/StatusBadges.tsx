import {
  APV_DECISION_CLASS,
  APV_DECISION_LABEL,
  APV_STATUS_CLASS,
  APV_STATUS_LABEL,
  type ApvDecision,
  type ApvStatus,
} from "@/lib/approval-types";

export function ApvStatusBadge({ status }: { status: ApvStatus }) {
  return <span className={`badge ${APV_STATUS_CLASS[status]}`}>{APV_STATUS_LABEL[status]}</span>;
}

export function ApvDecisionBadge({ decision }: { decision: ApvDecision }) {
  return (
    <span className={`badge ${APV_DECISION_CLASS[decision]}`}>{APV_DECISION_LABEL[decision]}</span>
  );
}

export function TypeBadge({ icon, name }: { icon: string | null; name: string }) {
  return (
    <span className="badge bg-slate-100 text-slate-600">
      {icon ? `${icon} ` : ""}
      {name}
    </span>
  );
}

export function OverdueBadge({ days }: { days: number }) {
  if (days <= 0) return null;
  return <span className="badge bg-rose-50 text-rose-700">เลยกำหนด {days} วัน</span>;
}
