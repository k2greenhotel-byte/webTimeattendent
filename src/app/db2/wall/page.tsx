import WallBoard from "@/components/db2/WallBoard";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room ยอดขาย — เปิดค้างบนจอมอนิเตอร์ รีเฟรชเองทุกนาที (ข้อมูลมาจากแอป Db2 ผ่าน /api/db2/wall) */
export default async function Db2WallPage() {
  await requirePermission("DB2_WALL");
  return <WallBoard />;
}
