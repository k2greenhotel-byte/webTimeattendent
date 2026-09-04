import AttentionList from "@/components/booking/AttentionList";
import { formatBaht, type BookingOverview } from "@/lib/booking";

/**
 * ภาพรวมใบจองทั้งหมดในหน้าเดียว (ข้อ 1.4)
 * แถวบน = ตัวเลขสรุป · แถวล่าง = รายการที่ต้องลงมือทำ (เลยนัด / นัดวันนี้ / ใกล้ถึง / ค้างคืนเงิน)
 */

function KpiCard({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "slate" | "brand" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    slate: "bg-white",
    brand: "bg-brand-50",
    emerald: "bg-emerald-50",
    amber: "bg-amber-50",
    rose: "bg-rose-50",
  } as const;

  const values = {
    slate: "text-slate-800",
    brand: "text-brand-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  } as const;

  return (
    <div className={`rounded-2xl border border-slate-200 p-3 ${tones[tone]}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${values[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export default function OverviewPanel({ overview }: { overview: BookingOverview }) {
  return (
    <div className="space-y-3">
      {/* ---------- ตัวเลขสรุป ---------- */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="ใบจองทั้งหมด"
          value={`${overview.total} ใบ`}
          hint={`ปิดงานแล้ว ${overview.closed} · ยกเลิก ${overview.cancelledDoc}`}
        />
        <KpiCard
          label="กำลังดำเนินการ"
          value={`${overview.open} ใบ`}
          hint={`รอสัญญา ${overview.byBookingStatus.wait_contract} · รอรับรถ ${overview.byBookingStatus.wait_delivery}`}
          tone="brand"
        />
        <KpiCard
          label="ปิดการขายได้"
          value={`${overview.sold} ใบ`}
          hint={`คิดเป็น ${overview.closeRate}% ของใบจองทั้งหมด`}
          tone="emerald"
        />
        <KpiCard
          label="รับรถแล้ว"
          value={`${overview.byBookingStatus.delivered} ใบ`}
          hint={`ยกเลิกไม่รับรถ ${overview.byBookingStatus.cancelled} ใบ`}
        />
        <KpiCard
          label="เงินมัดจำที่ถืออยู่"
          value={formatBaht(overview.depositOpen)}
          hint={`มัดจำรวมทุกใบ ${formatBaht(overview.deposit)}`}
          tone="amber"
        />
        <KpiCard
          label="รถที่ต้องสั่งเพิ่ม"
          value={`${overview.needOrder} ใบ`}
          hint="นับเฉพาะใบที่ยังดำเนินการอยู่"
          tone={overview.needOrder > 0 ? "rose" : "slate"}
        />
      </section>

      {/* ---------- ต้องลงมือทำ ---------- */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AttentionList
          title="เลยวันนัดรับรถ"
          rows={overview.overdue}
          tone="rose"
          emptyText="ไม่มีใบที่เลยกำหนดนัด"
          href="/booking/search?doc=active"
        />
        <AttentionList
          title="นัดรับรถวันนี้"
          rows={overview.dueToday}
          tone="amber"
          emptyText="วันนี้ไม่มีนัดรับรถ"
        />
        <AttentionList
          title="นัดรับรถใน 7 วัน"
          rows={overview.dueSoon}
          tone="sky"
          emptyText="7 วันข้างหน้ายังไม่มีนัด"
        />
        <AttentionList
          title="ยกเลิกแล้วยังไม่คืนเงิน"
          rows={overview.refundPending}
          tone="slate"
          emptyText="ไม่มีรายการค้างคืนเงิน"
          href="/booking/search?status=cancelled"
        />
      </section>
    </div>
  );
}
