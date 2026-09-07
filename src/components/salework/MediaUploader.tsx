"use client";

import { useCallback, useRef, useState } from "react";
import type { MediaInput } from "@/lib/salework-types";

type Props = {
  /** ชื่อฟิลด์ที่ส่งไปกับฟอร์ม — ส่งเป็น JSON หนึ่งบรรทัดต่อหนึ่งไฟล์ */
  name: string;
  max?: number;
  initial?: MediaInput[];
  /** ปิดการแนบไฟล์เมื่อยังไม่ได้ติ๊กว่าทำงานนี้ */
  disabled?: boolean;
  required?: boolean;
};

const ENDPOINT = "/api/salework/file";
const MAX_EDGE = 1600;

/** ย่อรูปในเครื่องก่อนอัปโหลด — รูปจากมือถือ 4-8 MB จะเหลือไม่ถึง 1 MB (คลิปไม่ย่อ) */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.75);
  });
}

const fileUrl = (path: string) => `${ENDPOINT}?path=${encodeURIComponent(path)}`;

/**
 * แนบรูปภาพหรือคลิปประกอบงาน (มือถือกดแล้วเปิดกล้อง/แกลเลอรีได้เลย)
 * อัปโหลดทันทีที่เลือกไฟล์ แล้วเก็บผลลัพธ์เป็น hidden input ให้ฟอร์มส่งพร้อมข้อมูลอื่น
 */
export default function MediaUploader({
  name,
  max = 6,
  initial = [],
  disabled = false,
  required = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaInput[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      const room = max - items.length;
      if (room <= 0) {
        setError(`แนบได้สูงสุด ${max} ไฟล์`);
        return;
      }

      setBusy(true);
      const added: MediaInput[] = [];

      for (const file of Array.from(files).slice(0, room)) {
        try {
          const isImage = file.type.startsWith("image/");
          const body = new FormData();
          if (isImage) {
            body.append("file", new File([await compress(file)], "photo.jpg", { type: "image/jpeg" }));
          } else {
            body.append("file", file);
          }

          const res = await fetch(ENDPOINT, { method: "POST", body });
          const data = (await res.json()) as {
            ok: boolean;
            path?: string;
            kind?: "image" | "video";
            filename?: string | null;
            mime?: string | null;
            size?: number;
            error?: string;
          };
          if (!res.ok || !data.ok || !data.path) {
            setError(data.error ?? "อัปโหลดไฟล์ไม่สำเร็จ");
            break;
          }

          added.push({
            path: data.path,
            kind: data.kind ?? "image",
            filename: data.filename ?? file.name,
            mime: data.mime ?? file.type,
            size_bytes: data.size ?? file.size,
          });
        } catch {
          setError("อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");
          break;
        }
      }

      setItems((prev) => [...prev, ...added].slice(0, max));
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    },
    [items.length, max],
  );

  const remove = useCallback((path: string) => {
    setItems((prev) => prev.filter((m) => m.path !== path));
  }, []);

  return (
    <div>
      <p className="label">
        รูปภาพ / คลิปประกอบ{" "}
        <span className="font-normal text-slate-400">
          ({items.length}/{max})
        </span>
        {required && <span className="ml-1 text-rose-600">*</span>}
      </p>

      {items.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {items.map((m) => (
            <div key={m.path} className="relative overflow-hidden rounded-xl border border-slate-200">
              {m.kind === "video" ? (
                <a
                  href={fileUrl(m.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-24 w-full flex-col items-center justify-center bg-slate-100 text-center text-xs text-slate-600"
                >
                  <span className="text-xl">🎬</span>
                  <span className="px-1 line-clamp-2">คลิป</span>
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(m.path)} alt="ไฟล์แนบ" className="h-24 w-full object-cover" />
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(m.path)}
                  className="absolute right-1 top-1 rounded-full bg-rose-600/90 px-2 py-0.5 text-xs text-white"
                >
                  ลบ
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {items.map((m) => (
        <input key={m.path} type="hidden" name={name} value={JSON.stringify(m)} />
      ))}
      {/* ส่งค่าว่างไปด้วยเสมอ เพื่อให้ฝั่ง server รู้ว่าผู้ใช้ลบไฟล์ออกหมด */}
      <input type="hidden" name={name} value="" />

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(e) => void pick(e.target.files)}
        disabled={disabled || busy || items.length >= max}
        className="block w-full cursor-pointer rounded-xl border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 disabled:opacity-50"
      />

      {busy && <p className="mt-1 text-xs text-slate-500">กำลังอัปโหลด… อย่าเพิ่งกดบันทึก</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
