"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null };
const PIN_MIN = 4;
const PIN_MAX = 8;

export default function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  const press = (digit: string) => {
    if (pin.length < PIN_MAX) setPin(pin + digit);
  };

  const digitsOnly = phone.replace(/\D/g, "");

  return (
    <form action={formAction} className="card space-y-4">
      <input type="hidden" name="pin" value={pin} />
      {next && <input type="hidden" name="next" value={next} />}

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
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>

      <div>
        <span className="label">รหัสผ่าน ({PIN_MIN}-{PIN_MAX} หลัก)</span>
        <div className="mb-3 flex min-h-11 flex-wrap justify-center gap-2">
          {(pin.length === 0 ? [0] : Array.from({ length: pin.length })).map((_, i) => (
            <span
              key={i}
              className={`h-11 w-9 rounded-xl border text-center text-2xl leading-10 ${
                pin.length > i ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white"
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
      </div>

      {state.error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <button
        type="submit"
        className="btn-primary w-full py-3 text-base"
        disabled={pending || pin.length < PIN_MIN || digitsOnly.length < 9}
      >
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>

      <p className="text-center text-xs text-slate-500">
        ใช้เบอร์มือถือที่แจ้งไว้กับผู้ดูแลระบบ · ลืมรหัสผ่านให้ติดต่อผู้ดูแลเพื่อรีเซ็ต
      </p>
    </form>
  );
}
