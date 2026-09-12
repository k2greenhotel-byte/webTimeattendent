import StockWallBoard from "@/components/db2/StockWallBoard";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room สต็อกรถ — เปิดค้างบนจอมอนิเตอร์ รีเฟรชเองทุกนาที (ข้อมูลมาจากแอป Db2 ผ่าน /api/db2/stock*) */
export default async function Db2StockWallPage() {
  await requirePermission("DB2_STOCK_WALL");
  return <StockWallBoard />;
}
