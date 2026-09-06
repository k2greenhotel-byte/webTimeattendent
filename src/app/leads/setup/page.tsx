import { deleteStatusForm, saveStatusForm } from "@/app/leads/setup/actions";
import StatusSetup, { type SetupRow } from "@/components/lead/StatusSetup";
import { countStatusUsage, listChances, listWorkStatuses } from "@/lib/lead-db";
import { checkPermission, requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const PATH = "/leads/setup";

/** หน้าจอ 5 — ตั้งค่าสถานะงานและสถานะโอกาสการขาย */
export default async function LeadSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  await requirePermission("LEAD_SETUP", "read");

  const [statuses, chances, canWrite, canEdit, canDelete] = await Promise.all([
    listWorkStatuses(true),
    listChances(true),
    checkPermission("LEAD_SETUP", "write"),
    checkPermission("LEAD_SETUP", "edit"),
    checkPermission("LEAD_SETUP", "delete"),
  ]);

  // จำนวนใบงานที่ใช้แต่ละสถานะ — ใช้ตัดสินว่าลบได้ไหม และเตือนก่อนปิดใช้งาน
  const [statusRows, chanceRows] = await Promise.all([
    Promise.all(
      statuses.map(async (s): Promise<SetupRow> => ({
        ...s,
        usage: await countStatusUsage("work_status", s.code),
      })),
    ),
    Promise.all(
      chances.map(async (c): Promise<SetupRow> => ({
        ...c,
        usage: await countStatusUsage("chance", c.code),
      })),
    ),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">5. ตั้งค่าสถานะ</h1>
        <p className="text-sm text-slate-500">
          เพิ่ม/แก้ไขสถานะงานและสถานะโอกาสการขายได้เอง — ที่ตั้งไว้ที่นี่จะไปโผล่ในฟอร์มบันทึก Lead
          กระดานติดตาม และ dashboard ทันที
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {!canWrite && !canEdit && (
        <p className="card text-sm text-slate-600">
          บัญชีนี้ดูได้อย่างเดียว — ต้องมีสิทธิ์ “เพิ่ม/แก้ไข” เมนูตั้งค่าสถานะจึงจะแก้ได้
          (ผู้ดูแลระบบกำหนดให้ได้ที่ /core/program-rights)
        </p>
      )}

      <StatusSetup
        title="สถานะงาน"
        hint="ข้อ 1.10 — ขั้นของงานขาย เช่น ติดตามอีกครั้ง / ปิดการขายแล้ว · พฤติกรรมของสถานะเป็นตัวบอกระบบว่าต้องบังคับเลขที่สัญญาขายหรือต้องขึ้นรายการติดตามหรือไม่"
        rows={statusRows}
        editCode={params.edit ?? null}
        basePath={PATH}
        formKey="status"
        showKind
        canWrite={canWrite}
        canEdit={canEdit}
        canDelete={canDelete}
        saveAction={saveStatusForm}
        deleteAction={deleteStatusForm}
      />

      <StatusSetup
        title="สถานะโอกาสการขาย"
        hint="ข้อ 1.11 — ระดับโอกาสปิดการขาย พร้อมสีที่ใช้แยกลูกค้าบนกระดานติดตาม (ลำดับน้อยสุด = โอกาสสูงสุด ระบบใช้กลุ่มนี้เตือน “โอกาสสูงแต่เงียบนาน”)"
        rows={chanceRows}
        editCode={params.edit ?? null}
        basePath={PATH}
        formKey="chance"
        showKind={false}
        canWrite={canWrite}
        canEdit={canEdit}
        canDelete={canDelete}
        saveAction={saveStatusForm}
        deleteAction={deleteStatusForm}
      />
    </main>
  );
}
