import { ExportDatum, RecordImportRow } from '../../core/models/einvoice.models';
import { SheetColumn, SheetRow, parseDay } from '../../shared/excel.util';

// File trao đổi với cổng hoá đơn của nhà cung cấp (MISA…): xuất dữ liệu bán hàng để nhập lên cổng, đọc số hoá đơn từ danh sách hoá
// đơn đã phát hành trên cổng. Cổng nhập Excel theo bước ghép cột nên file xuất không cần khớp một mẫu cố định.

export const EXPORT_COLUMNS: SheetColumn[] = [
  { header: 'Mã tham chiếu', width: 20 },
  { header: 'Số thứ tự hoá đơn', width: 12 },
  { header: 'Ngày hoá đơn', width: 14 },
  { header: 'Tên người mua', width: 22 },
  { header: 'Tên đơn vị', width: 28 },
  { header: 'Mã số thuế', width: 16 },
  { header: 'Địa chỉ', width: 36 },
  { header: 'Email', width: 24 },
  { header: 'Tên hàng hoá, dịch vụ', width: 36 },
  { header: 'Tính chất', width: 18 },
  { header: 'ĐVT', width: 10 },
  { header: 'Số lượng', width: 10, numFmt: '#,##0.####' },
  { header: 'Đơn giá', width: 14, numFmt: '#,##0' },
  { header: 'Thành tiền', width: 16, numFmt: '#,##0' },
  { header: 'Thuế suất (%)', width: 12 },
  { header: 'Tiền thuế', width: 14, numFmt: '#,##0' },
];

const NATURE: Record<number, string> = { 1: 'Hàng hoá, dịch vụ', 2: 'Khuyến mại', 3: 'Chiết khấu thương mại', 4: 'Ghi chú' };

/** Dòng Excel của các hoá đơn: mỗi dòng hàng một dòng, các dòng của một hoá đơn dùng chung số thứ tự và thông tin người mua. */
export function exportRows(data: ExportDatum[]): unknown[][] {
  const rows: unknown[][] = [];
  let no = 0;
  for (const d of data) {
    const inv = d.invoice;
    if (!inv) continue;
    no++;
    const b = inv.buyer;
    for (const l of inv.lines) {
      const rate = l.vat !== undefined && /^\d+$/.test(l.vat) ? Number(l.vat) : null;
      rows.push([
        d.ref, no, inv.issueDate.split('-').reverse().join('/'), b.name, b.companyName, b.taxCode || b.idNumber, b.address, b.email,
        l.name, NATURE[l.nature] ?? '', l.unit, l.quantity ?? null, l.unitPrice ?? null, l.amount,
        rate ?? (l.vat ?? ''), rate === null ? null : Math.round((l.amount * rate) / 100),
      ]);
    }
  }
  return rows;
}

export const EXPORT_NOTES = {
  title: 'Dữ liệu bán hàng để lập hoá đơn trên cổng của nhà cung cấp',
  lines: [
    'Mỗi dòng là một dòng hàng. Các dòng có cùng "Số thứ tự hoá đơn" thuộc một hoá đơn.',
    'Cột "Mã tham chiếu" (số đơn, hoặc số đơn#số đợt giao) dùng để khớp lại số hoá đơn sau khi phát hành: hãy ghép cột này vào ô ghi chú / diễn giải / số chứng từ tham chiếu của hoá đơn khi nhập lên cổng, và giữ nguyên.',
    'Tiền thuế mỗi dòng làm tròn theo thuế suất của dòng; cổng sẽ tính lại tổng thuế khi lập hoá đơn, có thể lệch vài đồng so với hoá đơn trong phần mềm.',
    'Phần mềm này không phát hành hoá đơn có giá trị pháp lý: lập và ký hoá đơn trên cổng của nhà cung cấp, rồi quay lại ghi nhận số hoá đơn (nhập tay hoặc nhập danh sách hoá đơn từ cổng).',
  ],
};

