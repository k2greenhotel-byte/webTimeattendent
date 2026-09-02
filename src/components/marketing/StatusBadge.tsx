import {
  ACTIVE_STATUS_LABEL,
  FLOW_STATUS_CLASS,
  FLOW_STATUS_LABEL,
  MEMO_STATUS_CLASS,
  MEMO_STATUS_LABEL,
  type MktActiveStatus,
  type MktFlowStatus,
  type MktMemoStatus,
} from "@/lib/marketing-types";

export function MemoBadge({ status }: { status: MktMemoStatus }) {
  return (
    <span className={`badge whitespace-nowrap ${MEMO_STATUS_CLASS[status]}`}>
      {MEMO_STATUS_LABEL[status]}
    </span>
  );
}

export function FlowBadge({ status }: { status: MktFlowStatus }) {
  return <span className={`badge ${FLOW_STATUS_CLASS[status]}`}>{FLOW_STATUS_LABEL[status]}</span>;
}

export function ActiveBadge({ status }: { status: MktActiveStatus }) {
  return (
    <span
      className={`badge ${status === "active" ? "bg-slate-100 text-slate-600" : "bg-rose-100 text-rose-700"}`}
    >
      {ACTIVE_STATUS_LABEL[status]}
    </span>
  );
}

/** แถบรูปแนบแบบอ่านอย่างเดียว (คลิกเพื่อเปิดรูปเต็ม) */
export function PhotoStrip({ paths, empty = "ไม่มีรูปแนบ" }: { paths: string[]; empty?: string }) {
  if (paths.length === 0) return <p className="text-sm text-slate-400">{empty}</p>;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {paths.map((path) => {
        const src = `/api/marketing/photo?path=${encodeURIComponent(path)}`;
        return (
          <a
            key={path}
            href={src}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-xl border border-slate-200"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="รูปแนบ" className="h-24 w-full object-cover" />
          </a>
        );
      })}
    </div>
  );
}
