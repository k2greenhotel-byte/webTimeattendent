import BranchManager from "@/components/core/BranchManager";

export const dynamic = "force-dynamic";

/** ทางเข้าเดิมจากหลังบ้านลงเวลา — ใช้หน้าจอเดียวกับระบบส่วนกลาง */
export default async function AdminBranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  return <BranchManager basePath="/admin/branches" message={params.msg} error={params.err} />;
}
