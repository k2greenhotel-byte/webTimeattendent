"use client";

import { useState } from "react";
import {
  AUD_AMOUNT_RESULT_LABEL,
  AUD_CALL_RESULT_CLASS,
  AUD_CALL_RESULT_LABEL,
  AUD_DOC_RESULT_CLASS,
  AUD_DOC_RESULT_LABEL,
  AUD_INFO_RESULT_CLASS,
  AUD_INFO_RESULT_LABEL,
  AUD_INFO_RESULT_SHORT,
  AUD_RESULT_CLASS,
  AUD_RESULT_LABEL,
  AUD_SLIP_RESULT_LABEL,
  type AudAmountResult,
  type AudCallResult,
  type AudCheckRow,
  type AudCheckType,
  type AudDocResult,
  type AudDocType,
  type AudInfoResult,
  type AudResult,
  type AudSlipResult,
} from "@/lib/audit-types";
import { formatBaht, rowTone } from "@/lib/audit";
import { formatThaiDate } from "@/lib/datetime";

type Props = {
  check: AudCheckRow;
  /** รายการตรวจต้นแบบ — บอกว่าการ์ดนี้ต้องมีช่องไหนบ้าง (null = รายการที่ถูกลบไปแล้ว ใช้ค่าเริ่มต้น) */
  type: AudCheckType | null;
  docTypes: AudDocType[];
  saveAction: (data: FormData) => void | Promise<void>;
  deleteAction: (data: FormData) => void | Promise<void>;
  editable: boolean;
  canDelete: boolean;
};

/** ตัวเลือกแบบปุ่มกด — อ่านง่ายกว่า radio เล็ก ๆ บนมือถือ */
function Choice<T extends string>({
  name,
  value,
  current,
  onPick,
  label,
  tone = "",
  disabled,
}: {
  name: string;
  value: T;
  current: T;
  onPick: (v: T) => void;
  label: string;
  tone?: string;
  disabled?: boolean;
}) {
  const active = current === value;
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition ${
        active ? `border-transparent font-medium ${tone || "bg-brand-500 text-white"}` : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={active}
        disabled={disabled}
        onChange={() => onPick(value)}
        className="sr-only"
      />
      {label}
    </label>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-700">{value}</dd>
    </div>
  );
}

/**
 * การ์ดตรวจหนึ่งรายการ — ข้อมูลจากต้นทางอยู่ด้านบน (อ่านอย่างเดียว)
 * ส่วนล่างคือผลตรวจที่ผู้ตรวจสอบกรอก ช่องที่แสดงขึ้นกับรายการตรวจแต่ละชนิด
 */
