import Link from "next/link";
import {
  BookingStatusBadge,
  ContractStatusBadge,
  DocStatusBadge,
  VehicleStatusBadge,
} from "@/components/booking/StatusBadges";
import { describeVehicle, formatBaht } from "@/lib/booking";
import { CANCEL_REASON_LABEL, PURCHASE_TYPE_LABEL, type BookingRow } from "@/lib/booking-types";
import { formatThaiDate } from "@/lib/datetime";
import { formatPhone } from "@/lib/phone";

/**
 * รายการใบจอง ใช้ร่วมกันทั้งหน้ารายการ (1.1) และหน้าสอบถาม (1.3)
 *
 * จอเล็ก (มือถือ) แสดงเป็นการ์ดใบละกล่อง อ่านได้โดยไม่ต้องเลื่อนซ้าย-ขวา
 * จอ md ขึ้นไป (แท็บเล็ต/PC) แสดงเป็นตารางเต็มเพื่อเทียบหลายใบพร้อมกันและสั่งพิมพ์
 */
export default function BookingTable({
  rows,
  emptyText = "ยังไม่มีใบจองในระบบ",
}: {
  rows: BookingRow[];
  emptyText?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  return (
    <>
      {/* ---------- มือถือ: การ์ด ---------- */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/booking/bookings/${row.id}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  {row.doc_no}
                </Link>
                <p className="truncate text-sm text-slate-700">
                  {row.customer_name ?? "— ไม่ระบุลูกค้า —"}
                </p>
              </div>
              <DocStatusBadge status={row.doc_status} />
            </div>

            <p className="mt-1 text-xs text-slate-600">{describeVehicle(row)}</p>

            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
              <div>
                <dt className="text-slate-400">วันที่จอง</dt>
                <dd>{formatThaiDate(row.booking_date)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">นัดรับรถ</dt>
                <dd>{row.pickup_date ? formatThaiDate(row.pickup_date) : "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">เบอร์โทร</dt>
                <dd>{formatPhone(row.customer_phone)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">มัดจำ</dt>
                <dd>{formatBaht(row.deposit_amount)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-400">พนักงานที่รับจอง</dt>
                <dd>{row.taken_by_name ?? row.taken_by_full_name ?? "—"}</dd>
              </div>
            </dl>

            <div className="mt-2 flex flex-wrap gap-1">
              <VehicleStatusBadge status={row.vehicle_status} />
              <ContractStatusBadge status={row.contract_status} />
              <BookingStatusBadge status={row.booking_status} />
            </div>

            {(row.cancel_reason || row.sale_contract_no || row.ref_no) && (
              <p className="mt-2 text-[11px] text-slate-400">
                {row.ref_no ? `อ้างอิง ${row.ref_no}` : ""}
                {row.sale_contract_no ? ` · สัญญาขาย ${row.sale_contract_no}` : ""}
                {row.cancel_reason ? ` · ${CANCEL_REASON_LABEL[row.cancel_reason]}` : ""}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* ---------- แท็บเล็ต/PC: ตาราง ---------- */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table-report">
          <thead>
            <tr>
              <th>เลขที่ใบจอง</th>
              <th>วันที่จอง</th>
              <th className="text-left">ลูกค้า</th>
              <th>เบอร์โทร</th>
              <th className="text-left">รถที่จอง</th>
              <th>ผู้รับจอง</th>
              <th>ประเภทซื้อ</th>
              <th>นัดรับรถ</th>
              <th>มัดจำ</th>
              <th>สถานะรถ</th>
              <th>สถานะสัญญา</th>
              <th>สถานะการจอง</th>
              <th>สถานะเอกสาร</th>
              <th>แนบ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-medium">
                  <Link
                    href={`/booking/bookings/${row.id}`}
                    className="text-brand-600 hover:underline"
                  >
                    {row.doc_no}
                  </Link>
                  {row.ref_no && (
                    <div className="text-[11px] text-slate-400">อ้างอิง {row.ref_no}</div>
                  )}
                </td>
                <td className="text-xs">{formatThaiDate(row.booking_date)}</td>
                <td className="text-left">
                  {row.customer_name ?? <span className="text-slate-300">—</span>}
                  {row.branch_name && (
                    <div className="text-[11px] text-slate-400">สาขา {row.branch_name}</div>
                  )}
                </td>
                <td className="text-xs">{formatPhone(row.customer_phone)}</td>
                <td className="whitespace-normal text-left text-xs">{describeVehicle(row)}</td>
                <td className="text-xs">{row.taken_by_name ?? row.taken_by_full_name ?? "-"}</td>
                <td className="text-xs">{PURCHASE_TYPE_LABEL[row.purchase_type]}</td>
                <td className="text-xs">
                  {row.pickup_date ? (
                    formatThaiDate(row.pickup_date)
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="text-xs">{formatBaht(row.deposit_amount)}</td>
                <td>
                  <VehicleStatusBadge status={row.vehicle_status} />
                </td>
                <td>
                  <ContractStatusBadge status={row.contract_status} />
                </td>
                <td>
                  <BookingStatusBadge status={row.booking_status} />
                  {row.cancel_reason && (
                    <div className="text-[11px] text-slate-400">
                      {CANCEL_REASON_LABEL[row.cancel_reason]}
                    </div>
                  )}
                </td>
                <td>
                  <DocStatusBadge status={row.doc_status} />
                  {row.sale_contract_no && (
                    <div className="text-[11px] text-slate-400">สัญญาขาย {row.sale_contract_no}</div>
                  )}
                </td>
                <td className="text-xs text-slate-500">
                  {row.file_count > 0 ? `${row.file_count} ไฟล์` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
