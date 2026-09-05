import Link from "next/link";
import {
  CHANCE_LABEL,
  CHANCE_ORDER,
  WORK_STATUS_LABEL,
  WORK_STATUS_ORDER,
  type LeadOption,
} from "@/lib/lead-types";
import type { MotoOption } from "@/lib/moto-types";
import type { Branch } from "@/lib/types";

/**
 * แถบเงื่อนไขค้นหาของหน้าสอบถาม (3) และ dashboard (4)
 * ส่งด้วย GET เพื่อให้ผู้ใช้บันทึก/แชร์ลิงก์เงื่อนไขเดิมได้ และกดปุ่มย้อนกลับได้ตามปกติ
 *
 * จอเล็กเรียงช่องลงมาทีละช่องเต็มความกว้าง จอใหญ่เรียงเป็นแถวเดียว
 */
export default function LeadFilters({
  basePath,
  params,
  owners,
  branches,
  brands,
  models,
  channels,
  showOwner = true,
  extra,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  owners: LeadOption[];
  branches: Branch[];
  brands: MotoOption[];
  models: MotoOption[];
  channels: MotoOption[];
  /** พนักงานทั่วไปเห็นเฉพาะของตัวเอง จึงไม่ต้องมีช่องเลือกพนักงาน */
  showOwner?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <form method="get" className="card grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="q">
          คำค้น
        </label>
        <input
          id="q"
          name="q"
          defaultValue={params.q ?? ""}
          className="input"
          placeholder="เลขที่ Lead / ชื่อลูกค้า / เบอร์โทร / รุ่นรถ / เลขที่สัญญาขาย"
        />
      </div>

      <div>
        <label className="label" htmlFor="from">
          ตั้งแต่วันที่
        </label>
        <input id="from" name="from" type="date" defaultValue={params.from ?? ""} className="input" />
      </div>

      <div>
        <label className="label" htmlFor="to">
          ถึงวันที่
        </label>
        <input id="to" name="to" type="date" defaultValue={params.to ?? ""} className="input" />
      </div>

      {showOwner && (
        <div>
          <label className="label" htmlFor="owner">
            พนักงานขาย
          </label>
          <select id="owner" name="owner" defaultValue={params.owner ?? ""} className="input">
            <option value="">ทุกคน</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label" htmlFor="branch">
          สาขา
        </label>
        <select id="branch" name="branch" defaultValue={params.branch ?? ""} className="input">
          <option value="">ทุกสาขา</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="status">
          สถานะงาน
        </label>
        <select id="status" name="status" defaultValue={params.status ?? ""} className="input">
          <option value="">ทุกสถานะ</option>
          {WORK_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {WORK_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="chance">
          สถานะโอกาส
        </label>
        <select id="chance" name="chance" defaultValue={params.chance ?? ""} className="input">
          <option value="">ทุกระดับ</option>
          {CHANCE_ORDER.map((c) => (
            <option key={c} value={c}>
              {CHANCE_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="brand">
          ยี่ห้อ
        </label>
        <select id="brand" name="brand" defaultValue={params.brand ?? ""} className="input">
          <option value="">ทุกยี่ห้อ</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="model">
          รุ่นรถ
        </label>
        <select id="model" name="model" defaultValue={params.model ?? ""} className="input">
          <option value="">ทุกรุ่น</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="channel">
          ช่องทางการติดต่อ
        </label>
        <select id="channel" name="channel" defaultValue={params.channel ?? ""} className="input">
          <option value="">ทุกช่องทาง</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-end gap-2 pb-2.5 text-sm text-slate-600">
        <input
          type="checkbox"
          name="overdue"
          value="1"
          defaultChecked={params.overdue === "1"}
          className="h-4 w-4 rounded border-slate-300"
        />
        เฉพาะที่เลยนัดติดตาม
      </label>

      {extra}

      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button type="submit" className="btn-primary w-full sm:w-auto">
          ค้นหา
        </button>
        <Link href={basePath} className="pb-2.5 text-sm text-slate-500 hover:underline">
          ล้างเงื่อนไข
        </Link>
      </div>
    </form>
  );
}
