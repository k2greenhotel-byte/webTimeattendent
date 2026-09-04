import { redirect } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import { canPunch } from "@/lib/attendance";
import {
  getEmployeeById,
  getPunchesOfDay,
  getResolvedSettings,
  resolveWorkDateForPunch,
} from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PUNCH_LABEL, PUNCH_ORDER, type PunchType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const user = await requireUser();

  if (!type || !PUNCH_ORDER.includes(type as PunchType)) {
    redirect("/punch?error=ประเภทการลงเวลาไม่ถูกต้อง");
  }
  const punchType = type as PunchType;

  const employee = await getEmployeeById(user.id);
  const workDate = await resolveWorkDateForPunch(user.id, employee?.branch_id ?? null);
  const [punches, settings] = await Promise.all([
    getPunchesOfDay(user.id, workDate),
    getResolvedSettings(employee?.branch_id ?? null, user.id, workDate),
  ]);

  const check = canPunch(
    punchType,
    punches.map((p) => p.punch_type),
  );
  if (!check.ok) redirect(`/punch?error=${encodeURIComponent(check.reason ?? "ลงเวลาไม่ได้")}`);

  return (
    <CameraCapture
      punchType={punchType}
      punchLabel={PUNCH_LABEL[punchType]}
      empCode={user.emp_code}
      fullName={user.full_name}
      requireGps={settings.require_gps}
    />
  );
}
