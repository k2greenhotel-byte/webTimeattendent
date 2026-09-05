import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  addLeaveFilesForm,
  cancelLeaveForm,
  deleteLeaveFileForm,
  markCertForm,
} from "@/app/hr/actions";
import LeaveDecisionCard from "@/components/hr/LeaveDecisionCard";
import FileUploader from "@/components/marketing/FileUploader";
import { LeaveFlagList, LeaveStatusBadge, LeaveTypeBadge } from "@/components/hr/StatusBadges";
import { listRejectReasons } from "@/lib/approval-db";
import { formatStampThai, formatThaiDate, formatTime, workDateOf } from "@/lib/datetime";
import { formatServiceMonths, leaveFlags, leaveRangeText } from "@/lib/leave";
import { getLeaveRequest, listLeaveFiles } from "@/lib/leave-db";
import { HR_FILE_ACCEPT, LEAVE_FILE_KIND_LABEL, MAX_LEAVE_FILES } from "@/lib/leave-types";
import { checkPermission, isApproverAuthed, requireActiveUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LeaveDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const user = await requireActiveUser();
  const { id } = await params;
  const query = await searchParams;
  const today = workDateOf();

  const row = await getLeaveRequest(id);
  if (!row) notFound();

  const isOwner = row.employee_id === user.id;
  const canSeeAll = await checkPermission("HR_LEAVE_APPROVE", "read");
  if (!isOwner && !canSeeAll) {
    redirect(`/hr/leave?err=${encodeURIComponent("ดูได้เฉพาะใบแจ้งของตัวเอง")}`);
  }

  const [files, canDecide, approverAuthed, reasons] = await Promise.all([
    listLeaveFiles(id),
    checkPermission("HR_LEAVE_APPROVE", "write"),
    isApproverAuthed(),
    listRejectReasons(true),
  ]);

  const editable = row.status === "pending" || row.status === "need_docs";
  const flags = leaveFlags(row, today);

  const facts: { label: string; value: string }[] = [
    { label: "1. เลขที่", value: row.doc_no },
    { label: "2. วันที่แจ้ง", value: formatThaiDate(row.request_date) },
    { label: "3. เวลาที่แจ้ง", value: `${formatStampThai(row.reported_at)} น.` },
    { label: "4. ผู้แจ้ง", value: row.employee_name },
    { label: "6. ประเภทการลา", value: `${row.type_icon ?? ""} ${row.type_name}` },
    { label: "ช่วงที่ลา", value: leaveRangeText(row) },
    { label: "จำนวนวัน", value: row.arrival_time ? "-" : `${row.total_days} วัน` },
    { label: "บริษัท / สาขา", value: `${row.company_name ?? "-"} · ${row.branch_name ?? "-"}` },
    { label: "อายุงาน ณ วันที่แจ้ง", value: formatServiceMonths(row.service_months) },
    { label: "แจ้งล่วงหน้า", value: `${row.notice_days} วัน` },
  ];

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            ใบแจ้งลา {row.doc_no} <LeaveStatusBadge status={row.status} />
          </h1>
          <p className="text-sm text-slate-500">
            <LeaveTypeBadge icon={row.type_icon} name={row.type_name} /> · {row.employee_name}
          </p>
        </div>
        <Link href="/hr/leave" className="text-sm text-brand-600 hover:underline">
          ← กลับไปรายการ
        </Link>
      </div>

      {query.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{query.msg}</p>
      )}
      {query.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.err}</p>
      )}

      {/* ---------- ข้อมูลใบแจ้ง ---------- */}
      <section className="card space-y-3">
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="flex gap-2 text-sm">
              <dt className="w-40 shrink-0 text-slate-500">{f.label}</dt>
              <dd className="font-medium text-slate-800">{f.value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="text-sm text-slate-500">5. รายละเอียด</p>
          <p className="whitespace-pre-line text-slate-800">{row.detail ?? "-"}</p>
        </div>

        {flags.length > 0 && (
          <div className="rounded-xl bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-800">ผลของเงื่อนไข ณ วันที่แจ้ง</p>
            <LeaveFlagList flags={flags} />
          </div>
        )}
      </section>

      {/* ---------- 7 + 8: ผลการพิจารณา ---------- */}
      <section className="card space-y-2">
        <h2 className="font-semibold text-slate-800">7–8. สถานะและผู้อนุมัติ</h2>
        <p className="text-sm">
          สถานะ: <LeaveStatusBadge status={row.status} />
        </p>
        {row.decided_by_name ? (
          <p className="text-sm text-slate-600">
            ผู้อนุมัติ: <strong>{row.decided_by_name}</strong> ·{" "}
            {row.decided_at ? `${formatStampThai(row.decided_at)} น.` : "-"}
          </p>
        ) : (
          <p className="text-sm text-slate-500">ยังไม่มีผู้พิจารณา</p>
        )}
        {row.reason_name && (
          <p className="text-sm text-rose-700">เหตุผลที่ไม่อนุมัติ: {row.reason_name}</p>
        )}
        {row.decision_note && (
          <p className="whitespace-pre-line text-sm text-slate-700">
            หมายเหตุจากผู้อนุมัติ: {row.decision_note}
          </p>
        )}
      </section>

      {/* ---------- 9: เอกสารแนบ ---------- */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-800">9. เอกสารแนบ ({files.length})</h2>
          {row.require_medical_cert && row.cert_due_date && (
            <span
              className={`badge ${
                row.cert_count > 0 || row.cert_received
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              ใบรับรองแพทย์ · กำหนดส่ง {formatThaiDate(row.cert_due_date)}
            </span>
          )}
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีไฟล์แนบ</p>
        ) : (
          <ul className="space-y-1">
            {files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="badge bg-slate-100 text-slate-600">
                  {LEAVE_FILE_KIND_LABEL[f.kind] ?? f.kind}
                </span>
                <a
                  href={`/api/hr/file?path=${encodeURIComponent(f.file_path)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  {f.file_name ?? "ไฟล์แนบ"}
                </a>
                <span className="text-xs text-slate-400">
                  {formatThaiDate(f.created_at.slice(0, 10))} {formatTime(f.created_at)} น.
                </span>
                {isOwner && editable && (
                  <form action={deleteLeaveFileForm} className="ml-auto">
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="file_id" value={f.id} />
                    <button type="submit" className="text-xs text-rose-600 hover:underline">
                      ลบ
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {isOwner && editable && (
          <form action={addLeaveFilesForm} className="space-y-3 rounded-xl border border-slate-200 p-3">
            <input type="hidden" name="id" value={row.id} />
            <div>
              <label className="label">ประเภทไฟล์ที่จะแนบ</label>
              <select name="kind" className="input sm:w-64" defaultValue="attach">
                <option value="attach">เอกสารประกอบ</option>
                <option value="cert">ใบรับรองแพทย์</option>
              </select>
            </div>
            <FileUploader
              name="new_file"
              label="เลือกไฟล์ที่จะแนบเพิ่ม"
              hint={`แนบได้สูงสุด ${MAX_LEAVE_FILES} ไฟล์ต่อครั้ง · รองรับรูปภาพและ PDF`}
              max={MAX_LEAVE_FILES}
              endpoint="/api/hr/file"
              accept={HR_FILE_ACCEPT}
            />
            <button type="submit" className="btn-primary w-full sm:w-auto">
              แนบไฟล์
            </button>
          </form>
        )}
      </section>

      {/* ---------- ผู้อนุมัติพิจารณาจากหน้านี้ได้เลย ---------- */}
      {canDecide && approverAuthed && (row.status === "pending" || row.status === "need_docs") && (
        <section className="space-y-2">
          <h2 className="font-semibold text-slate-800">พิจารณาใบนี้</h2>
          <LeaveDecisionCard
            row={row}
            today={today}
            reasons={reasons}
            backTo={`/hr/leave/${row.id}`}
            canDecide
          />
          {row.require_medical_cert && (
            <form action={markCertForm} className="card flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="back" value={`/hr/leave/${row.id}`} />
              <p className="mr-auto text-sm text-slate-600">
                ใบรับรองแพทย์:{" "}
                <strong>{row.cert_received ? "รับครบแล้ว" : "ยังไม่ได้บันทึกว่ารับครบ"}</strong>
              </p>
              <input type="hidden" name="received" value={row.cert_received ? "0" : "1"} />
              <button type="submit" className="btn-secondary">
                {row.cert_received ? "ยกเลิกการรับใบรับรองแพทย์" : "บันทึกว่ารับใบรับรองแพทย์แล้ว"}
              </button>
            </form>
          )}
        </section>
      )}

      {canDecide && !approverAuthed && row.status === "pending" && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
          ต้องยืนยันรหัสผ่านผู้อนุมัติก่อนจึงจะพิจารณาได้ —{" "}
          <Link href="/hr/approvals/leave" className="text-brand-600 hover:underline">
            ไปหน้าอนุมัติการลา
          </Link>
        </p>
      )}

      {/* ---------- ผู้แจ้งยกเลิกใบของตัวเอง ---------- */}
      {isOwner && row.status === "pending" && (
        <form action={cancelLeaveForm} className="card flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={row.id} />
          <label className="flex items-center gap-2 text-sm text-rose-700">
            <input type="checkbox" name="confirm" />
            ยืนยันยกเลิกใบแจ้งนี้
          </label>
          <button type="submit" className="btn-secondary text-rose-600">
            ยกเลิกใบแจ้ง
          </button>
        </form>
      )}
    </main>
  );
}
