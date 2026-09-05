"use client";

import { useState } from "react";
import { resolveAuthority, withinLimit } from "@/lib/approval";
import type { ApvLimit, ApvType } from "@/lib/approval-types";
import type { AccessLevel } from "@/lib/core-types";
import { ACCESS_LEVEL_LABEL } from "@/lib/core-types";

type TestUser = { id: string; full_name: string; level: AccessLevel };

/**
 * กล่องทดสอบกฎ — เลือกคน + ประเภทเรื่อง + ใส่จำนวนเงิน แล้วบอกทันทีว่าอนุมัติได้ไหม
 * ใช้ฟังก์ชันตัวเดียวกับตอนอนุมัติจริง ผลจึงตรงกันเสมอ
 */
export default function AuthorityTester({
  limits,
  users,
  types,
  companyId,
}: {
  limits: ApvLimit[];
  users: TestUser[];
  types: ApvType[];
  companyId: string | null;
}) {
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [amount, setAmount] = useState("10000");

  const user = users.find((u) => u.id === userId) ?? null;
  const type = types.find((t) => t.id === typeId) ?? null;
  const value = Number(amount.replace(/[^\d.]/g, "")) || 0;

  const authority = user
    ? resolveAuthority(limits, { userId: user.id, level: user.level, typeId, companyId })
    : null;
  const ok = authority ? withinLimit(authority, value, type?.has_amount ?? true) : false;
  const hasAny = authority
    ? authority.isFinal || authority.maxAmount === null || authority.maxAmount > 0
    : false;

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-semibold text-slate-800">ทดสอบกฎ</h2>
        <p className="text-sm text-slate-500">
          ลองดูว่าคนนี้อนุมัติเรื่องนี้ได้ไหม ก่อนใช้งานจริง — คำนวณด้วยกฎชุดเดียวกับหน้าอนุมัติ
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">ผู้ใช้งาน</label>
          <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({ACCESS_LEVEL_LABEL[u.level]})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ประเภทเรื่อง</label>
          <select className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">จำนวนเงิน (บาท)</label>
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={type ? !type.has_amount : false}
          />
        </div>
      </div>

      {authority && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            !hasAny
              ? "bg-slate-100 text-slate-600"
              : ok
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-800"
          }`}
        >
          <p className="font-medium">
            {!hasAny
              ? "❌ ไม่มีอำนาจอนุมัติ — ยื่นเรื่องได้อย่างเดียว"
              : ok
                ? "✅ อนุมัติได้เลย"
                : "⚠️ เกินอำนาจ — ทำได้แค่เสนอขึ้นผู้มีอำนาจสูงกว่า"}
          </p>
          <p className="mt-1 text-xs">
            อำนาจที่ได้:{" "}
            {authority.maxAmount === null
              ? "ไม่จำกัดวงเงิน"
              : `${authority.maxAmount.toLocaleString("th-TH")} บาท`}
            {authority.isFinal ? " · ตัดสินขั้นสุดท้ายได้" : ""}
            {authority.canReject ? "" : " · ปฏิเสธไม่ได้"}
          </p>
          <p className="mt-1 text-xs">ที่มา: {authority.reason}</p>
        </div>
      )}
    </div>
  );
}
