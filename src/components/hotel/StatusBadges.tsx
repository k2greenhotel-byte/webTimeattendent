import {
  HTL_PRIORITY_CLASS,
  HTL_PRIORITY_LABEL,
  HTL_RESULT_CLASS,
  HTL_RESULT_LABEL,
  HTL_STATUS_CLASS,
  HTL_STATUS_LABEL,
  type HtlPriority,
  type HtlResultValue,
  type HtlRoundStatus,
} from "@/lib/hotel-types";

/** ป้ายสถานะเอกสาร — สีชุดเดียวกันทุกหน้าจอ */
export function StatusBadge({ status }: { status: HtlRoundStatus }) {
  return <span className={`badge ${HTL_STATUS_CLASS[status]}`}>{HTL_STATUS_LABEL[status]}</span>;
}

/** ป้ายผลการตรวจรายข้อ — เขียว = ปกติ · แดง = ไม่ปกติ */
export function ResultBadge({ result }: { result: HtlResultValue | null }) {
  if (!result) return <span className="badge bg-slate-100 text-slate-500">ยังไม่ได้ตรวจ</span>;
  return <span className={`badge ${HTL_RESULT_CLASS[result]}`}>{HTL_RESULT_LABEL[result]}</span>;
}

/** ป้ายความเร่งด่วนที่ต้องแก้ไข — แดง / เหลือง / น้ำเงิน */
export function PriorityBadge({ priority }: { priority: HtlPriority | null }) {
  const value: HtlPriority = priority ?? "soon";
  return <span className={`badge ${HTL_PRIORITY_CLASS[value]}`}>{HTL_PRIORITY_LABEL[value]}</span>;
}

/** ป้ายสถานะการแก้ไขของข้อที่ไม่ปกติ */
export function FixBadge({ isFixed }: { isFixed: boolean }) {
  return isFixed ? (
    <span className="badge bg-emerald-100 text-emerald-700">แก้ไขแล้ว</span>
  ) : (
    <span className="badge bg-amber-100 text-amber-700">ยังไม่ได้แก้</span>
  );
}
