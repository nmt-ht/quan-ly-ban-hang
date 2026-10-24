import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ApiService, errorText } from '../../core/api/api.service';
import { SheetColumn, downloadWorkbook, headerKey, readSheet } from '../excel.util';
import { ImportPreviewComponent } from './import-preview.component';
import { ImportResult } from './import.types';

export interface ImportColumn extends SheetColumn {
  /** The key the server reads (CUSTOMER_IMPORT_LABELS / SUPPLIER_IMPORT_LABELS). */
  key: string;
}

export interface ExcelImportConfig {
  title: string;
  /** "khách hàng", "nhà cung cấp" — for messages. */
  noun: string;
  sheetName: string;
  endpoint: string;
  columns: ImportColumn[];
  notes: string[];
  /** The current list in the same columns, for "Tải file kèm danh sách hiện có" (sửa hàng loạt). */
  currentRows?: () => unknown[][];
}

type Cell = string | number | boolean | null;

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Nhập Excel có xem trước (Pha 1.9) for a danh mục whose rules live on the server: the sheet is read here and sent cell by
 * cell; the server answers a dry run row by row (Thêm mới / Cập nhật / Không đổi / Lỗi) and nothing is saved until
 * "Nhập". Only the columns present in the file are sent, so a file with a few columns updates just those.
 */
@Component({
  selector: 'app-excel-import-dialog',
  standalone: true,
  imports: [NavIconComponent, ImportPreviewComponent],
  templateUrl: './excel-import-dialog.component.html',
  styleUrl: '../../features/products/product-import-dialog/product-import-dialog.component.scss',
})
export class ExcelImportDialogComponent {
  readonly config = input.required<ExcelImportConfig>();
  readonly imported = output<string>();

  private readonly api = inject(ApiService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly fileName = signal('');
  readonly busy = signal<'' | 'reading' | 'checking' | 'saving'>('');
  readonly error = signal('');
  readonly preview = signal<ImportResult | null>(null);
  private rows: { row: number; cells: Record<string, Cell> }[] = [];

  readonly importable = computed(() => {
    const p = this.preview();
    return p ? p.created + p.updated : 0;
  });

  open(): void {
    this.reset();
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  async downloadTemplate(withData: boolean): Promise<void> {
    const c = this.config();
    await downloadWorkbook(withData ? `Danh sách ${c.noun} để sửa.xlsx` : `Mẫu nhập ${c.noun}.xlsx`, [{
      name: c.sheetName,
      columns: c.columns,
      rows: withData && c.currentRows ? c.currentRows() : [],
      notes: { title: `${c.title} — hướng dẫn`, lines: c.notes },
    }]);
  }

  async onFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.preview.set(null);
    this.error.set('');
    this.fileName.set(file.name);
    if (!/\.xlsx$/i.test(file.name)) {
      this.error.set('Chỉ nhận file .xlsx. Với file .xls hoặc .csv, mở bằng Excel rồi lưu lại dạng .xlsx.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.error.set('File lớn hơn 5 MB. Hãy tách thành nhiều file nhỏ hơn.');
      return;
    }
    this.busy.set('reading');
    try {
      const { headers, rows } = await readSheet(file, this.config().sheetName);
      const cols = this.config().columns.filter((c) => headers.includes(headerKey(c.header)));
      const missing = this.config().columns.filter((c) => c.required && !cols.includes(c));
      if (missing.length) {
        this.error.set(`Thiếu cột bắt buộc: ${missing.map((c) => c.header).join(', ')}. Hãy dùng file mẫu.`);
        return;
      }
      if (!rows.length) {
        this.error.set('File không có dòng dữ liệu nào.');
        return;
      }
      this.rows = rows.map((r) => ({
        row: r.rowNumber,
        cells: Object.fromEntries(cols.map((c) => {
          const v = r.cells.get(headerKey(c.header));
          return [c.key, v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? null)];
        })),
      }));
      this.busy.set('checking');
      this.preview.set(await this.send(true));
    } catch (e) {
      this.error.set(this.busy() === 'reading'
        ? 'Không đọc được file. Kiểm tra file có đúng định dạng Excel (.xlsx) và không bị khoá mật khẩu.'
        : errorText(e));
    } finally {
      this.busy.set('');
    }
  }

  async confirm(): Promise<void> {
    if (!this.importable() || this.busy()) return;
    this.busy.set('saving');
    this.error.set('');
    try {
      const r = await this.send(false);
      let msg = `Đã nhập ${this.config().noun}: ${r.created} thêm mới, ${r.updated} cập nhật`;
      if (r.unchanged) msg += `, ${r.unchanged} không đổi`;
      if (r.failed) msg += `, bỏ qua ${r.failed} dòng lỗi`;
      this.imported.emit(msg + '.');
      this.close();
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set('');
    }
  }

  private send(dryRun: boolean): Promise<ImportResult> {
    return this.api.post<ImportResult>(this.config().endpoint, { dryRun, rows: this.rows });
  }

  reset(): void {
    this.fileName.set('');
    this.error.set('');
    this.busy.set('');
    this.preview.set(null);
    this.rows = [];
    const el = this.fileInput()?.nativeElement;
    if (el) el.value = '';
  }
}
