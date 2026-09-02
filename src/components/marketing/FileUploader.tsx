"use client";

import { useCallback, useRef, useState } from "react";
import { MEMO_FILE_ACCEPT } from "@/lib/marketing-types";

export type UploadedFile = {
  path: string;
  filename: string;
  mime: string | null;
  size: number | null;
};

type Props = {
  /** ชื่อฟิลด์ที่ส่งไปกับฟอร์ม (ส่งเป็น JSON หนึ่งบรรทัดต่อไฟล์) */
  name: string;
  label: string;
  hint?: string;
  max?: number;
  initialFiles?: UploadedFile[];
};

const MAX_EDGE = 1600;
const IMAGE_TYPES = /^image\//;

/** ย่อเฉพาะรูปภาพก่อนอัปโหลด ส่วนไฟล์เอกสารส่งขึ้นตามเดิม */
async function prepare(file: File): Promise<Blob> {
  if (!IMAGE_TYPES.test(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_000_000) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.75);
    });
  } catch {
    return file;
  }
}

function prettySize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function icon(mime: string | null, filename: string): string {
  const type = (mime ?? "").toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (type.startsWith("image/")) return "🖼";
  if (type.includes("pdf") || ext === "pdf") return "📕";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["doc", "docx"].includes(ext)) return "📄";
  if (["ppt", "pptx"].includes(ext)) return "📽";
  return "📎";
}

export default function FileUploader({ name, label, hint, max = 20, initialFiles = [] }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>(initialFiles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(
    async (picked: FileList | null) => {
      if (!picked || picked.length === 0) return;
      setError(null);

      const room = max - files.length;
      if (room <= 0) {
        setError(`แนบไฟล์ได้สูงสุด ${max} ไฟล์`);
        return;
      }

      setBusy(true);
      const added: UploadedFile[] = [];

      for (const file of Array.from(picked).slice(0, room)) {
        try {
          const body = new FormData();
          body.append("file", await prepare(file), file.name);

          const res = await fetch("/api/marketing/file", { method: "POST", body });
          const data = (await res.json()) as {
            ok: boolean;
            path?: string;
            filename?: string;
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
            filename: data.filename ?? file.name,
            mime: data.mime ?? null,
            size: data.size ?? null,
          });
        } catch {
          setError("อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");
          break;
        }
      }

      setFiles((prev) => [...prev, ...added].slice(0, max));
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    },
    [files.length, max],
  );

  const remove = useCallback((path: string) => {
    setFiles((prev) => prev.filter((f) => f.path !== path));
  }, []);

  return (
    <div>
      <label className="label">
        {label}{" "}
        <span className="font-normal text-slate-400">
          ({files.length}/{max})
        </span>
      </label>

      {files.length > 0 && (
        <ul className="mb-2 space-y-1">
          {files.map((f) => (
            <li
              key={f.path}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <span aria-hidden>{icon(f.mime, f.filename)}</span>
              <a
                href={`/api/marketing/file?path=${encodeURIComponent(f.path)}`}
                target="_blank"
                rel="noreferrer"
                className="mr-auto truncate text-brand-600 hover:underline"
              >
                {f.filename}
              </a>
              <span className="shrink-0 text-xs text-slate-400">{prettySize(f.size)}</span>
              <button
                type="button"
                onClick={() => remove(f.path)}
                className="shrink-0 rounded-lg px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50"
              >
                ลบ
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.map((f) => (
        <input key={f.path} type="hidden" name={name} value={JSON.stringify(f)} />
      ))}
      {/* ส่งค่าว่างไปด้วยเสมอ เพื่อให้ฝั่ง server รู้ว่าผู้ใช้ลบไฟล์ออกหมด */}
      <input type="hidden" name={name} value="" />

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={MEMO_FILE_ACCEPT}
          multiple
          onChange={(e) => void pick(e.target.files)}
          disabled={busy || files.length >= max}
          className="block w-full cursor-pointer rounded-xl border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 disabled:opacity-50 sm:w-auto"
        />
        {busy && <span className="text-sm text-slate-500">กำลังอัปโหลด…</span>}
      </div>

      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
