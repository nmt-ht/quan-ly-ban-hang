import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { PriceList, Product } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { MoneyInputDirective } from '../../shared/money-input.directive';
import { ProductPickerComponent } from '../../shared/product-picker/product-picker.component';
import { formatVnd, foldVi } from '../../shared/format.util';
import { errorText } from '../../core/api/api.service';
import { HasUnsavedChanges, isSaveShortcut, warnBeforeUnload } from '../../core/guards/unsaved-changes.guard';
import { PricingService } from './pricing.service';

interface ItemDraft {
  key: string;
  productId: string;
  unitName: string; // '' = ĐVT chính
  price: number | null;
}

const newItem = (): ItemDraft => ({ key: crypto.randomUUID(), productId: '', unitName: '', price: null });

// Bảng giá riêng (Pha 1.6): danh sách bảng giá và biên tập một bảng — giá theo mặt hàng / ĐVT. Khách gán bảng giá ở
// form khách hàng; mặt hàng không có trong bảng vẫn lấy giá theo loại khách.
@Component({
  selector: 'app-price-lists',
  standalone: true,
  imports: [DecimalPipe, FormsModule, RouterLink, NavIconComponent, MoneyInputDirective, ProductPickerComponent],
  templateUrl: './price-lists.component.html',
  styleUrl: './pricing.scss',
})
export class PriceListsComponent implements HasUnsavedChanges {
  readonly data = inject(DataStore);
  private readonly svc = inject(PricingService);
  readonly money = formatVnd;

  readonly notice = signal('');
  readonly error = signal('');
  readonly saving = signal(false);

  /** null = closed; '' = a new bảng giá; otherwise the id being edited. */
  readonly editingId = signal<string | null>(null);
  readonly name = signal('');
  readonly note = signal('');
  readonly isActive = signal(true);
  readonly items = signal<ItemDraft[]>([]);
  readonly filter = signal('');
  readonly percent = signal<number | null>(null);
  private baseline = '';

  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  readonly productOptions = computed(() =>
    this.data.products().filter((p) => p.isActive && p.isSellable).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
  );

  product(id: string): Product | undefined {
    return this.productById().get(id);
  }

  units(productId: string): { value: string; label: string; ratio: number }[] {
    const p = this.product(productId);
    return p ? [{ value: '', label: p.baseUnit, ratio: 1 }, ...p.unitConversions.map((u) => ({ value: u.unitName, label: u.unitName, ratio: u.ratioToBaseUnit }))] : [];
  }

  /** Giá lẻ / sỉ hiện tại của mặt hàng ở ĐVT của dòng, để so. */
  refPrices(l: ItemDraft): { retail: number; wholesale: number } {
    const p = this.product(l.productId);
    if (!p) return { retail: 0, wholesale: 0 };
    const uc = l.unitName ? p.unitConversions.find((u) => u.unitName === l.unitName) : undefined;
    if (!uc) return { retail: p.retailPrice, wholesale: p.wholesalePrice };
    return { retail: uc.price || Math.round(p.retailPrice * uc.ratioToBaseUnit), wholesale: uc.wholesalePrice || Math.round(p.wholesalePrice * uc.ratioToBaseUnit) };
  }

  readonly visibleItems = computed(() => {
    const q = foldVi(this.filter().trim());
    return this.items().map((l, i) => ({ l, i })).filter(({ l }) => {
      if (!q) return true;
      const p = this.product(l.productId);
      return !l.productId || foldVi(`${p?.code ?? ''} ${p?.name ?? ''}`).includes(q);
    });
  });

  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.name().trim()) out.push('Nhập tên bảng giá');
    const seen = new Set<string>();
    this.items().forEach((l, i) => {
      if (!l.productId) return;
      const key = `${l.productId}|${l.unitName}`;
      if (seen.has(key)) out.push(`Dòng ${i + 1}: mặt hàng và ĐVT này đã có ở dòng khác`);
      seen.add(key);
      if (l.price === null || l.price < 0) out.push(`Dòng ${i + 1}: nhập giá`);
    });
    return out;
  });

  readonly nameTaken = computed(() => {
    const n = foldVi(this.name().trim());
    return !!n && this.data.priceLists().some((l) => l.id !== this.editingId() && foldVi(l.name) === n);
  });

  open(l?: PriceList): void {
    this.error.set('');
    this.editingId.set(l?.id ?? '');
    this.name.set(l?.name ?? '');
    this.note.set(l?.note ?? '');
    this.isActive.set(l?.isActive ?? true);
    this.items.set([...(l?.items ?? []).map((x) => ({ key: crypto.randomUUID(), productId: x.productId, unitName: x.unitName, price: x.price })), newItem()]);
    this.filter.set('');
    this.baseline = this.snapshot();
  }

  close(): void {
    this.baseline = this.snapshot();
    this.editingId.set(null);
  }

  patch(i: number, change: Partial<ItemDraft>): void {
    this.items.update((ls) => ls.map((l, j) => (j === i ? { ...l, ...change } : l)));
    // Always one empty row at the end to type the next mặt hàng.
    if (this.items().at(-1)?.productId) this.items.update((ls) => [...ls, newItem()]);
  }

  setProduct(i: number, productId: string): void {
    const p = this.product(productId);
    this.patch(i, { productId, unitName: '', price: this.items()[i].price ?? p?.wholesalePrice ?? null });
  }

  remove(i: number): void {
    this.items.update((ls) => ls.filter((_, j) => j !== i));
    if (!this.items().length || this.items().at(-1)?.productId) this.items.update((ls) => [...ls, newItem()]);
  }

  /** Điền nhanh: mọi dòng = giá lẻ − x% (làm tròn đến 100 đ). */
  fillFromRetail(): void {
    const pct = this.percent();
    if (pct === null || pct < 0 || pct > 100) return;
    this.items.update((ls) => ls.map((l) => (l.productId ? { ...l, price: Math.round((this.refPrices(l).retail * (100 - pct)) / 100 / 100) * 100 } : l)));
  }

  async save(): Promise<void> {
    if (this.issues().length || this.nameTaken() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const id = this.editingId() || null;
      const l = await this.svc.saveList(id, {
        name: this.name().trim(), note: this.note().trim() || undefined, isActive: this.isActive(),
        items: this.items().filter((x) => x.productId).map((x) => ({ productId: x.productId, unitName: x.unitName, price: x.price ?? 0 })),
      });
      this.notice.set(id ? `Đã lưu bảng giá "${l.name}".` : `Đã lập bảng giá "${l.name}". Gán cho khách ở form khách hàng.`);
      this.close();
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }

  private snapshot(): string {
    return JSON.stringify([this.name(), this.note(), this.isActive(), this.items().map(({ key, ...x }) => x)]);
  }

  hasUnsavedChanges(): boolean {
    return this.editingId() !== null && this.snapshot() !== this.baseline;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    warnBeforeUnload(e, this.hasUnsavedChanges());
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (this.editingId() === null || !isSaveShortcut(e)) return;
    e.preventDefault();
    this.save();
  }
}
