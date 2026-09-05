"use client";

import { useState } from "react";

const ENDPOINT = "/api/procurement/photo";

/** รูปแนบของเอกสาร (โหมดดูอย่างเดียว) — แตะเพื่อขยายเต็มจอบนมือถือ */
export default function PhotoGrid({
  paths,
  caption,
  emptyText = "ไม่มีรูปแนบ",
}: {
  paths: string[];
  caption: string;
  emptyText?: string;
}) {
  const [zoom, setZoom] = useState<string | null>(null);

  if (paths.length === 0) return <p className="text-sm text-slate-400">{emptyText}</p>;

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {paths.map((path) => (
          <button
            key={path}
            type="button"
            onClick={() => setZoom(path)}
            className="overflow-hidden rounded-xl border border-slate-200"
            title="แตะเพื่อดูรูปขนาดเต็ม"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${ENDPOINT}?path=${encodeURIComponent(path)}`}
              alt={caption}
              className="h-24 w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {zoom && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoom(null)}
        >
          <div className="max-h-full w-full max-w-2xl overflow-auto rounded-xl bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${ENDPOINT}?path=${encodeURIComponent(zoom)}`}
              alt={caption}
              className="w-full rounded-lg"
            />
            <p className="p-2 text-center text-sm text-slate-600">{caption} · แตะเพื่อปิด</p>
          </div>
        </div>
      )}
    </>
  );
}
