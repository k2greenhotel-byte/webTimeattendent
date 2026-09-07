"use client";

import { useState } from "react";
import { CLAIM_MAX_ITEMS, type ClaimItem } from "@/lib/claim-types";

/**
 * รายการที่ขอเคลม (ข้อ 1.4.10) — หนึ่งใบบันทึกได้หลายรายการ
 *
 * ส่งเข้าฟอร์มเป็น 3 ชุดที่เรียงตรงกัน: item_name[] · item_qty[] · item_note[]
 * แถวที่ชื่อว่างจะถูกตัดทิ้งฝั่ง server (ผู้ใช้กดเพิ่มแถวแล้วไม่ได้กรอกก็ไม่พัง)
 */

type Row = { key: string; item_name: string; qty: string; note: string };

function rowsFrom(items: ClaimItem[]): Row[] {
  if (items.length === 0) {
    return [{ key: crypto.randomUUID(), item_name: "", qty: "1", note: "" }];
  }
  return items.map((i) => ({
    key: crypto.randomUUID(),
    item_name: i.item_name,
    qty: String(i.qty ?? 1),
    note: i.note ?? "",
  }));
}

export default function ClaimItemsEditor({ items = [] }: { items?: ClaimItem[] }) {
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(items));

  const patch = (key: string, field: keyof Row, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const add = () =>
    setRows((prev) =>
      prev.length >= CLAIM_MAX_ITEMS
        ? prev
        : [...prev, { key: crypto.randomUUID(), item_name: "", qty: "1", note: "" }],
    );

  const remove = (key: string) =>
    setRows((prev) => (prev.length === 1 ? rowsFrom([]) : prev.filter((r) => r.key !== key)));

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-semibold text-slate-800">
          รายการที่ขอเคลม *{" "}
          <span className="font-normal text-slate-400">
            ({rows.length}/{CLAIM_MAX_ITEMS})
          </span>
        </h3>
        <button
          type="button"
          onClick={add}
          disabled={rows.length >= CLAIM_MAX_ITEMS}
          className="btn-secondary disabled:opacity-50"
        >
          + เพิ่มรายการ
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.key} className="grid grid-cols-1 gap-2 sm:grid-cols-12">
            <div className="sm:col-span-5">
              {i === 0 && <label className="label">ชิ้นส่วน/รายการที่ขอเคลม</label>}
              <input
                name="item_name"
                value={row.item_name}
                onChange={(e) => patch(row.key, "item_name", e.target.value)}
                className="input"
                placeholder="เช่น ไฟหน้า"
                maxLength={200}
              />
            </div>
            <div className="sm:col-span-2">
              {i === 0 && <label className="label">จำนวน</label>}
              <input
                name="item_qty"
                value={row.qty}
                onChange={(e) => patch(row.key, "qty", e.target.value)}
                className="input"
                inputMode="decimal"
              />
            </div>
            <div className="sm:col-span-4">
              {i === 0 && <label className="label">หมายเหตุ</label>}
              <input
                name="item_note"
                value={row.note}
                onChange={(e) => patch(row.key, "note", e.target.value)}
                className="input"
                placeholder="อาการของชิ้นนี้"
              />
            </div>
            <div className="flex items-end sm:col-span-1">
              <button
                type="button"
                onClick={() => remove(row.key)}
                className="w-full rounded-xl px-2 py-2 text-sm text-rose-600 hover:bg-rose-50"
                title="ลบรายการนี้"
              >
                ลบ
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        บันทึกได้สูงสุด {CLAIM_MAX_ITEMS} รายการต่อหนึ่งใบ · แถวที่ไม่ได้กรอกชื่อรายการจะไม่ถูกบันทึก
      </p>
    </div>
  );
}
