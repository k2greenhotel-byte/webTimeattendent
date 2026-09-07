"use client";

import { useMemo, useState } from "react";
import MediaUploader from "@/components/salework/MediaUploader";
import type { LogItemRow, TaskGroup, TaskType } from "@/lib/salework-types";

type Props = {
  workDate: string;
  /** วันที่ทำงานแบบไทย เช่น "จ. 7 ก.ย. 2569" */
  dateLabel: string;
  docNo: string | null;
  ownerName: string;
  branchName: string | null;
  submittedAt: string | null;
  groups: TaskGroup[];
  /** บรรทัดที่บันทึกไว้แล้ว key = task_type_id */
  saved: Record<string, LogItemRow>;
  note: string | null;
  canEdit: boolean;
  action: (form: FormData) => void | Promise<void>;
};

/** การ์ดของงานหนึ่งรายการ — ติ๊กแล้วค่อยเปิดช่องกรอกข้อมูล จอมือถือจะได้ไม่ยาวเกินไป */
function TaskCard({
  task,
  saved,
  canEdit,
}: {
  task: TaskType;
  saved: LogItemRow | undefined;
  canEdit: boolean;
}) {
  const [done, setDone] = useState(saved?.done ?? false);

  return (
    <div
      className={`rounded-xl border p-3 transition ${
        done ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-white"
      }`}
    >
      <input type="hidden" name="task_id" value={task.id} />

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name={`done_${task.id}`}
          value="1"
          checked={done}
          disabled={!canEdit}
          onChange={(e) => setDone(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600"
        />
        <span className="min-w-0">
          <span className="block font-medium text-slate-800">{task.name}</span>
          {task.description && (
            <span className="block text-xs text-slate-500">{task.description}</span>
          )}
          <span className="block text-xs text-slate-400">
            {task.code}
            {task.daily_target !== null ? ` · เป้าหมายวันละ ${task.daily_target}` : ""}
            {!task.is_active ? " · (ปิดใช้งานแล้ว)" : ""}
          </span>
        </span>
      </label>

      {done && (
        <div className="mt-3 space-y-3 border-t border-emerald-200/70 pt-3">
          {task.metric_label && (
            <div>
              <label className="label" htmlFor={`qty_${task.id}`}>
                {task.metric_label}
                {task.metric_unit ? ` (${task.metric_unit})` : ""}
                {task.require_metric && <span className="ml-1 text-rose-600">*</span>}
              </label>
              <input
                id={`qty_${task.id}`}
                name={`qty_${task.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                step="1"
                defaultValue={saved?.qty ?? ""}
                disabled={!canEdit}
                className="input w-full sm:w-48"
              />
            </div>
          )}

          {task.allow_link && (
            <div>
              <label className="label" htmlFor={`link_${task.id}`}>
                ลิงก์โพสต์ / คลิป
              </label>
              <input
                id={`link_${task.id}`}
                name={`link_${task.id}`}
                type="text"
                inputMode="url"
                placeholder="วางลิงก์โพสต์ที่ทำไว้ เช่น https://www.facebook.com/…"
                defaultValue={saved?.link_url ?? ""}
                disabled={!canEdit}
                className="input w-full"
              />
            </div>
          )}

          <div>
            <label className="label" htmlFor={`detail_${task.id}`}>
              รายละเอียด / สถานที่ / หมายเหตุ
            </label>
            <textarea
              id={`detail_${task.id}`}
              name={`detail_${task.id}`}
              rows={2}
              defaultValue={saved?.detail ?? ""}
              disabled={!canEdit}
              className="input w-full"
            />
          </div>

          <MediaUploader
            name={`media_${task.id}`}
            initial={saved?.media ?? []}
            disabled={!canEdit}
            required={task.require_media}
          />
        </div>
      )}
    </div>
  );
}

/**
 * หน้าจอบันทึกงานประจำวันของพนักงานขาย (ข้อ 2)
 * เลขที่ใบงาน วันที่ และชื่อพนักงานมาจากระบบ — ผู้ใช้แค่ติ๊กงานที่ทำแล้วกรอกผลงาน
 */
export default function DailyLogForm({
  workDate,
  dateLabel,
  docNo,
  ownerName,
  branchName,
  submittedAt,
  groups,
  saved,
  note,
  canEdit,
  action,
}: Props) {
  const total = useMemo(
    () => groups.reduce((n, g) => n + (g.children.length || 1), 0),
    [groups],
  );
  const doneCount = Object.values(saved).filter((i) => i.done).length;

  return (
    <form action={action} className="space-y-4 pb-24">
      <input type="hidden" name="work_date" value={workDate} />

      <section className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="label">เลขที่ใบงาน</p>
            <p className="font-mono text-sm font-semibold text-slate-800">
              {docNo ?? "ระบบจะออกเลขให้เมื่อบันทึกครั้งแรก"}
            </p>
          </div>
          <div>
            <p className="label">วันที่ทำงาน</p>
            <p className="text-sm font-semibold text-slate-800">{dateLabel}</p>
            <p className="text-xs text-slate-500">เปลี่ยนวันที่ได้ที่ช่องเลือกวันด้านบน</p>
          </div>
          <div>
            <p className="label">พนักงานขาย</p>
            <p className="text-sm font-semibold text-slate-800">{ownerName}</p>
            <p className="text-xs text-slate-500">{branchName ? `สาขา ${branchName}` : "—"}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
            ทำแล้ว {doneCount}/{total} งาน
          </span>
          {submittedAt ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">ส่งงานแล้ว</span>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">ยังไม่ได้ส่งงาน</span>
          )}
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.head.id} className="card space-y-3">
          <h2 className="font-semibold text-slate-800">{group.head.name}</h2>

          {group.children.length === 0 ? (
            <TaskCard task={group.head} saved={saved[group.head.id]} canEdit={canEdit} />
          ) : (
            <div className="space-y-2">
              {group.children.map((child) => (
                <TaskCard key={child.id} task={child} saved={saved[child.id]} canEdit={canEdit} />
              ))}
            </div>
          )}
        </section>
      ))}

      <section className="card">
        <label className="label" htmlFor="note">
          สรุปงานวันนี้ / ปัญหาที่พบ
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={note ?? ""}
          disabled={!canEdit}
          className="input w-full"
          placeholder="เช่น ลูกค้าสนใจรุ่นไหนมาก ปัญหาที่เจอหน้างาน"
        />
      </section>

      {canEdit && (
        <div className="no-print fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl gap-2">
            <button type="submit" name="submit" value="0" className="btn-secondary flex-1">
              เก็บเป็นร่าง
            </button>
            <button type="submit" name="submit" value="1" className="btn-primary flex-1">
              ส่งงานวันนี้
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
