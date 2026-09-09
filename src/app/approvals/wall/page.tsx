import ApprovalWallBoard from "@/components/approval/ApprovalWallBoard";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * จอ War Room กล่องอนุมัติรวม — เปิดค้างบนจอในออฟฟิศ รีเฟรชเองทุกนาที
 *
 * เป็นจอเตือนว่ามีของค้าง ไม่ต้องผ่านประตูรหัสผู้อนุมัติเหมือนหน้า /approvals
 * เพราะดูอย่างเดียว กดอนุมัติไม่ได้ — ข้อมูลที่เห็นยังจำกัดตามสิทธิ์รายโปรแกรมอยู่ดี
 */
export default async function ApprovalWallPage() {
  await requirePermission("APV_WALL", "read");
  return <ApprovalWallBoard />;
}
