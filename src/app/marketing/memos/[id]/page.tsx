import Link from "next/link";
import { notFound } from "next/navigation";
import MemoForm from "@/components/marketing/MemoForm";
import { ActiveBadge, MemoBadge } from "@/components/marketing/StatusBadge";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { formatPeriod, isPeriodExpired } from "@/lib/marketing";
import { getStaffIdForEmployee, listMaster } from "@/lib/marketing-db";
import { getMemoRow, listMemoFiles, listMemoStatusLogs } from "@/lib/memo-db";
import {
  MEMO_STATUS_LABEL,
  MEMO_STATUS_ORDER,
} from "@/lib/marketing-types";
import { requireUser } from "@/lib/session";
import { changeMemoStatusForm, deleteMemoForm, updateMemoForm } from "../actions";

export const dynamic = "force-dynamic";

export default async function MemoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const memo = await getMemoRow(id);
  if (!memo) notFound();

  const user = await requireUser();
  const [files, logs, companies, staff, defaultStaffId] = await Promise.all([
    listMemoFiles(id),
    listMemoStatusLogs(id),
    listMaster("company"),
    listMaster("staff"),
    getStaffIdForEmployee(user.id),
  ]);

  const today = workDateOf();
  const expired = isPeriodExpired(memo.period_to, today) && memo.status !== "closed";

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Memo {memo.doc_no}</h1>
          <p className="text-sm text-slate-500">
            {formatThaiDate(memo.memo_date)} · {memo.company_name ?? "ไม่ระบุบริษัท"} ·{" "}
            {formatPeriod(memo.period_from, memo.period_to, formatThaiDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MemoBadge status={memo.status} />
          <ActiveBadge status={memo.active_status} />
          <Link href="/marketing/memos" className="btn-secondary">
            กลับไปรายการ
          </Link>
        </div>
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}
      {expired && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          เลยกำหนดระยะเวลาของ Memo นี้แล้ว ({formatThaiDate(memo.period_to as string)})
          แต่สถานะยังไม่ถูกปิดโครงการ
        </p>
      )}

      {/* ---------- หน้าจอ 8: บันทึกเปลี่ยนสถานะ ---------- */}
      <form action={changeMemoStatusForm} className="card space-y-3 border-brand-200">
        <div>
          <h2 className="font-semibold text-slate-800">บันทึกเปลี่ยนสถานะ</h2>
          <p className="text-sm text-slate-500">
            ทุกครั้งที่เปลี่ยน ระบบเก็บประวัติไว้ให้ ไม่ทับของเดิม
          </p>
        </div>
        <input type="hidden" name="id" value={memo.id} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">สถานะ *</label>
            <select name="status" className="input" defaultValue={memo.status} required>
              {MEMO_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {MEMO_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">วันที่เปลี่ยน *</label>
            <input type="date" name="changed_on" className="input" defaultValue={today} required />
          </div>
          <div>
            <label className="label">ผู้บันทึก</label>
            <select
              name="changed_by_staff_id"
              className="input"
              defaultValue={defaultStaffId ?? ""}
            >
              <option value="">— เลือกพนักงาน —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="label">หมายเหตุ</label>
            <input
              name="note"
              className="input"
              placeholder="เช่น ตั้งเบิกงวดที่ 1 แล้ว 50,000 บาท"
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={memo.active_status === "cancelled"}>
          บันทึกเปลี่ยนสถานะ
        </button>
      </form>

      {/* ---------- ประวัติการเปลี่ยนสถานะ ---------- */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">
          ประวัติสถานะ <span className="font-normal text-slate-400">({logs.length} ครั้ง)</span>
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีประวัติ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th>วันที่เปลี่ยน</th>
                  <th>สถานะ</th>
                  <th>ผู้บันทึก</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{formatThaiDate(l.changed_on)}</td>
                    <td>
                      <MemoBadge status={l.status} />
                    </td>
                    <td>{l.changed_by_name ?? "-"}</td>
                    <td className="!text-left">{l.note ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- แก้ไขข้อมูล Memo (field ของหน้าจอ 7) ---------- */}
      <div>
        <h2 className="mb-2 font-semibold text-slate-800">แก้ไขข้อมูล Memo</h2>
        <MemoForm
          action={updateMemoForm}
          memo={memo}
          files={files}
          companies={companies}
          staff={staff}
          defaultStaffId={defaultStaffId}
        />
      </div>

      <form action={deleteMemoForm} className="card space-y-3 border-rose-200">
        <h2 className="font-semibold text-rose-700">ลบ Memo นี้</h2>
        <p className="text-sm text-slate-600">
          จะลบไฟล์แนบ {files.length} ไฟล์และประวัติสถานะทั้งหมดออกถาวร ย้อนกลับไม่ได้
        </p>
        <input type="hidden" name="id" value={memo.id} />
        <input type="hidden" name="doc_no" value={memo.doc_no} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="confirm" className="h-4 w-4" />
          ยืนยันว่าต้องการลบ Memo {memo.doc_no}
        </label>
        <button type="submit" className="btn-danger">
          ลบถาวร
        </button>
      </form>
    </main>
  );
}