export default function CheckCard({
  check,
  type,
  docTypes,
  saveAction,
  deleteAction,
  editable,
  canDelete,
}: Props) {
  const hasDocs = type?.has_docs ?? true;
  const hasCall = type?.has_call ?? true;
  const hasSlip = type?.has_slip ?? false;

  const [result, setResult] = useState<AudResult>(check.result);
  const [docResult, setDocResult] = useState<AudDocResult>(check.doc_result);
  const [callResult, setCallResult] = useState<AudCallResult>(check.call_result);
  const [infoResult, setInfoResult] = useState<AudInfoResult>(check.info_result);
  const [slipResult, setSlipResult] = useState<AudSlipResult>(check.slip_result);
  const [slipAmountResult, setSlipAmountResult] = useState<AudAmountResult>(check.slip_amount_result);

  const missing = new Set(check.missing_docs ?? []);
  const extra = check.extra ?? {};
  const known = new Set(docTypes.map((d) => d.name));
  const otherMissing = [...missing].filter((m) => !known.has(m)).join(", ");

  return (
    <article className={`card space-y-3 ${rowTone(check)}`}>
      {/* ---------- ข้อมูลจากต้นทาง ---------- */}
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2">
        <div>
          <p className="text-xs text-slate-400">{check.type_name}</p>
          <h3 className="font-semibold text-slate-800">
            {check.ref_no ?? "— ไม่มีเลขที่ —"}
            {check.title && <span className="ml-2 font-normal text-slate-600">{check.title}</span>}
          </h3>
          <p className="text-xs text-slate-500">
            {check.ref_date ? formatThaiDate(check.ref_date) : "—"}
            {check.branch_label ? ` · ${check.branch_label}` : ""}
            {check.amount !== null ? ` · ${formatBaht(check.amount)} บาท` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          <span className={`badge ${AUD_RESULT_CLASS[check.result]}`}>{AUD_RESULT_LABEL[check.result]}</span>
          {hasDocs && (
            <span className={`badge ${AUD_DOC_RESULT_CLASS[check.doc_result]}`}>
              {AUD_DOC_RESULT_LABEL[check.doc_result]}
            </span>
          )}
          {hasCall && (
            <>
              <span className={`badge ${AUD_CALL_RESULT_CLASS[check.call_result]}`}>
                {AUD_CALL_RESULT_LABEL[check.call_result]}
              </span>
              {check.info_result !== "pending" && (
                <span className={`badge ${AUD_INFO_RESULT_CLASS[check.info_result]}`}>
                  {AUD_INFO_RESULT_SHORT[check.info_result]}
                </span>
              )}
            </>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Info label={type?.party_label ?? "ผู้เกี่ยวข้อง"} value={check.party} />
        <Info label="ยี่ห้อ / รุ่นรถ" value={[extra.brand, extra.model].filter(Boolean).join(" ")} />
        <Info label="บริษัทไฟแนนซ์" value={extra.finance} />
        <Info label="ช่องทางการขาย" value={extra.channel} />
        <Info label="เลขตัวถัง" value={extra.chassis} />
        <Info label="เบอร์ลูกค้า" value={extra.customer_phone} />
        <Info label="ผู้จัดทำ" value={extra.maker} />
        <Info label="ประเภทการจ่าย" value={extra.expense_type} />
        <Info label="เลขที่ใบอนุมัติ" value={extra.approval_no} />
        <Info label="ผู้อนุมัติ" value={extra.approver} />
        {check.payment_id && (
          <Info
            label="เอกสารต้นทาง"
            value={
              <a
                href={`/procurement/payments/${check.payment_id}`}
                className="text-brand-700 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                เปิดใบเบิก ↗
              </a>
            }
          />
        )}
      </dl>

      {/* ---------- ผลการตรวจ ---------- */}
      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="id" value={check.id} />
        <input type="hidden" name="audit_id" value={check.audit_id} />

        <fieldset disabled={!editable} className="space-y-3">
          <div>
            <p className="label">ผลการตรวจเอกสาร *</p>
            <div className="flex flex-wrap gap-2">
              <Choice name="result" value="correct" current={result} onPick={setResult} label={AUD_RESULT_LABEL.correct} tone="bg-emerald-600 text-white" />
              <Choice name="result" value="wrong" current={result} onPick={setResult} label={AUD_RESULT_LABEL.wrong} tone="bg-rose-600 text-white" />
              <Choice name="result" value="pending" current={result} onPick={setResult} label="ยังไม่ตรวจ" tone="bg-slate-500 text-white" />
            </div>
            <input
              name="result_note"
              defaultValue={check.result_note ?? ""}
              className="input mt-2"
              placeholder={result === "wrong" ? "ผิดตรงไหน (จำเป็นเมื่อไม่ถูกต้อง)" : "หมายเหตุ"}
              maxLength={500}
            />
          </div>

          {hasDocs && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="label">เอกสารประกอบ</p>
              <div className="flex flex-wrap gap-2">
                <Choice name="doc_result" value="complete" current={docResult} onPick={setDocResult} label={AUD_DOC_RESULT_LABEL.complete} tone="bg-emerald-600 text-white" />
                <Choice name="doc_result" value="incomplete" current={docResult} onPick={setDocResult} label={AUD_DOC_RESULT_LABEL.incomplete} tone="bg-amber-500 text-white" />
                <Choice name="doc_result" value="pending" current={docResult} onPick={setDocResult} label="ยังไม่ตรวจ" tone="bg-slate-500 text-white" />
              </div>

              {docResult === "incomplete" && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-slate-500">ติ๊กเอกสารที่ขาด</p>
                  <div className="flex flex-wrap gap-2">
                    {docTypes.map((d) => (
                      <label
                        key={d.id}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="missing"
                          value={`${d.id}|${d.name}`}
                          defaultChecked={missing.has(d.name)}
                          className="h-4 w-4"
                        />
                        {d.name}
                      </label>
                    ))}
                  </div>
                  <input
                    name="missing_other"
                    defaultValue={otherMissing}
                    className="input"
                    placeholder="เอกสารอื่น ๆ ที่ขาด (คั่นด้วยจุลภาค)"
                    maxLength={300}
                  />
                </div>
              )}

              <input
                name="doc_note"
                defaultValue={check.doc_note ?? ""}
                className="input mt-2"
                placeholder="หมายเหตุเรื่องเอกสาร"
                maxLength={500}
              />
            </div>
          )}

          {hasCall && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="label">การโทรถาม{type?.kind === "payment" ? "ผู้รับเงิน" : "ลูกค้า"}</p>
              <div className="flex flex-wrap gap-2">
                <Choice name="call_result" value="contacted" current={callResult} onPick={setCallResult} label={AUD_CALL_RESULT_LABEL.contacted} tone="bg-emerald-600 text-white" />
                <Choice name="call_result" value="no_contact" current={callResult} onPick={setCallResult} label={AUD_CALL_RESULT_LABEL.no_contact} tone="bg-slate-600 text-white" />
                <Choice name="call_result" value="pending" current={callResult} onPick={setCallResult} label="ยังไม่ได้โทร" tone="bg-slate-500 text-white" />
              </div>

              {callResult === "contacted" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Choice name="info_result" value="match" current={infoResult} onPick={setInfoResult} label={AUD_INFO_RESULT_LABEL.match} tone="bg-emerald-600 text-white" />
                  <Choice name="info_result" value="abnormal" current={infoResult} onPick={setInfoResult} label={AUD_INFO_RESULT_LABEL.abnormal} tone="bg-rose-600 text-white" />
                  <Choice name="info_result" value="branch_error" current={infoResult} onPick={setInfoResult} label={AUD_INFO_RESULT_LABEL.branch_error} tone="bg-amber-400 text-amber-950" />
                  <Choice name="info_result" value="pending" current={infoResult} onPick={setInfoResult} label="ยังไม่สรุป" tone="bg-slate-500 text-white" />
                </div>
              )}
              {callResult !== "contacted" && <input type="hidden" name="info_result" value={callResult === "no_contact" ? "pending" : infoResult} />}

              <input
                name="call_note"
                defaultValue={check.call_note ?? ""}
                className="input mt-2"
                placeholder="สิ่งที่ลูกค้าตอบ / ความผิดปกติที่พบ"
                maxLength={500}
              />
            </div>
          )}

          {hasSlip && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="label">สลิปนำฝากเงิน</p>
              <div className="flex flex-wrap gap-2">
                <Choice name="slip_result" value="has" current={slipResult} onPick={setSlipResult} label={AUD_SLIP_RESULT_LABEL.has} tone="bg-emerald-600 text-white" />
                <Choice name="slip_result" value="none" current={slipResult} onPick={setSlipResult} label={AUD_SLIP_RESULT_LABEL.none} tone="bg-rose-600 text-white" />
                <Choice name="slip_result" value="pending" current={slipResult} onPick={setSlipResult} label="ยังไม่ตรวจ" tone="bg-slate-500 text-white" />
              </div>

              {slipResult === "has" && (
                <>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Choice name="slip_amount_result" value="correct" current={slipAmountResult} onPick={setSlipAmountResult} label={AUD_AMOUNT_RESULT_LABEL.correct} tone="bg-emerald-600 text-white" />
                    <Choice name="slip_amount_result" value="wrong" current={slipAmountResult} onPick={setSlipAmountResult} label={AUD_AMOUNT_RESULT_LABEL.wrong} tone="bg-rose-600 text-white" />
                    <Choice name="slip_amount_result" value="pending" current={slipAmountResult} onPick={setSlipAmountResult} label="ยังไม่ตรวจ" tone="bg-slate-500 text-white" />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">ยอดบนสลิป (บาท)</label>
                      <input
                        name="slip_amount"
                        defaultValue={check.slip_amount ?? ""}
                        className="input"
                        inputMode="decimal"
                      />
                    </div>
                    <div>
                      <label className="label">ยอดที่ต้องนำฝาก (บาท)</label>
                      <input
                        name="deposit_amount"
                        defaultValue={check.deposit_amount ?? ""}
                        className="input"
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                </>
              )}
              {slipResult !== "has" && <input type="hidden" name="slip_amount_result" value="pending" />}
            </div>
          )}
        </fieldset>

        {editable && (
          <button type="submit" className="btn-primary w-full sm:w-auto">
            บันทึกผลการตรวจ
          </button>
        )}
      </form>

      {editable && canDelete && (
        <form action={deleteAction} className="border-t border-slate-100 pt-2">
          <input type="hidden" name="id" value={check.id} />
          <input type="hidden" name="audit_id" value={check.audit_id} />
          <button type="submit" className="text-xs text-rose-600 hover:underline">
            เอารายการนี้ออกจากใบคุมงาน
          </button>
        </form>
      )}
    </article>
  );
}
