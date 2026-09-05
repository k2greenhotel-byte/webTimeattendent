"use client";

import { useActionState } from "react";
import { approverLoginAction, type ApproverGateState } from "@/app/procurement/approvals/actions";

const initial: ApproverGateState = { error: null };

/**
 * ยืนยันตัวตนซ้ำก่อนเข้าหน้าจออนุมัติ (ข้อ 3.1)
 * ใช้รหัสผ่านของบัญชีที่ล็อกอินอยู่เอง ไม่ใช่ PIN กลางแบบหน้าหลังบ้าน
 */
export default function ApproverGate({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState(approverLoginAction, initial);

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-4">
      <form action={action} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-2xl text-white">
            🔒
          </div>
          <h1 className="text-lg font-bold text-slate-800">ยืนยันตัวตนผู้อนุมัติ</h1>
          <p className="mt-1 text-sm text-slate-500">
            {fullName} · กรอกรหัสผ่านของคุณอีกครั้งเพื่อเข้าหน้าจออนุมัติ
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
          {pending ? "กำลังตรวจสอบ…" : "เข้าหน้าจออนุมัติ"}
        </button>

        <p className="text-center text-xs text-slate-400">
          ผ่านครั้งเดียวใช้ได้ 30 นาที เพื่อกันคนอื่นมากดอนุมัติแทนบนเครื่องที่เปิดค้างไว้
        </p>
      </form>
    </main>
  );
}
