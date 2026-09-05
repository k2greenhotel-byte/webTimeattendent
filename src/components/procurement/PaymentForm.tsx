"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import FileUploader, { type UploadedFile } from "@/components/marketing/FileUploader";
import PhotoUploader from "@/components/marketing/PhotoUploader";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht, remainingToPay, round2 } from "@/lib/procurement";
import {
  DOC_KIND_LABEL,
  MAX_PAYMENT_DOCS,
  MAX_PHOTOS,
  PR_FILE_ACCEPT,
  type PaymentRow,
  type PrDocRow,
} from "@/lib/procurement-types";

/** เอกสารต้นทางหนึ่งใบที่ใบเบิกจ่ายนี้เลือกไว้แล้ว (ตอนแก้ไข) */
export type PickedItem = { docId: string; amount: number };

/**
 * ฟอร์มบันทึกประกอบการจ่ายเงิน (หน้าจอ 4)
 * หนึ่งใบเบิกจ่ายอ้างใบขอซ่อม/ใบขอซื้อได้หลายใบ — ยอดรวมคำนวณสดขณะติ๊กเลือก
 * ผู้ใช้จะได้เห็นทันทีว่าจะจ่ายเท่าไหร่ ไม่ต้องกดบันทึกก่อนถึงจะรู้
 */
export default function PaymentForm({
  payment,
  docs,
  picked = [],
  photos = [],
  documents = [],
  defaultRecorderName,
  action,
  submitLabel,
}: {
  payment?: PaymentRow | null;
  /** เอกสารที่อนุมัติแล้วและยังเบิกได้ (รวมใบที่ใบนี้เลือกไว้อยู่แล้วตอนแก้ไข) */
  docs: PrDocRow[];
  picked?: PickedItem[];
  photos?: string[];
  documents?: UploadedFile[];
  defaultRecorderName?: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const pickedMap = useMemo(() => new Map(picked.map((p) => [p.docId, p.amount])), [picked]);

  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(picked.map((p) => [p.docId, true])),
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      docs.map((d) => [d.id, String(pickedMap.get(d.id) ?? remainingToPay(d))]),
    ),
  );

  const total = round2(
    docs.reduce(
      (sum, d) => (selected[d.id] ? sum + (Number(amounts[d.id]) || 0) : sum),
      0,
    ),
  );
  const pickedCount = docs.filter((d) => selected[d.id]).length;

  return (
    <form action={action} className="card space-y-5">
      {payment && <input type="hidden" name="id" value={payment.id} />}

      {/* ---------- 4.1-4.3 ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">เลขที่เบิกจ่าย</label>
          <input
            value={payment?.doc_no ?? ""}
            readOnly
            disabled
            className="input bg-slate-50 font-medium text-slate-600"
            placeholder="ระบบออกให้ตอนบันทึก"
          />
        </div>
        <div>
          <label className="label" htmlFor="pay_date">
            วันที่ขอเบิกเงิน *
          </label>
          <input
            id="pay_date"
            name="pay_date"
            type="date"
            defaultValue={payment?.pay_date ?? today}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">ยอดเงินที่จ่ายจริง</label>
          <input
            value={formatBaht(total)}
            readOnly
            disabled
            className="input bg-slate-50 font-medium text-slate-800"
          />
          <p className="mt-1 text-xs text-slate-400">รวมจากรายการที่เลือก {pickedCount} ใบ</p>
        </div>
        <div>
          <label className="label" htmlFor="created_by_name">
            ผู้บันทึก
          </label>
          <input
            id="created_by_name"
            name="created_by_name"
            defaultValue={payment?.created_by_name ?? defaultRecorderName ?? ""}
            className="input"
          />
        </div>
      </div>

      {/* ---------- 4.4 อ้างอิงใบขอซ่อม/ใบขอซื้อที่อนุมัติแล้ว ---------- */}
      <section className="space-y-2">
        <h2 className="font-semibold text-slate-800">
          เอกสารที่ขอเบิกจ่าย{" "}
          <span className="text-sm font-normal text-slate-400">(เลือกได้หลายใบ)</span>
        </h2>

        {docs.length === 0 ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            ยังไม่มีใบขอซ่อมหรือใบขอซื้อที่อนุมัติแล้วและยังเบิกได้ — ต้องผ่านหน้าจออนุมัติ (ข้อ 3) ก่อน
          </p>
        ) : (
          <ul className="space-y-2">
            {docs.map((doc) => {
              const on = Boolean(selected[doc.id]);
              const remaining = remainingToPay(doc);

              return (
                <li
                  key={doc.id}
                  className={`rounded-xl border p-3 ${
                    on ? "border-brand-400 bg-brand-50/40" : "border-slate-200"
                  }`}
                >
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0"
                      checked={on}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [doc.id]: e.target.checked }))
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-800">
                        {doc.doc_no}
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {DOC_KIND_LABEL[doc.kind]}
                        </span>
                      </span>
                      <span className="block truncate text-sm text-slate-600">{doc.item_name}</span>
                      <span className="block text-xs text-slate-500">
                        {formatThaiDate(doc.doc_date)}
                        {doc.branch_name ? ` · ${doc.branch_name}` : ""} · อนุมัติ{" "}
                        {formatBaht(doc.approved_amount)} · เบิกได้อีก {formatBaht(remaining)}
                      </span>
                    </span>
                  </label>

                  {on && (
                    <div className="mt-2 flex flex-wrap items-end gap-2 pl-8">
                      <input type="hidden" name="pick" value={`${doc.kind}:${doc.id}`} />
                      <div className="w-full sm:w-48">
                        <label className="label" htmlFor={`amount_${doc.id}`}>
                          ยอดที่เบิกใบนี้
                        </label>
                        <input
                          id={`amount_${doc.id}`}
                          name={`amount_${doc.id}`}
                          value={amounts[doc.id] ?? ""}
                          onChange={(e) =>
                            setAmounts((prev) => ({ ...prev, [doc.id]: e.target.value }))
                          }
                          className="input"
                          inputMode="decimal"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAmounts((prev) => ({ ...prev, [doc.id]: String(remaining) }))
                        }
                        className="btn-secondary"
                      >
                        เบิกเต็มยอด
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------- 4.5 รูปภาพประกอบ ---------- */}
      <div className="rounded-xl border border-slate-200 p-3">
        <PhotoUploader
          name="photo"
          label="รูปภาพประกอบ"
          hint={`แนบได้สูงสุด ${MAX_PHOTOS} รูป เช่น รูปงานที่ซ่อมเสร็จ หรือของที่ได้รับ`}
          max={MAX_PHOTOS}
          initialPaths={photos}
          prefix="payment"
          endpoint="/api/procurement/photo"
        />
      </div>

      {/* ---------- 4.6 ไฟล์เอกสารแนบ ---------- */}
      <div className="rounded-xl border border-slate-200 p-3">
        <FileUploader
          name="file_document"
          label="แนบไฟล์เอกสาร (ใบเสร็จ / ใบรับสินค้า)"
          hint={`แนบได้สูงสุด ${MAX_PAYMENT_DOCS} ไฟล์ · รองรับรูปและ PDF`}
          max={MAX_PAYMENT_DOCS}
          endpoint="/api/procurement/file"
          accept={PR_FILE_ACCEPT}
          initialFiles={documents}
        />
      </div>

      <div>
        <label className="label" htmlFor="note">
          หมายเหตุ
        </label>
        <input id="note" name="note" defaultValue={payment?.note ?? ""} className="input" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pickedCount === 0}>
          {submitLabel}
        </button>
        <Link href="/procurement/payments" className="btn-secondary w-full sm:w-auto">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
