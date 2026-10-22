import type { Workbook, Worksheet, CellValue } from 'exceljs';
import { foldVi } from './format.util';

// ExcelJS is ~1 MB — load it only when someone exports or imports.
async function loadExcel() {
  const mod = await import('exceljs');
  return (mod as unknown as { default?: typeof mod }).default ?? mod;
}

export interface SheetColumn {
  header: string;
  width?: number;
  required?: boolean;
  numFmt?: string;
}

export interface SheetSpec {
  name: string;
  columns: SheetColumn[];
  rows: unknown[][];
  // Optional plain-text notes sheet (rules, allowed values).
  notes?: { title: string; lines: string[] };
}

const HEADER_FILL = 'FFE9ECE4'; // paper-3, so the file reads like the app
const REQUIRED_FONT = 'FFB3261E'; // danger

function addSheet(wb: Workbook, spec: SheetSpec): void {
  const ws = wb.addWorksheet(spec.name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = spec.columns.map((c) => ({
    header: c.required ? `${c.header} *` : c.header,
    width: c.width ?? Math.max(12, c.header.length + 4),
    style: c.numFmt ? { numFmt: c.numFmt } : {},
  }));
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: 'middle' };
  head.height = 22;
  spec.columns.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    if (c.required) cell.font = { bold: true, color: { argb: REQUIRED_FONT } };
  });
  for (const r of spec.rows) ws.addRow(r);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: spec.columns.length } };

  if (spec.notes) {
    const ns = wb.addWorksheet('Hướng dẫn');
    ns.getColumn(1).width = 110;
    ns.addRow([spec.notes.title]).font = { bold: true, size: 13 };
    ns.addRow([]);
    for (const line of spec.notes.lines) ns.addRow([line]);
  }
}

export async function downloadWorkbook(fileName: string, sheets: SheetSpec[]): Promise<void> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ninh Trang ERP';
  wb.created = new Date();
  for (const s of sheets) addSheet(wb, s);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function plainValue(v: CellValue): string | number | boolean | Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return plainValue(v.result as CellValue);
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text);
    if ('error' in v) return null;
  }
  return v as string | number | boolean | Date;
}

export interface SheetRow {
  rowNumber: number; // as Excel shows it, for error messages
  cells: Map<string, string | number | boolean | Date | null>; // keyed by folded header
}

export function headerKey(header: string): string {
  return foldVi(header.replace(/\*/g, '').trim());
}

// Reads the first sheet (or `sheetName`) into rows keyed by header text.
export async function readSheet(file: File, sheetName?: string): Promise<{ headers: string[]; rows: SheetRow[] }> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await file.arrayBuffer()) as never);
  const ws: Worksheet | undefined = (sheetName && wb.getWorksheet(sheetName)) || wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = headerKey(String(plainValue(cell.value) ?? ''));
  });

  const rows: SheetRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells = new Map<string, string | number | boolean | Date | null>();
    let hasValue = false;
    headers.forEach((h, i) => {
      if (!h) return;
      const v = plainValue(row.getCell(i + 1).value);
      if (v !== null && String(v).trim() !== '') hasValue = true;
      cells.set(h, v);
    });
    if (hasValue) rows.push({ rowNumber, cells });
  });
  return { headers: headers.filter(Boolean), rows };
}

/**
 * Tên file xuất: "Đơn hàng bán - 22-10-2026 14h35.xlsx" — tên tiếng Việt có dấu, theo sau là ngày giờ xuất
 * (giờ máy người dùng). Không dùng ":" và "/" vì Windows không cho phép trong tên file.
 */
export function exportFileName(title: string, now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${p(now.getDate())}-${p(now.getMonth() + 1)}-${now.getFullYear()} ${p(now.getHours())}h${p(now.getMinutes())}`;
  return `${title.replace(/[\\/:*?"<>|]/g, '-').trim()} - ${stamp}.xlsx`;
}
