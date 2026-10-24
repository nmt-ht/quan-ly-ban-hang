import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { CustomerType, DiscountType, Promotion, PromotionKind, PromotionScope } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { MoneyInputDirective } from '../../shared/money-input.directive';
import { ProductPickerComponent } from '../../shared/product-picker/product-picker.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { formatVnd, foldVi } from '../../shared/format.util';
import { formatDay, isoDay } from '../../shared/period';
import { errorText } from '../../core/api/api.service';
import { HasUnsavedChanges, isSaveShortcut, warnBeforeUnload } from '../../core/guards/unsaved-changes.guard';
import { CUSTOMER_TYPE_LABEL } from '../sales-orders/sales-order.rules';
import { PROMOTION_KIND_LABEL } from '../sales-orders/promotion.rules';
import { PROMOTION_STATE_LABEL, PricingService, PromotionDraft, PromotionState, promotionState } from './pricing.service';

const KIND_HINT: Record<PromotionKind, string> = {
  GIAM_HANG: 'Giảm % hoặc số tiền mỗi ĐVT chính trên các mặt hàng chọn — tự điền vào chiết khấu dòng.',
  GIAM_DON: 'Tiền hàng (sau chiết khấu dòng) đạt ngưỡng thì giảm cả đơn — tự điền vào Chiết khấu cả đơn.',
  BAC_THANG: 'Mua từ N (ĐVT chính) trở lên trên một dòng thì giảm theo bậc cao nhất đã đạt.',
  TANG_HANG: 'Mỗi đủ X (ĐVT chính) các mặt hàng chọn thì tự thêm dòng hàng tặng Y (thành tiền 0, vẫn xuất kho khi giao).',
};

// Khuyến mãi KM… (Pha 1.6): danh sách và biên tập chương trình. Đơn hàng và báo giá áp tự động theo ngày chứng từ.
@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [NgClass, FormsModule, RouterLink, NavIconComponent, MoneyInputDirective, ProductPickerComponent, FilterMultiSelectComponent],
  templateUrl: './promotions.component.html',
  styleUrl: './pricing.scss',
})
export class PromotionsComponent implements HasUnsavedChanges {
  readonly data = inject(DataStore);
  private readonly svc = inject(PricingService);
  readonly money = formatVnd;
  readonly day = formatDay;
  readonly today = isoDay(new Date());
  readonly kindLabel = PROMOTION_KIND_LABEL;
  readonly kindHint = KIND_HINT;
  readonly kinds = Object.keys(PROMOTION_KIND_LABEL) as PromotionKind[];
  readonly stateLabel = PROMOTION_STATE_LABEL;

  readonly notice = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  readonly search = signal('');
  readonly showEnded = signal(false);

