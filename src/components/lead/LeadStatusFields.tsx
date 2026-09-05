"use client";

import { useState } from "react";
import {
  CHANCE_CLASS,
  CHANCE_LABEL,
  CHANCE_ORDER,
  WORK_STATUS_LABEL,
  WORK_STATUS_ORDER,
  type Chance,
  type WorkStatus,
} from "@/lib/lead-types";

/**
 * ช่องสถานะของใบ Lead / ใบติดตาม (ข้อ 1.10-1.11 และ 2.5-2.7)
 *
 * เลือก "ปิดการขายแล้ว" จะมีช่องเลขที่สัญญาขายและวันที่ขายโผล่ขึ้นมาให้กรอก (บังคับ)
 * เลือกสถานะที่จบแล้ว วันนัดติดตามต่อจะถูกซ่อน เพราะไม่ต้องตามอีก
 *
 * ใช้ในใบติดตามด้วย โดยส่ง allowKeep=true เพื่อให้มีตัวเลือก "ไม่เปลี่ยน"
 */
export default function LeadStatusFields({
  defaultWorkStatus,
  defaultChance,
  defaultNextFollowDate,
  defaultSaleContractNo,
  defaultSaleDate,
  allowKeep = false,
  minDate,
}: {
  defaultWorkStatus?: WorkStatus | "";
  defaultChance?: Chance | "";
  defaultNextFollowDate?: string | null;
  defaultSaleContractNo?: string | null;
  defaultSaleDate?: string | null;
  /** ใบติดตาม: ไม่เลือก = คงสถานะเดิมไว้ */
  allowKeep?: boolean;
  /** วันแรกที่เลือกเป็นวันนัดติดตามได้ (วันที่ของเอกสาร) */
  minDate?: string;
}) {
  const [status, setStatus] = useState<WorkStatus | "">(defaultWorkStatus ?? (allowKeep ? "" : "follow_up"));
  const [chance, setChance] = useState<Chance | "">(defaultChance ?? (allowKeep ? "" : "medium"));

  const closing = status === "closed_won";
  const stillFollowing = status === "follow_up" || (allowKeep && status === "");

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
            onChange={(e) => setStatus(e.target.value as WorkStatus | "")}
            className="input"
          >
            {allowKeep && <option value="">— ไม่เปลี่ยนสถานะงาน —</option>}
            {WORK_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {WORK_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="chance">
            สถานะโอกาสการขาย{allowKeep ? " (ไม่เลือก = คงเดิม)" : " *"}
          </label>
          <select
            id="chance"
            name="chance"
            value={chance}
            onChange={(e) => setChance(e.target.value as Chance | "")}
            className="input"
          >
            {allowKeep && <option value="">— ไม่เปลี่ยนโอกาส —</option>}
            {CHANCE_ORDER.map((c) => (
              <option key={c} value={c}>
                {CHANCE_LABEL[c]}
              </option>
            ))}
          </select>
          {chance && (
            <p className="mt-1">
              <span className={`badge ${CHANCE_CLASS[chance]}`}>
                โอกาส{CHANCE_LABEL[chance]}
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
            ปิดการขายต้องมีเลขที่สัญญาขายและวันที่ขาย — บันทึกแล้วใบนี้จะออกจากรายการที่ต้องติดตาม
          </p>
        </div>
      )}
    </div>
  );
}
