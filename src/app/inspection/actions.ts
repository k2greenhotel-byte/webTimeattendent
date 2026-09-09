"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBranchById, logAudit } from "@/lib/db";
import { listCompanies } from "@/lib/core-db";
import { validateInspection, validateResult } from "@/lib/inspection";
import {
  createInspection,
  deleteInspection,
  getForm,
  getInspection,
  listResults,
  setInspectionStatus,
  updateInspection,
} from "@/lib/inspection-db";
import type { InspResultInput, InspStatus, InspectionInput } from "@/lib/inspection-types";
import { requirePermission } from "@/lib/session";

const LIST_PATH = "/inspection/inspections";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optText(form: FormData, key: string): string | null {
  return str(form, key) || null;
}

function back(path: string, message: string, isError = false): never {
  redirect(`${path}?${isError ? "err" : "msg"}=${encodeURIComponent(message)}`);
}

function statusOf(form: FormData): InspStatus {
  return str(form, "status") === "submitted" ? "submitted" : "draft";
}

/**
 * ประกอบผลรายข้อจากฟอร์ม โดย **อ่านคะแนนจากแบบฟอร์มในฐานข้อมูลเสมอ**
 * ไม่เชื่อคะแนนที่ browser ส่งมา (ผู้ใช้แก้ค่าในหน้าเว็บได้)
 * ค่าปรับรับจากฟอร์มได้ เพราะผู้ตรวจต้องกรอกจำนวนเงินจริงบางกรณี
 */
async function readResults(
  form: FormData,
  templateId: string,
): Promise<{ results: InspResultInput[]; problem: string | null; templateName: string; templateCode: string | null }> {
  const built = await getForm(templateId);
  if (!built) {
    return { results: [], problem: "ไม่พบแบบฟอร์มที่เลือก", templateName: "", templateCode: null };
  }

  const results: InspResultInput[] = [];
  let problem: string | null = null;

  for (const section of built.sections) {
    for (const item of section.items) {
      const photos = form
        .getAll(`photo_${item.id}`)
        .map((v) => String(v).trim())
        .filter(Boolean);

      const fine = Number(str(form, `fine_${item.id}`) || "0");
      const note = optText(form, `note_${item.id}`);

      let optionId: string | null = null;
      let optionLabel: string | null = null;
      let score = 0;

      if (item.item_type === "choice") {
        const picked = str(form, `opt_${item.id}`);
        const option = item.options.find((o) => o.id === picked);
        if (option) {
          optionId = option.id;
          optionLabel = option.label;
          score = option.score;
        }
      } else {
        const raw = str(form, `score_${item.id}`);
        score = raw === "" ? -1 : Number(raw);
        // ยังไม่ได้ให้คะแนน — ปล่อยเป็น 0 แล้วให้ validateResult เตือนตอนกดส่งผล
        if (score < 0) score = 0;
        optionLabel = raw === "" ? null : `${raw} คะแนน`;
      }

      const result: InspResultInput = {
        item_id: item.id,
        section_name: section.name,
        section_sort: section.sort_order,
        item_name: item.name,
        item_type: item.item_type,
        option_id: optionId,
        option_label: optionLabel,
        score,
        max_score: item.maxScore,
        fine_amount: Number.isFinite(fine) && fine > 0 ? fine : 0,
        note,
        sort_order: item.sort_order,
        photos,
      };

      if (!problem) problem = validateResult(result, item);
      results.push(result);
    }
  }

  return {
    results,
    problem,
    templateName: built.template.name,
    templateCode: built.template.code,
  };
}

