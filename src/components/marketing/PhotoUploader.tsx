"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  /** ชื่อฟิลด์ที่ส่งไปกับฟอร์ม (ส่งเป็นหลายค่าเมื่อ max > 1) */
  name: string;
  label: string;
  hint?: string;
  max?: number;
  initialPaths?: string[];
  /** ใช้แยกโฟลเดอร์ในถังเก็บไฟล์ เช่น activity / letter / ack */
  prefix?: string;
  /** ปลายทางอัปโหลด/อ่านรูป — โมดูลอื่นส่ง endpoint ของตัวเองเข้ามาได้ */
  endpoint?: string;
};

const MAX_EDGE = 1600;

/** ย่อรูปในเครื่องก่อนอัปโหลด — รูปจากมือถือ 4-8 MB จะเหลือไม่ถึง 1 MB */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.75);
  });
}

export default function PhotoUploader({
  name,
  label,
  hint,
  max = 10,
  initialPaths = [],
  prefix = "activity",
  endpoint = "/api/marketing/photo",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [paths, setPaths] = useState<string[]>(initialPaths);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      const room = max - paths.length;
      if (room <= 0) {
        setError(`แนบรูปได้สูงสุด ${max} รูป`);
        return;
      }

      setBusy(true);
      const added: string[] = [];

      for (const file of Array.from(files).slice(0, room)) {
        try {
          const blob = await compress(file);
          const form = new FormData();
          form.append("photo", blob, "photo.jpg");
          form.append("prefix", prefix);

          const res = await fetch(endpoint, { method: "POST", body: form });
          const data = (await res.json()) as { ok: boolean; path?: string; error?: string };
          if (!res.ok || !data.ok || !data.path) {
            setError(data.error ?? "อัปโหลดรูปไม่สำเร็จ");
            break;
          }
          added.push(data.path);
        } catch {
          setError("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่");
          break;
        }
      }

      setPaths((prev) => [...prev, ...added].slice(0, max));
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    },
    [max, paths.length, prefix, endpoint],
  );

  const remove = useCallback((path: string) => {
    setPaths((prev) => prev.filter((p) => p !== path));
  }, []);

  return (
    <div>
      <label className="label">
        {label}{" "}
        <span className="font-normal text-slate-400">
          ({paths.length}/{max})
        </span>
      </label>

      {paths.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {paths.map((path) => (
            <div key={path} className="relative overflow-hidden rounded-xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${endpoint}?path=${encodeURIComponent(path)}`}
                alt="รูปแนบ"
                className="h-24 w-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(path)}
                className="absolute right-1 top-1 rounded-full bg-rose-600/90 px-2 py-0.5 text-xs text-white"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}

      {paths.map((path) => (
        <input key={path} type="hidden" name={name} value={path} />
      ))}
      {/* ส่งค่าว่างไปด้วยเสมอ เพื่อให้ฝั่ง server รู้ว่าผู้ใช้ลบรูปออกหมด */}
      <input type="hidden" name={name} value="" />

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={max > 1}
          onChange={(e) => void pick(e.target.files)}
          disabled={busy || paths.length >= max}
          className="block w-full cursor-pointer rounded-xl border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 disabled:opacity-50 sm:w-auto"
        />
        {busy && <span className="text-sm text-slate-500">กำลังอัปโหลด…</span>}
      </div>

      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
