import PaymentListView from "@/components/procurement/PaymentListView";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; msg?: string; err?: string }>;
}) {
  return <PaymentListView source="central" params={await searchParams} />;
}
