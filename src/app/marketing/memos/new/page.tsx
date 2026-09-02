import Link from "next/link";
import MemoForm from "@/components/marketing/MemoForm";
import { getStaffIdForEmployee, listMaster } from "@/lib/marketing-db";
import { requireUser } from "@/lib/session";
import { createMemoForm } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewMemoPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();

  const [companies, staff, defaultStaffId] = await Promise.all([
    listMaster("company"),
    listMaster("staff"),
    getStaffIdForEmployee(user.id),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">เพิ่ม Memo ใหม่</h1>
        <p className="text-sm text-slate-500">
          เลขที่ระบบออกให้อัตโนมัติตามปี พ.ศ. ของวันที่ Memo ·{" "}
          <Link href="/marketing/memos" className="text-brand-600 hover:underline">
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
          </Link>
        </p>
      )}

      <MemoForm
        action={createMemoForm}
        companies={companies}
        staff={staff}
        defaultStaffId={defaultStaffId}
      />
    </main>
  );
}
