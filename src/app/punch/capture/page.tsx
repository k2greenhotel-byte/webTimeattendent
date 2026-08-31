import { redirect } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import { canPunch, effectiveSettings } from "@/lib/attendance";
import { workDateOf } from "@/lib/datetime";
import { getBranchById, getEmployeeById, getPunchesOfDay, getWorkSettings } from "@/lib/db";
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

  const workDate = workDateOf();
  const [globalSettings, punches, employee] = await Promise.all([
    getWorkSettings(),
    getPunchesOfDay(user.id, workDate),
    getEmployeeById(user.id),
  ]);

  const branch = await getBranchById(employee?.branch_id ?? null);
  const settings = effectiveSettings(globalSettings, branch);

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
