import Link from "next/link";
import ActivityForm from "@/components/marketing/ActivityForm";
import { getStaffIdForEmployee, listMaster } from "@/lib/marketing-db";
import { requireUser } from "@/lib/session";
import { createActivityForm } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const [staff, companies, activityTypes, defaultStaffId] = await Promise.all([
    listMaster("staff"),
    listMaster("company"),
    listMaster("activityType"),
    getStaffIdForEmployee(user.id),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">บันทึกงานกิจกรรมใหม่</h1>
        <p className="text-sm text-slate-500">
          เลขที่เอกสารระบบออกให้อัตโนมัติตามปี พ.ศ. ของวันที่จัดกิจกรรม ·{" "}
          <Link href="/marketing/activities" className="text-brand-600 hover:underline">
            กลับไปรายการ
          </Link>
        </p>
      </div>

      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {companies.length === 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ยังไม่มีรายชื่อบริษัทที่ขอเบิก —{" "}
          <Link href="/marketing/setup" className="font-medium underline">
            เพิ่มที่หน้าค่าเริ่มต้น
          </Link>{" "}
          ก่อนเพื่อให้เลือกได้
        </p>
      )}

      <ActivityForm
        action={createActivityForm}
        staff={staff}
        companies={companies}
        activityTypes={activityTypes}
        defaultStaffId={defaultStaffId}
      />
    </main>
  );
}
