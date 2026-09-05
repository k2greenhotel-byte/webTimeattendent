import DocFilters, { queryFromParams, type PrParams } from "@/components/procurement/DocFilters";
import DocTable, { docHref } from "@/components/procurement/DocTable";
import { listCompanies } from "@/lib/core-db";
import { workDateOf } from "@/lib/datetime";
import { listBranches } from "@/lib/db";
import { listDocs } from "@/lib/procurement-db";

export const dynamic = "force-dynamic";

/** หน้าจอ 5 — สอบถามงานซ่อม/งานขอซื้อ กรองได้ทุกมิติตามสเปก */
export default async function ProcurementSearchPage({
  searchParams,
}: {
  searchParams: Promise<PrParams>;
}) {
  const params = await searchParams;
  const query = queryFromParams(params);

  const [rows, companies, branches] = await Promise.all([
    listDocs(query),
    listCompanies(true),
    listBranches(true),
  ]);

  const today = workDateOf();
  const hasFilter = Object.values(params).some(Boolean);

  return (
    <main className="mx-auto max-w-[110rem] space-y-4 p-3 sm:p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">5. สอบถามงานซ่อม/งานขอซื้อ</h1>
        <p className="text-sm text-slate-500">
          ค้นหาได้ตามความเร่งด่วน บริษัท สาขา สถานะงาน หรือสถานะอื่น ๆ พร้อมกัน
        </p>
      </div>

      <DocFilters params={params} companies={companies} branches={branches} resetHref="/procurement/search" />

      <section className="card space-y-3">
        <h2 className="font-semibold text-slate-800">ผลการค้นหา ({rows.length} รายการ)</h2>
        <DocTable
          rows={rows}
          today={today}
          showKind
          hrefOf={docHref}
          emptyText={hasFilter ? "ไม่พบเอกสารที่ตรงกับเงื่อนไข" : "ยังไม่มีเอกสารในระบบ"}
        />
      </section>
    </main>
  );
}
