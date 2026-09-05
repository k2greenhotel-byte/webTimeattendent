"use client";

import { useState } from "react";
import { FIELD_PUNCH_LABEL, type FieldPunchType } from "@/lib/types";

/** รูปเริ่ม/จบของภารกิจนอกสถานที่ คลิกเพื่อขยาย */
export default function FieldPhotoThumbs({
  photos,
  caption,
}: {
  photos: Record<FieldPunchType, string | null>;
  caption: string;
}) {
  const [zoom, setZoom] = useState<{ path: string; label: string } | null>(null);
  const types: FieldPunchType[] = ["start", "end"];

  return (
    <>
      <div className="flex gap-1">
        {types.map((type) => {
          const path = photos[type];
          const label = FIELD_PUNCH_LABEL[type];
          if (!path) {
            return (
              <span
                key={type}
                className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400"
                title={`ไม่มีรูป${label}`}
              >
                {label}
              </span>
            );
          }
          return (
            <button
              key={type}
              type="button"
              onClick={() => setZoom({ path, label })}
              className="h-12 w-12 overflow-hidden rounded-md border border-slate-200"
              title={`ดูรูป${label}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photo?path=${encodeURIComponent(path)}`}
                alt={label}
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
