"use server";

import { redirect } from "next/navigation";
import { getSelectableContext } from "@/lib/core-db";
import { requireUser, setWorkContext } from "@/lib/session";

/** รับเฉพาะเส้นทางภายในเว็บนี้ (กัน open redirect) */
function safeNext(value: unknown): string | null {
  const path = String(value ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export async function selectContextAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const companyId = String(form.get("company_id") ?? "").trim();
  const branchId = String(form.get("branch_id") ?? "").trim();
  const next = safeNext(form.get("next")) ?? "/apps";

  const { companies, branches } = await getSelectableContext(user.id);

  const company = companies.find((c) => c.id === companyId);
  if (!company) redirect("/select-context?err=" + encodeURIComponent("ไม่มีสิทธิ์เข้าบริษัทที่เลือก"));

  const branch = branches.find((b) => b.id === branchId && b.company_id === company.id);
  if (branchId && !branch) {
    redirect("/select-context?err=" + encodeURIComponent("ไม่มีสิทธิ์เข้าสาขาที่เลือก"));
  }

  await setWorkContext({
    company_id: company.id,
    company_name: company.name,
    branch_id: branch?.id ?? null,
    branch_name: branch?.name ?? null,
  });

  redirect(next);
}
