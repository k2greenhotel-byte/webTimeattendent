import Link from "next/link";
import { formatBaht, type DeliveryPipeline } from "@/lib/booking";
import { VEHICLE_STATUS_LABEL, type VehicleStatus } from "@/lib/booking-types";

/**
 * ใบจองที่ขายจบแล้ว (สัญญาผ่านแล้ว + รอรับรถ) แยกตามว่ารถอยู่ไหน
 * เรียงจาก "พร้อมส่งมอบทันที" ไปหา "ยังไม่ได้สั่งรถ" เพื่อให้เห็นคอขวดจากซ้ายไปขวา
 */
const STEPS: {
  status: VehicleStatus;
  title: string;
  hint: string;
  tone: "emerald" | "sky" | "rose";
}[] = [
  {
    status: "in_stock",
    title: "รถมีในสต็อก",
    hint: "นัดลูกค้ามารับได้เลย",
    tone: "emerald",
  },
  {
    status: "ordered",
    title: "รถที่สั่งมาแล้ว",
    hint: "สั่งแล้ว รอรถเข้า",
    tone: "sky",
  },
  {
    status: "need_order",
    title: "รถต้องสั่ง",
    hint: "ยังไม่ได้สั่ง — ต้องรีบสั่งก่อนถึงวันนัด",
    tone: "rose",
  },
];

const TONES = {
  emerald: { box: "bg-emerald-50 border-emerald-200", value: "text-emerald-700" },
  sky: { box: "bg-sky-50 border-sky-200", value: "text-sky-700" },
  rose: { box: "bg-rose-50 border-rose-200", value: "text-rose-700" },
} as const;

export default function DeliveryPipelinePanel({ pipeline }: { pipeline: DeliveryPipeline }) {
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-800">รอส่งมอบ · สัญญาผ่านแล้ว + รอรับรถ</h2>
          <p className="text-xs text-slate-500">
            ใบที่งานขายจบแล้ว เหลือแค่รอรถ — แยกตามสถานะรถเพื่อดูว่าติดอยู่ขั้นไหน
          </p>
        </div>
        <p className="text-sm text-slate-500">รวม {pipeline.total} ใบ</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STEPS.map((step) => {
          const count = pipeline.byVehicleStatus[step.status];
          const deposit = pipeline.depositByVehicleStatus[step.status];
          const tone = TONES[step.tone];

          return (
            <Link
              key={step.status}
              href={`/booking/search?contract=approved&status=wait_delivery&vehicle=${step.status}`}
              className={`rounded-2xl border p-3 transition hover:shadow ${tone.box}`}
            >
              <p className="text-xs text-slate-600">
                {step.title}
                <span className="text-slate-400"> · {VEHICLE_STATUS_LABEL[step.status]}</span>
              </p>
              <p className={`text-2xl font-bold ${tone.value}`}>
                {count} <span className="text-sm font-normal">ใบ</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">{step.hint}</p>
              <p className="text-[11px] text-slate-400">มัดจำ {formatBaht(deposit)}</p>
            </Link>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400">กดที่การ์ดเพื่อดูรายการใบจองของกลุ่มนั้นในหน้าสอบถาม</p>
    </section>
  );
}
