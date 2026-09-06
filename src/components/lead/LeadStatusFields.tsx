"use client";

import { useMemo, useState } from "react";
import { BADGE_CLASS, colorOf, type ChanceOption, type WorkStatusOption } from "@/lib/lead-types";

/**
 * ช่องสถานะของใบ Lead / ใบติดตาม (ข้อ 1.10-1.11 และ 2.5-2.7)
 *
 * ตัวเลือกทั้งหมดมาจากตารางสถานะที่ตั้งค่าได้เอง — เพิ่มสถานะใหม่ที่ /leads/setup แล้วโผล่ที่นี่ทันที
 * เลือกสถานะที่ "ปิดการขายได้" (kind = won) จะมีช่องเลขที่สัญญาขาย/วันที่ขายขึ้นมาให้กรอก (บังคับ)
 * เลือกสถานะที่จบแล้ว วันนัดติดตามต่อจะถูกซ่อน เพราะไม่ต้องตามอีก
 *
 * ใช้ในใบติดตามด้วย โดยส่ง allowKeep=true เพื่อให้มีตัวเลือก "ไม่เปลี่ยน"
 */
export default function LeadStatusFields({
  statuses,
  chances,
  defaultWorkStatus,
  defaultChance,
  defaultNextFollowDate,
  defaultSaleContractNo,
  defaultSaleDate,
  allowKeep = false,
  minDate,
}: {
  statuses: WorkStatusOption[];
  chances: ChanceOption[];
  defaultWorkStatus?: string;
  defaultChance?: string;
  defaultNextFollowDate?: string | null;
  defaultSaleContractNo?: string | null;
  defaultSaleDate?: string | null;
  /** ใบติดตาม: ไม่เลือก = คงสถานะเดิมไว้ */
  allowKeep?: boolean;
  /** วันแรกที่เลือกเป็นวันนัดติดตามได้ (วันที่ของเอกสาร) */
  minDate?: string;
}) {
  const [status, setStatus] = useState(defaultWorkStatus ?? "");
  const [chance, setChance] = useState(defaultChance ?? "");

  const picked = useMemo(() => statuses.find((s) => s.code === status) ?? null, [status, statuses]);
  const pickedChance = useMemo(
    () => chances.find((c) => c.code === chance) ?? null,
    [chance, chances],
  );

  const closing = picked?.kind === "won";
  // ไม่เลือก (ใบติดตาม) = คงสถานะเดิม ซึ่งอาจยังต้องตามต่อ จึงยังให้ตั้งวันนัดได้
  const stillFollowing = picked ? picked.kind === "open" : allowKeep;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="work_status">
            สถานะงาน{allowKeep ? " (ไม่เลือก = คงสถานะเดิม)" : " *"}
          </label>
          <select
            id="work_status"
            name="work_status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input"
          >
            {allowKeep && <option value="">— ไม่เปลี่ยนสถานะงาน —</option>}
            {!allowKeep && !status && <option value="">— เลือกสถานะงาน —</option>}
            {statuses.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
                {s.is_active ? "" : " (ปิดใช้งานแล้ว)"}
              </option>
            ))}
          </select>
          {picked && (
            <p className="mt-1">
              <span className={`badge ${BADGE_CLASS[colorOf(picked.color)]}`}>{picked.name}</span>
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="chance">
            สถานะโอกาสการขาย{allowKeep ? " (ไม่เลือก = คงเดิม)" : " *"}
          </label>
          <select
            id="chance"
            name="chance"
            value={chance}
            onChange={(e) => setChance(e.target.value)}
            className="input"
          >
            {allowKeep && <option value="">— ไม่เปลี่ยนโอกาส —</option>}
            {!allowKeep && !chance && <option value="">— เลือกโอกาส —</option>}
            {chances.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
                {c.is_active ? "" : " (ปิดใช้งานแล้ว)"}
              </option>
            ))}
          </select>
          {pickedChance && (
            <p className="mt-1">
              <span className={`badge ${BADGE_CLASS[colorOf(pickedChance.color)]}`}>
                โอกาส{pickedChance.name}
              </span>
            </p>
          )}
        </div>
      </div>

      {stillFollowing && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="next_follow_date">
              วันที่คาดจะติดตามต่อ
            </label>
            <input
              id="next_follow_date"
              name="next_follow_date"
              type="date"
              min={minDate}
              defaultValue={defaultNextFollowDate ?? ""}
              className="input"
            />
            <p className="mt-1 text-xs text-slate-400">
              ใส่ไว้เพื่อให้ระบบเตือนในกระดานติดตาม — เลยวันแล้วจะขึ้นสีแดง
            </p>
          </div>
        </div>
      )}

      {closing && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sale_contract_no">
              เลขที่สัญญาขาย *
            </label>
            <input
              id="sale_contract_no"
              name="sale_contract_no"
              defaultValue={defaultSaleContractNo ?? ""}
              className="input"
              placeholder="เช่น S-2569-0001"
            />
          </div>
          <div>
            <label className="label" htmlFor="sale_date">
              วันที่ขาย *
            </label>
            <input
              id="sale_date"
              name="sale_date"
              type="date"
              defaultValue={defaultSaleDate ?? ""}
              className="input"
            />
          </div>
          <p className="text-xs text-emerald-700 sm:col-span-2">
            สถานะ “{picked?.name}” ถือว่าปิดการขายได้ จึงต้องมีเลขที่สัญญาขายและวันที่ขาย —
            บันทึกแล้วใบนี้จะออกจากรายการที่ต้องติดตาม
          </p>
        </div>
      )}
    </div>
  );
}
