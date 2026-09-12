import PaymentPrintView from "@/components/procurement/PaymentPrintView";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { id } = await params;
  const { auto } = await searchParams;
  return <PaymentPrintView auto={auto === "1"} source="fund" id={id} />;
}
