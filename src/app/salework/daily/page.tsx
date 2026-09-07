import Link from "next/link";
import { saveDailyLogForm } from "@/app/salework/actions";
import { workScope } from "@/app/salework/scope";
import DailyLogForm from "@/components/salework/DailyLogForm";
import { addDays, formatThaiDate, workDateOf } from "@/lib/datetime";
import { groupTaskTypes } from "@/lib/salework";
import { getLogByOwnerDate, listTaskTypes } from "@/lib/salework-db";
import type { LogItemRow, TaskType } from "@/lib/salework-types";
import { checkPermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * ประเภทงานที่ต้องแสดงบนใบของวันนี้ = ที่ยังเปิดใช้งานอยู่ + ที่ใบนี้เคยบันทึกไว้แล้ว
 * (งานที่แอดมินเพิ่งปิดใช้งานต้องยังเห็นบนใบเก่า ไม่งั้นข้อมูลที่กรอกไว้จะหายไปเงียบ ๆ)
 */
function typesForLog(all: TaskType[], usedIds: Set<string>): TaskType[] {
  const keep = new Map<string, TaskType>();
  for (const t of all) {
    if (t.is_active || usedIds.has(t.id)) keep.set(t.id, t);
  }
  // หัวข้อของงานย่อยที่เก็บไว้ ต้องติดมาด้วย ไม่งั้นงานย่อยจะหลุดจากกลุ่ม
  for (const t of [...keep.values()]) {
    if (t.parent_id && !keep.has(t.parent_id)) {
      const head = all.find((x) => x.id === t.parent_id);
      if (head) keep.set(head.id, head);
    }
  }
  return [...keep.values()];
}

/** หน้าจอ 1 — บันทึกงานประจำวันของพนักงานขายที่ล็อกอินอยู่ */
export default async function DailyLogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const { user } = await workScope("SW_ENTRY");
  const canWrite = await checkPermission("SW_ENTRY", "write");

  const today = workDateOf();
  const requested = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? (params.date as string) : today;
  const workDate = requested > today ? today : requested;

  const [allTypes, detail] = await Promise.all([
    listTaskTypes(false),
    getLogByOwnerDate(user.id, workDate),
  ]);

  const saved: Record<string, LogItemRow> = {};
  for (const item of detail?.items ?? []) {
    if (item.task_type_id) saved[item.task_type_id] = item;
  }

  const groups = groupTaskTypes(typesForLog(allTypes, new Set(Object.keys(saved))));

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">1. บันทึกงานประจำวัน</h1>
        <p className="text-sm text-slate-500">
          ติ๊กงานที่ทำแล้วในวันนี้ กรอกตัวเลขผลงาน และแนบรูปหรือคลิปเป็นหลักฐาน
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {/* เลือกวันที่ — ปกติทำงานวันไหนก็บันทึกวันนั้น แต่ย้อนกรอกของเมื่อวานได้ */}
      <form className="card flex flex-wrap items-end gap-2" method="get">
        <div className="grow">
          <label className="label" htmlFor="date">
            วันที่ทำงาน
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={workDate}
            max={today}
            className="input w-full sm:w-52"
          />
        </div>
        <button type="submit" className="btn-secondary">
          เปิดใบของวันที่เลือก
        </button>
        <Link href={`/salework/daily?date=${addDays(workDate, -1)}`} className="btn-secondary">
          วันก่อนหน้า
        </Link>
      </form>


      {groups.length === 0 ? (
        <p className="card text-sm text-slate-600">
          ยังไม่ได้ตั้งค่าประเภทงานในระบบ — ผู้ดูแลระบบต้องไปเพิ่มที่เมนู &quot;ตั้งค่าประเภทงาน&quot; ก่อน
        </p>
      ) : (
        <DailyLogForm
          workDate={workDate}
          dateLabel={formatThaiDate(workDate)}
          docNo={detail?.log.doc_no ?? null}
          ownerName={user.full_name}
          branchName={user.branch_name ?? null}
          submittedAt={detail?.log.submitted_at ?? null}
          groups={groups}
          saved={saved}
          note={detail?.log.note ?? null}
          canEdit={canWrite}
          action={saveDailyLogForm}
        />
      )}
    </main>
  );
}
