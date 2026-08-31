import { zipSync, strToU8 } from "fflate";

/**
 * ตัวสร้างไฟล์ Excel (.xlsx) ขนาดเล็ก ใช้ได้ทั้งบน Node และ Cloudflare Workers
 * (ไลบรารีอย่าง exceljs ใช้ Node API ที่ Workers ไม่รองรับ จึงเขียนเองแบบเบา ๆ)
 */

export type SheetData = {
  sheetName: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: string[];
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // ตัดอักขระควบคุมที่ XML ไม่รับ
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** 0 -> A, 25 -> Z, 26 -> AA */
function columnName(index: number): string {
  let name = "";
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode((n % 26) + 65) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

function cell(col: number, row: number, value: string | number, style: number): string {
  const ref = `${columnName(col)}${row}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(value ?? ""))}</t></is></c>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

/** style 0 = ปกติ, 1 = หัวข้อใหญ่ (ตัวหนา), 2 = หัวตาราง (ตัวหนา + พื้นฟ้า + เส้นขอบ), 3 = เซลล์ข้อมูล */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="11"/><name val="Sarabun"/></font>
<font><b/><sz val="11"/><name val="Sarabun"/></font>
<font><b/><sz val="14"/><name val="Sarabun"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9EBFF"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
</cellXfs>
</styleSheet>`;

const WORKBOOK = (sheetName: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

function buildSheet(data: SheetData): string {
  const colCount = Math.max(1, data.headers.length);

  const cols = data.headers
    .map((header, i) => {
      const longest = Math.max(
        header.length,
        ...data.rows.map((r) => String(r[i] ?? "").length),
        0,
      );
      const width = Math.min(30, Math.max(10, longest + 2));
      return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
    })
    .join("");

  const lines: string[] = [];
  let rowNum = 1;

  lines.push(`<row r="${rowNum}">${cell(0, rowNum, data.title, 1)}</row>`);
  rowNum += 1;
  rowNum += 1; // เว้นบรรทัดว่าง

  lines.push(
    `<row r="${rowNum}">${data.headers.map((h, i) => cell(i, rowNum, h, 2)).join("")}</row>`,
  );
  rowNum += 1;

  for (const row of data.rows) {
    lines.push(
      `<row r="${rowNum}">${row.map((v, i) => cell(i, rowNum, v, 3)).join("")}</row>`,
    );
    rowNum += 1;
  }

  if (data.summary?.length) {
    rowNum += 1;
    for (const line of data.summary) {
      lines.push(`<row r="${rowNum}">${cell(0, rowNum, line, 1)}</row>`);
      rowNum += 1;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData>${lines.join("")}</sheetData>
<pageSetup orientation="landscape"/>
</worksheet>`.replace("<cols></cols>", `<cols><col min="1" max="${colCount}" width="14"/></cols>`);
}

export function buildXlsx(data: SheetData): Uint8Array<ArrayBuffer> {
  const zipped = zipSync(
    {
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      "_rels/.rels": strToU8(ROOT_RELS),
      "xl/workbook.xml": strToU8(WORKBOOK(data.sheetName)),
      "xl/_rels/workbook.xml.rels": strToU8(WORKBOOK_RELS),
      "xl/styles.xml": strToU8(STYLES),
      "xl/worksheets/sheet1.xml": strToU8(buildSheet(data)),
    },
    { level: 6 },
  );

  // คัดลอกลง ArrayBuffer ปกติ เพื่อให้ส่งเป็น response body ได้ทุก runtime
  const out = new Uint8Array(zipped.length);
  out.set(zipped);
  return out;
}
