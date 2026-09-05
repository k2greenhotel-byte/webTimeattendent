"use client";

import { useActionState } from "react";
import { hrApproverLoginAction, type HrGateState } from "@/app/hr/actions";

const initial: HrGateState = { error: null };

/**
 * ยืนยันรหัสผ่านของผู้อนุมัติเองซ้ำ ก่อนเข้าหน้าจออนุมัติ
 * ใช้ cookie ตัวเดียวกับกล่องรออนุมัติกลาง — ถ้ายืนยันจากหน้ากลางมาแล้ว หน้านี้จะไม่ถามซ้ำ
 */
export default function HrApproverGate({
  fullName,
  kind,
  title,
}: {
  fullName: string;
  kind: "leave" | "advance";
  title: string;
}) {
  const [state, action, pending] = useActionState(hrApproverLoginAction, initial);

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-4">
      <form action={action} className="card w-full max-w-sm space-y-4">
        <input type="hidden" name="kind" value={kind} />

        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-2xl text-white">
            🔒
          </div>
          <h1 className="text-lg font-bold text-slate-800">ยืนยันตัวตนผู้อนุมัติ</h1>
          <p className="mt-1 text-sm text-slate-500">
            {fullName} · กรอกรหัสผ่านของคุณอีกครั้งเพื่อเข้าหน้า{title}
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
          {pending ? "กำลังตรวจสอบ…" : `เข้าหน้า${title}`}
        </button>

        <p className="text-center text-xs text-slate-400">
          ผ่านครั้งเดียวใช้ได้ 30 นาที และใช้ร่วมกับกล่องรออนุมัติกลาง —
          ถ้ายืนยันรหัสจากหน้าอนุมัติรวมมาแล้วจะไม่ถามซ้ำ
        </p>
      </form>
    </main>
  );
}
