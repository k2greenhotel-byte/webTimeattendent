"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ENDPOINT = "/api/procurement/photo";

/**
 * ช่องเซ็นชื่อดิจิทัล — เซ็นด้วยนิ้วบนมือถือหรือเมาส์บน PC
 *
 * เซ็นเสร็จกด "บันทึกลายเซ็น" ระบบอัปโหลดเป็นไฟล์ PNG ขึ้นถังเดียวกับรูปแนบ
 * แล้วส่งเฉพาะเส้นทางไฟล์ไปกับฟอร์ม (ไม่ฝัง base64 ในฟอร์ม เพราะจะทำให้ payload บวมมาก)
 */
export default function SignaturePad({
  name,
  label,
  hint,
  initialPath = null,
}: {
  name: string;
  label: string;
  hint?: string;
  initialPath?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  const [path, setPath] = useState<string | null>(initialPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** ตั้งขนาดจริงของ canvas ตามความกว้างที่แสดงผล เพื่อให้เส้นไม่เบลอบนจอความละเอียดสูง */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f172a";
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const pointOf = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    drawing.current = true;
    dirty.current = true;
    const { x, y } = pointOf(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const { x, y } = pointOf(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
    setPath(null);
    setError(null);
  }, []);

  const save = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!dirty.current) {
      setError("ยังไม่ได้เซ็นชื่อ กรุณาเซ็นในกรอบก่อน");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) throw new Error("สร้างไฟล์ลายเซ็นไม่สำเร็จ");

      const form = new FormData();
      form.append("photo", blob, "signature.png");
      form.append("prefix", "signature");

      const res = await fetch(ENDPOINT, { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; path?: string; error?: string };
      if (!res.ok || !data.ok || !data.path) throw new Error(data.error ?? "บันทึกลายเซ็นไม่สำเร็จ");

      setPath(data.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกลายเซ็นไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div>
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={path ?? ""} />

      {path ? (
        <div className="space-y-2">
          <div className="rounded-xl border border-slate-200 bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${ENDPOINT}?path=${encodeURIComponent(path)}`}
              alt={label}
              className="h-24 w-full object-contain"
            />
          </div>
          <button type="button" onClick={clear} className="btn-secondary w-full sm:w-auto">
            เซ็นใหม่
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            // touch-none กันหน้าจอเลื่อนตามนิ้วขณะเซ็นบนมือถือ
            className="h-32 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="btn-primary w-full sm:w-auto"
            >
              {busy ? "กำลังบันทึก…" : "บันทึกลายเซ็น"}
            </button>
            <button type="button" onClick={clear} className="btn-secondary w-full sm:w-auto">
              ล้าง
            </button>
          </div>
        </div>
      )}

      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
