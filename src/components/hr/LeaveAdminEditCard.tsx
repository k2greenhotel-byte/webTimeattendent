"use client";

import Link from "next/link";
import { useState } from "react";
import { adminUpdateLeaveForm } from "@/app/hr/actions";
import type { ApvRejectReason } from "@/lib/approval-types";
import { formatStampThai } from "@/lib/datetime";
import { daysInRange, formatServiceMonths } from "@/lib/leave";
import {
  LEAVE_STATUS_LABEL,
  LEAVE_STATUS_ORDER,
  type LeaveRequestRow,
  type LeaveStatus,
  type LeaveType,
} from "@/lib/leave-types";
import { LeaveStatusBadge, LeaveTypeBadge } from "./StatusBadges";

const TONE: Record<string, string> = {
  pending: "border-amber-300 bg-amber-50",
  need_docs: "border-sky-300 bg-sky-50",
  approved: "border-emerald-300 bg-emerald-50",
  rejected: "border-rose-300 bg-rose-50",
  cancelled: "border-slate-300 bg-slate-50",
};

/**
 * หนึ่งใบแจ้งลาในหน้าฝ่ายบุคคล — แก้ไขได้ทุกฟิลด์ ทุกสถานะ
 * ต่างจาก LeaveDecisionCard (หน้าอนุมัติปกติ) ตรงที่แก้ใบที่ตัดสินไปแล้วได้ด้วย
 * และแก้ประเภท/ช่วงวัน/รายละเอียดได้จริง ไม่ใช่แค่เลือกผลอนุมัติ — ใช้กรณีพนักงานบันทึกผิด
 */
export default function LeaveAdminEditCard({
  row,
  types,
  reasons,
  backTo,
  canEdit,
}: {
  row: LeaveRequestRow;
  types: LeaveType[];
  reasons: ApvRejectReason[];
  backTo: string;
  canEdit: boolean;
}) {
  const [typeId, setTypeId] = useState(row.type_id);
  const [startDate, setStartDate] = useState(row.start_date);
  const [endDate, setEndDate] = useState(row.end_date);
  const [totalDays, setTotalDays] = useState(row.total_days);
  const [arrivalTime, setArrivalTime] = useState(row.arrival_time?.slice(0, 5) ?? "");
  const [status, setStatus] = useState<LeaveStatus>(row.status);

  const type = types.find((t) => t.id === typeId) ?? null;

  function pickStart(value: string) {
    setStartDate(value);
    if (!endDate || endDate < value) setEndDate(value);
  }

  return (
    <form
      action={adminUpdateLeaveForm}
      className="rounded-xl border border-slate-200 bg-white p-3 md:p-4"
    >
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="back" value={backTo} />

      <div className="flex flex-col gap-3 lg:flex-row">
        {/* ---------- ข้อมูลเดิม + ฟอร์มแก้ไข ---------- */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">{row.doc_no}</span>
            <LeaveTypeBadge icon={row.type_icon} name={row.type_name} />
            <LeaveStatusBadge status={row.status} />
          </div>

          <p className="text-sm text-slate-700">
            <strong>{row.employee_name}</strong>
            {row.branch_name ? ` · สาขา ${row.branch_name}` : ""}
            {row.service_months !== null ? ` · อายุงาน ${formatServiceMonths(row.service_months)}` : ""}
          </p>

          <p className="text-xs text-slate-500">
            แจ้งเมื่อ {formatStampThai(row.reported_at)} น.
            {row.decided_by_name && (
              <>
                {" "}
                · ตัดสินล่าสุดโดย <strong>{row.decided_by_name}</strong>
                {row.decided_at ? ` (${formatStampThai(row.decided_at)} น.)` : ""}
              </>
            )}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="label">ประเภทการลา *</label>
              <select
                name="type_id"
                className="input"
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                disabled={!canEdit}
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.name}
                    {t.is_active ? "" : " (ปิดใช้งาน)"}
                  </option>
                ))}
              </select>
            </div>

            {type?.needs_arrival_time ? (
              <div>
                <label className="label">วันที่ / เวลาที่จะมาถึง *</label>
                <div className="flex gap-2">
                  <input
                    name="start_date"
                    type="date"
                    className="input"
                    value={startDate}
                    onChange={(e) => pickStart(e.target.value)}
                    disabled={!canEdit}
                    required
                  />
                  <input
                    name="arrival_time"
                    type="time"
                    className="input"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    disabled={!canEdit}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label">วันที่เริ่ม *</label>
                  <input
                    name="start_date"
                    type="date"
                    className="input"
                    value={startDate}
                    onChange={(e) => pickStart(e.target.value)}
                    disabled={!canEdit}
                    required
                  />
                </div>
                <div>
                  <label className="label">วันที่สิ้นสุด *</label>
                  <input
                    name="end_date"
                    type="date"
                    className="input"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      if (startDate && e.target.value >= startDate) {
                        setTotalDays(daysInRange(startDate, e.target.value));
                      }
                    }}
                    disabled={!canEdit}
                    required
                  />
                </div>
                <div>
                  <label className="label">จำนวนวัน *</label>
                  <input
                    name="total_days"
                    type="number"
                    step="0.5"
                    min="0.5"
                    className="input"
                    value={totalDays}
                    onChange={(e) => setTotalDays(Number(e.target.value))}
                    disabled={!canEdit}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="label">รายละเอียด *</label>
            <textarea
              name="detail"
              rows={2}
              className="input"
              defaultValue={row.detail ?? ""}
              disabled={!canEdit}
              required
            />
          </div>

          <p className="text-xs">
            <Link href={`/hr/leave/${row.id}`} className="text-brand-600 hover:underline">
              เปิดรายละเอียด/ไฟล์แนบ ({row.file_count})
            </Link>
          </p>
        </div>

        {/* ---------- เปลี่ยนสถานะ + บันทึก ---------- */}
        <div className="w-full space-y-2 lg:w-80 lg:border-l lg:border-slate-200 lg:pl-4">
          {canEdit ? (
            <>
              <span className="label">เปลี่ยนสถานะเป็น</span>
              <div className="space-y-1">
                {LEAVE_STATUS_ORDER.map((option) => (
                  <label
                    key={option}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${
                      status === option ? TONE[option] : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={option}
                      checked={status === option}
                      onChange={() => setStatus(option)}
                    />
                    <span className="font-medium">{LEAVE_STATUS_LABEL[option]}</span>
                  </label>
                ))}
              </div>

              {status === "rejected" && (
                <select name="reason_id" className="input" defaultValue={row.reason_id ?? ""} required>
                  <option value="">— เลือกเหตุผลที่ไม่อนุมัติ —</option>
                  {reasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}

              <textarea
                name="note"
                rows={2}
                className="input"
                placeholder="เหตุผลที่แก้ไข เช่น พนักงานแจ้งประเภทลาผิด แก้จากลาป่วยเป็นลากิจ"
                defaultValue={row.decision_note ?? ""}
              />

              <button type="submit" className="btn-primary w-full">
                บันทึกการแก้ไข
              </button>
            </>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              บัญชีของคุณเปิดดูได้อย่างเดียว ยังแก้ไขไม่ได้ — ให้ผู้ดูแลระบบเปิดสิทธิ์
              &quot;เพิ่ม&quot; ของเมนูนี้ให้ก่อน
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
