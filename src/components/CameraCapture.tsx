"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatStampThai } from "@/lib/datetime";
import type { FieldPunchType, PunchType } from "@/lib/types";

type Props = {
  /** ประเภทการลงเวลาปกติ (เข้าเช้า…), ของภารกิจ (start/end) เมื่อมี taskId, หรือธุระ (errand_out/errand_in) */
  punchType: PunchType | FieldPunchType | "errand_out" | "errand_in";
  punchLabel: string;
  empCode: string;
  fullName: string;
  requireGps: boolean;
  /** ลงเวลาให้ภารกิจนอกสถานที่แทนการลงเวลาปกติ */
  taskId?: string;
  /** เหตุผลที่ออกไปทำธุระ (ส่งไปกับการกดออก) */
  reason?: string;
  /** หน้าที่จะกลับไปหลังบันทึกสำเร็จ (ค่าเริ่มต้น /punch) */
  returnTo?: string;
};

type Coords = { lat: number; lng: number; accuracy: number };

const MAX_WIDTH = 1080;

export default function CameraCapture({
  punchType,
  punchLabel,
  empCode,
  fullName,
  requireGps,
  taskId,
  reason,
  returnTo = "/punch",
}: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- เปิดกล้อง ----
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCameraError(
          "เปิดกล้องไม่สำเร็จ กรุณาอนุญาตให้เว็บไซต์ใช้กล้อง แล้วรีเฟรชหน้านี้ (ต้องใช้ผ่าน HTTPS หรือ localhost)",
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ---- ขอพิกัด ----
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => setGpsError("ไม่สามารถอ่านตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, []);

  /** ขอเวลาจาก server เพื่อประทับบนรูป (ไม่ใช้นาฬิกาเครื่อง) */
  const serverNow = useCallback(async (): Promise<Date> => {
    try {
      const res = await fetch("/api/time", { cache: "no-store" });
      const data = (await res.json()) as { now: string };
      return new Date(data.now);
    } catch {
      return new Date();
    }
  }, []);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    setBusy(true);
    setError(null);

    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);

    // ---- watermark ----
    const now = await serverNow();
    const lines = [
      `${fullName} (${empCode})`,
      `${punchLabel} · ${formatStampThai(now)}`,
      coords
        ? `พิกัด ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)} (±${Math.round(coords.accuracy)} ม.)`
        : "ไม่มีข้อมูลพิกัด",
    ];

    const fontSize = Math.max(14, Math.round(width / 30));
    const padding = Math.round(fontSize * 0.6);
    const barHeight = lines.length * (fontSize + padding) + padding;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, height - barHeight, width, barHeight);
    ctx.fillStyle = "#ffffff";
    ctx.font = `${fontSize}px "Sarabun", "Noto Sans Thai", Tahoma, sans-serif`;
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.fillText(line, padding, height - barHeight + padding + i * (fontSize + padding));
    });

    canvas.toBlob(
      (blob) => {
        blobRef.current = blob;
        setPreview(canvas.toDataURL("image/jpeg", 0.7));
        setBusy(false);
      },
      "image/jpeg",
      0.7,
    );
  }, [coords, empCode, fullName, punchLabel, serverNow]);

  const submit = useCallback(async () => {
    if (!blobRef.current) return;
    if (requireGps && !coords) {
      setError("ระบบกำหนดให้ต้องเปิด GPS ก่อนลงเวลา");
      return;
    }

    setBusy(true);
    setError(null);

    const form = new FormData();
    form.append("punch_type", punchType);
    if (taskId) form.append("task_id", taskId);
    if (reason) form.append("reason", reason);
    form.append("photo", blobRef.current, "punch.jpg");
    if (coords) {
      form.append("lat", String(coords.lat));
      form.append("lng", String(coords.lng));
      form.append("accuracy", String(coords.accuracy));
    }

    try {
      const res = await fetch("/api/punch", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "บันทึกไม่สำเร็จ");
        setBusy(false);
        return;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      router.push(`${returnTo}${returnTo.includes("?") ? "&" : "?"}ok=1`);
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่");
      setBusy(false);
    }
  }, [coords, punchType, reason, requireGps, router, returnTo, taskId]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="mx-auto max-w-lg space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{punchLabel}</h1>
          <button type="button" onClick={() => router.push(returnTo)} className="text-sm text-slate-300">
            ยกเลิก
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-black">
          {cameraError ? (
            <p className="p-6 text-center text-sm text-rose-300">{cameraError}</p>
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="รูปที่ถ่าย" className="w-full" />
          ) : (
            <video ref={videoRef} playsInline muted className="w-full" />
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <p className="text-xs text-slate-400">
          {coords
            ? `พิกัด ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} (±${Math.round(coords.accuracy)} ม.)`
            : (gpsError ?? "กำลังอ่านตำแหน่ง…")}
        </p>

        {error && <p className="rounded-xl bg-rose-900/50 px-3 py-2 text-sm text-rose-200">{error}</p>}

        {!preview ? (
          <button
            type="button"
            onClick={capture}
            disabled={busy || !!cameraError}
            className="btn-primary w-full py-4 text-base"
          >
            {busy ? "กำลังถ่าย…" : "📷 ถ่ายรูป"}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                blobRef.current = null;
              }}
              disabled={busy}
              className="btn border border-slate-600 bg-slate-800 py-4 text-base text-white"
            >
              ถ่ายใหม่
            </button>
            <button type="button" onClick={submit} disabled={busy} className="btn-primary py-4 text-base">
              {busy ? "กำลังบันทึก…" : "ยืนยันลงเวลา"}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-slate-500">
          ระบบบันทึกเวลาจากเซิร์ฟเวอร์ และอนุญาตเฉพาะรูปที่ถ่ายสดจากกล้องเท่านั้น
        </p>
      </div>
    </div>
  );
}
