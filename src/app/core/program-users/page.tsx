import Link from "next/link";
import ProgramUserPicker, { type PickerUser } from "@/components/core/ProgramUserPicker";
import {
  countUsersByProgram,
  listCoreUsers,
  listProgramUserIds,
  listPrograms,
} from "@/lib/core-db";
import { listBranches } from "@/lib/db";
import { grantAllUsersForm, saveProgramUsersForm } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProgramUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; msg?: string; err?: string }>;
}) {
  const params = await searchParams;

  const [programs, users, branches, counts] = await Promise.all([
    listPrograms(),
    listCoreUsers(),
    listBranches(),
    countUsersByProgram(),
  ]);

  const current = programs.find((p) => p.id === params.program) ?? programs[0] ?? null;
  const selected = current ? await listProgramUserIds(current.id) : [];

  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const pickerUsers: PickerUser[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    emp_code: u.emp_code,
    full_name: u.full_name,
    access_level: u.access_level,
    branch_name: u.branch_id ? (branchName.get(u.branch_id) ?? null) : null,
    is_active: u.is_active,
  }));

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">กำหนดผู้ใช้งานโปรแกรม</h1>
        <p className="text-sm text-slate-500">
          เลือกโปรแกรมหนึ่ง แล้วเพิ่ม-ลดผู้ใช้ที่ใช้โปรแกรมนั้นได้ทีเดียวทั้งชุด — บางโปรแกรมให้ทุกคนใช้
          (เช่น ระบบลงเวลา) บางโปรแกรมให้เฉพาะบางคน (เช่น ระบบการตลาด)
        </p>
      </div>

      {params.msg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.msg}</p>
      )}
      {params.err && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.err}</p>
      )}

      {/* ---------- เลือกโปรแกรม ---------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        {programs.map((p) => (
          <Link
            key={p.id}
            href={`/core/program-users?program=${p.id}`}
            className={`card block ${
              p.id === current?.id ? "border-brand-400 ring-2 ring-brand-100" : ""
            }`}
          >
            <p className="font-semibold text-slate-800">
              {p.icon} {p.name}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {p.code}
              {p.is_active ? "" : " · ปิดใช้งานอยู่"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              ใช้งานได้ <strong className="text-slate-800">{counts.get(p.id) ?? 0}</strong> /{" "}
              {users.length} คน
            </p>
          </Link>
        ))}
      </div>

      {!current && (
        <p className="card text-sm text-slate-600">
          ยังไม่มีโปรแกรมในระบบ — เพิ่มได้ที่{" "}
          <Link href="/core/programs" className="text-brand-600 hover:underline">
            ทะเบียนโปรแกรม
          </Link>
        </p>
      )}

      {current && (
        <>
          {/* ---------- ปุ่มลัด: ให้ทุกคนใช้ได้ ---------- */}
          <form action={grantAllUsersForm} className="card flex flex-wrap items-center gap-3">
            <input type="hidden" name="program_id" value={current.id} />
            <input type="hidden" name="program_name" value={current.name} />
            <div className="mr-auto">
              <h2 className="font-semibold text-slate-800">ให้ทุกคนใช้โปรแกรมนี้ได้</h2>
              <p className="text-sm text-slate-500">
                ใช้กับโปรแกรมที่พนักงานทุกคนต้องใช้ เช่น ระบบลงเวลา — กดแล้วรายชื่อด้านล่างจะถูกติ๊กครบทันที
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="active_only" defaultChecked />
              เฉพาะบัญชีที่ยังใช้งานได้
            </label>
            <button type="submit" className="btn-secondary">
              ให้สิทธิ์ทุกคน
            </button>
          </form>

          {/* ---------- เลือกรายคน ---------- */}
          <form action={saveProgramUsersForm} className="card space-y-4">
            <input type="hidden" name="program_id" value={current.id} />
            <input type="hidden" name="program_name" value={current.name} />

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-800">
                  ผู้ใช้งานของ {current.icon} {current.name}
                </h2>
                <p className="text-sm text-slate-500">
                  ติ๊ก = ใช้โปรแกรมนี้ได้ · เอาติ๊กออก = ถอดสิทธิ์ (สิทธิ์รายเมนูของคนนั้นยังอยู่
                  แค่เข้าโปรแกรมไม่ได้)
                </p>
              </div>
              <Link href="/core/users" className="text-sm text-brand-600 hover:underline">
                กำหนดรายคนแทน (มองจากฝั่งผู้ใช้) →
              </Link>
            </div>

            <ProgramUserPicker
              users={pickerUsers}
              defaultSelected={selected}
              programName={current.name}
            />

            <button type="submit" className="btn-primary">
              บันทึกผู้ใช้งานของโปรแกรมนี้
            </button>
          </form>
        </>
      )}
    </main>
  );
}
