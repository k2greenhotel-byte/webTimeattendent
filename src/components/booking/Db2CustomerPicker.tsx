"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * เลือกลูกค้าของใบจองจากทะเบียนลูกค้าของระบบขาย (Db2 CUSTMAST)
 *
 * CUSTMAST มีลูกค้าเจ็ดหมื่นกว่าราย จึงไม่มีทางทำ dropdown ได้
 * ใช้เป็น "กดเลือก → เด้ง popup → พิมพ์ค้น → กดเลือก" เหมือนช่องเลือกรถ
 * ค้นได้ด้วย รหัสลูกค้า / ชื่อ / นามสกุล / เลขบัตรประชาชน / เบอร์โทร
 *
 * ค่าที่ส่งเข้าฟอร์ม: db2_cuscod · db2_customer_name · customer_phone (แก้ทับได้)
 */

type Db2CustomerBrief = {
  cuscod: string;
  fullName: string;
  nickname: string;
  idcard: string;
  mobile: string;
  phone: string;
  address?: { subdistrict?: string; zip?: string };
};

export type PickedCustomer = { cuscod: string; name: string; phone?: string } | null;

const MIN_CHARS = 2;

function PickerDialog({
  onPick,
  onClose,
}: {
  onPick: (c: Db2CustomerBrief) => void;
  onClose: () => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<Db2CustomerBrief[]>([]);
  const [count, setCount] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < MIN_CHARS) {
      setRows([]);
      setCount(0);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/db2/customers?q=${encodeURIComponent(q.trim())}`);
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        customers?: Db2CustomerBrief[];
        count?: number;
        truncated?: boolean;
      };
      if (!res.ok || data.ok === false) throw new Error(data.error ?? "ค้นลูกค้าไม่สำเร็จ");
      setRows(data.customers ?? []);
      setCount(data.count ?? 0);
      setTruncated(Boolean(data.truncated));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ค้นลูกค้าไม่สำเร็จ");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void search(keyword), 350);
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
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 p-3">
          <h3 className="mr-auto font-semibold text-slate-800">เลือกลูกค้าจากระบบขาย</h3>
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
            placeholder="พิมพ์ชื่อ นามสกุล รหัสลูกค้า เลขบัตร หรือเบอร์โทร"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-slate-400">
            {keyword.trim().length < MIN_CHARS
              ? `พิมพ์อย่างน้อย ${MIN_CHARS} ตัวอักษร`
              : busy
                ? "กำลังค้น…"
                : truncated
                  ? `พบมากกว่า ${count} ราย — แสดง ${count} รายแรก พิมพ์เพิ่มเพื่อแคบลง`
                  : `พบ ${count} ราย`}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && <p className="p-3 text-sm text-rose-600">{error}</p>}
          {!error && !busy && keyword.trim().length >= MIN_CHARS && rows.length === 0 && (
            <p className="p-3 text-sm text-slate-500">ไม่พบลูกค้าที่ตรงกับคำค้น</p>
          )}
          <ul className="divide-y divide-slate-100">
            {rows.map((c) => (
              <li key={c.cuscod}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="block w-full px-3 py-2.5 text-left text-sm hover:bg-brand-50"
                >
                  <span className="font-medium text-slate-800">{c.fullName || c.cuscod}</span>
                  {c.nickname && <span className="ml-2 text-xs text-slate-500">({c.nickname})</span>}
                  <div className="text-xs text-slate-400">
                    {c.cuscod}
                    {c.mobile || c.phone ? ` · ${c.mobile || c.phone}` : ""}
                    {c.idcard ? ` · ${c.idcard}` : ""}
                    {c.address?.subdistrict ? ` · ${c.address.subdistrict}` : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Db2CustomerPicker({
  defaultCustomer,
  defaultPhone,
}: {
  defaultCustomer?: PickedCustomer;
  defaultPhone?: string | null;
}) {
  const [picked, setPicked] = useState<PickedCustomer>(defaultCustomer ?? null);
  const [phone, setPhone] = useState(defaultPhone ?? defaultCustomer?.phone ?? "");
  const [open, setOpen] = useState(false);

  const choose = (c: Db2CustomerBrief) => {
    setPicked({ cuscod: c.cuscod, name: c.fullName || c.cuscod });
    setPhone(c.mobile || c.phone || "");
    setOpen(false);
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <input type="hidden" name="db2_cuscod" value={picked?.cuscod ?? ""} />
      <input type="hidden" name="db2_customer_name" value={picked?.name ?? ""} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">ชื่อลูกค้า * (จากทะเบียนลูกค้าระบบขาย)</label>

          {picked ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm">
              <span className="mr-auto min-w-0">
                <span className="font-medium text-slate-800">{picked.name}</span>
                <span className="ml-2 text-xs text-slate-500">{picked.cuscod}</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="shrink-0 text-xs text-brand-600 hover:underline"
              >
                เปลี่ยน
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="input w-full text-left text-slate-400 hover:border-brand-400"
            >
              — กดเพื่อค้นหาลูกค้า —
            </button>
          )}
        </div>

        <div>
          <label className="label" htmlFor="customer_phone">
            เบอร์โทรลูกค้า
          </label>
          <input
            id="customer_phone"
            name="customer_phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
            inputMode="numeric"
            placeholder="0812345678"
          />
          <p className="mt-1 text-xs text-slate-400">
            เติมให้จากทะเบียนลูกค้า แก้เฉพาะใบจองนี้ได้
          </p>
        </div>
      </div>

      {open && <PickerDialog onPick={choose} onClose={() => setOpen(false)} />}
    </div>
  );
}
