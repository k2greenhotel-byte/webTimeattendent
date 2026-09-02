import Link from "next/link";

const NAV = [
  { href: "/marketing", label: "หน้าแรก" },
  { href: "/marketing/activities", label: "1. บันทึกกิจกรรม" },
  { href: "/marketing/submit", label: "2. ส่งเรื่องเบิกเงิน" },
  { href: "/marketing/receive", label: "3. รับเงิน" },
  { href: "/marketing/setup", label: "4. ค่าเริ่มต้น" },
  { href: "/marketing/search", label: "5. สอบถาม" },
  { href: "/marketing/dashboard", label: "6. Dashboard" },
];

export default function MarketingHeader() {
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="mr-auto">
          <p className="text-sm font-semibold text-slate-800">ระบบกิจกรรมการตลาด</p>
          <p className="text-xs text-slate-500">บันทึกกิจกรรม · คุมการเบิกเงินค่าส่งเสริมกับบริษัทรถ</p>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
