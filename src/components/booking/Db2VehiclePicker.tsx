"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Db2MasterItem, Db2MasterKind } from "@/lib/db2-api";

/**
 * เลือกรถของใบจองจากข้อมูลหลักของระบบขาย (Db2): ยี่ห้อ → รุ่น → แบบ → สี
 *
 * ไม่ใช้ dropdown เพราะรุ่น/แบบมีหลายร้อยถึงหลักพันรายการ เลื่อนหาบนมือถือไม่ไหว
 * ใช้เป็น "กดเลือก → เด้ง popup → พิมพ์ค้น → กดเลือกจากผลลัพธ์" แทน
 * รายการที่เห็นเป็นบางส่วน (ครั้งละ 30) พร้อมบอกว่ายังมีอีกกี่รายการ
 *
 * ค่าที่ส่งเข้าฟอร์ม: <field>_code (รหัสจริงใน Db2) และ <field>_name (ชื่อ ณ ตอนบันทึก)
 */

export type PickedValue = { code: string; name: string } | null;

type FieldKey = "brand" | "model" | "variant" | "color";

const FIELD_LABEL: Record<FieldKey, string> = {
  brand: "ยี่ห้อรถ",
  model: "รุ่นรถ",
  variant: "แบบรถ",
  color: "สีรถ",
};

const KIND_OF: Record<FieldKey, Db2MasterKind> = {
  brand: "brand",
  model: "model",
  variant: "variant",
  color: "color",
};

/** popup ค้นข้อมูลหลักหนึ่งชุด */
function PickerDialog({
  field,
  brandCode,
  onPick,
  onClose,
}: {
  field: FieldKey;
  brandCode: string;
  onPick: (item: Db2MasterItem) => void;
  onClose: () => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<Db2MasterItem[]>([]);
  const [matched, setMatched] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(
    async (q: string) => {
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({ kind: KIND_OF[field], limit: "30" });
        if (q.trim()) params.set("q", q.trim());
        // รุ่นรถกรองตามยี่ห้อที่เลือกไว้ก่อนหน้า (SETMODEL มีคอลัมน์ TYPECOD)
        if (field === "model" && brandCode) params.set("brand", brandCode);

        const res = await fetch(`/api/db2/masters?${params.toString()}`);
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          items?: Db2MasterItem[];
          matched?: number;
        };
        if (!res.ok || data.ok === false) throw new Error(data.error ?? "ค้นข้อมูลไม่สำเร็จ");
        setItems(data.items ?? []);
        setMatched(data.matched ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "ค้นข้อมูลไม่สำเร็จ");
        setItems([]);
      } finally {
        setBusy(false);
      }
    },
    [brandCode, field],
  );

  useEffect(() => {
    inputRef.current?.focus();
    void search("");
    // ค้นครั้งแรกตอนเปิด popup เท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void search(keyword), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [keyword, search]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 p-3">
          <h3 className="mr-auto font-semibold text-slate-800">เลือก{FIELD_LABEL[field]}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            ปิด
          </button>
        </div>

        <div className="border-b border-slate-200 p-3">
          <input
            ref={inputRef}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="input"
            placeholder={`พิมพ์ค้น${FIELD_LABEL[field]} (รหัสหรือชื่อ)`}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-slate-400">
            {busy
              ? "กำลังค้น…"
              : matched > items.length
                ? `พบ ${matched} รายการ — แสดง ${items.length} รายการแรก พิมพ์เพิ่มเพื่อแคบลง`
                : `พบ ${matched} รายการ`}
            {field === "model" && brandCode ? ` · เฉพาะยี่ห้อ ${brandCode}` : ""}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && <p className="p-3 text-sm text-rose-600">{error}</p>}
          {!error && !busy && items.length === 0 && (
            <p className="p-3 text-sm text-slate-500">ไม่พบรายการที่ตรงกับคำค้น</p>
          )}
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  className="block w-full px-3 py-2.5 text-left text-sm hover:bg-brand-50"
                >
                  <span className="font-medium text-slate-800">{item.name}</span>
                  {item.name !== item.code && (
                    <span className="ml-2 text-xs text-slate-400">{item.code}</span>
                  )}
                  {item.parent && <span className="ml-2 text-xs text-slate-400">· {item.parent}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** ช่องหนึ่งช่อง: แสดงค่าที่เลือก + ปุ่มเปิด popup */
function PickerField({
  field,
  value,
  required,
  disabled,
  hint,
  onOpen,
  onClear,
}: {
  field: FieldKey;
  value: PickedValue;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <div>
      <label className="label">
        {FIELD_LABEL[field]}
        {required ? " *" : ""}
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          className={`input flex-1 truncate text-left ${
            value ? "text-slate-800" : "text-slate-400"
          } ${disabled ? "cursor-not-allowed bg-slate-50" : "hover:border-brand-400"}`}
        >
          {value ? value.name : disabled ? "— เลือกยี่ห้อก่อน —" : `— เลือก${FIELD_LABEL[field]} —`}
        </button>
        {value && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-xl px-2 text-xs text-rose-600 hover:bg-rose-50"
          >
            ล้าง
          </button>
        )}
      </div>

      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function Db2VehiclePicker({
  defaults,
}: {
  defaults?: Partial<Record<FieldKey, PickedValue>>;
}) {
  const [values, setValues] = useState<Record<FieldKey, PickedValue>>({
    brand: defaults?.brand ?? null,
    model: defaults?.model ?? null,
    variant: defaults?.variant ?? null,
    color: defaults?.color ?? null,
  });
  const [open, setOpen] = useState<FieldKey | null>(null);

  const pick = (field: FieldKey, item: Db2MasterItem) => {
    setValues((prev) => {
      const next = { ...prev, [field]: { code: item.code, name: item.name } };
      // เปลี่ยนยี่ห้อแล้วรุ่นเดิมอาจไม่ใช่ของยี่ห้อนี้ — ล้างให้เลือกใหม่ กันบันทึกคู่ที่ขัดกันเอง
      if (field === "brand" && prev.brand?.code !== item.code) next.model = null;
      return next;
    });
    setOpen(null);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(Object.keys(FIELD_LABEL) as FieldKey[]).map((field) => (
        <div key={field}>
          <input type="hidden" name={`db2_${field}_code`} value={values[field]?.code ?? ""} />
          <input type="hidden" name={`db2_${field}_name`} value={values[field]?.name ?? ""} />
          <PickerField
            field={field}
            value={values[field]}
            required={field === "brand" || field === "model"}
            disabled={field === "model" && !values.brand}
            hint={
              field === "brand"
                ? "ข้อมูลจากระบบขาย (Db2)"
                : field === "model" && values.brand
                  ? `เฉพาะยี่ห้อ ${values.brand.name}`
                  : undefined
            }
            onOpen={() => setOpen(field)}
            onClear={() =>
              setValues((prev) => ({
                ...prev,
                [field]: null,
                ...(field === "brand" ? { model: null } : {}),
              }))
            }
          />
        </div>
      ))}

      {open && (
        <PickerDialog
          field={open}
          brandCode={values.brand?.code ?? ""}
          onPick={(item) => pick(open, item)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
