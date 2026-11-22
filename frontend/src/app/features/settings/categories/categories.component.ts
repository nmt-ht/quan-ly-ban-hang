import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../../core/services/data-store.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProductCategory } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { foldVi } from '../../../shared/format.util';
import { errorText } from '../../../core/api/api.service';
import { CategoryService, MoveTarget } from './category.service';
import { ToastService } from '../../../core/services/toast.service';

// /thiet-lap/nhom-hang — the user's own way to divide the catalogue (Tính chất is the system's, not edited here).
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [FormsModule, RouterLink, NavIconComponent],
  templateUrl: './categories.component.html',
  styleUrls: [
    '../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
    '../../delivery-trips/trip-header-dialog/trip-header-dialog.component.scss',
    './categories.component.scss',
  ],
})
export class CategoriesComponent {
  protected readonly toast = inject(ToastService);
  private readonly dialogs = inject(ConfirmService);
  readonly data = inject(DataStore);
  readonly svc = inject(CategoryService);
  private readonly auth = inject(AuthService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly canCreate = this.auth.can('category.create');
  readonly canUpdate = this.auth.can('category.update');
  readonly canDelete = this.auth.can('category.delete');

  readonly search = signal('');
  readonly error = signal('');

  /** All nhóm A → Z with their product counts (search on the name). */
  readonly rows = computed(() => {
    const q = foldVi(this.search().trim());
    return [...this.data.categories()]
      .filter((c) => !q || foldVi(c.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .map((c) => ({ c, u: this.svc.usageOf(c.id) }));
  });
  readonly unassigned = computed(() => this.svc.usageOf(null));

  // ---- add / rename dialog
  readonly editing = signal<ProductCategory | null>(null);
  readonly name = signal('');
  readonly attempted = signal(false);
  readonly duplicate = computed(() => this.svc.duplicateName(this.name(), this.editing()?.id ?? null));
  readonly issue = computed(() => {
    const n = this.name().trim();
    if (!n) return 'Nhập tên nhóm';
    if (n.length > 100) return 'Tên nhóm tối đa 100 ký tự';
    if (this.duplicate()) return `Đã có nhóm "${this.duplicate()!.name}"`;
    return '';
  });

  open(c?: ProductCategory): void {
    this.editing.set(c ?? null);
    this.name.set(c?.name ?? '');
    this.attempted.set(false);
    this.dialog().nativeElement.showModal();
    setTimeout(() => document.getElementById('cg-name')?.focus());
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  async save(): Promise<void> {
    this.attempted.set(true);
    if (this.issue()) return;
    const c = this.editing();
    const name = this.name().trim();
    try {
      if (c) await this.svc.rename(c.id, name);
      else await this.svc.create(name);
    } catch (e) {
      this.close();
      this.error.set(errorText(e));
      return;
    }
    this.close();
    this.error.set('');
    this.toast.success(c ? `Đã đổi tên "${c.name}" thành "${name}".` : `Đã thêm nhóm "${name}".`);
  }

  // ---- delete (a nhóm with products moves them first — this is how two nhóm are merged)

  async askDelete(c: ProductCategory): Promise<void> {
    const n = this.svc.usageOf(c.id).total;
    const others = this.rows().map((r) => r.c).filter((x) => x.id !== c.id);
    const done = await this.dialogs.form({
      title: `Xoá nhóm "${c.name}"?`,
      message: n ? `Nhóm đang có ${n} mặt hàng: chọn nơi chuyển các mặt hàng này.` : 'Nhóm chưa có mặt hàng nào.',
      confirmLabel: n ? 'Chuyển và xoá nhóm' : 'Xoá nhóm', cancelLabel: 'Không xoá', tone: 'danger',
      fields: n ? [{
        key: 'to', label: `Chuyển ${n} mặt hàng sang`, type: 'select', required: true, value: '',
        options: [{ value: '', label: 'Chọn nhóm…' }, ...others.map((o) => ({ value: o.id, label: o.name })), { value: 'none', label: '— Không thuộc nhóm nào —' }],
      }] : [],
      run: (v) => this.svc.remove(c.id, n ? (v['to'] as MoveTarget) : null),
    });
    if (!done) return;
    const to = done['to'];
    const target = to && to !== 'none' ? this.data.categories().find((x) => x.id === to)?.name : null;
    this.error.set('');
    this.toast.success(n
      ? `Đã xoá nhóm "${c.name}" — ${n} mặt hàng ${target ? `chuyển sang "${target}"` : 'không còn thuộc nhóm nào'}.`
      : `Đã xoá nhóm "${c.name}".`);
  }
}
