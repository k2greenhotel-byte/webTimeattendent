import Link from "next/link";
import { countCustomers, listCustomers } from "@/lib/customer-db";
import {
  ageFromBirthDate,
  formatFullAddress,
  formatNationalId,
} from "@/lib/customers";
import { formatThaiDate } from "@/lib/datetime";
import { formatPhone } from "@/lib/phone";
import { checkPermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const keyword = (params.q ?? "").trim();

  const [rows, total, canWrite] = await Promise.all([
    listCustomers({ keyword }),
    countCustomers(),
    checkPermission("CUST_FORM", "write"),
  ]);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ประวัติลูกค้า</h1>
          <p className="text-sm text-slate-500">
            ค้นด้วยชื่อ รหัสลูกค้า เบอร์โทร หรือเลขบัตรประชาชน · ทั้งหมด {total} ราย
          </p>
        </div>
        {canWrite && (
          <Link href="/customers/new" className="btn-primary">
            + เพิ่มลูกค้าใหม่
          </Link>
        )}
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form method="get" className="card flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={keyword}
          className="input w-full sm:w-80"
          placeholder="ชื่อลูกค้า / รหัส / เบอร์โทร / เลขบัตรประชาชน"
        />
        <button type="submit" className="btn-secondary">
          ค้นหา
        </button>
        {keyword && (
          <Link href="/customers" className="text-sm text-slate-500 hover:underline">
            ล้างคำค้น
          </Link>
        )}
      </form>

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">
          ผลการค้นหา ({rows.length}
          {keyword ? ` จาก ${total}` : ""} ราย)
        </h2>

        <div className="overflow-x-auto">
          <table className="table-report">
            <thead>
              <tr>
                <th>รูป</th>
                <th>รหัสลูกค้า</th>
                <th className="text-left">ชื่อลูกค้า</th>
                <th>เบอร์โทร</th>
                <th className="text-left">ที่อยู่</th>
                <th>เลขบัตรประชาชน</th>
                <th>วันเกิด</th>
                <th>ช่องทาง</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const age = ageFromBirthDate(c.birth_date);
                return (
                  <tr key={c.id}>
                    <td>
                      {c.photo_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/customer/photo?path=${encodeURIComponent(c.photo_path)}`}
                          alt={c.full_name}
                          className="mx-auto h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="font-medium">{c.code}</td>
                    <td className="text-left">
                      <Link href={`/customers/${c.id}`} className="text-brand-600 hover:underline">
                        {c.full_name}
                      </Link>
                    </td>
                    <td>{formatPhone(c.phone)}</td>
                    <td className="whitespace-normal text-left text-xs text-slate-600">
                      {formatFullAddress({
                        address_detail: c.address_detail,
                        subdistrict_name: c.subdistrict_name,
                        district_name: c.district_name,
                        province_name: c.province_name,
                        postal_code: c.postal_code,
                      }) || "-"}
                    </td>
                    <td className="text-xs">{formatNationalId(c.national_id)}</td>
                    <td className="text-xs">
                      {c.birth_date ? formatThaiDate(c.birth_date) : "-"}
                      {age !== null && <span className="text-slate-400"> ({age} ปี)</span>}
                    </td>
                    <td className="text-xs">
                      <span className="flex items-center justify-center gap-2">
                        {c.facebook_url && (
                          <a
                            href={c.facebook_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-600 hover:underline"
                          >
                            Facebook
                          </a>
                        )}
                        {c.line_url && (
                          <a
                            href={c.line_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:underline"
                          >
                            Line
                          </a>
                        )}
                        {!c.facebook_url && !c.line_url && <span className="text-slate-300">—</span>}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          c.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {c.is_active ? "ใช้งาน" : "ยกเลิก"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p className="text-sm text-slate-500">
            {keyword ? "ไม่พบลูกค้าที่ตรงกับคำค้น" : "ยังไม่มีประวัติลูกค้าในระบบ"}
          </p>
        )}
      </section>
    </main>
  );
}
