import Link from "next/link";
import { logoutAction } from "@/app/login/actions";

export type NavLink = { href: string; label: string };

type Props = {
  /** ชื่อโปรแกรม เช่น "ระบบกิจกรรมการตลาด" */
  title: string;
  /** บรรทัดล่าง เช่น รหัสพนักงาน · บริษัท · สาขา */
  subtitle?: React.ReactNode;
  /** ชื่อผู้ใช้ที่ล็อกอินอยู่ (ต่อท้ายชื่อโปรแกรมบนจอใหญ่) */
  userName?: string;
  links: NavLink[];
  /** ลิงก์กลับไปหน้ารวมโปรแกรม — ส่ง null ถ้าไม่ต้องการ */
  appsLink?: NavLink | null;
  /** แอ็กชันออกจากระบบ — หลังบ้าน /admin ใช้คนละตัวกับฝั่งพนักงาน */
  onLogout?: (form: FormData) => Promise<void>;
};

/**
 * แถบเมนูกลางของทุกโปรแกรม
 *
 * จอเล็กและแท็บเล็ต (< lg) ยุบเป็นเมนูแฮมเบอร์เกอร์ด้วย <details> ล้วน ๆ ไม่ต้องใช้ JavaScript
 * จึงทำงานได้ทันทีตั้งแต่ HTML ชุดแรก และไม่เพิ่มขนาด bundle ฝั่งผู้ใช้
 * จอใหญ่ (>= lg) แสดงลิงก์เรียงแนวนอนเหมือนเดิม
 */
export default function ModuleNav({
  title,
  subtitle,
  userName,
  links,
  appsLink,
  onLogout = logoutAction,
}: Props) {
  const allLinks = appsLink ? [...links, appsLink] : links;

  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white">
      {/* ---------- มือถือ: ยุบเป็นเมนูแฮมเบอร์เกอร์ ---------- */}
      <details className="group lg:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
            <p className="truncate text-xs text-slate-500">
              {userName}
              {userName && subtitle ? " · " : ""}
              {subtitle}
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-600">
            <svg
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
            <span className="sr-only">เปิด/ปิดเมนู</span>
          </span>
        </summary>

        <nav className="flex flex-col gap-0.5 border-t border-slate-100 px-2 pb-3 pt-2">
          {allLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl px-3 py-3 text-sm text-slate-700 active:bg-slate-100"
            >
              {l.label}
            </Link>
          ))}
          <form action={onLogout}>
            <button
              type="submit"
              className="w-full rounded-xl px-3 py-3 text-left text-sm text-rose-600 active:bg-rose-50"
            >
              ออกจากระบบ
            </button>
          </form>
        </nav>
      </details>

      {/* ---------- จอใหญ่: เมนูเรียงแนวนอน ---------- */}
      <div className="mx-auto hidden max-w-7xl flex-wrap items-center gap-3 px-4 py-3 lg:flex">
        <div className="mr-auto min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            {title}
            {userName && <span className="ml-2 font-normal text-slate-500">· {userName}</span>}
          </p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {l.label}
            </Link>
          ))}
          {appsLink && (
            <Link
              href={appsLink.href}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              {appsLink.label}
            </Link>
          )}
          <form action={onLogout}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
            >
              ออกจากระบบ
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
