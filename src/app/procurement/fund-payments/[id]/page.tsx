import PaymentDetailView from "@/components/procurement/PaymentDetailView";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { id } = await params;
  return <PaymentDetailView source="fund" id={id} query={await searchParams} />;
}
