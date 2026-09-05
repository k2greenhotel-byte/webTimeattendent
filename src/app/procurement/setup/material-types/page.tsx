import PrTypeSetup from "@/components/procurement/PrTypeSetup";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** ตั้งค่า ประเภทวัสดุ (ข้อ 1.3.8) */
export default async function MaterialTypeSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requirePermission("PR_MATERIAL_TYPE", "read");
  const params = await searchParams;
  return <PrTypeSetup kind="material" params={params} />;
}
