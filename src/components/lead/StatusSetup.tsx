import Link from "next/link";
import {
  BADGE_CLASS,
  COLOR_LABEL,
  COLOR_ORDER,
  DOT_CLASS,
  STATUS_KIND_HINT,
  STATUS_KIND_LABEL,
  STATUS_KIND_ORDER,
  colorOf,
  type ChanceOption,
  type WorkStatusOption,
} from "@/lib/lead-types";

/** แถวเดียวที่ตารางตั้งค่าต้องใช้ — สถานะงานมี kind เพิ่มมา ส่วนสถานะโอกาสไม่มี */
export type SetupRow = (WorkStatusOption | ChanceOption) & { kind?: string; usage: number };

/**
 * หน้าตั้งค่าสถานะ (หน้าจอ 5) — ใช้ได้ทั้งสถานะงานและสถานะโอกาส
 *
 * ทั้งหมดทำงานด้วยฟอร์มธรรมดา (ไม่ใช้ JavaScript ฝั่งเบราว์เซอร์)
 * กด "แก้ไข" = เปิดหน้าเดิมพร้อม ?edit=<รหัส> แล้วแถวนั้นกลายเป็นฟอร์ม
 *
 * กติกาที่บังคับไว้:
 *   * รหัส (code) ตั้งได้ครั้งเดียวตอนเพิ่ม เพราะเป็นค่าที่บันทึกอยู่บนใบงานเดิมทั้งหมด
 *   * สถานะของระบบลบไม่ได้ (ปิดใช้งานแทนได้) และสถานะที่มีใบงานใช้อยู่ก็ลบไม่ได้
 */
