"use client";

import Link from "next/link";
import { useState } from "react";
import { createApprovalForm } from "@/app/procurement/approvals/actions";
import { formatBaht } from "@/lib/approval";
import type { PrPendingRow } from "@/lib/approval-db";
import {
  APPROVE_DECISION_ORDER,
  APPROVE_STATUS_LABEL,
  REJECT_REASON_LABEL,
  REJECT_REASON_ORDER,
  type ApproveStatus,
} from "@/lib/procurement-types";

/**
 * ใบขอซ่อม/ขอจัดซื้อหนึ่งใบในกล่องรออนุมัติกลาง พร้อมช่องตัดสินในตัว
 *
 * เดิมหน้ากลางแสดงอย่างเดียวแล้วลิงก์ไปหน้าของโปรแกรมจัดซื้อ ตอนนี้กดจบได้ในที่เดียว
 * ตัวบันทึกยังเป็น createApprovalForm ตัวเดิมของโปรแกรมจัดซื้อ กฎการตรวจและ audit
 * จึงเป็นชุดเดียวกับตอนกดจากหน้านั้น ไม่มีทางหลุดกฎเพราะเข้ามาคนละประตู
 *
 * ลิงก์ "ดูใบเต็ม" ยังอยู่ สำหรับใบที่ต้องดูรายละเอียด/ไฟล์แนบก่อนตัดสิน
 */
export default function PrDecideCard({
  row,
  today,
  canDecide,
}: {
  row: PrPendingRow;
  today: string;
  canDecide: boolean;
}) {
  const [decision, setDecision] = useState<ApproveStatus | "">("");

  const href = `/procurement/approvals/${row.kind}/${row.id}`;
  const tone =
    decision === "approved"
      ? "border-emerald-300 bg-emerald-50"
      : decision === "rejected"
        ? "border-rose-300 bg-rose-50"
        : decision === "recheck"
          ? "border-amber-300 bg-amber-50"
          : "border-slate-200";

  return (
    <form action={createApprovalForm} className={`rounded-xl border p-3 ${tone}`}>
      <input type="hidden" name="kind" value={row.kind} />
      <input type="hidden" name="doc_id" value={row.id} />
      <input type="hidden" name="approve_date" value={today} />
      <input type="hidden" name="back" value="/approvals" />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{row.item_name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {row.doc_no} · {row.created_by_name ?? "-"}
            {row.branch_name ? ` · ${row.branch_name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge bg-orange-50 text-orange-700">
            {row.kind === "repair" ? "🛠 ใบขอซ่อม" : "🧾 ใบขอจัดซื้อ"}
          </span>
          <span className="font-semibold text-slate-800">{formatBaht(row.requested_amount)}</span>
        </div>
      </div>

      {canDecide && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
          <div>
            <label className="label">ผลการพิจารณา</label>
            <select
              name="decision"
              value={decision}
              onChange={(e) => setDecision(e.target.value as ApproveStatus | "")}
              className="input w-44"
            >
              <option value="">— เลือก —</option>
              {APPROVE_DECISION_ORDER.map((d) => (
                <option key={d} value={d}>
                  {APPROVE_STATUS_LABEL[d]}
                </option>
              ))}
            </select>
          </div>

          {decision === "approved" && (
            <div>
              <label className="label">อนุมัติเบิก (บาท)</label>
              <input
                type="number"
                name="approved_amount"
                step="0.01"
                min="0"
                max={row.requested_amount}
                defaultValue={row.requested_amount}
                className="input w-36"
              />
            </div>
          )}

          {decision === "rejected" && (
            <div>
              <label className="label">สาเหตุที่ไม่อนุมัติ</label>
              <select name="reject_reason" className="input w-44" required>
                <option value="">— เลือกสาเหตุ —</option>
                {REJECT_REASON_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {REJECT_REASON_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="min-w-40 flex-1">
            <label className="label">หมายเหตุ</label>
            <input type="text" name="note" className="input w-full" placeholder="ไม่บังคับ" />
          </div>

          <button type="submit" className="btn-primary" disabled={!decision}>
            บันทึก
          </button>
          <Link href={href} className="pb-2 text-sm text-brand-600 hover:underline">
            ดูใบเต็ม →
          </Link>
        </div>
      )}

      {!canDecide && (
        <p className="mt-2 text-right">
          <Link href={href} className="text-sm text-brand-600 hover:underline">
            ดูใบเต็ม →
          </Link>
        </p>
      )}
    </form>
  );
}
