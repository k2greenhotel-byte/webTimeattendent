import HpDebtWallBoard from "@/components/db2/HpDebtWallBoard";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room ลูกหนี้เช่าซื้อ — ข้อมูลสดจากแอป Db2 ผ่าน /api/db2/hpdebt */
export default async function Db2HpDebtWallPage() {
  await requirePermission("DB2_HP_WALL");
  return <HpDebtWallBoard />;
}
