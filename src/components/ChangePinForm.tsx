"use client";

import { useActionState } from "react";
import { changePinAction, type ChangePinState } from "@/app/me/actions";

const initial: ChangePinState = { error: null, success: null };

/** ฟอร์มให้พนักงานตั้งรหัสผ่านใหม่ด้วยตัวเอง */
export default function ChangePinForm() {
  const [state, action, pending] = useActionState(changePinAction, initial);

  const pinProps = {
    type: "password" as const,
    inputMode: "numeric" as const,
    pattern: "\\d{4,8}",
    minLength: 4,
    maxLength: 8,
    className: "input text-center text-lg tracking-widest",
    required: true,
    autoComplete: "off",
  };

  return (
    <form action={action} className="card space-y-3">
      <div>
        <h2 className="font-semibold text-slate-800">ตั้งรหัสผ่านใหม่</h2>
        <p className="text-xs text-slate-500">ตัวเลข 4-8 หลัก · ใช้คู่กับเบอร์มือถือของคุณตอนเข้าระบบ</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="current_pin">
            รหัสผ่านเดิม
          </label>
          <input id="current_pin" name="current_pin" {...pinProps} />
        </div>
        <div>
          <label className="label" htmlFor="new_pin">
            รหัสผ่านใหม่
          </label>
          <input id="new_pin" name="new_pin" {...pinProps} />
        </div>
        <div>
          <label className="label" htmlFor="confirm_pin">
            ยืนยันรหัสผ่านใหม่
          </label>
          <input id="confirm_pin" name="confirm_pin" {...pinProps} />
        </div>
      </div>

      {state.error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</p>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
      </button>
    </form>
  );
}
