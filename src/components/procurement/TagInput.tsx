"use client";

import { useMemo, useState } from "react";
import { tagSlug } from "@/lib/procurement";
import { MAX_TAGS_PER_PAYMENT, type PrTagRow } from "@/lib/procurement-types";

/**
 * ช่องติดป้ายกำกับ (แฮชแท็ก) ของใบเบิกจ่าย
 *
 * พิมพ์ชื่อป้ายแล้วกด Enter หรือคอมมา เพื่อเพิ่มเป็นชิป
 * ป้ายที่เคยใช้แล้วกดเลือกจากรายการด้านล่างได้เลย จะได้ไม่พิมพ์ผิดจนกลายเป็นคนละกลุ่มในรายงาน
 * ค่าที่ส่งไปกับฟอร์มเป็นข้อความบรรทัดเดียวคั่นด้วยคอมมา (ฝั่ง server แยกด้วย parseTags)
 */
export default function TagInput({
  name,
  label,
  hint,
  initialTags = [],
  suggestions = [],
  compact = false,
}: {
  name: string;
  label: string;
  hint?: string;
  initialTags?: { name: string }[];
  /** ป้ายที่เคยใช้แล้วในระบบ เรียงตามที่ใช้บ่อย */
  suggestions?: PrTagRow[];
  /** แบบย่อ — ใช้ตอนที่มีหลายช่องซ้อนกันในหน้าเดียว จะได้ไม่ยาวจนอ่านยาก */
  compact?: boolean;
}) {
  const [tags, setTags] = useState<string[]>(() => initialTags.map((t) => t.name));
  const [draft, setDraft] = useState("");

  const slugs = useMemo(() => new Set(tags.map(tagSlug)), [tags]);
  const full = tags.length >= MAX_TAGS_PER_PAYMENT;

  const add = (raw: string) => {
    const clean = raw.replace(/^#+/, "").trim().replace(/\s+/g, " ");
    if (!clean || clean.length > 60 || full) return;
    if (slugs.has(tagSlug(clean))) return;
    setTags((prev) => [...prev, clean]);
  };

  const remove = (value: string) => setTags((prev) => prev.filter((t) => t !== value));

  /** ป้ายที่เคยใช้ แต่ยังไม่ได้ติดบนใบนี้ — แสดงไว้ให้กดเลือก 12 อันแรก */
  const available = suggestions.filter((s) => !slugs.has(s.slug)).slice(0, compact ? 6 : 12);

  return (
    <div>
      <label className="label" htmlFor={`${name}_draft`}>
        {label}{" "}
        <span className="font-normal text-slate-400">
          ({tags.length}/{MAX_TAGS_PER_PAYMENT})
        </span>
      </label>

      {/* ค่าจริงที่ส่งไปกับฟอร์ม */}
      <input type="hidden" name={name} value={tags.join(", ")} />

      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-700 ${
                compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
              }`}
            >
              #{tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="text-brand-500 hover:text-rose-600"
                aria-label={`เอาป้าย ${tag} ออก`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        id={`${name}_draft`}
        value={draft}
        onChange={(e) => {
          // พิมพ์คอมมาแล้วตัดเป็นป้ายทันที ไม่ต้องกด Enter
          if (e.target.value.includes(",")) {
            for (const piece of e.target.value.split(",")) add(piece);
            setDraft("");
          } else {
            setDraft(e.target.value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // กัน Enter ไปกดบันทึกทั้งฟอร์มขณะกำลังพิมพ์ป้าย
            e.preventDefault();
            add(draft);
            setDraft("");
          } else if (e.key === "Backspace" && !draft && tags.length > 0) {
            setTags((prev) => prev.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (draft.trim()) {
            add(draft);
            setDraft("");
          }
        }}
        className="input"
        placeholder={full ? `ติดป้ายครบ ${MAX_TAGS_PER_PAYMENT} แล้ว` : "พิมพ์ป้ายแล้วกด Enter เช่น ค่าน้ำมัน"}
        disabled={full}
      />

      {available.length > 0 && (
        <div className={compact ? "mt-1" : "mt-2"}>
          {/* แบบย่อไม่ต้องมีหัวข้อ ชิปมันบอกตัวเองอยู่แล้วว่ากดได้ */}
          {!compact && <p className="mb-1 text-xs text-slate-400">ป้ายที่เคยใช้ — กดเพื่อติด</p>}
          <div className="flex flex-wrap gap-1.5">
            {available.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => add(s.name)}
                disabled={full}
                className={`rounded-full border border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-40 ${
                  compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
                }`}
              >
                #{s.name}
                {s.use_count > 0 && <span className="ml-1 text-xs text-slate-400">{s.use_count}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
