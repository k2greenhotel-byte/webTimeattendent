"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import FileUploader, { type UploadedFile } from "@/components/marketing/FileUploader";
import PhotoUploader from "@/components/marketing/PhotoUploader";
import ApprovalPicker from "@/components/procurement/ApprovalPicker";
import SignaturePad from "@/components/procurement/SignaturePad";
import TagInput from "@/components/procurement/TagInput";
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
  type PrTag,
  type PrTagRow,
  type PrVendorRow,
  type PaySource,
  type PrDocRow,
  type DocKind,
} from "@/lib/procurement-types";
import type { Branch } from "@/lib/types";

/** หนึ่งบรรทัดในใบเบิกที่บันทึกไว้แล้ว (ตอนแก้ไข) */
export type PickedItem = {
  /** null = ค่าใช้จ่ายทั่วไปที่ไม่ได้ผูกกับใบขอซ่อม/ใบขอซื้อ */
  docId: string | null;
  docKind: DocKind | null;
  amount: number;
  detail: string | null;
  accountId: string | null;
};

/** บรรทัดค่าใช้จ่ายที่กำลังกรอกอยู่บนหน้าจอ */
type Line = {
  /** คีย์ของ React เท่านั้น ไม่ได้ส่งไป server */
  key: string;
  docId: string | null;
  docKind: DocKind | null;
  detail: string;
  accountId: string;
  amount: string;
};

