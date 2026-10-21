import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { Tag, TagColorKey } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { foldVi } from '../../../shared/format.util';
import { DEFAULT_TAG_COLOR, TAG_COLORS, tagStyle } from '../../../shared/tag-colors';
import { TagService } from './tag.service';

// /thiet-lap/the — thẻ đánh dấu dùng chung cho đơn hàng bán và khách hàng.
@Component({
  selector: 'app-tags',
  standalone: true,
  imports: [FormsModule, RouterLink, NavIconComponent],
  templateUrl: './tags.component.html',
  styleUrls: [
    '../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
    '../../delivery-trips/trip-header-dialog/trip-header-dialog.component.scss',
    './tags.component.scss',
  ],
})
export class TagsComponent {
  readonly data = inject(MockDataService);
  readonly svc = inject(TagService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly colors = TAG_COLORS;
  readonly style = tagStyle;
  readonly search = signal('');
  readonly showInactive = signal(true);
  readonly notice = signal('');
  readonly error = signal('');
  readonly confirmDelete = signal<Tag | null>(null);

  // dialog draft
  readonly editing = signal<Tag | null>(null);
  readonly name = signal('');
  readonly color = signal<TagColorKey>(DEFAULT_TAG_COLOR);
  readonly sortOrder = signal<number | null>(0);
  readonly isActive = signal(true);
  readonly attempted = signal(false);

  readonly tags = computed(() => {
    const q = foldVi(this.search().trim());
    return [...this.data.tags()]
      .filter((t) => (!q || foldVi(t.name).includes(q)) && (this.showInactive() || t.isActive))
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi'));
  });

  readonly duplicate = computed(() => this.svc.duplicateName(this.name(), this.editing()?.id ?? null));

  colorLabel(key: TagColorKey | undefined): string {
    return TAG_COLORS.find((c) => c.key === (key ?? DEFAULT_TAG_COLOR))?.label ?? '';
  }

  open(t?: Tag): void {
    this.editing.set(t ?? null);
    this.name.set(t?.name ?? '');
    this.color.set(t?.color ?? DEFAULT_TAG_COLOR);
    this.sortOrder.set(t?.sortOrder ?? (Math.max(0, ...this.data.tags().map((x) => x.sortOrder)) + 1));
    this.isActive.set(t?.isActive ?? true);
    this.attempted.set(false);
    this.dialog().nativeElement.showModal();
    setTimeout(() => document.getElementById('tg-name')?.focus());
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  readonly issue = computed(() => {
    if (!this.name().trim()) return 'Nhập tên thẻ';
    if (this.name().trim().length > 40) return 'Tên thẻ tối đa 40 ký tự';
    if (this.duplicate()) return `Đã có thẻ "${this.duplicate()!.name}"`;
    return '';
  });

  save(): void {
    this.attempted.set(true);
    if (this.issue()) return;
    const draft = { name: this.name(), color: this.color(), sortOrder: this.sortOrder() ?? 0, isActive: this.isActive() };
    const t = this.editing();
    if (t) this.svc.update(t.id, draft);
    else this.svc.create(draft);
    this.close();
    this.error.set('');
    this.notice.set(t ? `Đã lưu thẻ "${draft.name.trim()}".` : `Đã thêm thẻ "${draft.name.trim()}".`);
  }

  toggle(t: Tag): void {
    this.svc.setActive(t.id, !t.isActive);
    this.notice.set(t.isActive ? `"${t.name}" ngừng dùng — vẫn hiện trên đơn / khách cũ, không chọn được nữa.` : `"${t.name}" dùng lại.`);
  }

  doDelete(): void {
    const t = this.confirmDelete()!;
    try {
      this.svc.remove(t.id);
      this.notice.set(`Đã xoá thẻ "${t.name}".`);
      this.error.set('');
    } catch (e) {
      this.error.set((e as Error).message);
    }
    this.confirmDelete.set(null);
  }
}
