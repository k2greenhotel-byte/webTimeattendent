"use client";

import Link from "next/link";
import { useState } from "react";
import { decideAdvanceForm } from "@/app/hr/actions";
import type { ApvRejectReason } from "@/lib/approval-types";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht } from "@/lib/leave";
import {
  ADVANCE_DECISION_ORDER,
  ADVANCE_STATUS_HINT,
  ADVANCE_STATUS_LABEL,
  type AdvanceRequestRow,
  type AdvanceStatus,
} from "@/lib/leave-types";
import { AdvanceStatusBadge } from "./StatusBadges";

const TONE: Record<string, string> = {
  approved: "border-emerald-300 bg-emerald-50",
  partial: "border-teal-300 bg-teal-50",
  rejected: "border-rose-300 bg-rose-50",
};

/**
 * หนึ่งใบขอเบิกเงินในหน้าจออนุมัติ พร้อมช่องเปลี่ยนสถานะท้ายรายการ
 * (อนุมัติ · อนุมัติยอดเงินบางส่วน + ระบุจำนวนที่อนุมัติ · ไม่อนุมัติ)
 */
export default function AdvanceDecisionCard({
  row,
  reasons,
  backTo,
  canDecide,
  limitText,
}: {
  row: AdvanceRequestRow;
  reasons: ApvRejectReason[];
  backTo: string;
  canDecide: boolean;
  /** ข้อความอธิบายวงเงินอนุมัติของผู้ใช้คนนี้ (null = ไม่ได้คุมวงเงิน) */
  limitText: string | null;
}) {
  const [status, setStatus] = useState<AdvanceStatus | "">("");

  return (
    <form
      action={decideAdvanceForm}
      className="rounded-xl border border-slate-200 bg-white p-3 md:p-4"
    >
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="back" value={backTo} />

      <div className="flex flex-col gap-3 lg:flex-row">
        {/* ---------- ข้อมูลใบขอเบิก ---------- */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">{row.doc_no}</span>
            <AdvanceStatusBadge status={row.status} />
            <span className="text-xs text-slate-500">{formatThaiDate(row.request_date)}</span>
          </div>

          <p className="text-sm text-slate-700">
            <strong>{row.employee_name}</strong>
            {row.branch_name ? ` · สาขา ${row.branch_name}` : ""}
          </p>

          <p className="text-sm text-slate-700">
            ขอเบิกเพื่อ: <strong>{row.purpose}</strong>
          </p>
          {row.detail && <p className="whitespace-pre-line text-sm text-slate-600">{row.detail}</p>}

          <p className="pt-1 text-lg font-bold text-slate-800">{formatBaht(row.amount)}</p>

          <p className="text-xs">
            <Link href={`/hr/advance/${row.id}`} className="text-brand-600 hover:underline">
              เปิดรายละเอียด
            </Link>
          </p>
        </div>

        {/* ---------- ช่องเปลี่ยนสถานะท้ายรายการ ---------- */}
        <div className="w-full space-y-2 lg:w-80 lg:border-l lg:border-slate-200 lg:pl-4">
          {canDecide ? (
            <>
              <span className="label">เปลี่ยนสถานะเป็น</span>
              <div className="space-y-1">
                {ADVANCE_DECISION_ORDER.map((option) => (
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
                      <span className="font-medium">{ADVANCE_STATUS_LABEL[option]}</span>
                      <span className="block text-xs text-slate-500">
                        {ADVANCE_STATUS_HINT[option]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              {status === "partial" && (
                <div>
                  <label className="label">ยอดเงินที่อนุมัติให้เบิก (บาท) *</label>
                  <input
                    name="approved_amount"
                    className="input"
                    inputMode="decimal"
                    defaultValue={row.amount}
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    ต้องน้อยกว่าที่ขอมา ({row.amount.toLocaleString("th-TH")} บาท)
                  </p>
                </div>
              )}

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
                  placeholder="หมายเหตุถึงผู้ขอ (ถ้ามี)"
                />
              )}

              <button type="submit" className="btn-primary w-full" disabled={status === ""}>
                บันทึกผลการพิจารณา
              </button>

              {limitText && <p className="text-xs text-slate-500">{limitText}</p>}
            </>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              บัญชีของคุณเปิดดูได้อย่างเดียว ยังกดอนุมัติไม่ได้ — ให้ผู้ดูแลระบบเปิดสิทธิ์
              &quot;เพิ่ม&quot; ของเมนูอนุมัติขอเบิกเงินให้ก่อน
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