let lineSeq = 0;
const newKey = () => `line-${(lineSeq += 1)}`;

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
  vendors = [],
  tags = [],
  tagSuggestions = [],
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
  /** ทะเบียนเจ้าหนี้/ผู้ขายที่จ่ายเป็นประจำ */
  vendors?: PrVendorRow[];
  /** ป้ายที่ติดอยู่บนใบนี้ (ตอนแก้ไข) */
  tags?: PrTag[];
  /** ป้ายที่เคยใช้ในระบบ ไว้ให้กดเลือก */
  tagSuggestions?: PrTagRow[];
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
  /*
   * ใบเบิกหนึ่งใบมีได้หลายบรรทัด — ผูกกับใบอนุมัติก็ได้ หรือเป็นค่าใช้จ่ายทั่วไปก็ได้
   * ปนกันในใบเดียวได้ และแต่ละบรรทัดลงผังบัญชีของตัวเอง รายงานแยกตามหมวดจึงตรง
   */
  const [lines, setLines] = useState<Line[]>(() =>
    picked.length > 0
      ? picked.map((p) => ({
          key: newKey(),
          docId: p.docId,
          docKind: p.docKind,
          detail: p.detail ?? "",
          accountId: p.accountId ?? "",
          amount: String(p.amount),
        }))
      : [],
  );
  const [refNo, setRefNo] = useState(payment?.ref_no ?? "");
  const [expenseDetail, setExpenseDetail] = useState(payment?.expense_detail ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [vendorId, setVendorId] = useState(payment?.vendor_id ?? "");
  const [payee, setPayee] = useState({
    name: payment?.payee_name ?? "",
    phone: payment?.payee_phone ?? "",
    address: payment?.payee_address ?? "",
  });
  const [approverName, setApproverName] = useState(payment?.approver_name ?? "");

  const docById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const pickedIds = useMemo(
    () => new Set(lines.map((l) => l.docId).filter((id): id is string => Boolean(id))),
    [lines],
  );

  /** ยอดรวมทั้งใบ = ผลรวมของทุกบรรทัด ไม่ต้องคีย์ซ้ำและไม่มีทางไม่ตรงกัน */
  const total = round2(lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0));

  /** ช่องหัวเอกสารที่สรุปมาจากบรรทัด — ยังพิมพ์แก้เองได้ ระบบแค่เติมให้ */
  const summarize = (next: Line[]) => {
    const uniq = (values: (string | null | undefined)[]) =>
      [...new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))].join(", ");

    setExpenseDetail(uniq(next.map((l) => l.detail)));
    setRefNo(uniq(next.map((l) => (l.docId ? docById.get(l.docId)?.approval_no : null))));
    setApproverName(uniq(next.map((l) => (l.docId ? docById.get(l.docId)?.approved_by : null))));
  };

  const applyLines = (next: Line[]) => {
    setLines(next);
    summarize(next);
  };

  const patchLine = (key: string, patch: Partial<Line>) =>
    applyLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) => applyLines(lines.filter((l) => l.key !== key));

  /** บรรทัดค่าใช้จ่ายทั่วไป — ไม่ผูกใบอนุมัติ พิมพ์รายการเอง */
  const addFreeLine = () =>
    applyLines([
      ...lines,
      { key: newKey(), docId: null, docKind: null, detail: "", accountId: "", amount: "" },
    ]);

  /**
   * เลือกเจ้าหนี้จากทะเบียน = เติมชื่อ ที่อยู่ เบอร์โทรให้ทันที
   * เลือก "ผู้ขายไม่ประจำ" = ล้างการอ้างทะเบียน แล้วพิมพ์เองได้
   * (ค่าที่เติมยังแก้เองได้ เพราะบางครั้งจ่ายให้สาขาย่อยของเจ้าหนี้รายเดียวกัน)
   */
  const chooseVendor = (id: string) => {
    setVendorId(id);
    const v = vendors.find((x) => x.id === id);
    if (v) setPayee({ name: v.name, phone: v.phone ?? "", address: v.address ?? "" });
  };

  /** สาขาที่เลือกได้ต้องอยู่ในบริษัทที่เลือกไว้ (สาขาที่ยังไม่ระบุบริษัทให้เลือกได้เสมอ) */
  const branchOptions = branches.filter((b) => !companyId || !b.company_id || b.company_id === companyId);

  /**
   * ติ๊กเอกสารจากหน้าต่างเลือกเลขที่อนุมัติ = เพิ่มบรรทัดของใบนั้นเข้ามาหนึ่งบรรทัด
   * พร้อมเติมรายการและยอดที่ยังเบิกได้ให้ (แก้เองได้ทุกช่อง)
   * ติ๊กออก = เอาบรรทัดของใบนั้นออก
   */
  const toggle = (doc: PrDocRow, on: boolean) => {
    if (!on) {
      applyLines(lines.filter((l) => l.docId !== doc.id));
      return;
    }
    if (lines.some((l) => l.docId === doc.id)) return;

    applyLines([
      ...lines,
      {
        key: newKey(),
        docId: doc.id,
        docKind: doc.kind,
        detail: doc.item_name,
        accountId: "",
        amount: String(pickedMap.get(doc.id) ?? remainingToPay(doc)),
      },
    ]);
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

      {/* ---------- รายการค่าใช้จ่ายในใบเบิก (หลายรายการต่อหนึ่งใบ) ---------- */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-semibold text-slate-800">
            รายการค่าใช้จ่าย{" "}
            <span className="text-sm font-normal text-slate-400">
              (ใบเดียวจ่ายได้หลายรายการ)
            </span>
          </h2>
          <button type="button" onClick={addFreeLine} className="btn-secondary w-full sm:w-auto">
            + เพิ่มรายการ
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="btn-secondary w-full sm:w-auto"
          >
            🔍 ดึงเลขที่อนุมัติ
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            ยังไม่มีรายการ — กด “เพิ่มรายการ” เพื่อพิมพ์ค่าใช้จ่ายทั่วไป
            หรือกด “ดึงเลขที่อนุมัติ” เพื่อดึงใบขอซ่อม/ใบขอซื้อที่อนุมัติแล้วมาใส่ (เลือกได้หลายใบ)
          </p>
        ) : (
          <ul className="space-y-2">
            {lines.map((line, index) => {
              const doc = line.docId ? docById.get(line.docId) : null;

              return (
                <li
                  key={line.key}
                  className={`rounded-xl border p-3 ${
                    doc ? "border-brand-400 bg-brand-50/40" : "border-slate-200"
                  }`}
                >
                  {/* ส่งเป็นชุดคู่ขนาน ฝั่ง server อ่านด้วย getAll แล้วจับคู่ตามลำดับ */}
                  <input
                    type="hidden"
                    name="line_doc"
                    value={doc ? `${line.docKind}:${line.docId}` : ""}
                  />

                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">
                        รายการที่ {index + 1}
                        {doc && (
                          <span className="ml-2 font-normal text-brand-700">
                            {doc.approval_no ?? doc.doc_no} · {DOC_KIND_LABEL[doc.kind]} {doc.doc_no}
                          </span>
                        )}
                      </p>
                      {doc && (
                        <p className="text-xs text-slate-500">
                          {formatThaiDate(doc.doc_date)}
                          {doc.branch_name ? ` · ${doc.branch_name}` : ""} · อนุมัติ{" "}
                          {formatBaht(doc.approved_amount)} · เบิกได้อีก{" "}
                          {formatBaht(remainingToPay(doc))}
                          {doc.approved_by ? ` · ผู้อนุมัติ ${doc.approved_by}` : ""}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="rounded-lg px-2 py-1 text-sm text-rose-600 hover:bg-rose-50"
                    >
                      เอาออก
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2">
                      <label className="label" htmlFor={`line_detail_${line.key}`}>
                        รายการค่าใช้จ่าย *
                      </label>
                      <input
                        id={`line_detail_${line.key}`}
                        name="line_detail"
                        value={line.detail}
                        onChange={(e) => patchLine(line.key, { detail: e.target.value })}
                        className="input"
                        placeholder="จ่ายค่าอะไร เช่น ค่าซ่อมแอร์ / ค่าน้ำมันรถส่งของ"
                        required
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`line_account_${line.key}`}>
                        ประเภทค่าใช้จ่าย
                      </label>
                      <select
                        id={`line_account_${line.key}`}
                        name="line_account"
                        value={line.accountId}
                        onChange={(e) => patchLine(line.key, { accountId: e.target.value })}
                        className="input"
                      >
                        <option value="">— ยังไม่ระบุ —</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} · {a.name} ({ACCOUNT_CATEGORY_LABEL[a.category]})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor={`line_amount_${line.key}`}>
                        จำนวนเงิน *
                      </label>
                      <input
                        id={`line_amount_${line.key}`}
                        name="line_amount"
                        value={line.amount}
                        onChange={(e) => patchLine(line.key, { amount: e.target.value })}
                        className="input"
                        inputMode="decimal"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {lines.length > 0 && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {lines.length} รายการ · ยอดรวมทั้งใบ{" "}
            <span className="font-semibold">{formatBaht(total)}</span>
          </p>
        )}
      </section>

      {pickerOpen && (
        <ApprovalPicker
          docs={docs}
          selectedIds={pickedIds}
          onToggle={toggle}
          onClose={() => setPickerOpen(false)}
        />
      )}

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
          <label className="label" htmlFor="vendor_id">
            เจ้าหนี้ / ผู้ขายประจำ
          </label>
          <select
            id="vendor_id"
            name="vendor_id"
            value={vendorId}
            onChange={(e) => chooseVendor(e.target.value)}
            className="input"
          >
            <option value="">— ผู้ขายไม่ประจำ (พิมพ์เอง) —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} · {v.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            เลือกแล้วระบบเติมชื่อ ที่อยู่ เบอร์โทรให้ · แก้เองได้ถ้าจ่ายให้สาขาย่อย
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="payee_name">
            ชื่อผู้ขายหรือผู้รับเงิน *
          </label>
          <input
            id="payee_name"
            name="payee_name"
            value={payee.name}
            onChange={(e) => setPayee((prev) => ({ ...prev, name: e.target.value }))}
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
            value={payee.phone}
            onChange={(e) => setPayee((prev) => ({ ...prev, phone: e.target.value }))}
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
            value={payee.address}
            onChange={(e) => setPayee((prev) => ({ ...prev, address: e.target.value }))}
            className="input min-h-20"
            rows={2}
          />
        </div>
        <div>
          <label className="label" htmlFor="paid_amount">
            จำนวนเงินรวมทั้งใบ
          </label>
          <input
            id="paid_amount"
            name="paid_amount"
            value={total ? String(total) : ""}
            readOnly
            className="input bg-slate-50 font-medium text-slate-700"
            placeholder="0.00"
          />
          <p className="mt-1 text-xs text-slate-400">
            บวกจากรายการค่าใช้จ่ายด้านบนให้อัตโนมัติ — แก้ที่รายการ
          </p>
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

      {/* ---------- ป้ายกำกับ ---------- */}
      <TagInput
        name="tags"
        label="ป้ายกำกับ (แฮชแท็ก)"
        hint="ใช้จัดกลุ่มค่าใช้จ่ายเพื่อดูรายงานสรุปตามป้าย · ติดได้หลายป้ายต่อหนึ่งใบ"
        initialTags={tags}
        suggestions={tagSuggestions}
      />

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
