import Link from "next/link";
import LoginChangePinForm from "@/components/LoginChangePinForm";

export const dynamic = "force-dynamic";

/** เปลี่ยนรหัสผ่าน/PIN ด้วยตัวเองจากหน้าล็อกอิน — ไม่ต้องเข้าระบบก่อน */
export default function ChangePinPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-2xl text-white">
            🔑
          </div>
          <h1 className="text-xl font-bold text-slate-800">เปลี่ยนรหัสผ่าน</h1>
          <p className="mt-1 text-sm text-slate-500">ยืนยันด้วยเบอร์มือถือและรหัสผ่านเดิม</p>
        </div>

        <LoginChangePinForm />

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="text-brand-600 hover:underline">
            ← กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}
