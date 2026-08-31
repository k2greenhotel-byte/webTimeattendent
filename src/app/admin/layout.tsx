import AdminHeader from "@/components/AdminHeader";
import { isAdminAuthed } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // ยังไม่ผ่าน PIN → หน้า /admin จะแสดงจอกรอก PIN เอง (เส้นทางย่อยถูก middleware ส่งกลับมาที่ /admin)
  if (!(await isAdminAuthed())) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <AdminHeader />
      {children}
    </div>
  );
}
