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
  readonly data = inject(DataStore);
  readonly svc = inject(CategoryService);
  private readonly auth = inject(AuthService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly canCreate = this.auth.can('category.create');
  readonly canUpdate = this.auth.can('category.update');
  readonly canDelete = this.auth.can('category.delete');

  readonly search = signal('');
  readonly notice = signal('');
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
    this.notice.set(c ? `Đã đổi tên "${c.name}" thành "${name}".` : `Đã thêm nhóm "${name}".`);
  }

  // ---- delete (a nhóm with products moves them first — this is how two nhóm are merged)
  readonly deleting = signal<ProductCategory | null>(null);
  readonly moveTo = signal<MoveTarget | ''>('');
  readonly deletingCount = computed(() => (this.deleting() ? this.svc.usageOf(this.deleting()!.id).total : 0));
  readonly moveOptions = computed(() => this.rows().map((r) => r.c).filter((c) => c.id !== this.deleting()?.id));

  askDelete(c: ProductCategory): void {
    this.deleting.set(c);
    this.moveTo.set('');
  }

  async doDelete(): Promise<void> {
    const c = this.deleting()!;
    const n = this.deletingCount();
    const to = this.moveTo();
    if (n && !to) return;
    try {
      await this.svc.remove(c.id, n ? (to as MoveTarget) : null);
    } catch (e) {
      this.error.set(errorText(e));
      this.deleting.set(null);
      return;
    }
    const target = to && to !== 'none' ? this.data.categories().find((x) => x.id === to)?.name : null;
    this.error.set('');
    this.notice.set(n
      ? `Đã xoá nhóm "${c.name}" — ${n} mặt hàng ${target ? `chuyển sang "${target}"` : 'không còn thuộc nhóm nào'}.`
      : `Đã xoá nhóm "${c.name}".`);
    this.deleting.set(null);
  }
}
