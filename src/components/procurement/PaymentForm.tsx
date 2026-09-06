"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import FileUploader, { type UploadedFile } from "@/components/marketing/FileUploader";
import PhotoUploader from "@/components/marketing/PhotoUploader";
import SignaturePad from "@/components/procurement/SignaturePad";
import type { Company } from "@/lib/core-types";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht, remainingToPay, round2 } from "@/lib/procurement";
import {
  ACCOUNT_CATEGORY_LABEL,
  DOC_KIND_LABEL,
  MAX_PAYMENT_DOCS,
  MAX_PHOTOS,
  PAY_SOURCES,
  PR_FILE_ACCEPT,
  type PaymentRow,
  type PrAccountRow,
  type PaySource,
  type PrDocRow,
} from "@/lib/procurement-types";
import type { Branch } from "@/lib/types";

/** เอกสารต้นทางหนึ่งใบที่ใบเบิกนี้เลือกไว้แล้ว (ตอนแก้ไข) */
export type PickedItem = { docId: string; amount: number };

/**
 * ฟอร์มใบเบิกเงินสดย่อย (หน้าจอ 4)
 *
 * จ่ายได้สองแบบในหน้าเดียว:
 *   1) อ้างใบขอซ่อม/ใบขอซื้อ — ติ๊กเลือกได้หลายใบ ระบบดึงเลขที่อนุมัติมาใส่ช่องเลขที่อ้างอิงให้
 *   2) รายการทั่วไปที่ไม่ต้องขออนุมัติ — ไม่ต้องเลือกเอกสารเลย กรอกผู้รับเงินกับจำนวนเงินก็พอ
 *
 * เลขที่ใบเบิกรันแยกตามบริษัทและสาขาที่ทำจ่าย จึงบังคับให้เลือกทั้งสองช่อง
 * และรายการที่เลือกได้จำกัดตามสิทธิ์บริษัท/สาขาของผู้ใช้ (ส่งมาจากฝั่ง server แล้ว)
 */
