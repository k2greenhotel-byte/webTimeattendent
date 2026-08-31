import type { Branch } from "@/lib/types";

/** ตัวกรองสาขา (ใช้ในฟอร์ม GET ของหน้ารายงาน) */
export default function BranchFilter({
  branches,
  value,
}: {
  branches: Branch[];
  value?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor="branch">
        สาขา
      </label>
      <select id="branch" name="branch" defaultValue={value ?? ""} className="input">
        <option value="">ทุกสาขา</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.code} · {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
