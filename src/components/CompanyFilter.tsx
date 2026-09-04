import type { Company } from "@/lib/core-types";

/**
 * ช่องเลือกบริษัทสำหรับหน้าจอระบบลงเวลา
 * ถ้ามีบริษัทเดียวจะไม่แสดงเป็นช่องเลือก แต่ส่งค่าไปกับฟอร์มด้วย hidden field
 * (จอมือถือมีที่จำกัด ไม่ควรเปลืองพื้นที่กับตัวเลือกที่เลือกอะไรไม่ได้)
 */
export default function CompanyFilter({
  companies,
  value,
  name = "company",
}: {
  companies: Company[];
  value?: string | null;
  name?: string;
}) {
  if (companies.length <= 1) {
    return value ? <input type="hidden" name={name} value={value} /> : null;
  }

  return (
    <div className="min-w-44 flex-1 sm:flex-none">
      <label className="label" htmlFor={name}>
        บริษัท
      </label>
      <select id={name} name={name} defaultValue={value ?? ""} className="input">
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
