import {
  ADVANCE_STATUS_CLASS,
  ADVANCE_STATUS_LABEL,
  LEAVE_STATUS_CLASS,
  LEAVE_STATUS_LABEL,
  type AdvanceStatus,
  type LeaveStatus,
} from "@/lib/leave-types";

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <span className={`badge ${LEAVE_STATUS_CLASS[status]}`}>{LEAVE_STATUS_LABEL[status]}</span>;
}

export function AdvanceStatusBadge({ status }: { status: AdvanceStatus }) {
  return (
    <span className={`badge ${ADVANCE_STATUS_CLASS[status]}`}>{ADVANCE_STATUS_LABEL[status]}</span>
  );
}

export function LeaveTypeBadge({ icon, name }: { icon: string | null; name: string }) {
  return (
    <span className="badge bg-slate-100 text-slate-600">
      {icon ? `${icon} ` : ""}
      {name}
    </span>
  );
}

/** ธงเตือนของใบแจ้งลา (ขาดงาน · หักเงิน · ใบรับรองแพทย์) */
export function LeaveFlagList({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {flags.map((flag) => (
        <li key={flag} className="text-xs text-amber-700">
          ⚠ {flag}
        </li>
      ))}
    </ul>
  );
}
