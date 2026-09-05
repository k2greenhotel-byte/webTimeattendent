"use client";

import { useActionState } from "react";
import { apvApproverLoginAction, type ApproverGateState } from "@/app/approvals/actions";

const initial: ApproverGateState = { error: null };

/** ยืนยันรหัสผ่านของผู้อนุมัติเองซ้ำ ก่อนเข้ากล่องรออนุมัติ */
export default function ApvApproverGate({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState(apvApproverLoginAction, initial);

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-4">
      <form action={action} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-2xl text-white">
            🔒
          </div>
          <h1 className="text-lg font-bold text-slate-800">ยืนยันตัวตนผู้อนุมัติ</h1>
          <p className="mt-1 text-sm text-slate-500">
            {fullName} · กรอกรหัสผ่านของคุณอีกครั้งเพื่อเข้ากล่องรออนุมัติ
          </p>
        </div>

        <div>
          <label className="label" htmlFor="pin">
            รหัสผ่าน
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            className="input text-center text-lg tracking-widest"
            autoFocus
            required
          />
        </div>

        {state.error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
            {state.error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full py-3 text-base" disabled={pending}>
          {pending ? "กำลังตรวจสอบ…" : "เข้ากล่องรออนุมัติ"}
        </button>

        <p className="text-center text-xs text-slate-400">
          ผ่านครั้งเดียวใช้ได้ 30 นาที เพื่อกันคนอื่นมากดอนุมัติแทนบนเครื่องที่เปิดค้างไว้
        </p>
      </form>
    </main>
  );
}
