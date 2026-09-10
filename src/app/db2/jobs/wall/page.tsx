import JobWallBoard from "@/components/db2/JobWallBoard";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** จอ War Room งานซ่อม — เปิดค้างบนจอมอนิเตอร์ รีเฟรชเองทุกนาที (ข้อมูลมาจากแอป Db2 ผ่าน /api/db2/jobs) */
export default async function Db2JobWallPage() {
  await requirePermission("DB2_JOB_WALL");
  return <JobWallBoard />;
}
