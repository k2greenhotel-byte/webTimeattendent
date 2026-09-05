import { redirect } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import { canErrand, canPunch } from "@/lib/attendance";
import {
  getEmployeeById,
  getFieldTask,
  getOrgSettings,
  getPunchesOfDay,
  getResolvedSettings,
  listErrandRounds,
  resolveWorkDateForPunch,
} from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  ERRAND_PUNCH_LABEL,
  FIELD_PUNCH_LABEL,
  PUNCH_LABEL,
  PUNCH_ORDER,
  type ErrandPunchType,
  type FieldPunchType,
  type PunchType,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; task?: string; reason?: string }>;
}) {
  const { type, task: taskId, reason } = await searchParams;
  const user = await requireUser();

  // ---- ออกไปทำธุระระหว่างวัน ----
  if (type === "errand_out" || type === "errand_in") {
    const errandType: ErrandPunchType = type === "errand_out" ? "out" : "in";
    const employee = await getEmployeeById(user.id);
    const workDate = await resolveWorkDateForPunch(user.id, employee?.branch_id ?? null);
    const [punches, rounds, settings] = await Promise.all([
      getPunchesOfDay(user.id, workDate),
      listErrandRounds(user.id, workDate),
      getResolvedSettings(employee?.branch_id ?? null, user.id, workDate),
    ]);

    const check = canErrand(
      errandType,
      punches.map((p) => p.punch_type),
      rounds.some((r) => r.isOpen),
    );
    if (!check.ok) redirect(`/punch?error=${encodeURIComponent(check.reason ?? "ลงเวลาไม่ได้")}`);

    return (
      <CameraCapture
        punchType={type}
        punchLabel={ERRAND_PUNCH_LABEL[errandType] + (reason ? ` · ${reason}` : "")}
        empCode={user.emp_code}
        fullName={user.full_name}
        requireGps={settings.require_gps}
        reason={reason}
      />
    );
  }

  // ---- ภารกิจนอกสถานที่: เริ่ม/จบ ----
  if (taskId) {
    if (type !== "start" && type !== "end") redirect("/punch?error=ประเภทการลงเวลาไม่ถูกต้อง");
    const fieldType = type as FieldPunchType;

    const task = await getFieldTask(taskId);
    if (!task || task.is_cancelled) redirect("/punch?error=ไม่พบภารกิจนี้หรือถูกยกเลิกแล้ว");
    const me = task.members.find((m) => m.employee_id === user.id);
    if (!me) redirect("/punch?error=คุณไม่ได้อยู่ในรายชื่อของภารกิจนี้");
    if (fieldType === "start" && me.start) redirect("/punch?error=คุณกดเริ่มงานนี้ไปแล้ว");
    if (fieldType === "end" && !me.start) redirect("/punch?error=กรุณากดเริ่มงานก่อน");
    if (fieldType === "end" && me.end) redirect("/punch?error=คุณกดจบงานนี้ไปแล้ว");

    const org = await getOrgSettings(task.company_id);
    const place = task.site_name ?? task.place_text ?? "";
    return (
      <CameraCapture
        punchType={fieldType}
        punchLabel={`${FIELD_PUNCH_LABEL[fieldType]} · ${task.type_name}${place ? ` ${place}` : ""}`}
        empCode={user.emp_code}
        fullName={user.full_name}
        requireGps={org.require_gps}
        taskId={task.id}
      />
    );
  }

  // ---- การลงเวลาปกติ 4 ครั้ง ----
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
