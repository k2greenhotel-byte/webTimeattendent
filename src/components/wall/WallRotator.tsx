"use client";

import { useEffect, useState } from "react";
import AttWallBoard from "@/components/att/AttWallBoard";
import BookingWallBoard from "@/components/booking/BookingWallBoard";
import ClaimWallBoard from "@/components/claim/ClaimWallBoard";
import HrWallBoard from "@/components/hr/HrWallBoard";
import LeadWallBoard from "@/components/lead/LeadWallBoard";
import MarketingWallBoard from "@/components/marketing/MarketingWallBoard";
import ProcurementWallBoard from "@/components/procurement/ProcurementWallBoard";
import SaleWorkWallBoard from "@/components/salework/SaleWorkWallBoard";

/**
 * จอรวม War Room — สลับจอเองอัตโนมัติ สำหรับเปิดค้างบนทีวีจอเดียว
 *
 * กดชื่อจอเพื่อดูค้างจอนั้นได้ (หยุดสลับอัตโนมัติ) กดซ้ำเพื่อกลับไปสลับต่อ
 * ตัวจอแต่ละอันคือ component เดียวกับหน้าจอเดี่ยว จึงไม่มีตัวเลขชุดที่สองให้เพี้ยนกัน
 */

export type WallScreen = {
  key: "att" | "marketing" | "booking" | "lead" | "procurement" | "claim" | "hr" | "salework";
  label: string;
};

type Option = { id: string; name: string };

/** สลับจอทุกกี่วินาที */
const ROTATE_SEC = 30;

export default function WallRotator({
  screens,
  branches,
  companies,
  activityTypes,
}: {
  screens: WallScreen[];
  branches: Option[];
  companies: Option[];
  activityTypes: Option[];
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [left, setLeft] = useState(ROTATE_SEC);

  useEffect(() => {
    if (paused || screens.length <= 1) return;
    const t = window.setInterval(() => {
      setLeft((s) => {
        if (s > 1) return s - 1;
        setIndex((i) => (i + 1) % screens.length);
        return ROTATE_SEC;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [paused, screens.length]);

  if (screens.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <p className="rounded-xl border border-amber-800 bg-amber-950 px-4 py-3 text-amber-200">
          บัญชีนี้ยังไม่มีสิทธิ์ดูจอ War Room ของโปรแกรมใดเลย — ติดต่อผู้ดูแลระบบเพื่อเปิดสิทธิ์
        </p>
      </div>
    );
  }

  const current = screens[Math.min(index, screens.length - 1)];

  function show(i: number) {
    setIndex(i);
    setLeft(ROTATE_SEC);
    // กดจอเดิมซ้ำ = สลับโหมดหยุด/เล่นต่อ
    setPaused((p) => (i === index ? !p : true));
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ---------- แถบสลับจอ ---------- */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-900 px-3 py-2">
        {screens.map((s, i) => (
          <button
            key={s.key}
            onClick={() => show(i)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              i === index
                ? "bg-sky-500 font-medium text-white"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {s.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          {paused ? (
            <button
              onClick={() => {
                setPaused(false);
                setLeft(ROTATE_SEC);
              }}
              className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
            >
              ▶ สลับจอต่อ
            </button>
          ) : (
            <>
              <span className="tabular-nums">สลับจอถัดไปใน {left} วิ</span>
              <button
                onClick={() => setPaused(true)}
                className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
              >
                ⏸ หยุดที่จอนี้
              </button>
            </>
          )}
        </div>
      </div>

      {current.key === "att" && <AttWallBoard />}
      {current.key === "marketing" && (
        <MarketingWallBoard companies={companies} activityTypes={activityTypes} />
      )}
      {current.key === "booking" && <BookingWallBoard branches={branches} />}
      {current.key === "lead" && <LeadWallBoard branches={branches} />}
      {current.key === "procurement" && <ProcurementWallBoard branches={branches} />}
      {current.key === "claim" && <ClaimWallBoard branches={branches} />}
      {current.key === "hr" && <HrWallBoard branches={branches} />}
      {current.key === "salework" && <SaleWorkWallBoard branches={branches} />}
    </div>
  );
}
