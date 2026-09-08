import AttWallBoard from "@/components/att/AttWallBoard";
import { requireMenuAccess } from "@/lib/att-access";

export const dynamic = "force-dynamic";

/**
 * จอ War Room ระบบลงเวลา — เปิดค้างบนจอมอนิเตอร์ ข้อมูลมาจาก /api/att/wall รีเฟรชเองทุกนาที
 * เข้าได้ด้วย PIN หลังบ้าน หรือสิทธิ์รายเมนู ATT_WALL (เหมือนหน้ารายงาน)
 */
export default async function AttWallPage() {
  await requireMenuAccess("ATT_WALL", "read");
  return <AttWallBoard />;
}
