/**
 * กราฟสำหรับหน้า dashboard — วาดด้วย SVG ล้วน ไม่ต้องพึ่งไลบรารีภายนอก
 * (ทำงานได้บน Cloudflare Workers และไม่ต้องโหลด JS เพิ่มฝั่งผู้ใช้)
 *
 * สีประจำชุดข้อมูลตายตัวทั้งหน้า — ผ่านการตรวจ contrast และตาบอดสีแล้ว:
 *   ขอเบิก #2f7de1 · อนุมัติ #d97706 · ได้รับ #0d9488
 */

export const SERIES_COLORS = {
  request: "#2f7de1",
  approved: "#d97706",
  received: "#0d9488",
} as const;

const INK = "#334155";
const MUTED = "#94a3b8";
const GRID = "#e2e8f0";

/** ย่อจำนวนเงินให้อ่านง่ายบนแกน เช่น 1.2 ล. / 250 พ. */
export function compactBaht(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString("th-TH", { maximumFractionDigits: 1 })} ล.`;
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString("th-TH", { maximumFractionDigits: 0 })} พ.`;
  return value.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

/** ปัดเพดานแกนขึ้นเป็นเลขกลม 1 / 2 / 5 × 10^n */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const step = [1, 2, 2.5, 5, 10].find((s) => value <= s * base) ?? 10;
  return step * base;
}

/** สี่เหลี่ยมปลายมน 4px เฉพาะด้านยอด (ฐานยึดติดเส้นแกน) */
function barUp(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  if (h <= 0) return "";
  return `M${x},${y + h} V${y + r} q0,-${r} ${r},-${r} h${w - 2 * r} q${r},0 ${r},${r} V${y + h} Z`;
}

/** สี่เหลี่ยมปลายมน 4px เฉพาะด้านขวา (สำหรับกราฟแท่งแนวนอน) */
function barRight(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h / 2, w);
  if (w <= 0) return "";
  return `M${x},${y} h${w - r} q${r},0 ${r},${r} v${h - 2 * r} q0,${r} -${r},${r} h-${w - r} Z`;
}

export type Series = { key: string; label: string; color: string };

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-4">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** กราฟแท่งแนวตั้งแบบหลายชุด — ใช้กับยอดรายเดือน */
export function GroupedBarChart({
  groups,
  series,
  height = 260,
}: {
  groups: { label: string; values: Record<string, number> }[];
  series: Series[];
  height?: number;
}) {
  if (groups.length === 0) return <p className="py-6 text-sm text-slate-500">ยังไม่มีข้อมูล</p>;

  const width = Math.max(560, groups.length * 88);
  const pad = { top: 12, right: 12, bottom: 30, left: 58 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const max = niceMax(
    Math.max(...groups.flatMap((g) => series.map((s) => g.values[s.key] ?? 0)), 0),
  );
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  const groupW = plotW / groups.length;
  const barW = Math.max(6, (groupW - 14) / series.length - 2);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img">
        {ticks.map((t) => {
          const y = pad.top + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill={MUTED}>
                {compactBaht(t)}
              </text>
            </g>
          );
        })}

        {groups.map((g, gi) => {
          const gx = pad.left + gi * groupW;
          return (
            <g key={g.label}>
              {series.map((s, si) => {
                const value = g.values[s.key] ?? 0;
                const h = max > 0 ? (value / max) * plotH : 0;
                const x = gx + 7 + si * (barW + 2);
                const y = pad.top + plotH - h;
                return (
                  <path key={s.key} d={barUp(x, y, barW, h)} fill={s.color}>
                    <title>{`${g.label} · ${s.label}: ${value.toLocaleString("th-TH")} บาท`}</title>
                  </path>
                );
              })}
              <text
                x={gx + groupW / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize={11}
                fill={INK}
              >
                {g.label}
              </text>
            </g>
          );
        })}

        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + plotH}
          y2={pad.top + plotH}
          stroke={MUTED}
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

/** กราฟแท่งแนวนอน — ใช้กับยอดรายบริษัท / รายประเภทกิจกรรม (ชื่อไทยยาว อ่านง่ายกว่าแนวตั้ง) */
export function HorizontalBarChart({
  rows,
  series,
}: {
  rows: { label: string; values: Record<string, number> }[];
  series: Series[];
}) {
  if (rows.length === 0) return <p className="py-6 text-sm text-slate-500">ยังไม่มีข้อมูล</p>;

  const labelW = 150;
  const valueW = 92;
  const width = 700;
  const rowH = series.length * 14 + 14;
  const height = rows.length * rowH + 8;
  const plotW = width - labelW - valueW;

  const max = niceMax(Math.max(...rows.flatMap((r) => series.map((s) => r.values[s.key] ?? 0)), 0));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img">
        {rows.map((r, ri) => {
          const top = ri * rowH + 4;
          const primary = r.values[series[0].key] ?? 0;
          return (
            <g key={r.label}>
              <text x={labelW - 10} y={top + rowH / 2} textAnchor="end" fontSize={12} fill={INK}>
                {r.label.length > 22 ? `${r.label.slice(0, 21)}…` : r.label}
              </text>

              {series.map((s, si) => {
                const value = r.values[s.key] ?? 0;
                const w = max > 0 ? (value / max) * plotW : 0;
                const y = top + 4 + si * 14;
                return (
                  <path key={s.key} d={barRight(labelW, y, w, 10)} fill={s.color}>
                    <title>{`${r.label} · ${s.label}: ${value.toLocaleString("th-TH")} บาท`}</title>
                  </path>
                );
              })}

              <text
                x={width - 8}
                y={top + rowH / 2 + 4}
                textAnchor="end"
                fontSize={12}
                fill={INK}
              >
                {compactBaht(primary)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
