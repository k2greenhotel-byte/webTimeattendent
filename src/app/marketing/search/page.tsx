import Link from "next/link";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import {
  formatBaht,
  formatPeriod,
  isPeriodExpired,
  outstandingAmount,
  summarize,
  summarizeMemos,
} from "@/lib/marketing";
import { listActivities, listMaster } from "@/lib/marketing-db";
import { listMemos } from "@/lib/memo-db";
import {
  ACTIVE_STATUS_LABEL,
  FLOW_STATUS_LABEL,
  MEMO_STATUS_LABEL,
  MEMO_STATUS_ORDER,
  type MktActiveStatus,
  type MktFlowStatus,
  type MktMemoStatus,
} from "@/lib/marketing-types";
import { ActiveBadge, FlowBadge, MemoBadge } from "@/components/marketing/StatusBadge";

export const dynamic = "force-dynamic";

type Params = {
  tab?: string;
  flow_status?: string;
  status?: string;
  active_status?: string;
  company_id?: string;
  activity_type_id?: string;
  staff_id?: string;
  from?: string;
  to?: string;
  keyword?: string;
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const tab = params.tab === "memo" ? "memo" : "activity";

  const shared = {
    active_status: (params.active_status || undefined) as MktActiveStatus | undefined,
    company_id: params.company_id || undefined,
    staff_id: params.staff_id || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    keyword: params.keyword || undefined,
  };

  const [companies, types, staff] = await Promise.all([
    listMaster("company", { includeInactive: true }),
    listMaster("activityType", { includeInactive: true }),
    listMaster("staff", { includeInactive: true }),
  ]);

  const exportQuery = new URLSearchParams(
    Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
  );
  if (tab === "memo") exportQuery.set("kind", "memo");

  const rows =
    tab === "activity"
      ? await listActivities({
          ...shared,
          flow_status: (params.flow_status || undefined) as MktFlowStatus | undefined,
          activity_type_id: params.activity_type_id || undefined,
        })
      : [];
  const memos =
    tab === "memo"
      ? await listMemos({
          ...shared,
          status: (params.status || undefined) as MktMemoStatus | undefined,
        })
      : [];

  const totals = summarize(rows);
  const memoTotals = summarizeMemos(memos);
  const today = workDateOf();

  const tabLink = (target: "activity" | "memo") => {
    const q = new URLSearchParams();
    for (const key of ["from", "to", "company_id", "staff_id", "active_status", "keyword"] as const) {
      if (params[key]) q.set(key, params[key] as string);
    }
    if (target === "memo") q.set("tab", "memo");
    const qs = q.toString();
    return `/marketing/search${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">5. หน้าจอสอบถาม</h1>
        <p className="text-sm text-slate-500">
          ค้นตามสถานะ ช่วงวันที่ และบริษัท · พบ{" "}
          {tab === "activity" ? `${rows.length} ใบกิจกรรม` : `${memos.length} Memo`}
        </p>
      </div>

      {/* ---------- สลับระหว่างใบกิจกรรมกับ Memo ---------- */}
      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            ["activity", "ใบกิจกรรม"],
            ["memo", "Memo"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={tabLink(key)}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key
                ? "border-brand-500 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <form className="card grid gap-3 sm:grid-cols-4" method="get">
        {tab === "memo" && <input type="hidden" name="tab" value="memo" />}

        {tab === "activity" ? (
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
        ) : (
          <div>
            <label className="label">สถานะ Memo</label>
            <select name="status" defaultValue={params.status ?? ""} className="input">
              <option value="">ทั้งหมด</option>
              {MEMO_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {MEMO_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        )}

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

        {tab === "activity" && (
          <div>
            <label className="label">ประเภทกิจกรรม</label>
            <select
              name="activity_type_id"
              defaultValue={params.activity_type_id ?? ""}
              className="input"
            >
              <option value="">ทั้งหมด</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">ผู้บันทึก</label>
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
            placeholder={tab === "activity" ? "เลขที่ ชื่อกิจกรรม…" : "เลขที่ รายละเอียด…"}
          />
        </div>

        <div className="flex flex-wrap items-end gap-2 sm:col-span-4">
          <button type="submit" className="btn-primary">
            ค้นหา
          </button>
          <Link href={tabLink(tab)} className="btn-secondary">
            ล้างเงื่อนไข
          </Link>
          <a href={`/api/marketing/export?${exportQuery.toString()}&format=xlsx`} className="btn-secondary">
            ⬇ Excel
          </a>
          <a href={`/api/marketing/export?${exportQuery.toString()}&format=csv`} className="btn-secondary">
            ⬇ CSV
          </a>
        </div>
      </form>

      {tab === "activity" ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Total label="รวมขอเบิก" value={`${formatBaht(totals.request)} บาท`} />
            <Total label="รวมอนุมัติ" value={`${formatBaht(totals.approved)} บาท`} />
            <Total label="รวมได้รับ" value={`${formatBaht(totals.received)} บาท`} />
            <Total label="รวมคงค้าง" value={`${formatBaht(totals.outstanding)} บาท`} />
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
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {MEMO_STATUS_ORDER.map((s) => (
              <div key={s} className="card">
                <p className="text-xs text-slate-500">{MEMO_STATUS_LABEL[s]}</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{memoTotals.byStatus[s]}</p>
              </div>
            ))}
          </div>

          <div className="card overflow-x-auto">
            <table className="table-report">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>วันที่</th>
                  <th>บริษัท</th>
                  <th>รายละเอียด</th>
                  <th>ระยะเวลา</th>
                  <th>ผู้บันทึก</th>
                  <th>ไฟล์</th>
                  <th>เปลี่ยนสถานะล่าสุด</th>
                  <th>สถานะ</th>
                  <th>เอกสาร</th>
                </tr>
              </thead>
              <tbody>
                {memos.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-slate-500">
                      ไม่พบ Memo ตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  memos.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link
                          href={`/marketing/memos/${r.id}`}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {r.doc_no}
                        </Link>
                      </td>
                      <td>{formatThaiDate(r.memo_date)}</td>
                      <td>{r.company_name ?? "-"}</td>
                      <td className="!text-left">
                        <span className="line-clamp-2 max-w-xs">{r.detail ?? "-"}</span>
                      </td>
                      <td>
                        {formatPeriod(r.period_from, r.period_to, formatThaiDate)}
                        {isPeriodExpired(r.period_to, today) && r.status !== "closed" && (
                          <span className="ml-1 text-xs text-rose-600">(เลยกำหนด)</span>
                        )}
                      </td>
                      <td>{r.created_by_name ?? "-"}</td>
                      <td>{r.file_count > 0 ? `📎 ${r.file_count}` : "-"}</td>
                      <td>
                        {r.last_status_changed_on ? formatThaiDate(r.last_status_changed_on) : "-"}
                      </td>
                      <td>
                        <MemoBadge status={r.status} />
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
        </>
      )}
    </main>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
