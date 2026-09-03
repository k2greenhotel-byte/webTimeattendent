import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // หน้ารวมโปรแกรมจะเลือกให้เองว่าคนนี้เข้าโปรแกรมไหนได้บ้าง
  redirect("/apps");
}
