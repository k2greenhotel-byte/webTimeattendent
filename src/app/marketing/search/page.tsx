import Link from "next/link";
import { formatThaiDate } from "@/lib/datetime";
import { formatBaht, outstandingAmount, summarize } from "@/lib/marketing";
import { listActivities, listMaster } from "@/lib/marketing-db";
import {
  ACTIVE_STATUS_LABEL,
  FLOW_STATUS_LABEL,
  type MktActiveStatus,
  type MktFlowStatus,
} from "@/lib/marketing-types";
import { ActiveBadge, FlowBadge } from "@/components/marketing/StatusBadge";

export const dynamic = "force-dynamic";

type Params = {
  flow_status?: string;
  active_status?: string;
  company_id?: string;
  activity_type_id?: string;
  staff_id?: string;
  from?: string;
  to?: string;
  keyword?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;

  const query = {
    flow_status: (params.flow_status || undefined) as MktFlowStatus | undefined,
    active_status: (params.active_status || undefined) as MktActiveStatus | undefined,
    company_id: params.company_id || undefined,
    activity_type_id: params.activity_type_id || undefined,
    staff_id: params.staff_id || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    keyword: params.keyword || undefined,
  };

  const [rows, companies, types, staff] = await Promise.all([
    listActivities(query),
    listMaster("company", { includeInactive: true }),
    listMaster("activityType", { includeInactive: true }),
    listMaster("staff", { includeInactive: true }),
  ]);

  const totals = summarize(rows);
  const exportQuery = new URLSearchParams(
    Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
  );

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">5. หน้าจอสอบถาม</h1>
        <p className="text-sm text-slate-500">
          ค้นตามสถานะ ช่วงวันที่ และบริษัท · พบ {rows.length} รายการ
        </p>
      </div>

      <form className="card grid gap-3 sm:grid-cols-4" method="get">
        <div>
          <label className="label">สถานะการเบิก</label>
          <select name="flow_status" defaultValue={params.flow_status ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {(Object.keys(FLOW_STATUS_LABEL) as MktFlowStatus[]).map((s) => (
              <option key={s} value={s}>
                {FLOW_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">สถานะเอกสาร</label>
          <select name="active_status" defaultValue={params.active_status ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {(Object.keys(ACTIVE_STATUS_LABEL) as MktActiveStatus[]).map((s) => (
              <option key={s} value={s}>
                {ACTIVE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ตั้งแต่วันที่</label>
          <input type="date" name="from" defaultValue={params.from ?? ""} className="input" />
        </div>
        <div>
          <label className="label">ถึงวันที่</label>
          <input type="date" name="to" defaultValue={params.to ?? ""} className="input" />
        </div>

        <div>
          <label className="label">บริษัทที่ขอเบิก</label>
          <select name="company_id" defaultValue={params.company_id ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ประเภทกิจกรรม</label>
          <select name="activity_type_id" defaultValue={params.activity_type_id ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ผู้บันทึกจัดทำ</label>
          <select name="staff_id" defaultValue={params.staff_id ?? ""} className="input">
            <option value="">ทั้งหมด</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">คำค้น</label>
          <input
            name="keyword"
            defaultValue={params.keyword ?? ""}
            className="input"
            placeholder="เลขที่ ชื่อกิจกรรม เลขไปรษณีย์…"
          />
        </div>

        <div className="flex flex-wrap items-end gap-2 sm:col-span-4">
          <button type="submit" className="btn-primary">
            ค้นหา
          </button>
          <Link href="/marketing/search" className="btn-secondary">
            ล้างเงื่อนไข
          </Link>
          <a
            href={`/api/marketing/export?${exportQuery.toString()}&format=xlsx`}
            className="btn-secondary"
          >
            ⬇ Excel
          </a>
          <a
            href={`/api/marketing/export?${exportQuery.toString()}&format=csv`}
            className="btn-secondary"
          >
            ⬇ CSV
          </a>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-4">
        <Total label="รวมขอเบิก" value={formatBaht(totals.request)} />
        <Total label="รวมอนุมัติ" value={formatBaht(totals.approved)} />
        <Total label="รวมได้รับ" value={formatBaht(totals.received)} />
        <Total label="รวมคงค้าง" value={formatBaht(totals.outstanding)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="table-report">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>วันที่</th>
              <th>ชื่อกิจกรรม</th>
              <th>ประเภท</th>
              <th>บริษัท</th>
              <th>ขอเบิก</th>
              <th>อนุมัติ</th>
              <th>ได้รับ</th>
              <th>คงค้าง</th>
              <th>วันที่ส่งเบิก</th>
              <th>วันที่รับเงิน</th>
              <th>สถานะการเบิก</th>
              <th>เอกสาร</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-6 text-slate-500">
                  ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={`/marketing/activities/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.doc_no}
                    </Link>
                  </td>
                  <td>{formatThaiDate(r.activity_date)}</td>
                  <td className="!text-left">{r.title}</td>
                  <td>{r.activity_type_name ?? "-"}</td>
                  <td>{r.company_name ?? "-"}</td>
                  <td className="!text-right">{formatBaht(r.request_amount)}</td>
                  <td className="!text-right">{formatBaht(r.approved_amount)}</td>
                  <td className="!text-right">{formatBaht(r.received_amount)}</td>
                  <td className="!text-right">{formatBaht(outstandingAmount(r))}</td>
                  <td>{r.submit_date ? formatThaiDate(r.submit_date) : "-"}</td>
                  <td>{r.receive_date ? formatThaiDate(r.receive_date) : "-"}</td>
                  <td>
                    <FlowBadge status={r.flow_status} />
                  </td>
                  <td>
                    <ActiveBadge status={r.active_status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-800">{value} บาท</p>
    </div>
  );
}
