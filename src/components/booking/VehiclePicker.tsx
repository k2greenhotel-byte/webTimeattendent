"use client";

import { useMemo, useState } from "react";
import type { MotoOption } from "@/lib/moto-types";

/**
 * ช่องเลือกรถของใบจอง (ข้อ 1.1.7-1.1.10)
 * ยี่ห้อ → รุ่น → แบบ ผูกกันเป็นชั้น: เปลี่ยนยี่ห้อแล้วรุ่น/แบบที่ไม่เข้าพวกจะถูกล้างให้
 * ตัวเลือกทั้งหมดดึงมาจากระบบข้อมูลเบื้องต้น (โปรแกรม MC) ไม่พิมพ์เอง
 */
export default function VehiclePicker({
  brands,
  models,
  variants,
  colors,
  defaults,
}: {
  brands: MotoOption[];
  models: MotoOption[];
  variants: MotoOption[];
  colors: MotoOption[];
  defaults?: {
    brand_id?: string | null;
    model_id?: string | null;
    variant_id?: string | null;
    color_id?: string | null;
  };
}) {
  const [brandId, setBrandId] = useState(defaults?.brand_id ?? "");
  const [modelId, setModelId] = useState(defaults?.model_id ?? "");
  const [variantId, setVariantId] = useState(defaults?.variant_id ?? "");

  const shownModels = useMemo(
    () => (brandId ? models.filter((m) => m.brand_id === brandId) : models),
    [brandId, models],
  );
  const shownVariants = useMemo(
    () => (modelId ? variants.filter((v) => v.model_id === modelId) : []),
    [modelId, variants],
  );

  const changeBrand = (value: string) => {
    setBrandId(value);
    // รุ่นเดิมไม่ใช่ของยี่ห้อใหม่ → ล้างรุ่นและแบบ กันบันทึกคู่ที่ขัดกันเอง
    if (modelId && !models.some((m) => m.id === modelId && m.brand_id === value)) {
      setModelId("");
      setVariantId("");
    }
  };

  const changeModel = (value: string) => {
    setModelId(value);
    if (variantId && !variants.some((v) => v.id === variantId && v.model_id === value)) {
      setVariantId("");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="label" htmlFor="brand_id">
          ยี่ห้อรถ *
        </label>
        <select
          id="brand_id"
          name="brand_id"
          value={brandId}
          onChange={(e) => changeBrand(e.target.value)}
          className="input"
        >
          <option value="">— เลือกยี่ห้อ —</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="model_id">
          รุ่นรถ *
        </label>
        <select
          id="model_id"
          name="model_id"
          value={modelId}
          onChange={(e) => changeModel(e.target.value)}
          className="input"
        >
          <option value="">— เลือกรุ่น —</option>
          {shownModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {brandId && shownModels.length === 0 && (
          <p className="mt-1 text-xs text-amber-600">
            ยี่ห้อนี้ยังไม่มีรุ่นในระบบ — เพิ่มที่เมนูข้อมูลเบื้องต้น “2. รุ่นรถ”
          </p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="variant_id">
          แบบรถ
        </label>
        <select
          id="variant_id"
          name="variant_id"
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className="input"
          disabled={!modelId}
        >
          <option value="">{modelId ? "— เลือกแบบ —" : "— เลือกรุ่นก่อน —"}</option>
          {shownVariants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="color_id">
          สี
        </label>
        <select
          id="color_id"
          name="color_id"
          defaultValue={defaults?.color_id ?? ""}
          className="input"
        >
          <option value="">— เลือกสี —</option>
          {colors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
