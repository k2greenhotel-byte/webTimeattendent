"use client";

import { useEffect, useRef, useState } from "react";
import { isRestoring, takeFormDraft } from "@/lib/form-draft";

/**
 * เติมค่าที่ผู้ใช้กรอกค้างไว้กลับเข้าฟอร์ม หลังกลับมาจากหน้าข้อมูลเบื้องต้น
 *
 * ดูแลเฉพาะช่องธรรมดา (input/select ที่ไม่ได้ถูกคุมด้วย React)
 * ส่วนช่องลูกค้า/รถ และไฟล์แนบ แต่ละตัวกู้ค่าของตัวเองจากร่างเดียวกัน
 */
const HANDLED_ELSEWHERE = new Set([
  "customer_id",
  "customer_phone",
  "brand_id",
  "model_id",
  "variant_id",
  "color_id",
]);

export default function DraftRestorer({ skip = [] }: { skip?: string[] }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!isRestoring()) return;

    const form = anchor.current?.closest("form");
    const draft = takeFormDraft(window.location.pathname);
    if (!form || !draft) return;

    // ช่องที่หน้าจอนั้น ๆ กู้ค่าเอง (React คุมค่าอยู่) ห้ามแตะซ้ำ ไม่งั้นค่าที่เห็นกับค่าที่ส่งจะไม่ตรงกัน
    const handled = new Set([...HANDLED_ELSEWHERE, ...skip]);

    let touched = 0;
    for (const [name, values] of Object.entries(draft)) {
      if (handled.has(name) || name.startsWith("file_")) continue;

      const field = form.elements.namedItem(name);
      const element =
        field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement
          ? field
          : null;
      if (!element) continue;

      if (element instanceof HTMLInputElement && element.type === "checkbox") {
        element.checked = values[0] === "on";
      } else {
        element.value = values[0] ?? "";
      }
      touched += 1;
    }

    if (touched > 0) setRestored(true);
    // อ่านร่างครั้งเดียวตอน mount เท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span ref={anchor}>
      {restored && (
        <span className="block rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
          นำค่าที่กรอกค้างไว้ทั้งหมดกลับมาให้แล้ว (รวมเอกสารแนบ) — ตรวจอีกครั้งก่อนกดบันทึก
        </span>
      )}
    </span>
  );
}
