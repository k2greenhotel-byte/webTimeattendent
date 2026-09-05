"use client";

import { useState } from "react";
import { saveUserAuthorityForm } from "@/app/approvals/setup/limits/actions";
import type { UserAuthorityInput } from "@/lib/approval";
import type { ApvType } from "@/lib/approval-types";

type Company = { id: string; name: string };

/**
 * ขั้นที่ 2 ของการตั้งผู้มีอำนาจอนุมัติ: ติ๊กว่าคนนี้อนุมัติเรื่องอะไรได้บ้าง + วงเงิน/ส่วนลดของแต่ละเรื่อง
 * ช่องวงเงินเปิดให้กรอกเฉพาะเรื่องที่ติ๊ก (เรื่องที่ไม่มีจำนวนเงิน เช่น ขอสลับกะ ไม่มีช่องวงเงิน)
 * ส่งฟอร์มเป็นชุดเดียว → server action ล้างกฎเดิมของคนนี้แล้วบันทึกตามหน้าจอ
 */
export default function UserAuthorityForm({
  userName,
  initial,
  types,
  companies,
}: {
  userName: string;
  initial: UserAuthorityInput;
  types: ApvType[];
  companies: Company[];
}) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initial.entries.map((e) => [e.typeId, e.enabled])),
  );
  const checkedCount = Object.values(enabled).filter(Boolean).length;

  const toggleAll = (value: boolean) =>
    setEnabled(Object.fromEntries(types.map((t) => [t.id, value])));

  return (
    <form action={saveUserAuthorityForm} className="space-y-4">
      <input type="hidden" name="user_id" value={initial.userId} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-800">
            ขั้นที่ 2 · {userName} อนุมัติเรื่องใดได้บ้าง
          </h3>
          <p className="text-sm text-slate-500">
            ติ๊กเรื่องที่ให้อำนาจ แล้วใส่วงเงินหรือส่วนลดสูงสุดของเรื่องนั้น · เว้นว่าง = ไม่จำกัด ·
            เรื่องที่ไม่ติ๊กจะอนุมัติไม่ได้เลย
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => toggleAll(true)} className="text-brand-600 hover:underline">
            ติ๊กทั้งหมด
          </button>
          <span className="text-slate-300">|</span>
          <button type="button" onClick={() => toggleAll(false)} className="text-slate-500 hover:underline">
            ล้างทั้งหมด
          </button>
        </div>
      </div>

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {types.map((type) => {
          const entry = initial.entries.find((e) => e.typeId === type.id);
          const on = enabled[type.id] ?? false;
          return (
            <li
              key={type.id}
              className={`flex flex-wrap items-center gap-3 px-3 py-2 ${on ? "bg-brand-50/60" : ""}`}
            >
              <label className="flex min-w-[12rem] flex-1 cursor-pointer items-center gap-3 py-1">
                <input
                  type="checkbox"
                  name={`enabled__${type.id}`}
                  checked={on}
                  onChange={(e) => setEnabled({ ...enabled, [type.id]: e.target.checked })}
                  className="h-5 w-5"
                />
                <span className="text-sm text-slate-800">
                  {type.icon} {type.name}
                  {!type.is_active && <span className="ml-2 badge bg-slate-100 text-slate-500">ปิดใช้</span>}
                </span>
              </label>

              {type.has_amount ? (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">{type.amount_label} สูงสุด</label>
                  <input
                    name={`amount__${type.id}`}
                    inputMode="decimal"
                    defaultValue={entry?.maxAmount ?? ""}
                    disabled={!on}
                    placeholder="ไม่จำกัด"
                    className="input w-36 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-400">ไม่มีจำนวนเงิน — ติ๊กแล้วอนุมัติได้เลย</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">ใช้อำนาจนี้กับบริษัท</label>
          <select name="company_id" defaultValue={initial.companyId ?? ""} className="input">
            <option value="">ทุกบริษัท</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pt-6 text-sm text-slate-600">
          <input type="checkbox" name="can_reject" defaultChecked={initial.canReject} className="h-5 w-5" />
          ไม่อนุมัติ (ปฏิเสธ) เรื่องได้
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm text-slate-600">
          <input type="checkbox" name="is_final" defaultChecked={initial.isFinal} className="h-5 w-5" />
          ตัดสินขั้นสุดท้ายได้ทุกจำนวน (ผู้บริหาร)
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary">
          บันทึกอำนาจอนุมัติ ({checkedCount} เรื่อง)
        </button>
        <span className="text-xs text-slate-500">มีผลทันทีกับเรื่องที่รออยู่ในกล่องรออนุมัติ</span>
      </div>
    </form>
  );
}
