import AttentionList from "@/components/booking/AttentionList";
import type { BookingRankings } from "@/lib/booking";

/**
 * อันดับสูงสุด 5 อันดับ และรายการเฝ้าระวังสต็อกรถ (ข้อ 1.4)
 * แต่ละอันดับมีแถบสัดส่วนเทียบกับอันดับหนึ่ง เพื่อให้เห็นช่องว่างระหว่างอันดับได้ทันที
 */
function TopList({
  title,
  hint,
  rows,
  unit = "ใบ",
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
                <span className="w-4 shrink-0 text-xs text-slate-400">{index + 1}.</span>
                <span className="mr-auto min-w-0 truncate text-slate-700" title={row.label}>
                  {row.label}
                </span>
                <span className="shrink-0 font-semibold text-slate-800">
                  {row.count} <span className="text-xs font-normal text-slate-400">{unit}</span>
                </span>
              </div>
              <div className="ml-6 mt-0.5 h-1.5 rounded-full bg-slate-100">
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

export default function RankingPanel({ rankings }: { rankings: BookingRankings }) {
  return (
    <div className="space-y-3">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TopList
          title="1. รุ่นรถที่จองสูงสุด"
          hint="นับใบจองทุกใบตามเงื่อนไขที่กรองไว้"
          rows={rankings.topModels}
          color="#2f7de1"
          emptyText="ยังไม่มีใบจอง"
        />
        <TopList
          title="2. จองแล้วรถยังไม่มีในสต็อก"
          hint="เฉพาะใบที่ยังดำเนินการอยู่ · รถต้องสั่ง หรือสั่งมาแล้วแต่ยังไม่ถึง"
          rows={rankings.topModelsOutOfStock}
          color="#d97706"
          emptyText="รถที่จองมีในสต็อกครบทุกใบ"
        />
        <TopList
          title="3. พนักงานขายที่รับจองสูงสุด"
          rows={rankings.topStaff}
          color="#0d9488"
          emptyText="ยังไม่มีใบจอง"
        />
        <TopList
          title="4. สาขาที่รับจองสูงสุด"
          rows={rankings.topBranches}
          color="#7c3aed"
          emptyText="ยังไม่มีใบจอง"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <AttentionList
          title="5. นัดรับรถภายใน 3 วัน แต่รถยังไม่มีในสต็อก"
          hint="รวมใบที่เลยกำหนดนัดไปแล้วด้วย — ต้องเร่งตามรถให้ทันนัด"
          rows={rankings.pickupSoonNoStock}
          tone="rose"
          emptyText="ไม่มีใบที่ใกล้ถึงนัดแล้วรถยังไม่มา"
          showVehicleStatus
          href="/booking/search?doc=active&vehicle=need_order"
        />
        <AttentionList
          title="6. ยกเลิกใน 7 วันล่าสุด ตอนที่รถยังไม่มีในสต็อก"
          hint="ใช้วันที่แก้ไขใบล่าสุดเป็นวันที่ยกเลิก · เสียลูกค้าเพราะรอรถนานหรือเปล่า"
          rows={rankings.cancelledNoStockRecent}
          tone="slate"
          emptyText="7 วันที่ผ่านมาไม่มีใบที่ยกเลิกตอนรถขาดสต็อก"
          showVehicleStatus
          href="/booking/search?status=cancelled"
        />
      </section>
    </div>
  );
}
