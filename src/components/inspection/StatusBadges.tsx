import { gradeOf } from "@/lib/inspection";
import {
  INSP_GRADE_CLASS,
  INSP_GRADE_LABEL,
  INSP_STATUS_CLASS,
  INSP_STATUS_LABEL,
  type InspStatus,
} from "@/lib/inspection-types";

/** ป้ายสถานะเอกสาร — สีชุดเดียวกันทุกหน้าจอ */
export function StatusBadge({ status }: { status: InspStatus }) {
  return <span className={`badge ${INSP_STATUS_CLASS[status]}`}>{INSP_STATUS_LABEL[status]}</span>;
}

/** ป้ายเกรดจากเปอร์เซ็นต์คะแนน */
export function GradeBadge({ scorePct }: { scorePct: number }) {
  const grade = gradeOf(scorePct);
  return (
    <span className={`badge ${INSP_GRADE_CLASS[grade]}`}>
      {INSP_GRADE_LABEL[grade]} {scorePct.toFixed(0)}%
    </span>
  );
}
