"use client";

import { useState } from "react";
import { createRequestForm } from "@/app/approvals/actions";
import type { ApvType } from "@/lib/approval-types";

/**
 * ฟอร์มยื่นเรื่องขออนุมัติกลาง — ใช้ได้กับทุกเรื่องที่แอดมินเปิดไว้
 * ช่องจำนวนจะเปลี่ยนป้ายตามประเภทเรื่อง และซ่อนไปเลยถ้าเรื่องนั้นไม่มีจำนวน (เช่น ขอย้ายห้อง)
 */
export default function RequestForm({ types }: { types: ApvType[] }) {
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const selected = types.find((t) => t.id === typeId) ?? null;

  return (
    <form action={createRequestForm} className="card space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">เรื่องที่ขออนุมัติ *</label>
          <select
            name="type_id"
            className="input"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            required
          >
            {types.length === 0 && <option value="">— ยังไม่มีประเภทเรื่องที่เปิดใช้ —</option>}
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
          {selected?.description && (
            <p className="mt-1 text-xs text-slate-500">{selected.description}</p>
          )}
        </div>

        <div>
          <label className="label">ต้องการทราบผลภายในวันที่</label>
          <input name="needed_by" type="date" className="input" />
          <p className="mt-1 text-xs text-slate-500">ใส่ไว้เพื่อให้เรื่องเร่งด่วนขึ้นก่อนในกล่องผู้อนุมัติ</p>
        </div>

        <div className="sm:col-span-2">
          <label className="label">เรื่อง (สรุปสั้น ๆ) *</label>
          <input
            name="subject"
            className="input"
            placeholder="เช่น ขอลาพักร้อน 3 วัน 10-12 ต.ค."
            required
          />
        </div>

        {selected?.has_amount && (
          <div>
            <label className="label">{selected.amount_label} *</label>
            <input name="requested_amount" className="input" inputMode="decimal" placeholder="0" required />
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="label">รายละเอียด</label>
          <textarea
            name="detail"
            rows={3}
            className="input"
            placeholder="เหตุผล ความจำเป็น หรือข้อมูลที่ผู้อนุมัติควรรู้"
          />
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={types.length === 0}>
        ยื่นเรื่องขออนุมัติ
      </button>
      <p className="text-xs text-slate-500">
        ยื่นแล้วเรื่องจะไปอยู่ในกล่องของผู้มีอำนาจอนุมัติทันที ติดตามผลได้ที่เมนู &quot;เรื่องของฉัน&quot;
      </p>
    </form>
  );
}
