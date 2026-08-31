"use client";

import { useState } from "react";
import { PUNCH_ORDER, PUNCH_SHORT_LABEL, type PunchType } from "@/lib/types";

type Photos = Record<PunchType, string | null>;

/** รูป 4 ใบของวัน คลิกเพื่อขยาย */
export default function PhotoThumbs({ photos, caption }: { photos: Photos; caption: string }) {
  const [zoom, setZoom] = useState<{ path: string; label: string } | null>(null);

  return (
    <>
      <div className="flex gap-1">
        {PUNCH_ORDER.map((type) => {
          const path = photos[type];
          if (!path) {
            return (
              <span
                key={type}
                className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400"
                title={`ไม่มีรูป ${PUNCH_SHORT_LABEL[type]}`}
              >
                {PUNCH_SHORT_LABEL[type]}
              </span>
            );
          }
          return (
            <button
              key={type}
              type="button"
              onClick={() => setZoom({ path, label: PUNCH_SHORT_LABEL[type] })}
              className="h-12 w-12 overflow-hidden rounded-md border border-slate-200"
              title={`ดูรูป ${PUNCH_SHORT_LABEL[type]}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photo?path=${encodeURIComponent(path)}`}
                alt={PUNCH_SHORT_LABEL[type]}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoom(null)}
        >
          <div className="max-h-full max-w-lg overflow-auto rounded-xl bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photo?path=${encodeURIComponent(zoom.path)}`}
              alt={zoom.label}
              className="w-full rounded-lg"
            />
            <p className="p-2 text-center text-sm text-slate-600">
              {caption} · {zoom.label}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
