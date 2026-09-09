"use client";

import { useMemo, useState } from "react";
import {
  initialPeriodState,
  periodFromState,
  WALL_PRESETS,
  type WallPeriod,
  type WallPeriodState,
  type WallPreset,
} from "@/lib/wall-period";
import { workDateOf } from "@/lib/datetime";

/**
 * ตัวกรองมาตรฐานของจอ War Room ทุกโปรแกรม
 *
 * แถบช่วงเวลาใช้แบบเดียวกับจอยอดขาย Db2 ทั้งหมด ผู้ใช้จึงเจอปุ่มชุดเดิมทุกจอ
 * ไม่ต้องเรียนรู้ใหม่ และ dropdown สาขา/อื่นๆ ใช้หน้าตาเดียวกันหมด
 */

export type Option = { id: string; name: string };

const PILL = "rounded-lg px-2.5 py-1 text-sm transition";
const INPUT =
  "rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100";

/** สถานะช่วงเวลา + ช่วงที่คำนวณแล้ว — ให้จอเอาไปทำ query string */
export function useWallPeriod(initial: WallPreset = "mtd") {
  const [state, setState] = useState<WallPeriodState>(() => initialPeriodState(initial));
  const period = useMemo<WallPeriod>(() => periodFromState(state), [state]);
  return { state, setState, period };
}

/** แถบปุ่มช่วงเวลา — วางใน controls ของ WallShell */
export function WallPeriodPicker({
  state,
  onChange,
  period,
}: {
  state: WallPeriodState;
  onChange: (next: WallPeriodState) => void;
  period: WallPeriod;
}) {
  const today = workDateOf();

  return (
    <>
      <div className="flex rounded-lg bg-slate-800 p-1">
        {WALL_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange({ ...state, preset: p.key })}
            className={`${PILL} ${
              state.preset === p.key
                ? "bg-sky-500 font-medium text-white"
                : "text-slate-300 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {state.preset === "month" && (
        <input
          type="month"
          value={state.month}
          max={today.slice(0, 7)}
          onChange={(e) => onChange({ ...state, month: e.target.value })}
          className={INPUT}
          aria-label="เลือกเดือน"
        />
      )}

      {state.preset === "custom" && (
        <span className="flex items-center gap-1">
          <input
            type="date"
            value={state.from}
            max={state.to}
            onChange={(e) => onChange({ ...state, from: e.target.value })}
            className={INPUT}
            aria-label="ตั้งแต่วันที่"
          />
          <span className="text-slate-500">–</span>
          <input
            type="date"
            value={state.to}
            min={state.from}
            max={today}
            onChange={(e) => onChange({ ...state, to: e.target.value })}
            className={INPUT}
            aria-label="ถึงวันที่"
          />
        </span>
      )}

      <span className="hidden text-sm text-slate-400 md:inline">{period.label}</span>
    </>
  );
}

/** dropdown ตัวเลือกแบบมาตรฐาน (สาขา บริษัท ประเภท ฯลฯ) */
export function WallSelect({
  value,
  onChange,
  options,
  allLabel,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  options: Option[];
  allLabel: string;
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT}
      aria-label={label}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
