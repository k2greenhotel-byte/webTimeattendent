import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getSessionUser } from "@/lib/session";

/** รับเฉพาะเส้นทางภายในเว็บนี้ (กัน open redirect) */
function safeNext(value: string | undefined): string | null {
  const path = (value ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  const user = await getSessionUser();
  if (user) redirect(next ?? "/apps");

  const forMarketing = next?.startsWith("/marketing") ?? false;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-2xl text-white">
            {forMarketing ? "📣" : "⏱"}
          </div>
          <h1 className="text-xl font-bold text-slate-800">
            {forMarketing ? "ระบบกิจกรรมการตลาด" : "ระบบลงเวลาเข้า-ออกงาน"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">เข้าสู่ระบบด้วยเบอร์มือถือและรหัสผ่าน</p>
        </div>

        {params.msg && (
          <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {params.msg}
          </p>
        )}

        <LoginForm next={next ?? undefined} />

        <p className="mt-4 text-center text-sm">
          <a href="/login/change-pin" className="text-brand-600 hover:underline">
            เปลี่ยนรหัสผ่าน / PIN ของฉัน
          </a>
        </p>

        {!forMarketing && (
          <p className="mt-2 text-center text-sm text-slate-500">
            <a href="/marketing" className="text-brand-600 hover:underline">
              ระบบกิจกรรมการตลาด →
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
