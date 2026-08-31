"use client";

import { useActionState, useState } from "react";
import { adminLoginAction, type AdminGateState } from "@/app/admin/actions";

const initial: AdminGateState = { error: null };

/** หน้าจอกรอก PIN 6 หลัก ก่อนเข้าระบบหลังบ้าน */
export default function AdminPinGate() {
  const [state, action, pending] = useActionState(adminLoginAction, initial);
  const [pin, setPin] = useState("");

  const press = (digit: string) => {
    if (pin.length < 6) setPin(pin + digit);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <form action={action} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <input type="hidden" name="pin" value={pin} />

        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-2xl text-white">
            🔒
          </div>
          <h1 className="text-lg font-bold text-slate-800">ระบบหลังบ้าน</h1>
          <p className="mt-1 text-sm text-slate-500">กรอก PIN ผู้ดูแลระบบ 6 หลัก</p>
        </div>

        <div className="mb-4 flex justify-center gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={`h-10 w-10 rounded-lg border text-center text-2xl leading-9 ${
                pin.length > i ? "border-slate-800 bg-slate-100" : "border-slate-300 bg-white"
              }`}
            >
              {pin.length > i ? "•" : ""}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => press(d)}
              className="rounded-xl border border-slate-300 bg-white py-3 text-xl font-semibold text-slate-700 active:bg-slate-100"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin("")}
            className="rounded-xl border border-slate-300 bg-white py-3 text-sm text-slate-500 active:bg-slate-100"
          >
            ล้าง
          </button>
          <button
            type="button"
            onClick={() => press("0")}
            className="rounded-xl border border-slate-300 bg-white py-3 text-xl font-semibold text-slate-700 active:bg-slate-100"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setPin(pin.slice(0, -1))}
            className="rounded-xl border border-slate-300 bg-white py-3 text-sm text-slate-500 active:bg-slate-100"
          >
            ลบ
          </button>
        </div>

        {state.error && (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          className="btn-primary mt-4 w-full py-3 text-base"
          disabled={pending || pin.length !== 6}
        >
          {pending ? "กำลังตรวจสอบ…" : "เข้าระบบหลังบ้าน"}
        </button>

        <p className="mt-4 text-center text-xs text-slate-400">
          หน้านี้เข้าถึงได้จาก /admin เท่านั้น
        </p>
      </form>
    </main>
  );
}