export default function PaymentForm({
  source,
  payment,
  docs,
  accounts,
  companies,
  branches,
  picked = [],
  photos = [],
  documents = [],
  defaultCompanyId,
  defaultBranchId,
  defaultRecorderName,
  action,
  submitLabel,
}: {
  /** แหล่งเงินที่จ่าย — ตัดสินชุดเลขที่เอกสารและสิทธิ์ที่ฝั่ง server */
  source: PaySource;
  payment?: PaymentRow | null;
  /** ใบขอซ่อม/ใบขอซื้อที่ยังเบิกได้ (รวมใบที่ใบนี้เลือกไว้อยู่แล้วตอนแก้ไข) */
  docs: PrDocRow[];
  accounts: PrAccountRow[];
  companies: Company[];
  branches: Branch[];
  picked?: PickedItem[];
  photos?: string[];
  documents?: UploadedFile[];
  defaultCompanyId?: string | null;
  defaultBranchId?: string | null;
  defaultRecorderName?: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const pickedMap = useMemo(() => new Map(picked.map((p) => [p.docId, p.amount])), [picked]);

  const [companyId, setCompanyId] = useState(payment?.company_id ?? defaultCompanyId ?? "");
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(picked.map((p) => [p.docId, true])),
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(docs.map((d) => [d.id, String(pickedMap.get(d.id) ?? remainingToPay(d))])),
  );
  const [paidAmount, setPaidAmount] = useState(payment ? String(payment.paid_amount) : "");
  const [refNo, setRefNo] = useState(payment?.ref_no ?? "");
  const [expenseDetail, setExpenseDetail] = useState(payment?.expense_detail ?? "");
  const [approverName, setApproverName] = useState(payment?.approver_name ?? "");

  const pickedDocs = docs.filter((d) => selected[d.id]);
  const itemTotal = round2(
    pickedDocs.reduce((sum, d) => sum + (Number(amounts[d.id]) || 0), 0),
  );

  /** สาขาที่เลือกได้ต้องอยู่ในบริษัทที่เลือกไว้ (สาขาที่ยังไม่ระบุบริษัทให้เลือกได้เสมอ) */
  const branchOptions = branches.filter((b) => !companyId || !b.company_id || b.company_id === companyId);

  /** ติ๊กเอกสาร = ดึงยอดและเลขที่อนุมัติของใบนั้นมาเติมให้อัตโนมัติ */
  const toggle = (doc: PrDocRow, on: boolean) => {
    const next = { ...selected, [doc.id]: on };
    setSelected(next);

    const chosen = docs.filter((d) => next[d.id]);
    setPaidAmount(String(round2(chosen.reduce((s, d) => s + (Number(amounts[d.id]) || 0), 0))));

    // ดึงข้อมูลจากใบที่เลือกมาเติมให้ — เลขที่อนุมัติ ชื่อผู้อนุมัติ และรายการค่าใช้จ่าย
    // (ยังพิมพ์แก้เองได้ทุกช่อง ระบบแค่ช่วยไม่ให้ต้องคีย์ซ้ำ)
    const uniq = (values: (string | null)[]) => [...new Set(values.filter(Boolean))].join(", ");
    setRefNo(uniq(chosen.map((d) => d.approval_no)));
    setApproverName(uniq(chosen.map((d) => d.approved_by)));
    setExpenseDetail(uniq(chosen.map((d) => d.item_name)));
  };

  return (
    <form action={action} className="card space-y-5">
      <input type="hidden" name="pay_source" value={source} />
      {payment && <input type="hidden" name="id" value={payment.id} />}

      {/* ---------- หัวเอกสาร ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">เลขที่เอกสาร</label>
          <input
            value={payment?.doc_no ?? ""}
            readOnly
            disabled
            className="input bg-slate-50 font-medium text-slate-600"
            placeholder="ระบบออกให้ตามบริษัท/สาขา"
          />
        </div>
        <div>
          <label className="label" htmlFor="pay_date">
            วันที่ทำจ่าย *
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
          <label className="label" htmlFor="company_id">
            บริษัทที่ทำจ่าย *
          </label>
          <select
            id="company_id"
            name="company_id"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="input"
            required
          >
            <option value="">— เลือกบริษัท —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="branch_id">
            สาขาที่ทำจ่าย *
          </label>
          <select
            id="branch_id"
            name="branch_id"
            defaultValue={payment?.branch_id ?? defaultBranchId ?? ""}
            className="input"
            required
          >
            <option value="">— เลือกสาขา —</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
        เลขที่{PAY_SOURCES[source].docLabel}รันแยกตามบริษัทและสาขา (เช่น {PAY_SOURCES[source].prefix}-HQ-BKK-2569-0001) ·
        รายชื่อบริษัทและสาขาที่เลือกได้เป็นไปตามสิทธิ์ของบัญชีที่ล็อกอินอยู่
      </p>

      {/* ---------- เอกสารที่อ้างถึง (ไม่บังคับ) ---------- */}
      <section className="space-y-2">
        <h2 className="font-semibold text-slate-800">
          ใบขอซ่อม / ใบขอจัดซื้อที่อ้างถึง{" "}
          <span className="text-sm font-normal text-slate-400">(ไม่มีก็จ่ายได้)</span>
        </h2>

        {docs.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            ยังไม่มีใบขอซ่อมหรือใบขอซื้อที่รอเบิกจ่าย — จ่ายเป็นรายการทั่วไปได้เลยโดยกรอกช่องด้านล่าง
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
                      onChange={(e) => toggle(doc, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-800">
                        {doc.doc_no}
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {DOC_KIND_LABEL[doc.kind]}
                        </span>
                        {doc.approval_no && (
                          <span className="ml-2 badge bg-emerald-100 text-emerald-700">
                            อนุมัติ {doc.approval_no}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-sm text-slate-600">{doc.item_name}</span>
                      <span className="block text-xs text-slate-500">
                        {formatThaiDate(doc.doc_date)}
                        {doc.branch_name ? ` · ${doc.branch_name}` : ""} · อนุมัติ{" "}
                        {formatBaht(doc.approved_amount)} · เบิกได้อีก {formatBaht(remaining)}
                      </span>
                      {doc.approved_by && (
                        <span className="block text-xs text-slate-500">
                          ผู้อนุมัติ {doc.approved_by}
                          {doc.approved_date ? ` · ${formatThaiDate(doc.approved_date)}` : ""}
                        </span>
                      )}
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
                          onChange={(e) => {
                            const next = { ...amounts, [doc.id]: e.target.value };
                            setAmounts(next);
                            setPaidAmount(
                              String(
                                round2(
                                  docs
                                    .filter((d) => selected[d.id])
                                    .reduce((s, d) => s + (Number(next[d.id]) || 0), 0),
                                ),
                              ),
                            );
                          }}
                          className="input"
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {pickedDocs.length > 0 && (
          <p className="text-sm text-slate-600">
            เลือกไว้ {pickedDocs.length} ใบ · ยอดรวมของเอกสาร {formatBaht(itemTotal)}
          </p>
        )}
      </section>

      {/* ---------- ผู้รับเงินและจำนวนเงิน ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="ref_no">
            เลขที่อ้างอิง (เลขที่อนุมัติ)
          </label>
          <input
            id="ref_no"
            name="ref_no"
            value={refNo}
            onChange={(e) => setRefNo(e.target.value)}
            className="input"
            placeholder="เว้นว่างได้ถ้าไม่ผ่านอนุมัติ"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label" htmlFor="expense_detail">
            รายการค่าใช้จ่าย *
          </label>
          <input
            id="expense_detail"
            name="expense_detail"
            value={expenseDetail}
            onChange={(e) => setExpenseDetail(e.target.value)}
            className="input"
            placeholder="จ่ายค่าอะไร เช่น ค่าซ่อมแอร์ห้องประชุม / ค่าน้ำมันรถส่งของ"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="payee_name">
            ชื่อผู้ขายหรือผู้รับเงิน *
          </label>
          <input
            id="payee_name"
            name="payee_name"
            defaultValue={payment?.payee_name ?? ""}
            className="input"
            placeholder="ชื่อร้าน ช่าง หรือพนักงานที่รับเงินไป"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="payee_phone">
            เบอร์โทร
          </label>
          <input
            id="payee_phone"
            name="payee_phone"
            defaultValue={payment?.payee_phone ?? ""}
            className="input"
            inputMode="tel"
            placeholder="0812345678"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <label className="label" htmlFor="payee_address">
            ที่อยู่ผู้รับเงิน
          </label>
          <textarea
            id="payee_address"
            name="payee_address"
            defaultValue={payment?.payee_address ?? ""}
            className="input min-h-20"
            rows={2}
          />
        </div>
        <div>
          <label className="label" htmlFor="paid_amount">
            จำนวนเงิน *
          </label>
          <input
            id="paid_amount"
            name="paid_amount"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            className="input font-medium"
            inputMode="decimal"
            placeholder="0.00"
            required
          />
          {pickedDocs.length > 0 && itemTotal > (Number(paidAmount) || 0) && (
            <p className="mt-1 text-xs text-rose-600">
              น้อยกว่ายอดรวมของเอกสารที่เลือก ({formatBaht(itemTotal)})
            </p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="account_id">
            ประเภทค่าใช้จ่าย (ผังบัญชี)
          </label>
          <select
            id="account_id"
            name="account_id"
            defaultValue={payment?.account_id ?? ""}
            className="input"
          >
            <option value="">— ไม่ระบุ —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name} ({ACCOUNT_CATEGORY_LABEL[a.category]})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ---------- รูปและเอกสารแนบ ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <PhotoUploader
            name="photo"
            label="รูปถ่ายแนบประกอบ"
            hint={`แนบได้สูงสุด ${MAX_PHOTOS} รูป`}
            max={MAX_PHOTOS}
            initialPaths={photos}
            prefix="payment"
            endpoint="/api/procurement/photo"
          />
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <FileUploader
            name="file_document"
            label="เอกสารแนบประกอบ (ใบเสร็จ / ใบรับสินค้า)"
            hint={`แนบได้สูงสุด ${MAX_PAYMENT_DOCS} ไฟล์ · รองรับรูปและ PDF`}
            max={MAX_PAYMENT_DOCS}
            endpoint="/api/procurement/file"
            accept={PR_FILE_ACCEPT}
            initialFiles={documents}
          />
        </div>
      </div>

      {/* ---------- ผู้บันทึก ผู้อนุมัติ และลายเซ็น ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="created_by_name">
            ชื่อผู้บันทึก
          </label>
          <input
            id="created_by_name"
            name="created_by_name"
            defaultValue={payment?.created_by_name ?? defaultRecorderName ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="payer_name">
            ชื่อผู้ทำจ่าย
          </label>
          <input
            id="payer_name"
            name="payer_name"
            defaultValue={payment?.payer_name ?? defaultRecorderName ?? ""}
            className="input"
            placeholder="คนที่จ่ายเงินสดย่อยออกไป"
          />
        </div>
        <div>
          <label className="label" htmlFor="approver_name">
            ชื่อผู้อนุมัติ
          </label>
          <input
            id="approver_name"
            name="approver_name"
            value={approverName}
            onChange={(e) => setApproverName(e.target.value)}
            className="input"
            placeholder="ดึงมาจากใบอนุมัติที่อ้างถึง"
          />
          <p className="mt-1 text-xs text-slate-400">
            ผู้อนุมัติเซ็นไว้ที่ใบอนุมัติแล้ว ใบเบิกจึงเก็บแค่ชื่อ
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <SignaturePad
            name="payee_signature"
            label="ลายเซ็นผู้รับเงิน"
            hint="เซ็นด้วยนิ้วบนมือถือหรือเมาส์บน PC แล้วกดบันทึกลายเซ็น"
            initialPath={payment?.payee_signature ?? null}
          />
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <SignaturePad
            name="payer_signature"
            label="ลายเซ็นผู้ทำจ่าย"
            initialPath={payment?.payer_signature ?? null}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="note">
          หมายเหตุ
        </label>
        <input id="note" name="note" defaultValue={payment?.note ?? ""} className="input" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          {submitLabel}
        </button>
        <Link href="/procurement/payments" className="btn-secondary w-full sm:w-auto">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
