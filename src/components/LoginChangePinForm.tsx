"use client";

import { useActionState } from "react";
import { changePinAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null };
const PIN_MIN = 4;
const PIN_MAX = 8;

/** เปลี่ยนรหัสผ่าน/PIN ของตัวเองจากหน้าล็อกอิน (ยืนยันด้วยเบอร์มือถือ + รหัสเดิม) */
export default function LoginChangePinForm() {
  const [state, formAction, pending] = useActionState(changePinAction, initialState);

  const pinProps = {
    type: "password" as const,
    inputMode: "numeric" as const,
    pattern: `\\d{${PIN_MIN},${PIN_MAX}}`,
    minLength: PIN_MIN,
    maxLength: PIN_MAX,
    className: "input text-center text-lg tracking-widest",
    required: true,
  };

  return (
    <form action={formAction} className="card space-y-4">
      <div>
        <label className="label" htmlFor="phone">
          เบอร์มือถือ
        </label>
        <input
          id="phone"
          name="phone"
          className="input text-center text-lg tracking-widest"
          autoComplete="tel"
          inputMode="numeric"
          placeholder="08x-xxx-xxxx"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="current_pin">
          รหัสผ่านเดิม
        </label>
        <input id="current_pin" name="current_pin" autoComplete="current-password" {...pinProps} />
      </div>

      <div>
        <label className="label" htmlFor="new_pin">
          รหัสผ่านใหม่ ({PIN_MIN}-{PIN_MAX} หลัก)
        </label>
        <input id="new_pin" name="new_pin" autoComplete="new-password" {...pinProps} />
      </div>

      <div>
        <label className="label" htmlFor="confirm_pin">
          ยืนยันรหัสผ่านใหม่
        </label>
        <input id="confirm_pin" name="confirm_pin" autoComplete="new-password" {...pinProps} />
      </div>

      {state.error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <button type="submit" className="btn-primary w-full py-3 text-base" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
      </button>

      <p className="text-center text-xs text-slate-500">
        ใช้ตัวเลข {PIN_MIN}-{PIN_MAX} หลัก · ลืมรหัสเดิมให้ติดต่อผู้ดูแลระบบเพื่อรีเซ็ตให้
      </p>
    </form>
  );
}
