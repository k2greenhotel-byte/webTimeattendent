import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getSessionUser } from "@/lib/session";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/punch");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-2xl text-white">
            ⏱
          </div>
          <h1 className="text-xl font-bold text-slate-800">ระบบลงเวลาเข้า-ออกงาน</h1>
          <p className="mt-1 text-sm text-slate-500">กรอกรหัสพนักงานและ PIN 4 หลัก</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
