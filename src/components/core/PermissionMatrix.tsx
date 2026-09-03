"use client";

import { useState } from "react";
import { MENU_KIND_LABEL, PERM_ACTION_LABEL, type MenuKind, type MenuRights, type PermAction } from "@/lib/core-types";

export type MatrixRow = {
  menu_id: string;
  menu_code: string;
  menu_name: string;
  menu_kind: MenuKind;
  program_code: string;
  program_name: string;
  /** สิทธิ์ที่ตั้งไว้เฉพาะคนนี้ (null = ใช้ค่าตามระดับ) */
  override: MenuRights | null;
  /** ค่าเริ่มต้นของระดับที่ผู้ใช้คนนี้อยู่ */
  levelDefault: MenuRights;
};

const ACTIONS: PermAction[] = ["read", "write", "edit", "delete"];
const FIELD: Record<PermAction, keyof MenuRights> = {
  read: "can_read",
  write: "can_write",
  edit: "can_edit",
  delete: "can_delete",
};

/**
 * ตารางสิทธิ์ อ่าน/เพิ่ม/แก้ไข/ลบ รายเมนู
 * ติ๊ก "ตามระดับ" = ไม่เก็บค่าเฉพาะราย ให้เดินตามค่าเริ่มต้นของระดับที่แก้ทีหลังได้
 */
export default function PermissionMatrix({
  rows,
  readOnlyNote,
}: {
  rows: MatrixRow[];
  readOnlyNote?: string;
}) {
  const [inherit, setInherit] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rows.map((r) => [r.menu_id, r.override === null])),
  );

  const groups = rows.reduce<Record<string, MatrixRow[]>>((acc, row) => {
    acc[row.program_name] = [...(acc[row.program_name] ?? []), row];
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {readOnlyNote && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{readOnlyNote}</p>
      )}

      {Object.entries(groups).map(([programName, menus]) => (
        <div key={programName} className="overflow-x-auto">
          <table className="table-report">
            <thead>
              <tr>
                <th className="text-left">{programName}</th>
                <th>ประเภทหน้าจอ</th>
                <th>ตามระดับ</th>
                {ACTIONS.map((a) => (
                  <th key={a}>{PERM_ACTION_LABEL[a]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {menus.map((row) => {
                const useLevel = inherit[row.menu_id] ?? true;
                const shown = useLevel ? row.levelDefault : (row.override ?? row.levelDefault);

                return (
                  <tr key={row.menu_id} className={useLevel ? "bg-slate-50/60" : ""}>
                    <td className="text-left">
                      <input type="hidden" name="menu_ids" value={row.menu_id} />
                      {row.menu_name}
                      <span className="ml-2 text-xs text-slate-400">{row.menu_code}</span>
                    </td>
                    <td className="text-xs text-slate-500">{MENU_KIND_LABEL[row.menu_kind]}</td>
                    <td>
                      <input
                        type="checkbox"
                        name="inherit"
                        value={row.menu_id}
                        checked={useLevel}
                        onChange={(e) =>
                          setInherit((prev) => ({ ...prev, [row.menu_id]: e.target.checked }))
                        }
                      />
                    </td>
                    {ACTIONS.map((a) => (
                      <td key={a}>
                        <input
                          type="checkbox"
                          name={`${a}__${row.menu_id}`}
                          defaultChecked={shown[FIELD[a]]}
                          key={`${row.menu_id}-${a}-${useLevel}`}
                          disabled={useLevel}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
