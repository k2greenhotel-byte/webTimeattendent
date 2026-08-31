import { formatThaiDate, workDateOf } from "@/lib/datetime";
import { listHolidays } from "@/lib/db";
import { deleteHolidayForm, saveHolidayForm } from "./actions";

export const dynamic = "force-dynamic";

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; year?: string }>;
}) {
  const params = await searchParams;
  const year = Number(params.year) || Number(workDateOf().slice(0, 4));
  const holidays = await listHolidays(`${year}-01-01`, `${year}-12-31`);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">วันหยุดประจำปี</h1>
        <p className="text-sm text-slate-500">
          วันที่อยู่ในรายการนี้จะไม่ถูกนับเป็น &quot;ขาดงาน&quot; ในรายงาน
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      <form action={saveHolidayForm} className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">วันที่</label>
          <input name="holiday_date" type="date" className="input" required />
        </div>
        <div className="min-w-56 flex-1">
          <label className="label">ชื่อวันหยุด</label>
          <input name="name" className="input" placeholder="เช่น วันสงกรานต์" required />
        </div>
        <button type="submit" className="btn-primary">
          เพิ่ม / แก้ไข
        </button>
      </form>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            วันหยุดปี {year} ({holidays.length} วัน)
          </h2>
          <form method="get" className="flex items-end gap-2">
            <input name="year" type="number" defaultValue={year} className="input w-28" />
            <button type="submit" className="btn-secondary">
              ดูปีอื่น
            </button>
          </form>
        </div>

        {holidays.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีวันหยุดในปีนี้</p>
        )}

        {holidays.map((h) => (
          <div
            key={h.holiday_date}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
          >
            <span className="text-sm">
              <span className="font-medium">{formatThaiDate(h.holiday_date)}</span>
              <span className="ml-3 text-slate-600">{h.name}</span>
            </span>
            <form action={deleteHolidayForm}>
              <input type="hidden" name="holiday_date" value={h.holiday_date} />
              <button type="submit" className="text-xs text-rose-600 hover:underline">
                ลบ
              </button>
            </form>
          </div>
        ))}
      </section>
    </main>
  );
}
