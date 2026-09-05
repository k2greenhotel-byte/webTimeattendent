"use client";

import { useState } from "react";
import { decideForm } from "@/app/approvals/actions";
import {
  APV_DECISION_HINT,
  APV_DECISION_LABEL,
  type ApvDecision,
  type ApvRejectReason,
  type ApvRequestRow,
  type Authority,
} from "@/lib/approval-types";

/**
 * ฟอร์มตัดสินเรื่อง — ตัวเลือกที่กดไม่ได้จะถูกปิดพร้อมบอกเหตุผล
 * (เกินอำนาจ = เลือกได้แค่ "เสนอผู้มีอำนาจสูงกว่า")
 */
export default function DecisionForm({
  row,
  authority,
  reasons,
  canDecideFinal,
}: {
  row: ApvRequestRow;
  authority: Authority;
  reasons: ApvRejectReason[];
  canDecideFinal: boolean;
}) {
  const [decision, setDecision] = useState<ApvDecision>(canDecideFinal ? "approve" : "endorse");

  const options: { value: ApvDecision; disabled: boolean; why?: string }[] = [
    { value: "approve", disabled: !canDecideFinal, why: "เกินอำนาจของคุณ" },
    {
      value: "partial",
      disabled: !canDecideFinal || !row.allow_partial || !row.has_amount,
      why: !canDecideFinal
        ? "เกินอำนาจของคุณ"
        : !row.has_amount
          ? "เรื่องนี้ไม่มีจำนวนให้แบ่ง"
          : "เรื่องประเภทนี้อนุมัติบางส่วนไม่ได้",
    },
    {
      value: "reject",
      disabled: !canDecideFinal || !authority.canReject,
      why: canDecideFinal ? "บัญชีของคุณไม่มีอำนาจปฏิเสธ" : "เกินอำนาจของคุณ",
    },
    { value: "endorse", disabled: false },
  ];

  const limitText =
    authority.maxAmount === null
      ? "ไม่จำกัดวงเงิน"
      : `${authority.maxAmount.toLocaleString("th-TH")} บาท`;

  return (
    <form action={decideForm} className="card space-y-4">
      <input type="hidden" name="id" value={row.id} />

      <div>
        <h2 className="font-semibold text-slate-800">พิจารณาเรื่องนี้</h2>
        <p className="text-sm text-slate-500">
          อำนาจอนุมัติของคุณ: <strong className="text-slate-700">{limitText}</strong> · {authority.reason}
        </p>
      </div>

      {!canDecideFinal && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          เรื่องนี้ {row.requested_amount.toLocaleString("th-TH")} บาท เกินอำนาจของคุณ —
          ทำได้เฉพาะเสนอขึ้นผู้มีอำนาจสูงกว่าพร้อมความเห็นของคุณ
        </p>
      )}

      <div>
        <span className="label">ผลการพิจารณา *</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                opt.disabled
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                  : decision === opt.value
                    ? "border-brand-400 bg-brand-50"
                    : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="decision"
                value={opt.value}
                checked={decision === opt.value}
                disabled={opt.disabled}
                onChange={() => setDecision(opt.value)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{APV_DECISION_LABEL[opt.value]}</span>
                <span className="block text-xs">
                  {opt.disabled ? opt.why : APV_DECISION_HINT[opt.value]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {decision === "partial" && (
        <div>
          <label className="label">{row.amount_label} ที่อนุมัติ *</label>
          <input
            name="approved_amount"
            className="input sm:w-64"
            inputMode="decimal"
            defaultValue={row.requested_amount}
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            ต้องไม่เกินที่ขอมา ({row.requested_amount.toLocaleString("th-TH")})
          </p>
        </div>
      )}

      {decision === "reject" && (
        <div>
          <label className="label">เหตุผลที่ไม่อนุมัติ *</label>
          <select name="reason_id" className="input sm:w-96" required>
            <option value="">— เลือกเหตุผล —</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label">
          {decision === "endorse" ? "ความเห็นถึงผู้บริหาร *" : "หมายเหตุ"}
        </label>
        <textarea
          name="note"
          rows={2}
          className="input"
          placeholder={
            decision === "endorse"
              ? "เช่น ของจำเป็นต้องใช้เร่งด่วน เห็นควรอนุมัติ"
              : "บันทึกเพิ่มเติม (ถ้ามี)"
          }
          required={decision === "endorse"}
        />
      </div>

      <button type="submit" className="btn-primary">
        บันทึกผลการพิจารณา
      </button>
    </form>
  );
}