  readonly rows = computed(() => {
    const q = foldVi(this.search().trim());
    return [...this.data.promotions()]
      .filter((p) => this.showEnded() || this.state(p) === 'DANG_CHAY' || this.state(p) === 'SAP_CHAY')
      .filter((p) => !q || foldVi(`${p.code} ${p.name}`).includes(q))
      .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.code.localeCompare(a.code));
  });

  state(p: Promotion): PromotionState {
    return promotionState(p, this.today);
  }

  stateClass(s: PromotionState): string {
    return s === 'DANG_CHAY' ? 'badge-success' : s === 'SAP_CHAY' ? 'badge-info' : 'badge-muted';
  }

  // ---------- editor ----------
  /** null = closed; '' = new; else the id being edited. */
  readonly editingId = signal<string | null>(null);
  readonly name = signal('');
  readonly kind = signal<PromotionKind>('GIAM_HANG');
  readonly startDate = signal(this.today);
  readonly endDate = signal('');
  readonly isActive = signal(true);
  readonly note = signal('');
  readonly scope = signal<PromotionScope>('TAT_CA');
  readonly customerTypes = signal<string[]>([]);
  readonly priceListIds = signal<string[]>([]);
  readonly productIds = signal<string[]>([]);
  readonly categoryIds = signal<string[]>([]);
  readonly discountType = signal<DiscountType>('PHAN_TRAM');
  readonly discountValue = signal<number | null>(null);
  readonly minOrderValue = signal<number | null>(null);
  readonly tiers = signal<{ key: string; minQuantity: number | null; value: number | null }[]>([]);
  readonly buyQuantity = signal<number | null>(null);
  readonly giftProductId = signal('');
  readonly giftQuantity = signal<number | null>(null);
  private baseline = '';

  readonly typeOptions: FilterOption[] = (Object.keys(CUSTOMER_TYPE_LABEL) as CustomerType[]).map((t) => ({ value: t, label: CUSTOMER_TYPE_LABEL[t] }));
  readonly listOptions = computed<FilterOption[]>(() => this.data.priceLists().map((l) => ({ value: l.id, label: l.name })));
  readonly productOptions = computed<FilterOption[]>(() =>
    this.data.products().filter((p) => p.isActive && p.isSellable).sort((a, b) => a.code.localeCompare(b.code))
      .map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
  );
  readonly categoryOptions = computed<FilterOption[]>(() => this.data.categories().map((c) => ({ value: c.id, label: c.name })));
  readonly giftOptions = computed(() => this.data.products().filter((p) => p.isActive && p.isSellable).sort((a, b) => a.name.localeCompare(b.name, 'vi')));
  readonly giftUnit = computed(() => this.data.products().find((p) => p.id === this.giftProductId())?.baseUnit ?? '');

  readonly issues = computed(() => {
    const out: string[] = [];
    const k = this.kind();
    const pct = this.discountType() === 'PHAN_TRAM';
    if (!this.name().trim()) out.push('Nhập tên chương trình');
    if (!this.startDate()) out.push('Chọn ngày bắt đầu');
    if (this.endDate() && this.endDate() < this.startDate()) out.push('Ngày kết thúc trước ngày bắt đầu');
    if (this.scope() === 'LOAI_KHACH' && !this.customerTypes().length) out.push('Chọn loại khách');
    if (this.scope() === 'BANG_GIA' && !this.priceListIds().length) out.push('Chọn bảng giá');
    if (k === 'GIAM_HANG' || k === 'GIAM_DON') {
      const v = this.discountValue() ?? 0;
      if (!(v > 0)) out.push('Nhập mức giảm');
      else if (pct && v > 100) out.push('Giảm theo % tối đa 100%');
    }
    if (k === 'BAC_THANG') {
      const t = this.tiers().filter((x) => x.minQuantity !== null || x.value !== null);
      if (!t.length) out.push('Thêm ít nhất một bậc');
      if (t.some((x) => !((x.minQuantity ?? 0) > 0) || !((x.value ?? 0) > 0))) out.push('Mỗi bậc cần số lượng và mức giảm lớn hơn 0');
      if (new Set(t.map((x) => x.minQuantity)).size !== t.length) out.push('Hai bậc trùng số lượng');
      if (pct && t.some((x) => (x.value ?? 0) > 100)) out.push('Giảm theo % tối đa 100%');
    }
    if (k === 'TANG_HANG') {
      if (!this.productIds().length && !this.categoryIds().length) out.push('Chọn mặt hàng hoặc nhóm hàng phải mua');
      if (!((this.buyQuantity() ?? 0) > 0)) out.push('Nhập số lượng mua');
      if (!this.giftProductId()) out.push('Chọn hàng tặng');
      if (!((this.giftQuantity() ?? 0) > 0)) out.push('Nhập số lượng tặng');
    }
    return out;
  });

  open(p?: Promotion): void {
    this.error.set('');
    this.editingId.set(p?.id ?? '');
    this.name.set(p?.name ?? '');
    this.kind.set(p?.kind ?? 'GIAM_HANG');
    this.startDate.set(p?.startDate.slice(0, 10) ?? this.today);
    this.endDate.set(p?.endDate?.slice(0, 10) ?? '');
    this.isActive.set(p?.isActive ?? true);
    this.note.set(p?.note ?? '');
    this.scope.set(p?.scope ?? 'TAT_CA');
    this.customerTypes.set(p?.customerTypes ?? []);
    this.priceListIds.set(p?.priceListIds ?? []);
    this.productIds.set(p?.productIds ?? []);
    this.categoryIds.set(p?.categoryIds ?? []);
    this.discountType.set(p?.discountType ?? 'PHAN_TRAM');
    this.discountValue.set(p?.discountValue || null);
    this.minOrderValue.set(p?.minOrderValue || null);
    this.tiers.set((p?.tiers.length ? p.tiers : [{ minQuantity: null, value: null }]).map((t) => ({ key: crypto.randomUUID(), minQuantity: t.minQuantity, value: t.value })));
    this.buyQuantity.set(p?.buyQuantity || null);
    this.giftProductId.set(p?.giftProductId ?? '');
    this.giftQuantity.set(p?.giftQuantity || null);
    this.baseline = this.snapshot();
  }

  close(): void {
    this.baseline = this.snapshot();
    this.editingId.set(null);
  }

  addTier(): void {
    this.tiers.update((t) => [...t, { key: crypto.randomUUID(), minQuantity: null, value: null }]);
  }

  patchTier(i: number, change: { minQuantity?: number | null; value?: number | null }): void {
    this.tiers.update((t) => t.map((x, j) => (j === i ? { ...x, ...change } : x)));
  }

  removeTier(i: number): void {
    this.tiers.update((t) => t.filter((_, j) => j !== i));
  }

  async save(): Promise<void> {
    if (this.issues().length || this.saving()) return;
    const draft: PromotionDraft = {
      name: this.name().trim(), kind: this.kind(), startDate: this.startDate(), endDate: this.endDate() || undefined,
      isActive: this.isActive(), note: this.note().trim() || undefined, scope: this.scope(),
      customerTypes: this.customerTypes() as CustomerType[], priceListIds: this.priceListIds(),
      productIds: this.productIds(), categoryIds: this.categoryIds(), discountType: this.discountType(),
      discountValue: this.discountValue() ?? 0, minOrderValue: this.minOrderValue() ?? 0,
      tiers: this.tiers().filter((x) => x.minQuantity !== null && x.value !== null).map((x) => ({ minQuantity: x.minQuantity!, value: x.value! })),
      buyQuantity: this.buyQuantity() ?? 0, giftProductId: this.giftProductId() || undefined, giftQuantity: this.giftQuantity() ?? 0,
    };
    this.saving.set(true);
    this.error.set('');
    try {
      const id = this.editingId() || null;
      const p = await this.svc.savePromotion(id, draft);
      this.notice.set(id ? `Đã lưu ${p.code}.` : `Đã lập khuyến mãi ${p.code} — đơn và báo giá trong thời gian chạy sẽ tự áp.`);
      this.close();
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }

  async toggle(p: Promotion): Promise<void> {
    this.error.set('');
    try {
      await this.svc.setPromotionActive(p.id, !p.isActive);
      this.notice.set(p.isActive ? `Đã dừng ${p.code}.` : `${p.code} chạy lại.`);
    } catch (e) {
      this.error.set(errorText(e));
    }
  }

  /** "Giảm 10% · SP001, SP002" — what the chương trình does, for the list. */
  summary(p: Promotion): string {
    const unit = (v: number) => (p.discountType === 'PHAN_TRAM' ? `${v}%` : formatVnd(v));
    const goods = p.productIds.length || p.categoryIds.length
      ? [...p.productIds.map((id) => this.data.products().find((x) => x.id === id)?.code ?? '?'),
        ...p.categoryIds.map((id) => `nhóm ${this.data.categories().find((c) => c.id === id)?.name ?? '?'}`)].join(', ')
      : 'mọi mặt hàng';
    switch (p.kind) {
      case 'GIAM_HANG': return `Giảm ${unit(p.discountValue)}${p.discountType === 'SO_TIEN' ? '/ĐVT' : ''} · ${goods}`;
      case 'GIAM_DON': return `Đơn từ ${formatVnd(p.minOrderValue)} giảm ${unit(p.discountValue)}`;
      case 'BAC_THANG': return `${p.tiers.map((t) => `từ ${t.minQuantity}: −${unit(t.value)}`).join(' · ')} · ${goods}`;
      case 'TANG_HANG': {
        const g = this.data.products().find((x) => x.id === p.giftProductId);
        return `Mua ${p.buyQuantity} tặng ${p.giftQuantity} ${g?.code ?? ''} ${g?.name ?? ''} · ${goods}`;
      }
    }
  }

  scopeText(p: Promotion): string {
    if (p.scope === 'LOAI_KHACH') return p.customerTypes.map((t) => CUSTOMER_TYPE_LABEL[t]).join(', ');
    if (p.scope === 'BANG_GIA') return p.priceListIds.map((id) => this.data.priceLists().find((l) => l.id === id)?.name ?? '?').join(', ');
    return 'Mọi khách';
  }

  private snapshot(): string {
    return JSON.stringify([
      this.name(), this.kind(), this.startDate(), this.endDate(), this.isActive(), this.note(), this.scope(), this.customerTypes(),
      this.priceListIds(), this.productIds(), this.categoryIds(), this.discountType(), this.discountValue(), this.minOrderValue(),
      this.tiers().map(({ key, ...t }) => t), this.buyQuantity(), this.giftProductId(), this.giftQuantity(),
    ]);
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