// Tiêu đề cột thường gặp của danh sách hoá đơn xuất từ cổng (đã bỏ dấu, chữ thường): cột nào khớp trước thì dùng.
export const IMPORT_COLS = {
  ref: ['ma tham chieu', 'tham chieu', 'so tham chieu', 'ma don hang', 'so don hang', 'so chung tu', 'dien giai', 'ghi chu', 'noi dung'],
  series: ['ky hieu', 'ky hieu hoa don', 'mau so ky hieu', 'serial'],
  number: ['so hoa don', 'so hd', 'so'],
  date: ['ngay hoa don', 'ngay lap', 'ngay hd', 'ngay phat hanh', 'ngay'],
};

export interface ImportColumnMap { ref?: string; series?: string; number?: string; date?: string }

export function detectColumns(headers: string[]): ImportColumnMap {
  const pick = (names: string[]) => names.find((n) => headers.includes(n));
  return { ref: pick(IMPORT_COLS.ref), series: pick(IMPORT_COLS.series), number: pick(IMPORT_COLS.number), date: pick(IMPORT_COLS.date) };
}

/** Mã tham chiếu trong ô văn bản (ví dụ "Hàng bán DH0000012#2 ngày…"): số đơn, có thể kèm #số đợt giao. */
export function extractRef(text: unknown): string {
  const m = /[A-Za-z]{2,4}\d{6,}(?:\s*#\s*\d{1,3})?/.exec(String(text ?? ''));
  return m ? m[0].replace(/\s+/g, '') : '';
}

/** Ký hiệu trên cổng thường là "mẫu số + ký hiệu" ("1C26TAA"): tách ra; chỉ có ký hiệu ("C26TAA") thì giữ nguyên. */
export function splitSerial(value: unknown): { templateCode?: '1' | '2'; series?: string } {
  const s = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const full = /^([12])\/?([CK]\d{2}[TDLMNBGH][A-Z]{2})$/.exec(s);
  if (full) return { templateCode: full[1] as '1' | '2', series: full[2] };
  return /^[CK]\d{2}[TDLMNBGH][A-Z]{2}$/.test(s) ? { series: s } : {};
}

/** Số hoá đơn trong ô: chỉ lấy chữ số (số có thể là số nguyên hoặc chuỗi "0000101"). */
export function parseNumber(v: unknown): string {
  const s = typeof v === 'number' ? String(Math.trunc(v)) : String(v ?? '').trim();
  return /^\d{1,8}$/.test(s) ? s : '';
}

export interface ParsedImport { rows: RecordImportRow[]; problems: string[] }

/** Các dòng nhập về từ file; dòng thiếu ngày, số hoặc mã tham chiếu bị bỏ và nêu trong `problems` (không chặn các dòng khác). */
export function importRows(rows: SheetRow[], map: ImportColumnMap): ParsedImport {
  const out: RecordImportRow[] = [];
  const problems: string[] = [];
  for (const r of rows) {
    const ref = extractRef(map.ref ? r.cells.get(map.ref) : '');
    const number = parseNumber(map.number ? r.cells.get(map.number) : '');
    const issueDate = parseDay(map.date ? r.cells.get(map.date) : '');
    if (!ref) continue; // hoá đơn không lập từ phần mềm (không có mã tham chiếu): không phải của mình
    if (!number) { problems.push(`Dòng ${r.rowNumber}: số hoá đơn không đọc được.`); continue; }
    if (!issueDate) { problems.push(`Dòng ${r.rowNumber}: ngày hoá đơn không đọc được.`); continue; }
    const serial = splitSerial(map.series ? r.cells.get(map.series) : '');
    out.push({ ref, number, issueDate, ...(serial.series ? { series: serial.series } : {}), ...(serial.templateCode ? { templateCode: serial.templateCode } : {}) });
  }
  return { rows: out, problems };
}
