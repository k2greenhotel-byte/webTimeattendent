"use client";

/** ชิ้นส่วนที่จอ War Room ทุกโปรแกรมใช้ร่วมกัน — ตัวเลขใหญ่ อ่านจากไกลได้ */

export const TONE = {
  slate: "text-slate-100",
  sky: "text-sky-300",
  amber: "text-amber-300",
  emerald: "text-emerald-300",
  rose: "text-rose-300",
  violet: "text-violet-300",
} as const;

export type Tone = keyof typeof TONE;

export const intTH = (n: number) => Math.round(n).toLocaleString("th-TH");

/** ย่อจำนวนเงินให้พอดีจอ เช่น 1.2 ล. / 250 พ. */
export function shortBaht(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("th-TH", { maximumFractionDigits: 1 })} ล.`;
  if (abs >= 10_000)
    return `${(value / 1_000).toLocaleString("th-TH", { maximumFractionDigits: 0 })} พ.`;
  return value.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

/** กล่องตัวเลขใหญ่ 1 ค่า */
export function StatTile({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
      <p className="truncate text-xs text-slate-400 sm:text-sm">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums sm:text-4xl ${TONE[tone]}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/** กรอบหัวข้อพร้อมจำนวนรายการ · `action` = ตัวกรองเล็ก ๆ ของแผงนั้นเอง วางชิดขวา */
export function Panel({
  title,
  count,
  hint,
  action,
  children,
}: {
  title: string;
  count?: number;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h2 className="font-semibold text-slate-200">{title}</h2>
        {count !== undefined && (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
            {intTH(count)}
          </span>
        )}
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
        {action && <span className="ml-auto shrink-0">{action}</span>}
      </div>
      {children}
    </section>
  );
}

/** รายการเทียบสัดส่วนแบบแท่ง — ใช้จัดอันดับสาขา/พนักงาน/บริษัท */
export function RankBars({
  rows,
  unit = "",
  tone = "sky",
  empty = "ไม่มีข้อมูล",
}: {
  rows: { label: string; value: number; sub?: string }[];
  unit?: string;
  tone?: Tone;
  empty?: string;
}) {
  if (rows.length === 0) return <p className="py-3 text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);

  const bar = {
    slate: "bg-slate-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    rose: "bg-rose-500",
    violet: "bg-violet-500",
  }[tone];

  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-slate-300">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-100">
              {intTH(r.value)}
              {unit && <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          {r.sub && <p className="mt-0.5 text-xs text-slate-500">{r.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

/** รายการที่ต้องตามตอนนี้ — ชื่อ + คำอธิบาย + ตัวเลขทางขวา */
export function AlertList({
  rows,
  empty = "ไม่มีรายการค้าง",
  tone = "amber",
}: {
  rows: { key: string; title: string; detail?: string; right?: string }[];
  empty?: string;
  tone?: Tone;
}) {
  if (rows.length === 0) return <p className="py-3 text-sm text-emerald-400">{empty}</p>;

  return (
    <ul className="divide-y divide-slate-800">
      {rows.map((r) => (
        <li key={r.key} className="flex items-start gap-2 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">{r.title}</p>
            {r.detail && <p className="truncate text-xs text-slate-400">{r.detail}</p>}
          </div>
          {r.right && (
            <span className={`shrink-0 text-sm font-semibold tabular-nums ${TONE[tone]}`}>
              {r.right}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
