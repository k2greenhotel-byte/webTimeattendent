"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Db2Vehicle } from "@/lib/db2-api";

/**
 * ช่องเลือกรถและลูกค้าของใบขอเคลม (ข้อ 1.4.5-1.4.9)
 *
 * โหมดปกติ: กด "ค้นจากระบบขาย" → popup → พิมพ์เลขตัวถัง/เลขเครื่อง/ชื่อลูกค้า/เลขที่สัญญา
 * → เลือกหนึ่งคัน แล้วระบบเติมให้ครบทีเดียวทั้ง เลขตัวถัง เลขเครื่อง ยี่ห้อ/รุ่น/แบบ/สี
 * และชื่อ/ที่อยู่/เบอร์ลูกค้า (ข้อมูลมาจาก INVTRAN + SALEALL + CUSTMAST ของระบบขาย)
 *
 * โหมดลูกค้าภายนอก (ข้อ 1.4.9): ไม่มีข้อมูลใน Db2 → คีย์เองทุกช่อง
 *
 * ค่าที่บันทึกลงใบเป็น "สำเนา ณ ตอนบันทึก" ทั้งรหัสและชื่อ — ใบเก่าต้องอ่านออก
 * แม้ระบบขายจะแก้ข้อมูลภายหลัง และหน้าจอรายการจะได้ไม่ต้องยิงถาม Db2 ทีละแถว
 */

export type VehicleDefaults = {
  chassis_no: string;
  engine_no: string;
  brand_code: string;
  brand_name: string;
  model_code: string;
  model_name: string;
  variant_code: string;
  variant_name: string;
  color_code: string;
  color_name: string;
  contno: string;
  locat: string;
  sale_date: string;
  cuscod: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  is_external: boolean;
};

const EMPTY: VehicleDefaults = {
  chassis_no: "",
  engine_no: "",
  brand_code: "",
  brand_name: "",
  model_code: "",
  model_name: "",
  variant_code: "",
  variant_name: "",
  color_code: "",
  color_name: "",
  contno: "",
  locat: "",
  sale_date: "",
  cuscod: "",
  customer_name: "",
  customer_phone: "",
  customer_address: "",
  is_external: false,
};

const TSALE_LABEL: Record<string, string> = { H: "ผ่อน", C: "สด", F: "ไฟแนนซ์", A: "ส่งเอเย่นต์" };

function vehicleOf(v: Db2Vehicle): VehicleDefaults {
  return {
    chassis_no: v.strno,
    engine_no: v.engno,
    brand_code: v.brand,
    brand_name: v.brand,
    model_code: v.model,
    model_name: v.modelName,
    variant_code: v.variant,
    variant_name: v.variantName,
    color_code: v.color,
    color_name: v.color,
    contno: v.sale.contno,
    locat: v.sale.locat,
    sale_date: v.sale.date ?? "",
    cuscod: v.customer.cuscod,
    customer_name: v.customer.fullName,
    // 1.4.8 เบอร์โทรให้พิมพ์ใหม่ได้เสมอ — เติมเบอร์ที่ระบบขายมีไว้เป็นค่าตั้งต้น
    customer_phone: v.customer.mobile || v.customer.phone,
    customer_address: v.customer.address,
    is_external: false,
  };
}

