"use client";

import { useMemo, useState } from "react";
import { ACCESS_LEVEL_LABEL, type AccessLevel } from "@/lib/core-types";

export type PickerUser = {
  id: string;
  username: string | null;
  emp_code: string;
  full_name: string;
  access_level: AccessLevel;
  branch_name: string | null;
  is_active: boolean;
};

/**
 * เลือกว่าใครใช้โปรแกรมนี้ได้บ้าง
 *
 * ทุกคนถูก render ไว้ในฟอร์มเสมอ ช่องค้นหาแค่ "ซ่อน" แถวที่ไม่ตรง (ไม่ได้ถอดออกจากฟอร์ม)
 * เพื่อไม่ให้การค้นหาทำให้คนที่ไม่ได้แสดงถูกถอดสิทธิ์ตอนกดบันทึก
 */
export default function ProgramUserPicker({
  users,
  defaultSelected,
  programName,
}: {
  users: PickerUser[];
  defaultSelected: string[];
  programName: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelected));
  const [keyword, setKeyword] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const ids = new Set<string>();
    for (const u of users) {
      if (onlyActive && !u.is_active) continue;
      const hay = [u.username, u.emp_code, u.full_name, u.branch_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!q || hay.includes(q)) ids.add(u.id);
    }
    return ids;
  }, [users, keyword, onlyActive]);

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  /** เลือก/ล้าง เฉพาะคนที่มองเห็นอยู่ตอนนี้ (ตามคำค้นหา) */
  const setVisible = (on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of visible) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const shownCount = visible.size;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="input w-64"
          placeholder="ค้นหา User ID / ชื่อ / รหัสพนักงาน / สาขา"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
          />
          แสดงเฉพาะบัญชีที่ใช้งานได้
        </label>

        <button type="button" onClick={() => setVisible(true)} className="btn-secondary py-1.5 text-sm">
          เลือกทั้งหมด{keyword || !onlyActive ? ` (${shownCount} คนที่แสดงอยู่)` : ""}
        </button>
        <button type="button" onClick={() => setVisible(false)} className="btn-secondary py-1.5 text-sm">
          ล้างที่แสดงอยู่
        </button>

        <p className="ml-auto text-sm font-medium text-slate-700">
          เลือกแล้ว {selected.size} / {users.length} คน
        </p>
      </div>

      <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-slate-200">
        <table className="table-report">
          <thead className="sticky top-0 z-10">
            <tr>
              <th>ใช้งานได้</th>
              <th>User ID</th>
              <th>รหัสพนักงาน</th>
              <th className="text-left">ชื่อผู้ใช้งาน</th>
              <th>ระดับ</th>
              <th>สาขา</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const on = selected.has(u.id);
              return (
                <tr key={u.id} hidden={!visible.has(u.id)} className={on ? "bg-brand-50/60" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      name="user_ids"
                      value={u.id}
                      checked={on}
                      onChange={(e) => toggle(u.id, e.target.checked)}
                      aria-label={`ให้ ${u.full_name} ใช้ ${programName}`}
                    />
                  </td>
                  <td>{u.username ?? "-"}</td>
                  <td>{u.emp_code}</td>
                  <td className="text-left">{u.full_name}</td>
                  <td className="text-xs text-slate-500">{ACCESS_LEVEL_LABEL[u.access_level]}</td>
                  <td className="text-xs text-slate-500">{u.branch_name ?? "-"}</td>
                  <td>
                    <span
                      className={`badge ${
                        u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {u.is_active ? "ใช้งานได้" : "ยกเลิก"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {shownCount === 0 && (
          <p className="p-4 text-sm text-slate-500">ไม่พบผู้ใช้งานที่ตรงกับคำค้น</p>
        )}
      </div>

      <p className="text-xs text-slate-500">
        การค้นหาแค่ซ่อนแถวที่ไม่ตรงเท่านั้น คนที่ติ๊กไว้แล้วแต่ถูกซ่อนอยู่จะยังถูกบันทึกตามเดิม
      </p>
    </div>
  );
}
