/**
 * อันดับสูงสุดพร้อมแถบสัดส่วนเทียบกับอันดับหนึ่ง
 * ใช้กับ "10 อันดับรุ่นรถที่ลูกค้าสนใจ" และ "10 อันดับพนักงานขายที่มี Lead มากสุด"
 */
export default function TopList({
  title,
  hint,
  rows,
  unit = "ราย",
  color,
  emptyText,
}: {
  title: string;
  hint?: string;
  rows: { label: string; count: number }[];
  unit?: string;
  color: string;
  emptyText: string;
}) {
  const max = rows[0]?.count ?? 0;

  return (
    <div className="card min-w-0 space-y-2">
      <div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyText}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((row, index) => (
            <li key={row.label}>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="w-5 shrink-0 text-xs text-slate-400">{index + 1}.</span>
                <span className="mr-auto min-w-0 truncate text-slate-700" title={row.label}>
                  {row.label}
                </span>
                <span className="shrink-0 font-semibold text-slate-800">
                  {row.count} <span className="text-xs font-normal text-slate-400">{unit}</span>
                </span>
              </div>
              <div className="ml-7 mt-0.5 h-1.5 rounded-full bg-slate-100">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${max > 0 ? Math.max(6, (row.count / max) * 100) : 0}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
