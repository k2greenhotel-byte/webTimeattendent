import Link from "next/link";
import LeaveAdminEditCard from "@/components/hr/LeaveAdminEditCard";
import { listRejectReasons } from "@/lib/approval-db";
import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { groupByCompany } from "@/lib/leave";
import { listLeaveRequests, listLeaveTypes } from "@/lib/leave-db";
import { LEAVE_STATUS_LABEL, LEAVE_STATUS_ORDER, type LeaveStatus } from "@/lib/leave-types";
import { checkPermission, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * หน้าจอฝ่ายบุคคล — แก้ไขใบแจ้งลาของพนักงานคนอื่นได้ทุกฟิลด์ ทุกสถานะ
 * ต่างจากหน้าอนุมัติปกติ (/hr/approvals/leave) ตรงที่:
 *   1. เห็นใบทุกสถานะ ไม่ใช่แค่ใบที่รออนุมัติ — จะได้แก้ใบที่ตัดสินไปแล้วได้ด้วย
 *   2. แก้ประเภทการลา ช่วงวันที่ รายละเอียดได้จริง ไม่ใช่แค่เลือกผลอนุมัติ
 * ใช้กรณีพนักงานบันทึกเข้ามาผิด หรือแจ้งใช้สิทธิ์การลาผิดประเภท
 */
export default async function LeaveManagePage({
  searchParams,
}: {
  searchParams: Promise<{
    company?: string;
    type?: string;
    status?: string;
    q?: string;
    msg?: string;
    err?: string;
  }>;
}) {
  await requirePermission("HR_LEAVE_MANAGE", "read");
  const params = await searchParams;

  const today = workDateOf();
  const status = (LEAVE_STATUS_ORDER as string[]).includes(params.status ?? "")
    ? (params.status as LeaveStatus)
    : undefined;

  const [canEdit, reasons, types, rows] = await Promise.all([
    checkPermission("HR_LEAVE_MANAGE", "write"),
    listRejectReasons(true),
    listLeaveTypes(),
    listLeaveRequests({
      companyId: params.company || undefined,
      typeId: params.type || undefined,
      statuses: status ? [status] : undefined,
      keyword: params.q || undefined,
      limit: 500,
    }),
  ]);

  const groups = groupByCompany(rows);
  const companyOptions = groups.map((g) => ({ id: g.companyId, name: g.companyName }));

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">แก้ไขข้อมูลการลาพนักงาน (ฝ่ายบุคคล)</h1>
          <p className="text-sm text-slate-500">
            {formatThaiDate(today)} · แยกตามบริษัท · แก้ไขข้อมูลและเปลี่ยนสถานะได้ทันที ใช้กรณีพนักงาน
            บันทึกเข้ามาผิด หรือแจ้งใช้สิทธิ์การลาผิดประเภท
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/hr/approvals/leave" className="text-sm text-brand-600 hover:underline">
            ← หน้าอนุมัติการลา
          </Link>
        </div>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}
      {!canEdit && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          บัญชีของคุณเปิดดูได้อย่างเดียว ยังแก้ไขไม่ได้ — ให้ผู้ดูแลระบบเปิดสิทธิ์ &quot;เพิ่ม&quot;
          ของเมนูนี้ให้ก่อน
        </p>
      )}

      <form method="get" className="card flex flex-wrap items-end gap-2">
        <div>
          <label className="label">คำค้น</label>
          <input
            name="q"
            defaultValue={params.q ?? ""}
            className="input w-56"
            placeholder="เลขที่ / ชื่อพนักงาน / รายละเอียด"
          />
        </div>
        <div>
          <label className="label">บริษัท</label>
          <select name="company" defaultValue={params.company ?? ""} className="input w-56">
            <option value="">ทุกบริษัท</option>
            {companyOptions.map((c) => (
              <option key={c.id ?? "none"} value={c.id ?? ""}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ประเภทการลา</label>
          <select name="type" defaultValue={params.type ?? ""} className="input w-56">
            <option value="">ทุกประเภท</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
                {t.is_active ? "" : " (ปิดใช้งาน)"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">สถานะ</label>
          <select name="status" defaultValue={params.status ?? ""} className="input w-48">
            <option value="">ทุกสถานะ</option>
            {LEAVE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {LEAVE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          กรอง
        </button>
      </form>

      {groups.length === 0 ? (
        <p className="card py-8 text-center text-sm text-slate-500">ไม่พบใบแจ้งลาที่ตรงกับเงื่อนไข</p>
      ) : (
        groups.map((group) => (
          <section key={group.companyId ?? "none"} className="space-y-2">
            <h2 className="font-semibold text-slate-800">
              {group.companyName}{" "}
              <span className="text-sm font-normal text-slate-500">({group.rows.length} ใบ)</span>
            </h2>
            <div className="space-y-2">
              {group.rows.map((row) => (
                <LeaveAdminEditCard
                  key={row.id}
                  row={row}
                  types={types}
                  reasons={reasons}
                  backTo="/hr/manage/leave"
                  canEdit={canEdit}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
