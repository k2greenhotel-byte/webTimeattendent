import Link from "next/link";
import { describeUpdate } from "@/lib/booking";
import { FILE_KIND_LABEL, type BookingFile, type BookingUpdateRow } from "@/lib/booking-types";
import { formatThaiDate } from "@/lib/datetime";

/** ลิงก์เปิดเอกสารแนบของใบ update หนึ่งใบ */
export function UpdateFileLinks({ files }: { files: BookingFile[] }) {
  if (files.length === 0) return <span className="text-slate-300">—</span>;
  return (
    <ul className="space-y-0.5">
      {files.map((f) => (
        <li key={f.path} className="text-xs">
          <span className="text-slate-400">{FILE_KIND_LABEL[f.kind]}: </span>
          <a
            href={`/api/booking/file?path=${encodeURIComponent(f.path)}`}
            target="_blank"
            rel="noreferrer"
            className="break-all text-brand-600 hover:underline"
          >
            {f.filename}
          </a>
        </li>
      ))}
    </ul>
  );
}

function DeleteButton({
  action,
  updateId,
  bookingId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  updateId: string;
  bookingId: string;
}) {
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="id" value={updateId} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <label className="flex items-center gap-1 text-[11px] text-slate-500">
        <input type="checkbox" name="confirm" />
        ยืนยัน
      </label>
      <button type="submit" className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">
        ลบ
      </button>
    </form>
  );
}

/**
 * รายการใบ update สถานะ (หน้าจอ 1.2 และประวัติในใบจอง)
 * จอเล็กเป็นการ์ด · จอ md ขึ้นไปเป็นตาราง
 */
export default function UpdateList({
  rows,
  files,
  showBooking = false,
  deleteAction,
  emptyText = "ยังไม่มีการบันทึก update",
}: {
  rows: BookingUpdateRow[];
  /** เอกสารแนบของแต่ละแถว (ลำดับตรงกับ rows) — ไม่ส่งมาก็ได้ จะแสดงเป็นจำนวนไฟล์แทน */
  files?: BookingFile[][];
  showBooking?: boolean;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  emptyText?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;

  return (
    <>
      {/* ---------- มือถือ: การ์ด ---------- */}
      <ul className="space-y-2 md:hidden">
        {rows.map((u, i) => (
          <li key={u.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-slate-800">{u.doc_no}</span>
              <span className="text-xs text-slate-500">{formatThaiDate(u.update_date)}</span>
            </div>

            {showBooking && (
              <p className="mt-1 text-sm">
                <Link
                  href={`/booking/bookings/${u.booking_id}`}
                  className="text-brand-600 hover:underline"
                >
                  {u.booking_no}
                </Link>
                <span className="ml-2 text-slate-600">{u.customer_name ?? "—"}</span>
              </p>
            )}

            <p className="mt-1 text-xs text-slate-700">{describeUpdate(u)}</p>
            <p className="mt-1 text-xs text-slate-400">
              ผู้บันทึก {u.recorded_by_name ?? u.recorded_by_full_name ?? "-"}
              {u.note ? ` · ${u.note}` : ""}
            </p>

            <div className="mt-2 text-xs">
              {files ? (
                <UpdateFileLinks files={files[i] ?? []} />
              ) : (
                <span className="text-slate-500">
                  {u.file_count > 0 ? `แนบ ${u.file_count} ไฟล์` : "ไม่มีเอกสารแนบ"}
                </span>
              )}
            </div>

            {deleteAction && (
              <div className="mt-2">
                <DeleteButton action={deleteAction} updateId={u.id} bookingId={u.booking_id} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* ---------- แท็บเล็ต/PC: ตาราง ---------- */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table-report">
          <thead>
            <tr>
              <th>เลขที่ Update</th>
              <th>วันที่</th>
              {showBooking && <th>เลขที่ใบจอง</th>}
              {showBooking && <th className="text-left">ลูกค้า</th>}
              <th className="text-left">สิ่งที่บันทึก</th>
              <th>ผู้บันทึก</th>
              <th className="text-left">เอกสารแนบ</th>
              <th className="text-left">หมายเหตุ</th>
              {deleteAction && <th>จัดการ</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((u, i) => (
              <tr key={u.id}>
                <td className="font-medium">{u.doc_no}</td>
                <td className="text-xs">{formatThaiDate(u.update_date)}</td>
                {showBooking && (
                  <td>
                    <Link
                      href={`/booking/bookings/${u.booking_id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {u.booking_no}
                    </Link>
                  </td>
                )}
                {showBooking && <td className="text-left text-xs">{u.customer_name ?? "-"}</td>}
                <td className="whitespace-normal text-left text-xs">{describeUpdate(u)}</td>
                <td className="text-xs">{u.recorded_by_name ?? u.recorded_by_full_name ?? "-"}</td>
                <td className="whitespace-normal text-left">
                  {files ? (
                    <UpdateFileLinks files={files[i] ?? []} />
                  ) : (
                    <span className="text-xs text-slate-500">
                      {u.file_count > 0 ? `${u.file_count} ไฟล์` : "—"}
                    </span>
                  )}
                </td>
                <td className="whitespace-normal text-left text-xs text-slate-500">{u.note ?? "-"}</td>
                {deleteAction && (
                  <td>
                    <DeleteButton action={deleteAction} updateId={u.id} bookingId={u.booking_id} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
