"use client";

import { useEffect, useRef, useState } from "react";
import { districtLabel, subdistrictLabel, type GeoRow } from "@/lib/customers";

/**
 * ที่อยู่ส่วนที่ระบบดึงให้อัตโนมัติ
 * พิมพ์รหัสไปรษณีย์หรือชื่อตำบล → ระบบค้นให้ → เลือกหนึ่งบรรทัด แล้วเติม ตำบล/อำเภอ/จังหวัด ครบทันที
 */
export default function AddressPicker({
  defaultGeo,
}: {
  defaultGeo?: GeoRow | null;
}) {
  const [picked, setPicked] = useState<GeoRow | null>(defaultGeo ?? null);
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<GeoRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const res = await fetch(`/api/geo?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { ok: boolean; rows?: GeoRow[] };
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

  const choose = (row: GeoRow) => {
    setPicked(row);
    setKeyword("");
    setRows([]);
    setTouched(true);
  };

  return (
    <div className="space-y-2">
      <input type="hidden" name="geo_code" value={picked?.subdistrict_code ?? ""} />
      <input type="hidden" name="postal_code" value={picked?.postal_code ?? ""} />

      <div>
        <label className="label" htmlFor="geo_search">
          ที่อยู่ (ตำบล อำเภอ จังหวัด) — ระบบดึงให้อัตโนมัติ
        </label>
        <input
          id="geo_search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="input"
          placeholder="พิมพ์รหัสไปรษณีย์ เช่น 71000 หรือชื่อตำบล/อำเภอ/จังหวัด"
          autoComplete="off"
        />
        {busy && <p className="mt-1 text-xs text-slate-400">กำลังค้นหา…</p>}
      </div>

      {rows.length > 0 && (
        <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {rows.map((row) => (
            <li key={row.subdistrict_code}>
              <button
                type="button"
                onClick={() => choose(row)}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-brand-50"
              >
                {subdistrictLabel(row.province_name)}
                {row.subdistrict_name} · {districtLabel(row.province_name)}
                {row.district_name} · {row.province_name}{" "}
                <span className="text-slate-400">{row.postal_code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {keyword.trim().length >= 2 && !busy && rows.length === 0 && (
        <p className="text-xs text-slate-500">ไม่พบที่อยู่ที่ตรงกับคำค้น ลองพิมพ์รหัสไปรษณีย์แทน</p>
      )}

      <div className="grid gap-2 sm:grid-cols-4">
        {[
          { label: subdistrictLabel(picked?.province_name), value: picked?.subdistrict_name },
          { label: districtLabel(picked?.province_name), value: picked?.district_name },
          { label: "จังหวัด", value: picked?.province_name },
          { label: "รหัสไปรษณีย์", value: picked?.postal_code },
        ].map((field) => (
          <div key={field.label}>
            <span className="label">{field.label}</span>
            <input
              value={field.value ?? ""}
              readOnly
              disabled
              className="input bg-slate-50 text-slate-600"
              placeholder="—"
            />
          </div>
        ))}
      </div>

      {picked && (
        <button
          type="button"
          onClick={() => {
            setPicked(null);
            setTouched(true);
          }}
          className="text-xs text-rose-600 hover:underline"
        >
          ล้างที่อยู่ที่เลือก
        </button>
      )}

      {touched && !picked && (
        <p className="text-xs text-amber-600">ยังไม่ได้เลือกตำบล — ที่อยู่จะบันทึกเฉพาะส่วนที่พิมพ์เอง</p>
      )}
    </div>
  );
}