/** popup ค้นรถจากระบบขาย */
function SearchDialog({
  onPick,
  onClose,
}: {
  onPick: (v: Db2Vehicle) => void;
  onClose: () => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [soldOnly, setSoldOnly] = useState(true);
  const [rows, setRows] = useState<Db2Vehicle[]>([]);
  const [matched, setMatched] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string, sold: boolean) => {
    if (q.trim().length < 3) {
      setRows([]);
      setMatched(0);
      setError(null);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: q.trim(), limit: "30" });
      if (sold) params.set("sold", "1");

      const res = await fetch(`/api/db2/vehicles?${params.toString()}`);
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        vehicles?: Db2Vehicle[];
        matched?: number;
      };
      if (!res.ok || data.ok === false) throw new Error(data.error ?? "ค้นข้อมูลรถไม่สำเร็จ");
      setRows(data.vehicles ?? []);
      setMatched(data.matched ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ค้นข้อมูลรถไม่สำเร็จ");
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
    timer.current = setTimeout(() => void search(keyword, soldOnly), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [keyword, soldOnly, search]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 p-3">
          <h3 className="mr-auto font-semibold text-slate-800">ค้นรถจากระบบขาย</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            ปิด
          </button>
        </div>

        <div className="space-y-2 border-b border-slate-200 p-3">
          <input
            ref={inputRef}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="input"
            placeholder="เลขตัวถัง · เลขเครื่อง · ชื่อลูกค้า · เลขที่สัญญา · รหัสลูกค้า"
            autoComplete="off"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={soldOnly}
              onChange={(e) => setSoldOnly(e.target.checked)}
            />
            เฉพาะรถที่ขายออกไปแล้ว (ติ๊กออกเพื่อค้นรถที่ยังอยู่ในสต็อกด้วย)
          </label>
          <p className="text-xs text-slate-400">
            {keyword.trim().length < 3
              ? "พิมพ์อย่างน้อย 3 ตัวอักษร"
              : busy
                ? "กำลังค้น…"
                : matched > rows.length
                  ? `พบ ${matched} คัน — แสดง ${rows.length} คันแรก พิมพ์เพิ่มเพื่อแคบลง`
                  : `พบ ${matched} คัน`}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && <p className="p-3 text-sm text-rose-600">{error}</p>}
          {!error && !busy && keyword.trim().length >= 3 && rows.length === 0 && (
            <p className="p-3 text-sm text-slate-500">
              ไม่พบรถที่ตรงกับคำค้น — ถ้าเป็นรถที่ไม่ได้ซื้อจากเรา ให้ปิดหน้าต่างนี้แล้วติ๊ก
              “ลูกค้าภายนอก” เพื่อคีย์ข้อมูลเอง
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {rows.map((v) => (
              <li key={`${v.strno}-${v.sale.contno}`}>
                <button
                  type="button"
                  onClick={() => onPick(v)}
                  className="block w-full px-3 py-2.5 text-left text-sm hover:bg-brand-50"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">{v.strno}</span>
                    {v.flag !== "C" && (
                      <span className="badge bg-sky-100 text-sky-700">ยังอยู่ในสต็อก</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-slate-600">
                    {[v.brand, v.modelName, v.variantName, v.color].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {v.customer.fullName || "— ไม่พบชื่อลูกค้าในระบบขาย —"}
                    {v.sale.contno ? ` · สัญญา ${v.sale.contno}` : ""}
                    {v.sale.date ? ` · ขาย ${v.sale.date}` : ""}
                    {v.sale.tsale ? ` · ${TSALE_LABEL[v.sale.tsale] ?? v.sale.tsale}` : ""}
                    {v.sale.locat ? ` · ${v.sale.locat}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function VehiclePicker({ defaults }: { defaults?: Partial<VehicleDefaults> }) {
  const [value, setValue] = useState<VehicleDefaults>({ ...EMPTY, ...defaults });
  const [open, setOpen] = useState(false);

  const set = (patch: Partial<VehicleDefaults>) => setValue((prev) => ({ ...prev, ...patch }));
  const external = value.is_external;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      {/* ค่าที่ส่งเข้าฟอร์ม — ช่องที่ผู้ใช้แก้เองมี input ของตัวเองอยู่ด้านล่างแล้ว */}
      <input type="hidden" name="db2_brand_code" value={value.brand_code} />
      <input type="hidden" name="db2_model_code" value={value.model_code} />
      <input type="hidden" name="db2_variant_code" value={value.variant_code} />
      <input type="hidden" name="db2_color_code" value={value.color_code} />
      <input type="hidden" name="db2_contno" value={value.contno} />
      <input type="hidden" name="db2_locat" value={value.locat} />
      <input type="hidden" name="db2_sale_date" value={value.sale_date} />
      <input type="hidden" name="db2_cuscod" value={external ? "" : value.cuscod} />
      <input type="hidden" name="is_external" value={external ? "1" : "0"} />

      <div className="flex flex-wrap items-center gap-3">
        <h3 className="mr-auto font-semibold text-slate-800">รถและลูกค้า</h3>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={external}
            onChange={(e) =>
              // สลับโหมดแล้วล้างการอ้างอิงระบบขายทิ้ง กันใบที่อ้างรหัสค้างไว้แต่ข้อมูลคีย์เอง
              e.target.checked
                ? set({ is_external: true, cuscod: "", contno: "", locat: "", sale_date: "" })
                : set({ is_external: false })
            }
          />
          ลูกค้าภายนอก (ไม่มีข้อมูลในระบบขาย — คีย์เอง)
        </label>
        {!external && (
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
            🔍 ค้นจากระบบขาย
          </button>
        )}
      </div>

      {!external && value.chassis_no && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <p className="font-semibold text-slate-800">{value.chassis_no}</p>
          <p className="text-slate-600">
            {[value.brand_name, value.model_name, value.variant_name, value.color_name]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-xs text-slate-500">
            {value.cuscod ? `ลูกค้า ${value.cuscod}` : "ไม่พบรหัสลูกค้าในระบบขาย"}
            {value.contno ? ` · สัญญา ${value.contno}` : ""}
            {value.sale_date ? ` · ขาย ${value.sale_date}` : ""}
            {value.locat ? ` · ${value.locat}` : ""}
          </p>
        </div>
      )}

      {/* ---------- รถ (1.4.5-1.4.6) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="chassis_no">
            เลขตัวถัง *
          </label>
          <input
            id="chassis_no"
            name="chassis_no"
            value={value.chassis_no}
            onChange={(e) => set({ chassis_no: e.target.value })}
            readOnly={!external}
            className={`input ${external ? "" : "bg-slate-50"}`}
            placeholder={external ? "พิมพ์เลขตัวถัง" : "กด “ค้นจากระบบขาย”"}
            maxLength={40}
          />
        </div>
        <div>
          <label className="label" htmlFor="engine_no">
            เลขเครื่อง{external ? " *" : ""}
          </label>
          <input
            id="engine_no"
            name="engine_no"
            value={value.engine_no}
            onChange={(e) => set({ engine_no: e.target.value })}
            readOnly={!external}
            className={`input ${external ? "" : "bg-slate-50"}`}
            maxLength={40}
          />
        </div>
        <div>
          <label className="label" htmlFor="db2_brand_name">
            ยี่ห้อ
          </label>
          <input
            id="db2_brand_name"
            name="db2_brand_name"
            value={value.brand_name}
            onChange={(e) => set({ brand_name: e.target.value })}
            readOnly={!external}
            className={`input ${external ? "" : "bg-slate-50"}`}
          />
        </div>
        <div>
          <label className="label" htmlFor="db2_model_name">
            รุ่น
          </label>
          <input
            id="db2_model_name"
            name="db2_model_name"
            value={value.model_name}
            onChange={(e) => set({ model_name: e.target.value })}
            readOnly={!external}
            className={`input ${external ? "" : "bg-slate-50"}`}
          />
        </div>
        <div>
          <label className="label" htmlFor="db2_variant_name">
            แบบ
          </label>
          <input
            id="db2_variant_name"
            name="db2_variant_name"
            value={value.variant_name}
            onChange={(e) => set({ variant_name: e.target.value })}
            readOnly={!external}
            className={`input ${external ? "" : "bg-slate-50"}`}
          />
        </div>
        <div>
          <label className="label" htmlFor="db2_color_name">
            สี
          </label>
          <input
            id="db2_color_name"
            name="db2_color_name"
            value={value.color_name}
            onChange={(e) => set({ color_name: e.target.value })}
            readOnly={!external}
            className={`input ${external ? "" : "bg-slate-50"}`}
          />
        </div>
      </div>

      {/* ---------- ลูกค้า (1.4.7-1.4.9) ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="customer_name">
            ชื่อลูกค้า *
          </label>
          <input
            id="customer_name"
            name="customer_name"
            value={value.customer_name}
            onChange={(e) => set({ customer_name: e.target.value })}
            readOnly={!external && Boolean(value.cuscod)}
            className={`input ${!external && value.cuscod ? "bg-slate-50" : ""}`}
            maxLength={200}
          />
          {!external && !value.cuscod && value.chassis_no && (
            <p className="mt-1 text-xs text-amber-600">
              ระบบขายไม่มีชื่อลูกค้าของรถคันนี้ (เช่น รายการส่งเอเย่นต์) — พิมพ์ชื่อเองได้เลย
            </p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="customer_phone">
            เบอร์โทร{external ? " *" : ""}
          </label>
          <input
            id="customer_phone"
            name="customer_phone"
            value={value.customer_phone}
            onChange={(e) => set({ customer_phone: e.target.value })}
            className="input"
            inputMode="tel"
            placeholder="0812345678"
          />
          <p className="mt-1 text-xs text-slate-400">แก้ได้เสมอ (ข้อ 1.4.8)</p>
        </div>
        <div>
          <label className="label" htmlFor="customer_address">
            ที่อยู่{external ? " *" : ""}
          </label>
          <input
            id="customer_address"
            name="customer_address"
            value={value.customer_address}
            onChange={(e) => set({ customer_address: e.target.value })}
            className="input"
          />
        </div>
      </div>

      {open && (
        <SearchDialog
          onPick={(v) => {
            set(vehicleOf(v));
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
