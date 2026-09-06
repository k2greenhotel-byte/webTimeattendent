import { BADGE_CLASS, DOT_CLASS, colorOf } from "@/lib/lead-types";

/**
 * ป้ายสถานะของระบบ Lead
 * ชื่อและสีมาจากตารางสถานะที่ตั้งค่าได้ที่ /leads/setup — ไม่ได้ตายตัวในโค้ด
 */

export function WorkStatusBadge({
  name,
  color,
}: {
  name: string | null | undefined;
  color: string | null | undefined;
}) {
  return (
    <span className={`badge whitespace-nowrap ${BADGE_CLASS[colorOf(color)]}`}>
      {name || "— ไม่ระบุสถานะ —"}
    </span>
  );
}

/** ข้อ 1.11 — โอกาสการขาย พร้อมจุดสีนำหน้าให้กวาดตาเห็นได้เร็ว */
export function ChanceBadge({
  name,
  color,
}: {
  name: string | null | undefined;
  color: string | null | undefined;
}) {
  return (
    <span className={`badge whitespace-nowrap ${BADGE_CLASS[colorOf(color)]}`}>
      <span className={`mr-1 inline-block h-2 w-2 rounded-full ${DOT_CLASS[colorOf(color)]}`} />
      โอกาส{name || "— ไม่ระบุ —"}
    </span>
  );
}

/** ป้ายเตือน "เลยนัดติดตาม" — ใช้ในรายการและกระดานติดตาม */
export function OverdueBadge({ days }: { days: number }) {
  return <span className="badge whitespace-nowrap bg-rose-600 text-white">เลยนัด {days} วัน</span>;
}
