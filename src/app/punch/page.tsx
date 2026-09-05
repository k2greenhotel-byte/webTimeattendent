import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import Clock from "@/components/Clock";
import ErrandCard from "@/components/ErrandCard";
import FieldTaskCard from "@/components/FieldTaskCard";
import { canErrand, computeDaySummary, nextPunchType, sumErrandMinutes } from "@/lib/attendance";
import { formatDuration, formatThaiDate, formatTime, workDateOf } from "@/lib/datetime";
import {
  getBranchById,
  getEmployeeById,
  getPunchesOfDay,
  getResolvedDay,
  listErrandRounds,
  listMyFieldTasks,
  resolveWorkDateForPunch,
} from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PUNCH_LABEL, PUNCH_ORDER, type PunchType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PunchPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const employee = await getEmployeeById(user.id);
  const branch = await getBranchById(employee?.branch_id ?? null);

  // กะดึกที่ยังไม่ออกงาน → หน้านี้ยังแสดงวันเริ่มกะ (เมื่อวาน) ให้กดออกงานต่อได้
  const calendarDate = workDateOf();
  const workDate = await resolveWorkDateForPunch(user.id, branch?.id ?? null);
  const isYesterdayShift = workDate !== calendarDate;

  const [punches, { settings, isDayOff, assignment }, fieldTasks, errandRounds] = await Promise.all([
    getPunchesOfDay(user.id, workDate),
    getResolvedDay(branch?.id ?? null, user.id, workDate),
    listMyFieldTasks(user.id, calendarDate),
    listErrandRounds(user.id, workDate),
  ]);
  const siteToday = assignment?.site_id ? (assignment.site_name ?? settings.site_name) : null;

  const byType = new Map(punches.map((p) => [p.punch_type, p]));
  const done = punches.map((p) => p.punch_type);
  const next = nextPunchType(done);

  const summary = computeDaySummary(
    {
      work_date: workDate,
      check_in_at: byType.get("check_in")?.punched_at ?? null,
      break_out_at: byType.get("break_out")?.punched_at ?? null,
      break_in_at: byType.get("break_in")?.punched_at ?? null,
      check_out_at: byType.get("check_out")?.punched_at ?? null,
      errand_minutes: sumErrandMinutes(errandRounds),
      errand_rounds: errandRounds.length,
    },
    settings,
  );

  // ปุ่ม "ออกไปทำธุระ" ใช้ได้เฉพาะตอนที่กดได้จริง (เข้างานแล้ว ยังไม่เลิกงาน ไม่ได้พักเที่ยงอยู่)
  const errandGate = canErrand("out", done, errandRounds.some((r) => r.isOpen));

  const standardTime: Record<PunchType, string> = {
    check_in: settings.work_start,
    break_out: settings.break_start,
    break_in: settings.break_end,
    check_out: settings.work_end,
  };

  return (
    <div className="min-h-screen">
      <AppHeader
        user={user}
        links={[{ href: "/me", label: "ประวัติของฉัน" }]}
        subtitle={branch ? `สาขา ${branch.name}` : undefined}
      />

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <section className="card text-center">
          <p className="text-sm text-slate-500">{formatThaiDate(workDate)}</p>
          <p className="my-1 text-4xl font-bold text-slate-800">
            <Clock />
          </p>
          <p className="text-xs text-slate-500">
            {assignment ? "กะวันนี้" : "กะทำงาน"}: <span className="font-medium text-slate-700">{settings.schedule_name}</span>{" "}
            {settings.work_start} - {settings.work_end}
            {settings.crosses_midnight ? " (ข้ามเที่ยงคืน)" : ""} · พักได้ {settings.break_allow_minutes} นาที
          </p>
          {isYesterdayShift && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              กำลังลงเวลาต่อของกะวันที่ {formatThaiDate(workDate)} (กะข้ามเที่ยงคืน)
            </p>
          )}
          {isDayOff && (
            <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
              วันนี้เป็นวันหยุดเวรของคุณ — ถ้ามาทำงานสามารถลงเวลาได้ตามปกติ
            </p>
          )}
          {siteToday && (
            <p className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
              📍 วันนี้ประจำที่ <span className="font-medium">{siteToday}</span> — ลงเวลา 4 ครั้งตามปกติ
              {settings.require_gps ? " ระบบตรวจ GPS ที่นั่นแทนสาขา" : ""}
            </p>
          )}
        </section>

        {done.includes("check_in") && (
        <ErrandCard
          rounds={errandRounds}
          breakMinutes={summary.breakMinutes}
          quotaMinutes={settings.break_allow_minutes}
          blockedReason={errandGate.ok ? undefined : errandGate.reason}
        />
        )}

        <FieldTaskCard tasks={fieldTasks} employeeId={user.id} />

        {params.ok && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✓ บันทึกเวลาเรียบร้อยแล้ว
          </p>
        )}
        {params.error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.error}</p>
        )}

        <section className="space-y-3">
          {PUNCH_ORDER.map((type, index) => {
            const record = byType.get(type);
            const isNext = next === type;
            const state = record ? "done" : isNext ? "ready" : "locked";

            return (
              <div
                key={type}
                className={`card flex items-center gap-3 ${
                  state === "ready" ? "border-brand-500 ring-2 ring-brand-100" : ""
                } ${state === "locked" ? "opacity-60" : ""}`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                    state === "done"
                      ? "bg-emerald-100 text-emerald-700"
                      : state === "ready"
                        ? "bg-brand-500 text-white"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {state === "done" ? "✓" : index + 1}
                </div>

                <div className="mr-auto">
                  <p className="font-semibold text-slate-800">{PUNCH_LABEL[type]}</p>
                  <p className="text-xs text-slate-500">
                    เวลามาตรฐาน {standardTime[type]}
                    {record ? ` · ลงเวลาแล้ว ${formatTime(record.punched_at)} น.` : ""}
                  </p>
                </div>

                {state === "ready" && (
                  <Link href={`/punch/capture?type=${type}`} className="btn-primary">
                    ถ่ายรูป
                  </Link>
                )}
                {state === "done" && (
                  <span className="badge bg-emerald-50 text-emerald-700">บันทึกแล้ว</span>
                )}
              </div>
            );
          })}
        </section>

        {done.length > 0 && (
          <section className="card space-y-1 text-sm">
            <p className="font-semibold text-slate-700">สรุปวันนี้</p>
            <p className="flex justify-between">
              <span className="text-slate-500">ชั่วโมงทำงาน</span>
              <span>{summary.checkOutAt ? formatDuration(summary.workMinutes) : "กำลังทำงาน"}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">มาสาย</span>
              <span>{summary.lateMinutes > 0 ? `${summary.lateMinutes} นาที` : "ไม่สาย"}</span>
            </p>
            {summary.errandRounds > 0 && (
              <p className="flex justify-between">
                <span className="text-slate-500">ออกทำธุระ {summary.errandRounds} ครั้ง</span>
                <span>{formatDuration(summary.errandMinutes)}</span>
              </p>
            )}
            <p className="flex justify-between">
              <span className="text-slate-500">เวลาพัก</span>
              <span>
                {summary.breakMinutes > 0 ? formatDuration(summary.breakMinutes) : "-"}
                {summary.overBreakMinutes > 0 ? ` (เกิน ${summary.overBreakMinutes} นาที)` : ""}
              </span>
            </p>
          </section>
        )}

        {next === null && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-700">
            ลงเวลาครบ 4 ครั้งแล้ววันนี้ ขอบคุณครับ 🎉
          </p>
        )}
      </main>
    </div>
  );
}
