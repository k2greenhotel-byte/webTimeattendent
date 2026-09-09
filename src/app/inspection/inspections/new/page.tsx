import Link from "next/link";
import InspectionForm from "@/components/inspection/InspectionForm";
import { listCompanies } from "@/lib/core-db";
import { workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { formatScore } from "@/lib/inspection";
import { getForm, listTemplates } from "@/lib/inspection-db";
import { requirePermission } from "@/lib/session";
import { saveInspectionForm } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * เปิดใบตรวจใหม่ — เลือกแบบฟอร์มก่อนหนึ่งครั้ง (?template=) แล้วจึงลงคะแนนรายข้อ
 * เลือกแบบฟอร์มด้วยลิงก์ เพราะโครงรายการตรวจต้องดึงจาก server ใหม่ทั้งชุด
 */
export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; msg?: string; err?: string }>;
}) {
  const user = await requirePermission("INSP_ENTRY", "write");
  const params = await searchParams;

  const [templates, companies, branches] = await Promise.all([
    listTemplates(),
    listCompanies(true),
    listBranches(true),
  ]);

  const form = params.template ? await getForm(params.template) : null;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-800">เปิดใบตรวจสอบสาขาใหม่</h1>
        <Link href="/inspection/inspections" className="btn-secondary">
          ← กลับรายการ
        </Link>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {!form ? (
        <section className="card space-y-3">
          <h2 className="font-semibold text-slate-800">เลือกแบบฟอร์มที่จะใช้ตรวจ</h2>

          {templates.length === 0 ? (
            <p className="text-sm text-slate-600">
              ยังไม่มีแบบฟอร์มที่เปิดใช้งาน — ให้ผู้ดูแลระบบตั้งค่าที่หน้า “4. ตั้งค่ารายการตรวจ” ก่อน
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((t) => (
                <Link
                  key={t.id}
                  href={`/inspection/inspections/new?template=${t.id}`}
                  className="rounded-xl border border-slate-200 p-3 hover:border-brand-300"
                >
                  <p className="font-semibold text-slate-800">{t.name}</p>
                  {t.description && (
                    <p className="mt-0.5 text-sm text-slate-500">{t.description}</p>
                  )}
                  {t.bonus_threshold !== null && t.bonus_amount > 0 && (
                    <p className="mt-1 text-xs text-emerald-700">
                      ได้ตั้งแต่ {formatScore(t.bonus_threshold)} คะแนนขึ้นไป รับรางวัล{" "}
                      {t.bonus_amount.toLocaleString("th-TH")} บาท
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            ใช้แบบฟอร์ม <span className="font-medium text-slate-700">{form.template.name}</span> ·{" "}
            <Link href="/inspection/inspections/new" className="text-brand-700 hover:underline">
              เปลี่ยนแบบฟอร์ม
            </Link>
          </p>

          <InspectionForm
            form={form}
            companies={companies}
            branches={branches}
            action={saveInspectionForm}
            defaults={{
              inspect_date: workDateOf(),
              company_id: user.company_id ?? "",
              branch_id: "",
              inspector_name: user.full_name,
              note: "",
            }}
            submitLabel="ส่งผลการตรวจ"
          />
        </>
      )}
    </main>
  );
}
