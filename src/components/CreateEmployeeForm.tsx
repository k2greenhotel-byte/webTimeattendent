"use client";

import { useActionState } from "react";
import { createEmployeeAction, type ActionState } from "@/app/admin/employees/actions";
import type { Branch, Department, Position } from "@/lib/types";

const initial: ActionState = { error: null, success: null };

export default function CreateEmployeeForm({
  branches,
  departments,
  positions,
}: {
  branches: Branch[];
  departments: Department[];
  positions: Position[];
}) {
  const [state, action, pending] = useActionState(createEmployeeAction, initial);

  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold text-slate-800">เพิ่มพนักงานใหม่</h2>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="new_emp_code">
            รหัสพนักงาน *
          </label>
          <input id="new_emp_code" name="emp_code" className="input" placeholder="EMP003" required />
        </div>
        <div>
          <label className="label" htmlFor="new_full_name">
            ชื่อ-สกุล *
          </label>
          <input id="new_full_name" name="full_name" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="new_nickname">
            ชื่อเล่น
          </label>
          <input id="new_nickname" name="nickname" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="new_branch">
            สาขา
          </label>
          <select id="new_branch" name="branch_id" className="input" defaultValue="">
            <option value="">— ไม่ระบุ —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="new_phone">
            เบอร์มือถือ * (ใช้เข้าระบบ)
          </label>
          <input
            id="new_phone"
            name="phone"
            className="input"
            inputMode="numeric"
            placeholder="08xxxxxxxx"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="new_department">
            แผนก
          </label>
          <select id="new_department" name="department_id" className="input" defaultValue="">
            <option value="">— ไม่ระบุ —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="new_position">
            ตำแหน่ง
          </label>
          <select id="new_position" name="position_id" className="input" defaultValue="">
            <option value="">— ไม่ระบุ —</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="new_hire_date">
            วันที่เริ่มงาน
          </label>
          <input id="new_hire_date" name="hire_date" type="date" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="new_pin">
            รหัสผ่านเริ่มต้น * (4-8 หลัก)
          </label>
          <input
            id="new_pin"
            name="pin"
            className="input"
            inputMode="numeric"
            pattern="\d{4,8}"
            maxLength={8}
            placeholder="1234"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="new_role">
            สิทธิ์
          </label>
          <select id="new_role" name="role" className="input" defaultValue="employee">
            <option value="employee">พนักงาน</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </select>
        </div>
      </div>

      {state.error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</p>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "เพิ่มพนักงาน"}
      </button>
    </form>
  );
}
