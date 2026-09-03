import BranchManager from "@/components/core/BranchManager";

export const dynamic = "force-dynamic";

export default async function CoreBranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  return <BranchManager basePath="/core/branches" message={params.msg} error={params.err} />;
}
