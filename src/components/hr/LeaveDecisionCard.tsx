"use client";

import Link from "next/link";
import { useState } from "react";
import { decideLeaveForm } from "@/app/hr/actions";
import { formatThaiDate, formatTime } from "@/lib/datetime";
import { formatServiceMonths, leaveFlags, leaveRangeText } from "@/lib/leave";
import {
  LEAVE_DECISION_ORDER,
  LEAVE_STATUS_HINT,
  LEAVE_STATUS_LABEL,
  type LeaveRequestRow,
  type LeaveStatus,
} from "@/lib/leave-types";
import type { ApvRejectReason } from "@/lib/approval-types";
import { LeaveFlagList, LeaveStatusBadge, LeaveTypeBadge } from "./StatusBadges";

const TONE: Record<string, string> = {
  approved: "border-emerald-300 bg-emerald-50",
  need_docs: "border-sky-300 bg-sky-50",
  rejected: "border-rose-300 bg-rose-50",
};

/**
 * หนึ่งใบแจ้งลาในหน้าจออนุมัติ พร้อมช่องเปลี่ยนสถานะท้ายรายการ
 * (อนุมัติ · อนุมัติแต่ขอหลักฐานเพิ่ม · ไม่อนุมัติ)
 */
export default function LeaveDecisionCard({
  row,
  today,
  reasons,
  backTo,
  canDecide,
}: {
  row: LeaveRequestRow;
  today: string;
  reasons: ApvRejectReason[];
  backTo: string;
  canDecide: boolean;
}) {
  const [status, setStatus] = useState<LeaveStatus | "">("");
  const flags = leaveFlags(row, today);

  return (
    <form
      action={decideLeaveForm}
      className="rounded-xl border border-slate-200 bg-white p-3 md:p-4"
    >
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="back" value={backTo} />

      <div className="flex flex-col gap-3 lg:flex-row">
        {/* ---------- ข้อมูลใบแจ้ง ---------- */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">{row.doc_no}</span>
            <LeaveTypeBadge icon={row.type_icon} name={row.type_name} />
            <LeaveStatusBadge status={row.status} />
            {!row.is_paid && <span className="badge bg-slate-100 text-slate-500">ไม่ได้ค่าจ้าง</span>}
          </div>

          <p className="text-sm text-slate-700">
            <strong>{row.employee_name}</strong>
            {row.branch_name ? ` · สาขา ${row.branch_name}` : ""}
            {row.service_months !== null ? ` · อายุงาน ${formatServiceMonths(row.service_months)}` : ""}
          </p>

          <p className="text-sm text-slate-700">
            {leaveRangeText(row)}
            {!row.arrival_time && ` · ${row.total_days} วัน`}
          </p>

          <p className="text-xs text-slate-500">
            แจ้งเมื่อ {formatThaiDate(row.request_date)} เวลา {formatTime(row.reported_at)} น. ·
            แจ้งล่วงหน้า {row.notice_days} วัน
          </p>

          <p className="whitespace-pre-line text-sm text-slate-600">{row.detail}</p>

          <LeaveFlagList flags={flags} />

          <p className="pt-1 text-xs">
            <Link href={`/hr/leave/${row.id}`} className="text-brand-600 hover:underline">
              เปิดรายละเอียด/ไฟล์แนบ ({row.file_count})
            </Link>
            {row.require_medical_cert && (
              <span className={row.cert_count > 0 ? "ml-2 text-emerald-700" : "ml-2 text-rose-600"}>
                {row.cert_count > 0
                  ? "· มีใบรับรองแพทย์แล้ว"
                  : `· ยังไม่มีใบรับรองแพทย์ (กำหนด ${
                      row.cert_due_date ? formatThaiDate(row.cert_due_date) : "-"
                    })`}
              </span>
            )}
          </p>
        </div>

        {/* ---------- ช่องเปลี่ยนสถานะท้ายรายการ ---------- */}
        <div className="w-full space-y-2 lg:w-80 lg:border-l lg:border-slate-200 lg:pl-4">
          {canDecide ? (
            <>
              <span className="label">เปลี่ยนสถานะเป็น</span>
              <div className="space-y-1">
                {LEAVE_DECISION_ORDER.map((option) => (
                  <label
                    key={option}
                    className={`flex items-start gap-2 rounded-lg border p-2 text-sm ${
                      status === option ? TONE[option] : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={option}
                      checked={status === option}
                      onChange={() => setStatus(option)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">{LEAVE_STATUS_LABEL[option]}</span>
                      <span className="block text-xs text-slate-500">
                        {LEAVE_STATUS_HINT[option]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              {status === "rejected" && (
                <select name="reason_id" className="input" required>
                  <option value="">— เลือกเหตุผลที่ไม่อนุมัติ —</option>
                  {reasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}

              {status !== "" && (
                <textarea
                  name="note"
                  rows={2}
                  className="input"
                  placeholder={
                    status === "need_docs"
                      ? "ระบุว่าต้องการหลักฐานอะไรเพิ่ม เช่น ใบรับรองแพทย์ฉบับจริง"
                      : "หมายเหตุถึงผู้แจ้ง (ถ้ามี)"
                  }
                  required={status === "need_docs"}
                />
              )}

              <button type="submit" className="btn-primary w-full" disabled={status === ""}>
                บันทึกผลการพิจารณา
              </button>
            </>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              บัญชีของคุณเปิดดูได้อย่างเดียว ยังกดอนุมัติไม่ได้ — ให้ผู้ดูแลระบบเปิดสิทธิ์
              &quot;เพิ่ม&quot; ของเมนูอนุมัติการลาให้ก่อน
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
