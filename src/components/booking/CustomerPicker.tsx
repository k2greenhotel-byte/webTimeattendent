"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MasterLink from "@/components/booking/MasterLink";
import { draftValue, isRestoring, pickedFromLocation, takeFormDraft } from "@/lib/form-draft";

export type CustomerBrief = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  province_name?: string | null;
};

/**
 * ช่องเลือกลูกค้าของใบจอง (ข้อ 1.1.5-1.1.6)
 * พิมพ์ชื่อ/รหัส/เบอร์โทร → ระบบค้นจากทะเบียนลูกค้า → เลือกแล้วเบอร์โทรเติมให้อัตโนมัติ (แก้ทับได้)
 *
 * ยังไม่มีลูกค้าคนนี้ในระบบ → กด "+ เพิ่มลูกค้าใหม่" ไปบันทึกที่ทะเบียนลูกค้าได้เลย
 * บันทึกเสร็จระบบพากลับมาที่ใบจองใบเดิม พร้อมเลือกลูกค้าคนที่เพิ่งเพิ่มให้
 */
export default function CustomerPicker({
  defaultCustomer,
  defaultPhone,
}: {
  defaultCustomer?: CustomerBrief | null;
  defaultPhone?: string | null;
}) {
  const [picked, setPicked] = useState<CustomerBrief | null>(defaultCustomer ?? null);
  const [phone, setPhone] = useState(defaultPhone ?? defaultCustomer?.phone ?? "");
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<CustomerBrief[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** ดึงลูกค้าหนึ่งรายมาแสดงชื่อ เมื่อรู้แต่ id (กลับมาจากหน้าทะเบียนลูกค้า / กู้จากร่าง) */
  const loadById = useCallback(async (id: string, keepPhone: string | null) => {
    try {
      const res = await fetch(`/api/booking/customers?id=${encodeURIComponent(id)}`);
      const data = (await res.json()) as { ok: boolean; rows?: CustomerBrief[] };
      const row = data.ok ? data.rows?.[0] : null;
      if (!row) return;
      setPicked(row);
      setPhone(keepPhone || row.phone || "");
    } catch {
      // ดึงชื่อไม่ได้ก็ไม่เป็นไร ผู้ใช้เลือกใหม่ได้
    }
  }, []);

  // กลับมาจากหน้าทะเบียนลูกค้า: เติมลูกค้าที่เพิ่งเพิ่ม หรือกู้ลูกค้าที่เลือกไว้ก่อนออกจากหน้า
  useEffect(() => {
    if (!isRestoring()) return;

    const draft = takeFormDraft(window.location.pathname);
    const draftPhone = draftValue(draft, "customer_phone");
    if (draftPhone) setPhone(draftPhone);

    const chosen = pickedFromLocation();
    const id = chosen?.pick === "customer" ? chosen.id : draftValue(draft, "customer_id");
    if (id) void loadById(id, chosen?.pick === "customer" ? null : draftPhone);
    // อ่านร่างครั้งเดียวตอน mount เท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = keyword.trim();
    if (q.length < 2) {
      setRows([]);
      return;
    }

    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/booking/customers?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { ok: boolean; rows?: CustomerBrief[] };
        setRows(data.ok && data.rows ? data.rows : []);
      } catch {
        setRows([]);
      } finally {
        setBusy(false);
      }
    }, 300);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [keyword]);

  const choose = (row: CustomerBrief) => {
    setPicked(row);
    setPhone(row.phone ?? "");
    setKeyword("");
    setRows([]);
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <input type="hidden" name="customer_id" value={picked?.id ?? ""} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label className="label" htmlFor="customer_search">
              ชื่อลูกค้า * (ดึงจากทะเบียนลูกค้า)
            </label>
            <MasterLink href="/customers/new" pick="customer" label="+ เพิ่มลูกค้าใหม่" />
          </div>

          {picked ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm">
              <span className="mr-auto min-w-0">
                <span className="font-medium text-slate-800">{picked.full_name}</span>
                <span className="ml-2 text-xs text-slate-500">{picked.code}</span>
              </span>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="shrink-0 text-xs text-rose-600 hover:underline"
              >
                เปลี่ยนลูกค้า
              </button>
            </div>
          ) : (
            <input
              id="customer_search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="input"
              placeholder="พิมพ์ชื่อลูกค้า รหัสลูกค้า หรือเบอร์โทร"
              autoComplete="off"
            />
          )}
          {busy && <p className="mt-1 text-xs text-slate-400">กำลังค้นหา…</p>}
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
            เติมให้อัตโนมัติจากทะเบียนลูกค้า แก้เฉพาะใบจองนี้ได้
          </p>
        </div>
      </div>

      {rows.length > 0 && (
        <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => choose(row)}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-brand-50"
              >
                <span className="font-medium">{row.full_name}</span>{" "}
                <span className="text-slate-400">{row.code}</span>
                {row.phone && <span className="ml-2 text-slate-500">{row.phone}</span>}
                {row.province_name && (
                  <span className="ml-2 text-xs text-slate-400">{row.province_name}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {keyword.trim().length >= 2 && !busy && rows.length === 0 && (
        <p className="text-xs text-amber-600">
          ไม่พบลูกค้าที่ตรงกับคำค้น — กด “+ เพิ่มลูกค้าใหม่” ด้านบนเพื่อไปบันทึกทะเบียนลูกค้า
          แล้วระบบจะพากลับมาที่ใบจองใบนี้ให้เอง
        </p>
      )}
    </div>
  );
}
