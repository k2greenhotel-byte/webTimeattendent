import {
  CHANCE_CLASS,
  CHANCE_DOT_CLASS,
  CHANCE_LABEL,
  WORK_STATUS_CLASS,
  WORK_STATUS_LABEL,
  type Chance,
  type WorkStatus,
} from "@/lib/lead-types";

/** ป้ายสถานะของระบบ Lead — สีกับข้อความมาจากที่เดียวกันทุกหน้า */

export function WorkStatusBadge({ status }: { status: WorkStatus }) {
  return (
    <span className={`badge whitespace-nowrap ${WORK_STATUS_CLASS[status]}`}>
      {WORK_STATUS_LABEL[status]}
    </span>
  );
}

/** ข้อ 1.11 — โอกาสสูง (เขียว) กลาง (เหลือง) น้อย (แดง) */
export function ChanceBadge({ chance }: { chance: Chance }) {
  return (
    <span className={`badge whitespace-nowrap ${CHANCE_CLASS[chance]}`}>
      <span className={`mr-1 inline-block h-2 w-2 rounded-full ${CHANCE_DOT_CLASS[chance]}`} />
      โอกาส{CHANCE_LABEL[chance]}
    </span>
  );
}

/** ป้ายเตือน "เลยนัดติดตาม" — ใช้ในรายการและกระดานติดตาม */
export function OverdueBadge({ days }: { days: number }) {
  return (
    <span className="badge whitespace-nowrap bg-rose-600 text-white">
      เลยนัด {days} วัน
    </span>
  );
}
