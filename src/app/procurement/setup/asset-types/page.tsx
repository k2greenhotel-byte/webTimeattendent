import PrTypeSetup from "@/components/procurement/PrTypeSetup";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** ตั้งค่า ประเภททรัพย์สิน (ข้อ 1.1.6) */
export default async function AssetTypeSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requirePermission("PR_ASSET_TYPE", "read");
  const params = await searchParams;
  return <PrTypeSetup kind="asset" params={params} />;
}
