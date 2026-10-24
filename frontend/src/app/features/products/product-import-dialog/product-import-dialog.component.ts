import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { DataStore } from '../../../core/services/data-store.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { downloadWorkbook } from '../../../shared/excel.util';
import {
  BomImportPlan, ImportIssue, ProductImportPlan,
  bomTemplateSheet, planBomImport, planProductImport, productTemplateSheet,
} from '../product-excel';
import { ProductService } from '../product.service';
import { errorText } from '../../../core/api/api.service';
import { ImportPreviewComponent } from '../../../shared/import/import-preview.component';
import { ImportResult, withClientErrors } from '../../../shared/import/import.types';

export type ImportMode = 'products' | 'bom';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-product-import-dialog',
  standalone: true,
  imports: [NavIconComponent, ImportPreviewComponent],
  templateUrl: './product-import-dialog.component.html',
  styleUrl: './product-import-dialog.component.scss',
})
export class ProductImportDialogComponent {
  readonly mode = input.required<ImportMode>();
  readonly closed = output<void>();
  readonly imported = output<string>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  private readonly products = inject(ProductService);
  readonly fileName = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly productPlan = signal<ProductImportPlan | null>(null);
  readonly bomPlan = signal<BomImportPlan | null>(null);
  /** Hàng hoá: the server's dry run of the parsed rows, with the rows the file itself failed (Pha 1.9). */
  readonly preview = signal<ImportResult | null>(null);

  readonly title = computed(() => (this.mode() === 'products' ? 'Nhập hàng hoá từ Excel' : 'Nhập định mức từ Excel'));
  readonly issues = computed<ImportIssue[]>(() => this.productPlan()?.issues ?? this.bomPlan()?.issues ?? []);
  readonly validCount = computed(() => {
    const v = this.preview();
    if (this.productPlan()) return v ? v.created + v.updated : 0;
    return this.bomPlan()?.lineCount ?? 0;
  });
  readonly hasPlan = computed(() => !!this.productPlan() || !!this.bomPlan());

  constructor(private readonly data: DataStore) {}

  open(): void {
    this.reset();
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  onNativeClose(): void {
    this.reset();
    this.closed.emit();
  }

  async downloadTemplate(): Promise<void> {
    const lk = this.lookups();
    if (this.mode() === 'products') {
      await downloadWorkbook('Mẫu nhập hàng hoá.xlsx', [productTemplateSheet(lk)]);
    } else {
      await downloadWorkbook('Mẫu nhập định mức.xlsx', [bomTemplateSheet(lk.products, this.data.bomLines())]);
    }
  }

  async onFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.productPlan.set(null);
    this.bomPlan.set(null);
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
    this.busy.set(true);
    try {
      if (this.mode() === 'products') {
        const plan = await planProductImport(file, this.lookups());
        this.productPlan.set(plan);
        // Xem trước trên máy chủ: same rules as saving (quyền sửa giá, độ dài, trùng…), nothing is kept.
        const checked = plan.creates.length + plan.updates.length
          ? await this.products.importProducts(plan, true)
          : { dryRun: true, rows: [], created: 0, updated: 0, unchanged: 0, failed: 0 };
        this.preview.set(withClientErrors(checked, plan.issues));
      } else this.bomPlan.set(await planBomImport(file, this.data.products()));
    } catch (e) {
      this.error.set(this.productPlan() ? errorText(e) : 'Không đọc được file. Kiểm tra file có đúng định dạng Excel (.xlsx) và không bị khoá mật khẩu.');
    } finally {
      this.busy.set(false);
    }
  }

  chooseAnother(): void {
    const el = this.fileInput()?.nativeElement;
    if (el) {
      el.value = '';
      el.click();
    }
  }

  async confirm(): Promise<void> {
    const pp = this.productPlan();
    const bp = this.bomPlan();
    let summary = '';
    this.busy.set(true);
    this.error.set('');
    let done: ImportResult | null = null;
    try {
      if (pp) done = withClientErrors(await this.products.importProducts(pp, false), pp.issues);
      else if (bp) await this.products.importBoms(bp);
    } catch (e) {
      this.error.set(errorText(e));
      return;
    } finally {
      this.busy.set(false);
    }
    if (done) {
      summary = `Đã nhập hàng hoá: ${done.created} thêm mới, ${done.updated} cập nhật`;
      if (done.unchanged) summary += `, ${done.unchanged} không đổi`;
      if (done.failed) summary += `, bỏ qua ${done.failed} dòng lỗi`;
    } else if (bp) {
      summary = `Đã nhập định mức cho ${bp.replacements.size} thành phẩm (${bp.lineCount} dòng vật tư)`;
      const skipped = bp.issues.filter((i) => i.row > 0).length;
      if (skipped) summary += `, bỏ qua ${skipped} dòng lỗi`;
    }
    this.imported.emit(summary + '.');
    this.close();
  }

  private lookups() {
    return {
      products: this.data.products(),
      categories: this.data.categories(),
      warehouses: this.data.warehouses(),
      stockLevels: this.data.stockLevels(),
    };
  }

  private reset(): void {
    this.fileName.set('');
    this.error.set('');
    this.busy.set(false);
    this.productPlan.set(null);
    this.bomPlan.set(null);
    this.preview.set(null);
    const el = this.fileInput()?.nativeElement;
    if (el) el.value = '';
  }
}
