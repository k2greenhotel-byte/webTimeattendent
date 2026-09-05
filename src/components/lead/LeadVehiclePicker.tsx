"use client";

import { useEffect, useMemo, useState } from "react";
import MasterLink from "@/components/booking/MasterLink";
import { draftValue, isRestoring, pickedFromLocation, takeFormDraft } from "@/lib/form-draft";
import type { MotoOption } from "@/lib/moto-types";

/**
 * ช่องที่ดึงค่าจากข้อมูลเบื้องต้นของใบ Lead (ข้อ 1.6, 1.7, 1.9)
 * ยี่ห้อ → รุ่น ผูกกัน: เปลี่ยนยี่ห้อแล้วรุ่นที่ไม่เข้าพวกจะถูกล้างให้
 * ช่องทางการติดต่อเลือก "อื่นๆ" จะมีช่องให้ระบุเพิ่ม
 *
 * ยังไม่มีค่าที่ต้องการ → กดลิงก์ข้างช่องไปเพิ่มที่หน้าข้อมูลเบื้องต้นได้เลย
 * บันทึกเสร็จระบบพากลับมาที่ใบเดิม พร้อมเลือกค่าที่เพิ่งเพิ่มให้
 */
export default function LeadVehiclePicker({
  brands,
  models,
  channels,
  defaults,
}: {
  brands: MotoOption[];
  models: MotoOption[];
  channels: MotoOption[];
  defaults?: {
    brand_id?: string | null;
    model_id?: string | null;
    channel_id?: string | null;
    channel_other?: string | null;
  };
}) {
  const [brandId, setBrandId] = useState(defaults?.brand_id ?? "");
  const [modelId, setModelId] = useState(defaults?.model_id ?? "");
  const [channelId, setChannelId] = useState(defaults?.channel_id ?? "");
  const [channelOther, setChannelOther] = useState(defaults?.channel_other ?? "");

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
    restore("channel_id", setChannelId);
    restore("channel_other", setChannelOther);

    const chosen = pickedFromLocation();
    if (chosen?.pick === "brand") setBrandId(chosen.id);
    if (chosen?.pick === "model") setModelId(chosen.id);
    if (chosen?.pick === "channel") setChannelId(chosen.id);
    // อ่านร่างครั้งเดียวตอน mount เท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shownModels = useMemo(
    () => (brandId ? models.filter((m) => m.brand_id === brandId) : models),
    [brandId, models],
  );

  /** ช่องทาง "อื่นๆ" ให้ระบุข้อความเพิ่ม — ดูจากชื่อช่องทางที่เลือก */
  const needOther = useMemo(
    () => channels.some((c) => c.id === channelId && c.name.includes("อื่น")),
    [channelId, channels],
  );

  const changeBrand = (value: string) => {
    setBrandId(value);
    // รุ่นเดิมไม่ใช่ของยี่ห้อใหม่ → ล้างรุ่น กันบันทึกคู่ที่ขัดกันเอง
    if (modelId && !models.some((m) => m.id === modelId && m.brand_id === value)) setModelId("");
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label className="label" htmlFor="brand_id">
            ยี่ห้อรถที่สนใจ
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
            รุ่นรถที่สนใจ
          </label>
          <MasterLink href="/moto/setup/models" pick="model" label="+ เพิ่มรุ่น" parentId={brandId} />
        </div>
        <select
          id="model_id"
          name="model_id"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
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
          <label className="label" htmlFor="channel_id">
            ช่องทางการติดต่อ *
          </label>
          <MasterLink href="/moto/setup/channels" pick="channel" label="+ เพิ่มช่องทาง" />
        </div>
        <select
          id="channel_id"
          name="channel_id"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="input"
        >
          <option value="">— เลือกช่องทาง —</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {needOther && (
          <input
            name="channel_other"
            value={channelOther}
            onChange={(e) => setChannelOther(e.target.value)}
            className="input mt-2"
            placeholder="ระบุช่องทาง เช่น งานวัด / เพื่อนแนะนำ"
            aria-label="ระบุช่องทางอื่นๆ"
          />
        )}
        {!needOther && <input type="hidden" name="channel_other" value="" />}
      </div>
    </div>
  );
}