/** บันทึกใบตรวจใหม่ หรือแก้ไขใบเดิม (ปุ่ม "เก็บฉบับร่าง" / "บันทึกใบตรวจ") */
export async function saveInspectionForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const user = await requirePermission("INSP_ENTRY", id ? "edit" : "write");

  const templateId = str(form, "template_id");
  const backPath = id ? `${LIST_PATH}/${id}` : `${LIST_PATH}/new?template=${templateId}`;

  const status = statusOf(form);
  const branchId = optText(form, "branch_id");
  const companyId = optText(form, "company_id");
  const inspectDate = str(form, "inspect_date");

  const { results, problem, templateName, templateCode } = await readResults(form, templateId);
  if (!templateName) back(backPath, "ไม่พบแบบฟอร์มที่เลือก กรุณาเลือกใหม่", true);

  const headerProblem = validateInspection({
    branch_id: branchId,
    inspect_date: inspectDate,
    results,
  });
  if (headerProblem) back(backPath, headerProblem, true);

  // ฉบับร่างยอมให้ยังตรวจไม่ครบ — ตรวจครบเมื่อกดส่งผลเท่านั้น
  if (status === "submitted" && problem) back(backPath, problem, true);

  const [branch, companies] = await Promise.all([
    getBranchById(branchId),
    companyId ? listCompanies() : Promise.resolve([]),
  ]);
  const company = companies.find((c) => c.id === companyId) ?? null;

  const input: InspectionInput = {
    inspect_date: inspectDate,
    template_id: templateId,
    template_code: templateCode,
    template_name: templateName,
    company_id: companyId,
    company_name: company?.name ?? null,
    branch_id: branchId,
    branch_name: branch?.name ?? null,
    inspector_id: user.id,
    inspector_name: optText(form, "inspector_name") ?? user.full_name,
    status,
    note: optText(form, "note"),
  };

  let savedId = id;
  try {
    if (id) {
      await updateInspection(id, input, results);
    } else {
      savedId = (await createInspection(input, results, user.id)).id;
    }

    await logAudit({
      actor_id: user.id,
      action: id ? "แก้ไขใบตรวจสอบสาขา" : "บันทึกใบตรวจสอบสาขา",
      target_table: "insp_inspections",
      target_id: savedId || null,
      after: { branch: branch?.name ?? null, date: inspectDate, status },
    });
  } catch (err) {
    back(backPath, err instanceof Error ? err.message : "บันทึกใบตรวจไม่สำเร็จ", true);
  }

  revalidatePath(LIST_PATH);
  revalidatePath("/inspection/dashboard");
  back(
    `${LIST_PATH}/${savedId}`,
    status === "submitted" ? "ส่งผลการตรวจเรียบร้อยแล้ว" : "เก็บฉบับร่างเรียบร้อยแล้ว",
  );
}

/** เปลี่ยนสถานะใบ (ส่งผล / กลับเป็นฉบับร่าง / ยกเลิกใบ) */
export async function setStatusForm(form: FormData): Promise<void> {
  const user = await requirePermission("INSP_ENTRY", "edit");
  const id = str(form, "id");
  const status = str(form, "to") as InspStatus;

  if (!["draft", "submitted", "cancelled"].includes(status)) {
    back(`${LIST_PATH}/${id}`, "สถานะที่ส่งมาไม่ถูกต้อง", true);
  }

  // ส่งผลได้ต่อเมื่อตรวจครบทุกข้อที่บังคับแล้ว
  if (status === "submitted") {
    const inspection = await getInspection(id);
    if (!inspection) back(LIST_PATH, "ไม่พบใบตรวจนี้", true);

    const [results, built] = await Promise.all([
      listResults(id),
      inspection.template_id ? getForm(inspection.template_id) : Promise.resolve(null),
    ]);
    const items = built?.sections.flatMap((s) => s.items) ?? [];

    for (const r of results) {
      const item = items.find((i) => i.id === r.item_id);
      const problem = validateResult(
        { ...r, item_type: r.item_type, option_id: r.option_id, photos: r.photos },
        item ?? { name: r.item_name, require_photo: false },
      );
      if (problem) back(`${LIST_PATH}/${id}`, problem, true);
    }
  }

  try {
    await setInspectionStatus(id, status);
    await logAudit({
      actor_id: user.id,
      action: "เปลี่ยนสถานะใบตรวจสอบสาขา",
      target_table: "insp_inspections",
      target_id: id,
      after: { status },
    });
  } catch (err) {
    back(`${LIST_PATH}/${id}`, err instanceof Error ? err.message : "เปลี่ยนสถานะไม่สำเร็จ", true);
  }

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath("/inspection/dashboard");
  back(`${LIST_PATH}/${id}`, "เปลี่ยนสถานะเรียบร้อยแล้ว");
}

/** ลบใบตรวจทั้งใบ พร้อมรูปทั้งหมด — ต้องติ๊กยืนยันก่อน */
export async function deleteInspectionForm(form: FormData): Promise<void> {
  const user = await requirePermission("INSP_ENTRY", "delete");
  const id = str(form, "id");

  if (str(form, "confirm") !== "on") {
    back(`${LIST_PATH}/${id}`, "กรุณาติ๊กยืนยันก่อนลบใบตรวจ", true);
  }

  const inspection = await getInspection(id);
  if (!inspection) back(LIST_PATH, "ไม่พบใบตรวจที่ต้องการลบ", true);

  try {
    const { filesDeleted } = await deleteInspection(id);
    await logAudit({
      actor_id: user.id,
      action: "ลบใบตรวจสอบสาขา",
      target_table: "insp_inspections",
      target_id: id,
      before: {
        doc_no: inspection.doc_no,
        branch: inspection.branch_name,
        date: inspection.inspect_date,
        photos_deleted: filesDeleted,
      },
    });
  } catch (err) {
    back(`${LIST_PATH}/${id}`, err instanceof Error ? err.message : "ลบใบตรวจไม่สำเร็จ", true);
  }

  revalidatePath(LIST_PATH);
  revalidatePath("/inspection/dashboard");
  back(LIST_PATH, `ลบใบตรวจ ${inspection.doc_no} แล้ว`);
}
