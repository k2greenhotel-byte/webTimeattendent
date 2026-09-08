"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * โครงจอ War Room ที่ใช้ร่วมกันทุกโปรแกรม
 *
 * รับผิดชอบส่วนที่เหมือนกันหมด: พื้นมืด · นาฬิกาเดินจริง · ดึงข้อมูลซ้ำเองตามรอบ ·
 * ปุ่มเต็มจอ · แถบ error · สถานะกำลังโหลด
 * ส่วนตัวเลขและรายชื่อให้แต่ละโปรแกรมส่งเข้ามาทาง children
 *
 * ออกแบบให้อ่านจากไกลบนจอมอนิเตอร์ แต่ยังเปิดบนมือถือได้ (ตัวเลขย่อลงอัตโนมัติ)
 */

type Props<T> = {
  title: string;
  /** ปลายทาง API — เปลี่ยนค่าเมื่อไหร่ระบบจะโหลดใหม่ทันที */
  endpoint: string;
  /** รอบรีเฟรชอัตโนมัติ (มิลลิวินาที) */
  refreshMs?: number;
  /** ตัวกรองของแต่ละโปรแกรม วางไว้บนแถบหัว */
  controls?: React.ReactNode;
  children: (data: T) => React.ReactNode;
};

export default function WallShell<T extends { generatedAt?: string }>({
  title,
  endpoint,
  refreshMs = 60_000,
  controls,
  children,
}: Props<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body as T);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(load, refreshMs);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [load, refreshMs]);

  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  return (
    <div className="min-h-screen bg-slate-950 p-3 text-slate-100 sm:p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {controls}

        <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
          {data?.generatedAt && (
            <span className="hidden sm:inline">
              อัปเดต{" "}
              {new Date(data.generatedAt).toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <span className="font-mono text-base tabular-nums text-slate-200 sm:text-lg">
            {now ? now.toLocaleTimeString("th-TH") : ""}
          </span>
          <button
            onClick={fullscreen}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
          >
            เต็มจอ
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-800 bg-rose-950 px-4 py-3 text-rose-200">
          {error}
        </p>
      )}
      {!data && !error && <p className="text-slate-400">กำลังโหลด…</p>}

      {data && children(data)}
    </div>
  );
}
