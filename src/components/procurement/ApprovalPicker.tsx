"use client";

import { useMemo, useState } from "react";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht, remainingToPay } from "@/lib/procurement";
import { DOC_KIND_LABEL, type PrDocRow } from "@/lib/procurement-types";

export type PickedDoc = { doc: PrDocRow; amount: string };

/**
 * หน้าต่างเลือกเอกสารที่อนุมัติแล้ว เพื่ออ้างในใบเบิกจ่าย
 *
 * แสดงเอกสารที่อนุมัติแล้วทั้งหมด รวมใบที่จ่ายเงินไปแล้วด้วย
 * แต่ใบที่จ่ายครบแล้วจะกดเลือกไม่ได้ และขึ้นป้าย "จ่ายเงินแล้ว" กำกับไว้
 * เพื่อให้ผู้ใช้เห็นว่าใบนั้นมีอยู่จริงและถูกจ่ายไปแล้ว ไม่ใช่หายไปเฉย ๆ
 */
export default function ApprovalPicker({
  docs,
  selectedIds,
  onToggle,
  onClose,
}: {
  docs: PrDocRow[];
  selectedIds: Set<string>;
  onToggle: (doc: PrDocRow, on: boolean) => void;
  onClose: () => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [showPaid, setShowPaid] = useState(true);

  const rows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return docs
      .filter((d) => (showPaid ? true : remainingToPay(d) > 0))
      .filter((d) =>
        !q
          ? true
          : [d.doc_no, d.approval_no, d.item_name, d.branch_name, d.approved_by]
              .join(" ")
              .toLowerCase()
              .includes(q),
      );
  }, [docs, keyword, showPaid]);

  const paidCount = docs.filter((d) => remainingToPay(d) <= 0).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      {/* จอเล็กเปิดจากด้านล่างเต็มความกว้าง จอใหญ่เป็นกล่องกลางจอ */}
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-800">เลือกเลขที่อนุมัติ</h2>
            <p className="text-xs text-slate-500">
              เอกสารที่อนุมัติแล้ว {docs.length} ใบ · จ่ายเงินแล้ว {paidCount} ใบ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            ปิด
          </button>
        </div>

        <div className="space-y-2 border-b border-slate-200 p-4">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="input"
            placeholder="ค้นหาเลขที่อนุมัติ เลขที่เอกสาร รายการ หรือผู้อนุมัติ"
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showPaid}
              onChange={(e) => setShowPaid(e.target.checked)}
              className="h-4 w-4"
            />
            แสดงใบที่จ่ายเงินแล้วด้วย
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">
              {docs.length === 0
                ? "ยังไม่มีเอกสารที่อนุมัติแล้ว — ต้องผ่านหน้าจออนุมัติ (ข้อ 3) ก่อน"
                : "ไม่พบเอกสารที่ตรงกับคำค้น"}
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((doc) => {
                const remaining = remainingToPay(doc);
                const paid = remaining <= 0;
                const on = selectedIds.has(doc.id);

                return (
                  <li
                    key={doc.id}
                    className={`rounded-xl border p-3 ${
                      paid
                        ? "border-slate-200 bg-slate-50"
                        : on
                          ? "border-brand-400 bg-brand-50/40"
                          : "border-slate-200"
                    }`}
                  >
                    <label
                      className={`flex items-start gap-3 ${paid ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 shrink-0"
                        checked={on}
                        disabled={paid}
                        onChange={(e) => onToggle(doc, e.target.checked)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={`font-medium ${paid ? "text-slate-500" : "text-slate-800"}`}>
                            {doc.approval_no ?? doc.doc_no}
                          </span>
                          <span className="badge bg-slate-100 text-slate-500">
                            {DOC_KIND_LABEL[doc.kind]} {doc.doc_no}
                          </span>
                          {paid && <span className="badge bg-rose-100 text-rose-700">จ่ายเงินแล้ว</span>}
                        </span>

                        <span className={`block truncate text-sm ${paid ? "text-slate-400" : "text-slate-600"}`}>
                          {doc.item_name}
                        </span>

                        <span className="block text-xs text-slate-500">
                          {doc.approved_date ? `อนุมัติ ${formatThaiDate(doc.approved_date)}` : ""}
                          {doc.approved_by ? ` · ${doc.approved_by}` : ""}
                          {doc.branch_name ? ` · ${doc.branch_name}` : ""}
                        </span>

                        <span className="block text-xs text-slate-500">
                          อนุมัติ {formatBaht(doc.approved_amount)} · เบิกไปแล้ว{" "}
                          {formatBaht(doc.actual_amount)} ·{" "}
                          {paid ? (
                            <span className="text-rose-600">เบิกครบแล้ว</span>
                          ) : (
                            <span className="text-emerald-700">เบิกได้อีก {formatBaht(remaining)}</span>
                          )}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="btn-primary w-full">
            เสร็จสิ้น ({selectedIds.size} ใบที่เลือก)
          </button>
        </div>
      </div>
    </div>
  );
}
