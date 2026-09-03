import Link from "next/link";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_ORDER,
  CANCEL_REASON_LABEL,
  CANCEL_REASON_ORDER,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_ORDER,
  DOC_STATUS_LABEL,
  DOC_STATUS_ORDER,
  PURCHASE_TYPE_LABEL,
  PURCHASE_TYPE_ORDER,
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_ORDER,
} from "@/lib/booking-types";
import type { MotoOption } from "@/lib/moto-types";
import type { Branch } from "@/lib/types";

type Params = Record<string, string | undefined>;

/** dropdown ของตัวเลือกที่มีชื่อไทยตายตัว (สถานะต่าง ๆ) */
function StatusSelect<T extends string>({
  name,
  label,
  order,
  labels,
  value,
}: {
  name: string;
  label: string;
  order: readonly T[];
  labels: Record<T, string>;
  value?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={value ?? ""} className="input">
        <option value="">ทั้งหมด</option>
        {order.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </div>
  );
}

function OptionSelect({
  name,
  label,
  rows,
  value,
  describe,
}: {
  name: string;
  label: string;
  rows: { id: string; name: string }[];
  value?: string;
  describe?: (row: { id: string; name: string }) => string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={value ?? ""} className="input">
        <option value="">ทั้งหมด</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {describe ? describe(r) : r.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * ชุดเงื่อนไขค้นหาใบจอง (ข้อ 1.3) — ใช้ทั้งหน้าสอบถามและ dashboard
 * ส่งเป็นฟอร์ม GET เพื่อให้ผลลัพธ์ที่ค้นได้แชร์เป็นลิงก์และกดพิมพ์ได้เลย
 */
export default function BookingFilters({
  params,
  branches,
  brands,
  models,
  variants,
  colors,
  resetHref,
  extraHiddenFields = {},
}: {
  params: Params;
  branches: Branch[];
  brands: MotoOption[];
  models: MotoOption[];
  variants: MotoOption[];
  colors: MotoOption[];
  resetHref: string;
  /** ค่าที่ต้องติดไปกับฟอร์มด้วย เช่นเดือนที่กำลังดูบน dashboard */
  extraHiddenFields?: Record<string, string>;
}) {
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const modelName = new Map(models.map((m) => [m.id, m.name]));

  return (
    <form method="get" className="card space-y-3">
      {Object.entries(extraHiddenFields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="q">
            คำค้น
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            className="input"
            placeholder="เลขที่ใบจอง / อ้างอิง / ชื่อลูกค้า / เบอร์โทร / เลขที่สัญญาขาย"
          />
        </div>
        <OptionSelect name="branch" label="สาขาที่รับจอง" rows={branches} value={params.branch} />
        <OptionSelect name="brand" label="ยี่ห้อรถ" rows={brands} value={params.brand} />

        <OptionSelect
          name="model"
          label="รุ่นรถ"
          rows={models}
          value={params.model}
          describe={(m) => {
            const parent = models.find((x) => x.id === m.id)?.brand_id ?? null;
            const brand = parent ? brandName.get(parent) : null;
            return brand ? `${brand} · ${m.name}` : m.name;
          }}
        />
        <OptionSelect
          name="variant"
          label="แบบรถ"
          rows={variants}
          value={params.variant}
          describe={(v) => {
            const parent = variants.find((x) => x.id === v.id)?.model_id ?? null;
            const model = parent ? modelName.get(parent) : null;
            return model ? `${model} · ${v.name}` : v.name;
          }}
        />
        <OptionSelect name="color" label="สี" rows={colors} value={params.color} />
        <StatusSelect
          name="purchase"
          label="ประเภทการซื้อ"
          order={PURCHASE_TYPE_ORDER}
          labels={PURCHASE_TYPE_LABEL}
          value={params.purchase}
        />

        <StatusSelect
          name="vehicle"
          label="สถานะรถ"
          order={VEHICLE_STATUS_ORDER}
          labels={VEHICLE_STATUS_LABEL}
          value={params.vehicle}
        />
        <StatusSelect
          name="contract"
          label="สถานะสัญญา"
          order={CONTRACT_STATUS_ORDER}
          labels={CONTRACT_STATUS_LABEL}
          value={params.contract}
        />
        <StatusSelect
          name="status"
          label="สถานะการจอง"
          order={BOOKING_STATUS_ORDER}
          labels={BOOKING_STATUS_LABEL}
          value={params.status}
        />
        <StatusSelect
          name="doc"
          label="สถานะเอกสาร"
          order={DOC_STATUS_ORDER}
          labels={DOC_STATUS_LABEL}
          value={params.doc}
        />

        <StatusSelect
          name="cancel"
          label="สาเหตุของการยกเลิก"
          order={CANCEL_REASON_ORDER}
          labels={CANCEL_REASON_LABEL}
          value={params.cancel}
        />
        <div>
          <label className="label" htmlFor="from">
            วันที่จอง ตั้งแต่
          </label>
          <input id="from" name="from" type="date" defaultValue={params.from ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="to">
            วันที่จอง ถึง
          </label>
          <input id="to" name="to" type="date" defaultValue={params.to ?? ""} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="pickup_from">
              นัดรับรถ ตั้งแต่
            </label>
            <input
              id="pickup_from"
              name="pickup_from"
              type="date"
              defaultValue={params.pickup_from ?? ""}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="pickup_to">
              ถึง
            </label>
            <input
              id="pickup_to"
              name="pickup_to"
              type="date"
              defaultValue={params.pickup_to ?? ""}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          ค้นหา
        </button>
        <Link href={resetHref} className="text-sm text-slate-500 hover:underline">
          ล้างเงื่อนไขทั้งหมด
        </Link>
      </div>
    </form>
  );
}
