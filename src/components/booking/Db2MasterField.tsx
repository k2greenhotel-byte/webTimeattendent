"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Db2MasterItem, Db2MasterKind } from "@/lib/db2-api";

/**
 * ช่องกรองที่เลือกค่าจาก "ตารางข้อมูลหลักของระบบขาย" ตรง ๆ (SETTYPE / SETMODEL / SETBAAB / SETCOLOR / SETGROUP)
 *
 * ต่างจาก dropdown ที่ไล่จากของที่มีในสต็อก — อันนี้ค้นได้ทั้งตาราง
 * จึงเลือกค่าที่ "ยังไม่มีของในสต็อก" ได้ด้วย (เอาไว้ยืนยันว่าไม่มีจริง ๆ ไม่ใช่หาไม่เจอ)
 *
 * ใช้ในฟอร์ม GET ได้เลย — ค่าส่งออกเป็น hidden input ชื่อตามที่กำหนด
 */
export default function Db2MasterField({
  name,
  kind,
  label,
  value,
  valueLabel,
  brand,
  hint,
}: {
  /** ชื่อฟิลด์ที่ส่งไปกับฟอร์ม (เช่น variant) */
  name: string;
  kind: Db2MasterKind;
  label: string;
  /** รหัสที่เลือกไว้ตอนนี้ */
  value: string;
  /** ชื่อของรหัสที่เลือกไว้ (ถ้ารู้) */
  valueLabel?: string;
  /** กรองรุ่นตามยี่ห้อ (ใช้กับ kind = model) */
  brand?: string;
  hint?: string;
}) {
  const [picked, setPicked] = useState<{ code: string; name: string } | null>(
    value ? { code: value, name: valueLabel || value } : null,
  );
  const [open, setOpen] = useState(false);

  return (
    <div>
      <input type="hidden" name={name} value={picked?.code ?? ""} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label className="label">{label}</label>
        {picked && (
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="text-xs text-rose-600 hover:underline"
          >
            ล้าง
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`input w-full truncate text-left hover:border-brand-400 ${
          picked ? "text-slate-800" : "text-slate-400"
        }`}
      >
        {picked ? picked.name : "ทั้งหมด — กดเพื่อค้น"}
      </button>

      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}

      {open && (
        <MasterDialog
          kind={kind}
          label={label}
          brand={brand}
          onPick={(item) => {
            setPicked({ code: item.code, name: item.name });
            setOpen(false);
          }}
          onClear={() => {
            setPicked(null);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function MasterDialog({
  kind,
  label,
  brand,
  onPick,
  onClear,
  onClose,
}: {
  kind: Db2MasterKind;
  label: string;
  brand?: string;
  onPick: (item: Db2MasterItem) => void;
  onClear: () => void;
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
        const params = new URLSearchParams({ kind, limit: "30" });
        if (q.trim()) params.set("q", q.trim());
        if (kind === "model" && brand) params.set("brand", brand);

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
    [brand, kind],
  );

  useEffect(() => {
    inputRef.current?.focus();
    void search("");
    // ค้นครั้งแรกตอนเปิดเท่านั้น
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
          <h3 className="mr-auto font-semibold text-slate-800">เลือก{label}</h3>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            ทั้งหมด
          </button>
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
            placeholder={`พิมพ์ค้น${label} (รหัสหรือชื่อ)`}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-slate-400">
            {busy
              ? "กำลังค้น…"
              : matched > items.length
                ? `พบ ${matched} รายการ — แสดง ${items.length} รายการแรก พิมพ์เพิ่มเพื่อแคบลง`
                : `พบ ${matched} รายการ`}
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
                  <span className="font-medium text-slate-800">{item.code}</span>
                  {item.name !== item.code && (
                    <span className="ml-2 text-xs text-slate-500">{item.name}</span>
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
