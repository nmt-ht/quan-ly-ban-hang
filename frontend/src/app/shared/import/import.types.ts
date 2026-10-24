// Nhập Excel có xem trước (Pha 1.9): what the server answers for a dry run (xem trước) or a real import, row by row.
export type ImportAction = 'create' | 'update' | 'unchanged' | 'error';

export interface ImportRowResult {
  row: number; // số dòng trong file Excel; 0 = cả file
  action: ImportAction;
  code?: string;
  name?: string;
  changes?: string[];
  errors: string[];
}

export interface ImportResult {
  dryRun: boolean;
  rows: ImportRowResult[];
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
}

export const IMPORT_ACTION_LABEL: Record<ImportAction, string> = {
  create: 'Thêm mới',
  update: 'Cập nhật',
  unchanged: 'Không đổi',
  error: 'Lỗi — bỏ qua',
};

/** Rows the file failed before reaching the server (đọc file ở trình duyệt) join the server's answer as errors. */
export function withClientErrors(result: ImportResult, issues: { row: number; message: string }[]): ImportResult {
  if (!issues.length) return result;
  const rows = [...result.rows, ...issues.map((i): ImportRowResult => ({ row: i.row, action: 'error', errors: [i.message] }))]
    .sort((a, b) => a.row - b.row);
  return { ...result, rows, failed: rows.filter((r) => r.action === 'error').length };
}
