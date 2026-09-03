"use client";

import { useEffect, useMemo, useState } from "react";
import MasterLink from "@/components/booking/MasterLink";
import { draftValue, isRestoring, pickedFromLocation, takeFormDraft } from "@/lib/form-draft";
import type { MotoOption } from "@/lib/moto-types";

/**
 * ช่องเลือกรถของใบจอง (ข้อ 1.1.7-1.1.10)
 * ยี่ห้อ → รุ่น → แบบ ผูกกันเป็นชั้น: เปลี่ยนยี่ห้อแล้วรุ่น/แบบที่ไม่เข้าพวกจะถูกล้างให้
 * ตัวเลือกทั้งหมดดึงมาจากระบบข้อมูลเบื้องต้น (โปรแกรม MC) ไม่พิมพ์เอง
 *
 * ยังไม่มีรุ่น/แบบ/สีที่ต้องการ → กดลิงก์ข้างช่องไปเพิ่มที่หน้าข้อมูลเบื้องต้นได้เลย
 * บันทึกเสร็จระบบพากลับมาที่ใบจองใบเดิม พร้อมเลือกค่าที่เพิ่งเพิ่มให้
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
  const [colorId, setColorId] = useState(defaults?.color_id ?? "");

  // กลับมาจากหน้าข้อมูลเบื้องต้น: กู้ค่าที่เลือกไว้เดิม แล้วทับด้วยค่าที่เพิ่งเพิ่ม
  useEffect(() => {
    if (!isRestoring()) return;

    const draft = takeFormDraft(window.location.pathname);
    const restore = (name: string, set: (v: string) => void) => {
      const value = draftValue(draft, name);
      if (value) set(value);
    };
    restore("brand_id", setBrandId);
    restore("model_id", setModelId);
    restore("variant_id", setVariantId);
    restore("color_id", setColorId);

    const chosen = pickedFromLocation();
    if (chosen?.pick === "brand") setBrandId(chosen.id);
    if (chosen?.pick === "model") setModelId(chosen.id);
    if (chosen?.pick === "variant") setVariantId(chosen.id);
    if (chosen?.pick === "color") setColorId(chosen.id);
    // อ่านร่างครั้งเดียวตอน mount เท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label className="label" htmlFor="brand_id">
            ยี่ห้อรถ *
          </label>
          <MasterLink href="/moto/setup/brands" pick="brand" label="+ เพิ่มยี่ห้อ" />
        </div>
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label className="label" htmlFor="model_id">
            รุ่นรถ *
          </label>
          <MasterLink href="/moto/setup/models" pick="model" label="+ เพิ่มรุ่น" parentId={brandId} />
        </div>
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
            ยี่ห้อนี้ยังไม่มีรุ่นในระบบ — กด “+ เพิ่มรุ่น” ด้านบนได้เลย
          </p>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label className="label" htmlFor="variant_id">
            แบบรถ
          </label>
          <MasterLink
            href="/moto/setup/variants"
            pick="variant"
            label="+ เพิ่มแบบ"
            parentId={modelId}
          />
        </div>
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label className="label" htmlFor="color_id">
            สี
          </label>
          <MasterLink href="/moto/setup/colors" pick="color" label="+ เพิ่มสี" />
        </div>
        <select
          id="color_id"
          name="color_id"
          value={colorId}
          onChange={(e) => setColorId(e.target.value)}
          className="input"
        >
          <option value="">— เลือกสี —</option>
          {colors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {colors.length === 0 && (
          <p className="mt-1 text-xs text-amber-600">
            ยังไม่มีสีรถในระบบ — กด “+ เพิ่มสี” ด้านบนได้เลย
          </p>
        )}
      </div>
    </div>
  );
}
