"use client";

import { useCallback, useRef, useState } from "react";

const ENDPOINT = "/api/inspection/photo";
const MAX_EDGE = 1600;

const photoUrl = (path: string) => `${ENDPOINT}?path=${encodeURIComponent(path)}`;

/** ย่อรูปในเครื่องก่อนอัปโหลด — รูปจากมือถือ 4-8 MB จะเหลือไม่ถึง 1 MB */
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

/**
 * รูปประกอบของรายการตรวจหนึ่งข้อ — กดแล้วเปิดกล้องบนมือถือได้เลย
 * อัปโหลดทันทีที่เลือกรูป แล้วเก็บเส้นทางไฟล์เป็น hidden input ให้ฟอร์มส่งพร้อมข้อมูลอื่น
 */
export default function ItemPhotos({
  name,
  max,
  initial = [],
  onChange,
}: {
  name: string;
  max: number;
  initial?: string[];
  onChange?: (paths: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [paths, setPaths] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const apply = useCallback(
    (next: string[]) => {
      setPaths(next);
      onChange?.(next);
    },
    [onChange],
  );

  const pick = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      const room = max - paths.length;
      if (room <= 0) {
        setError(`แนบได้สูงสุด ${max} รูป`);
        return;
      }

      setBusy(true);
      const added: string[] = [];

      for (const file of Array.from(files).slice(0, room)) {
        try {
          const body = new FormData();
          body.append(
            "photo",
            new File([await compress(file)], "photo.jpg", { type: "image/jpeg" }),
          );

          const res = await fetch(ENDPOINT, { method: "POST", body });
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

      apply([...paths, ...added].slice(0, max));
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    },
    [apply, max, paths],
  );

  return (
    <div>
      {paths.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {paths.map((path) => (
            <div key={path} className="relative overflow-hidden rounded-xl border border-slate-200">
              <button type="button" onClick={() => setZoom(path)} className="block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(path)}
                  alt="รูปประกอบการตรวจ"
                  className="h-20 w-full object-cover"
                  loading="lazy"
                />
              </button>
              <button
                type="button"
                onClick={() => apply(paths.filter((p) => p !== path))}
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

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => void pick(e.target.files)}
        disabled={busy || paths.length >= max}
        className="block w-full cursor-pointer rounded-xl border border-slate-300 px-3 py-1.5 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-brand-700 disabled:opacity-50"
      />

      {busy && <p className="mt-1 text-xs text-slate-500">กำลังอัปโหลด… อย่าเพิ่งกดบันทึก</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoom(null)}
        >
          <div className="max-h-full w-full max-w-2xl overflow-auto rounded-xl bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(zoom)} alt="รูปประกอบการตรวจ" className="w-full rounded-lg" />
            <p className="p-2 text-center text-sm text-slate-600">แตะเพื่อปิด</p>
          </div>
        </div>
      )}
    </div>
  );
}
