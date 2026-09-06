import PaymentNewView from "@/components/procurement/PaymentNewView";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; msg?: string }>;
}) {
  return <PaymentNewView source="central" params={await searchParams} />;
}
