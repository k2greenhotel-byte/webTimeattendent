"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import FileUploader, { type UploadedFile } from "@/components/marketing/FileUploader";
import PhotoUploader from "@/components/marketing/PhotoUploader";
import ApprovalPicker from "@/components/procurement/ApprovalPicker";
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
  refNo: string | null;
  vendorId: string | null;
  payeeName: string | null;
  payeePhone: string | null;
  payeeAddress: string | null;
  tags: PrTag[];
  photos: string[];
  documents: UploadedFile[];
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
  refNo: string;
  vendorId: string;
  payeeName: string;
  payeePhone: string;
  payeeAddress: string;
  /** ค่าเริ่มต้นของช่องที่จัดการตัวเอง (TagInput / uploader) ไม่ได้คุมเป็น state */
  tags: PrTag[];
  photos: string[];
  documents: UploadedFile[];
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
  tagSuggestions = [],
  companies,
  branches,
  picked = [],
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
  /** ป้ายที่เคยใช้ในระบบ ไว้ให้กดเลือก */
  tagSuggestions?: PrTagRow[];
  companies: Company[];
  branches: Branch[];
  picked?: PickedItem[];
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
          refNo: p.refNo ?? "",
          vendorId: p.vendorId ?? "",
          payeeName: p.payeeName ?? "",
          payeePhone: p.payeePhone ?? "",
          payeeAddress: p.payeeAddress ?? "",
          tags: p.tags,
          photos: p.photos,
          documents: p.documents,
        }))
      : [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [approverName, setApproverName] = useState(payment?.approver_name ?? "");

  const docById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const pickedIds = useMemo(
    () => new Set(lines.map((l) => l.docId).filter((id): id is string => Boolean(id))),
    [lines],
  );

  /** ยอดรวมทั้งใบ = ผลรวมของทุกบรรทัด ไม่ต้องคีย์ซ้ำและไม่มีทางไม่ตรงกัน */
  const total = round2(lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0));

  /**
   * ชื่อผู้อนุมัติยังเป็นของทั้งใบ จึงสรุปจากใบอนุมัติที่ทุกบรรทัดอ้างถึง
   * ช่องสรุปอื่น (รายการ เลขที่อ้างอิง ผู้รับเงิน) เป็นของรายการแล้ว ฝั่ง server คิดให้เอง
   */
  const applyLines = (next: Line[]) => {
    setLines(next);
    setApproverName(
      [
        ...new Set(
          next
            .map((l) => (l.docId ? docById.get(l.docId)?.approved_by : null))
            .map((v) => (v ?? "").trim())
            .filter(Boolean),
        ),
      ].join(", "),
    );
  };

  const patchLine = (key: string, patch: Partial<Line>) =>
    applyLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) => applyLines(lines.filter((l) => l.key !== key));

  /** บรรทัดค่าใช้จ่ายทั่วไป — ไม่ผูกใบอนุมัติ พิมพ์รายการเอง */
  const addFreeLine = () =>
    applyLines([
      ...lines,
      {
        key: newKey(),
        docId: null,
        docKind: null,
        detail: "",
        accountId: "",
        amount: "",
        refNo: "",
        vendorId: "",
        payeeName: "",
        payeePhone: "",
        payeeAddress: "",
        tags: [],
        photos: [],
        documents: [],
      },
    ]);

  /**
   * เลือกเจ้าหนี้จากทะเบียน = เติมชื่อ ที่อยู่ เบอร์โทรให้ทันที
   * เลือก "ผู้ขายไม่ประจำ" = ล้างการอ้างทะเบียน แล้วพิมพ์เองได้
   * (ค่าที่เติมยังแก้เองได้ เพราะบางครั้งจ่ายให้สาขาย่อยของเจ้าหนี้รายเดียวกัน)
   */
  const chooseVendor = (key: string, id: string) => {
    const v = vendors.find((x) => x.id === id);
    patchLine(key, {
      vendorId: id,
      ...(v ? { payeeName: v.name, payeePhone: v.phone ?? "", payeeAddress: v.address ?? "" } : {}),
    });
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
        // ดึงเลขที่อนุมัติของใบนั้นมาเป็นเลขที่อ้างอิงของรายการนี้เลย
        refNo: doc.approval_no ?? "",
        vendorId: "",
        payeeName: "",
        payeePhone: "",
        payeeAddress: "",
        tags: [],
        photos: [],
        documents: [],
      },
    ]);
  };

  return (
    <form action={action} className="card space-y-5">
      <input type="hidden" name="pay_source" value={source} />
      {payment && <input type="hidden" name="id" value={payment.id} />}

      <div className="space-y-3 rounded-2xl border border-slate-400 bg-slate-200 p-3 sm:p-4">
        {/* ---------- หัวเอกสาร ---------- */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <label className="label">เลขที่เอกสาร</label>
            <input
              value={payment?.doc_no ?? ""}
              readOnly
              disabled
              className="input bg-slate-50 font-medium text-slate-600"
              placeholder="ระบบออกให้ตามบริษัท/สาขา"
            />
          </div>
          <div className="lg:col-span-2">
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
          <div className="lg:col-span-4">
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
          <div className="lg:col-span-3">
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

        <p className="rounded-xl bg-white px-4 py-3 text-xs text-slate-600">
          เลขที่{PAY_SOURCES[source].docLabel}รันแยกตามบริษัทและสาขา (เช่น {PAY_SOURCES[source].prefix}-HQ-BKK-2569-0001) ·
          รายชื่อบริษัทและสาขาที่เลือกได้เป็นไปตามสิทธิ์ของบัญชีที่ล็อกอินอยู่
        </p>
      </div>

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

                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12">
                    <div className="sm:col-span-2 lg:col-span-6">
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
                    <div className="lg:col-span-4">
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
                    <div className="lg:col-span-2">
                      <label className="label" htmlFor={`line_amount_${line.key}`}>
                        จำนวนเงิน *
                      </label>
                      <input
                        id={`line_amount_${line.key}`}
                        name="line_amount"
                        value={line.amount}
                        onChange={(e) => patchLine(line.key, { amount: e.target.value })}
                        className="input text-right"
                        inputMode="decimal"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  {/* ---------- ผู้รับเงินของรายการนี้ ---------- */}
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12">
                    <div className="lg:col-span-3">
                      <label className="label" htmlFor={`line_ref_${line.key}`}>
                        เลขที่อ้างอิง (เลขที่อนุมัติ)
                      </label>
                      <input
                        id={`line_ref_${line.key}`}
                        name="line_ref"
                        value={line.refNo}
                        onChange={(e) => patchLine(line.key, { refNo: e.target.value })}
                        className="input"
                        placeholder="เว้นว่างได้ถ้าไม่ผ่านอนุมัติ"
                      />
                    </div>
                    <div className="lg:col-span-3">
                      <label className="label" htmlFor={`line_vendor_${line.key}`}>
                        เจ้าหนี้ / ผู้ขายประจำ
                      </label>
                      <select
                        id={`line_vendor_${line.key}`}
                        name="line_vendor"
                        value={line.vendorId}
                        onChange={(e) => chooseVendor(line.key, e.target.value)}
                        className="input"
                      >
                        <option value="">— ผู้ขายไม่ประจำ (พิมพ์เอง) —</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.code} · {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="lg:col-span-4">
                      <label className="label" htmlFor={`line_payee_${line.key}`}>
                        ชื่อผู้ขายหรือผู้รับเงิน *
                      </label>
                      <input
                        id={`line_payee_${line.key}`}
                        name="line_payee"
                        value={line.payeeName}
                        onChange={(e) => patchLine(line.key, { payeeName: e.target.value })}
                        className="input"
                        placeholder="ชื่อร้าน ช่าง หรือพนักงานที่รับเงินไป"
                        required
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="label" htmlFor={`line_phone_${line.key}`}>
                        เบอร์โทร
                      </label>
                      <input
                        id={`line_phone_${line.key}`}
                        name="line_phone"
                        value={line.payeePhone}
                        onChange={(e) => patchLine(line.key, { payeePhone: e.target.value })}
                        className="input"
                        inputMode="tel"
                        placeholder="0812345678"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-7">
                      <label className="label" htmlFor={`line_address_${line.key}`}>
                        ที่อยู่ผู้รับเงิน
                      </label>
                      <input
                        id={`line_address_${line.key}`}
                        name="line_address"
                        value={line.payeeAddress}
                        onChange={(e) => patchLine(line.key, { payeeAddress: e.target.value })}
                        className="input"
                        placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
                      />
                    </div>
                    {/* ป้ายกำกับอยู่บรรทัดเดียวกับที่อยู่ จะได้ไม่กินความสูงเพิ่มอีกบรรทัด */}
                    <div className="sm:col-span-2 lg:col-span-5">
                      <TagInput
                        name="line_tags"
                        label="ป้ายกำกับ"
                        initialTags={line.tags}
                        suggestions={tagSuggestions}
                        compact
                      />
                    </div>
                  </div>

                  {/* ---------- ใบเสร็จของรายการนี้ ---------- */}
                  <div className="mt-2 grid gap-2 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-2">
                      <PhotoUploader
                        name={`line_photo_${index}`}
                        label="รูปถ่าย"
                        hint={`สูงสุด ${MAX_PHOTOS} รูป`}
                        max={MAX_PHOTOS}
                        initialPaths={line.photos}
                        prefix="payment"
                        endpoint="/api/procurement/photo"
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 p-2">
                      <FileUploader
                        name={`line_file_${index}`}
                        label="ใบเสร็จ / เอกสารแนบ"
                        hint={`สูงสุด ${MAX_PAYMENT_DOCS} ไฟล์ · รูปและ PDF`}
                        max={MAX_PAYMENT_DOCS}
                        endpoint="/api/procurement/file"
                        accept={PR_FILE_ACCEPT}
                        initialFiles={line.documents}
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

      {/* ---------- ท้ายเอกสาร ---------- */}
      <div className="space-y-4 rounded-2xl border border-slate-400 bg-slate-200 p-3 sm:p-4">
        {/* ---------- ยอดรวมทั้งใบ ---------- */}
        {/*
          ผู้รับเงิน เลขที่อ้างอิง ผังบัญชี ป้ายกำกับ และไฟล์แนบ ย้ายไปอยู่ที่รายการจ่ายแต่ละรายการแล้ว
          หัวเอกสารเหลือเฉพาะสิ่งที่เป็นของทั้งใบจริง ๆ ส่วนช่องสรุปบน pr_payments
          ฝั่ง server คิดจากรายการให้เอง จะได้ไม่มีทางที่ค่าสรุปกับรายการไม่ตรงกัน
        */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <label className="label" htmlFor="paid_amount">
              จำนวนเงินรวมทั้งใบ
            </label>
            <input
              id="paid_amount"
              name="paid_amount"
              value={total ? String(total) : ""}
              readOnly
              className="input bg-white text-right font-medium text-slate-700"
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-slate-400">
              บวกจากทุกรายการจ่ายด้านบนให้อัตโนมัติ — แก้ที่รายการ
            </p>
          </div>
        </div>

        {/* ---------- ผู้บันทึกและผู้เกี่ยวข้อง ---------- */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

        <div className="lg:max-w-3xl">
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
      </div>
    </form>
  );
}