export default function StatusSetup({
  title,
  hint,
  rows,
  editCode,
  basePath,
  formKey,
  showKind,
  canWrite,
  canEdit,
  canDelete,
  saveAction,
  deleteAction,
}: {
  title: string;
  hint: string;
  rows: SetupRow[];
  editCode: string | null;
  basePath: string;
  /** ค่า hidden ที่บอก action ว่ากำลังแก้ชุดไหน: "status" หรือ "chance" */
  formKey: "status" | "chance";
  showKind: boolean;
  canWrite: boolean;
  canEdit: boolean;
  canDelete: boolean;
  saveAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  // รหัสสถานะงานกับสถานะโอกาสอาจซ้ำกันได้ จึงใส่ชื่อชุดนำหน้าใน URL ด้วย
  const editing = rows.find((r) => `${formKey}:${r.code}` === editCode) ?? null;

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <p className="text-[11px] text-slate-400">{hint}</p>
      </div>

      {/* ---------- รายการปัจจุบัน ---------- */}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.code}
            className={`rounded-xl border p-3 ${row.is_active ? "border-slate-200" : "border-dashed border-slate-300 bg-slate-50"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${BADGE_CLASS[colorOf(row.color)]}`}>
                <span
                  className={`mr-1 inline-block h-2 w-2 rounded-full ${DOT_CLASS[colorOf(row.color)]}`}
                />
                {row.name}
              </span>

              {showKind && row.kind && (
                <span className="text-xs text-slate-500">
                  {STATUS_KIND_LABEL[row.kind as keyof typeof STATUS_KIND_LABEL] ?? row.kind}
                </span>
              )}

              {!row.is_active && <span className="badge bg-slate-200 text-slate-600">ปิดใช้งาน</span>}
              {row.is_system && (
                <span className="text-[11px] text-slate-400" title="สถานะตั้งต้นของระบบ ลบไม่ได้">
                  ระบบ
                </span>
              )}

              <span className="ml-auto text-[11px] text-slate-400">
                ลำดับ {row.sort_order} · รหัส {row.code} · ใช้อยู่ {row.usage} ใบ
              </span>
            </div>

            {editing?.code === row.code ? (
              <StatusForm
                row={row}
                basePath={basePath}
                formKey={formKey}
                showKind={showKind}
                action={saveAction}
              />
            ) : (
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {canEdit && (
                  <Link
                    href={`${basePath}?edit=${encodeURIComponent(`${formKey}:${row.code}`)}#${formKey}`}
                    className="text-brand-600 hover:underline"
                  >
                    แก้ไข
                  </Link>
                )}
                {canDelete && !row.is_system && row.usage === 0 && (
                  <form action={deleteAction}>
                    <input type="hidden" name="target" value={formKey} />
                    <input type="hidden" name="code" value={row.code} />
                    <button type="submit" className="text-rose-600 hover:underline">
                      ลบ
                    </button>
                  </form>
                )}
                {canDelete && !row.is_system && row.usage > 0 && (
                  <span className="text-slate-400">
                    ลบไม่ได้ — มีใบงานใช้อยู่ {row.usage} ใบ (ปิดใช้งานแทนได้)
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* ---------- เพิ่มใหม่ ---------- */}
      {canWrite && !editing && (
        <details className="rounded-xl border border-dashed border-slate-300 p-3" id={formKey}>
          <summary className="cursor-pointer text-sm font-medium text-brand-600">
            + เพิ่ม{title}ใหม่
          </summary>
          <StatusForm
            row={null}
            basePath={basePath}
            formKey={formKey}
            showKind={showKind}
            action={saveAction}
          />
        </details>
      )}
    </section>
  );
}

/** ฟอร์มเพิ่ม/แก้ไขหนึ่งสถานะ (row = null คือเพิ่มใหม่) */
function StatusForm({
  row,
  basePath,
  formKey,
  showKind,
  action,
}: {
  row: SetupRow | null;
  basePath: string;
  formKey: "status" | "chance";
  showKind: boolean;
  action: (formData: FormData) => Promise<void>;
}) {
  const nextOrder = row ? row.sort_order : 100;

  return (
    <form action={action} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      <input type="hidden" name="target" value={formKey} />
      {row && <input type="hidden" name="code" value={row.code} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!row && (
          <div>
            <label className="label" htmlFor={`${formKey}_code`}>
              รหัส *
            </label>
            <input
              id={`${formKey}_code`}
              name="code"
              className="input"
              placeholder="wait_finance"
              required
            />
            <p className="mt-1 text-xs text-slate-400">
              อังกฤษพิมพ์เล็ก/ตัวเลข/ขีดล่าง · ตั้งแล้วแก้ไม่ได้
            </p>
          </div>
        )}

        <div>
          <label className="label" htmlFor={`${formKey}_name_${row?.code ?? "new"}`}>
            ชื่อที่แสดง *
          </label>
          <input
            id={`${formKey}_name_${row?.code ?? "new"}`}
            name="name"
            defaultValue={row?.name ?? ""}
            className="input"
            placeholder="เช่น รอผลไฟแนนซ์"
            required
          />
        </div>

        {showKind && (
          <div>
            <label className="label" htmlFor={`${formKey}_kind_${row?.code ?? "new"}`}>
              พฤติกรรมของสถานะ *
            </label>
            <select
              id={`${formKey}_kind_${row?.code ?? "new"}`}
              name="kind"
              defaultValue={row?.kind ?? "open"}
              className="input"
              disabled={row?.is_system}
            >
              {STATUS_KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {STATUS_KIND_LABEL[k]}
                </option>
              ))}
            </select>
            {row?.is_system && (
              <input type="hidden" name="kind" value={row.kind ?? "open"} />
            )}
            <p className="mt-1 text-xs text-slate-400">
              {STATUS_KIND_HINT[(row?.kind as keyof typeof STATUS_KIND_HINT) ?? "open"]}
            </p>
          </div>
        )}

        <div>
          <label className="label" htmlFor={`${formKey}_color_${row?.code ?? "new"}`}>
            สีป้าย
          </label>
          <select
            id={`${formKey}_color_${row?.code ?? "new"}`}
            name="color"
            defaultValue={row?.color ?? "slate"}
            className="input"
          >
            {COLOR_ORDER.map((c) => (
              <option key={c} value={c}>
                {COLOR_LABEL[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor={`${formKey}_sort_${row?.code ?? "new"}`}>
            ลำดับการแสดง
          </label>
          <input
            id={`${formKey}_sort_${row?.code ?? "new"}`}
            name="sort_order"
            type="number"
            min={0}
            max={999}
            defaultValue={nextOrder}
            className="input"
          />
          <p className="mt-1 text-xs text-slate-400">
            {formKey === "chance" ? "เลขน้อย = โอกาสสูงกว่า" : "เลขน้อย = แสดงก่อน"}
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={row ? row.is_active : true}
          className="h-4 w-4 rounded border-slate-300"
        />
        เปิดใช้งาน (ให้เลือกได้ในฟอร์มบันทึกงาน)
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          {row ? "บันทึกการแก้ไข" : "เพิ่มสถานะ"}
        </button>
        {row && (
          <Link href={basePath} className="btn-secondary w-full text-center sm:w-auto">
            ยกเลิก
          </Link>
        )}
      </div>
    </form>
  );
}
