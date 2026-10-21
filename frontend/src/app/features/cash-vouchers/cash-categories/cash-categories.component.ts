import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { CashCategory, VoucherKind } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { foldVi } from '../../../shared/format.util';
import { PARTNER_LABEL, PartnerType, categoryHint } from '../cash-voucher.rules';
import { CashVoucherService } from '../cash-voucher.service';

// /thu-chi/loai — loại thu chi quyết định phiếu gắn khách hàng, nhà cung cấp hay không gắn đối tác.
@Component({
  selector: 'app-cash-categories',
  standalone: true,
  imports: [FormsModule, RouterLink, NavIconComponent],
  templateUrl: './cash-categories.component.html',
  styleUrls: [
    '../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
    '../../delivery-trips/trip-header-dialog/trip-header-dialog.component.scss',
    '../cash-accounts/cash-accounts.component.scss',
  ],
})
export class CashCategoriesComponent {
  readonly data = inject(MockDataService);
  private readonly svc = inject(CashVoucherService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly partnerLabel = PARTNER_LABEL;
  readonly hint = categoryHint;
  readonly partnerTypes: PartnerType[] = ['KHACH_HANG', 'NHA_CUNG_CAP', 'KHAC'];
  readonly notice = signal('');

  readonly editing = signal<CashCategory | null>(null);
  readonly name = signal('');
  readonly kind = signal<VoucherKind>('THU');
  readonly partnerType = signal<PartnerType>('KHAC');
  readonly isDefault = signal(false);
  readonly isActive = signal(true);
  readonly attempted = signal(false);

  private readonly usage = computed(() => {
    const m = new Map<string, number>();
    for (const v of this.data.cashVouchers()) if (!v.isCancelled) m.set(`${v.kind}|${v.category}`, (m.get(`${v.kind}|${v.category}`) ?? 0) + 1);
    return m;
  });

  used(c: CashCategory): number {
    return this.usage().get(`${c.kind}|${c.name}`) ?? 0;
  }

  readonly groups = computed(() =>
    (['THU', 'CHI'] as VoucherKind[]).map((k) => ({
      kind: k,
      label: k === 'THU' ? 'Phiếu thu' : 'Phiếu chi',
      items: this.data.cashCategories().filter((c) => c.kind === k).sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault)),
    })),
  );

  open(kind: VoucherKind, c?: CashCategory): void {
    this.editing.set(c ?? null);
    this.name.set(c?.name ?? '');
    this.kind.set(c?.kind ?? kind);
    this.partnerType.set(c?.partnerType ?? 'KHAC');
    this.isDefault.set(!!c?.isDefault);
    this.isActive.set(c?.isActive ?? true);
    this.attempted.set(false);
    this.dialog().nativeElement.showModal();
    setTimeout(() => document.getElementById('cc-name')?.focus());
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  readonly issues = computed(() => {
    const out: string[] = [];
    const n = this.name().trim();
    if (!n) out.push('Nhập tên loại');
    const dup = this.data.cashCategories().find((c) => c.kind === this.kind() && c.code !== this.editing()?.code && foldVi(c.name) === foldVi(n));
    if (n && dup) out.push(`Đã có loại "${dup.name}"`);
    return out;
  });

  save(): void {
    this.attempted.set(true);
    if (this.issues().length) return;
    const c = this.editing();
    const code = c?.code ?? `${this.kind()}_${Date.now().toString(36).toUpperCase()}`;
    this.svc.saveCategory({
      code,
      name: this.name().trim(),
      kind: this.kind(),
      partnerType: c?.isSystem ? c.partnerType : this.partnerType(),
      isDefault: this.isDefault() && this.isActive(),
      isActive: this.isActive(),
      isSystem: c?.isSystem,
    });
    this.close();
    this.notice.set(c ? `Đã lưu loại "${this.name().trim()}".` : `Đã thêm loại "${this.name().trim()}".`);
  }

  toggle(c: CashCategory): void {
    this.svc.setCategoryActive(c.code, !c.isActive);
    this.notice.set(c.isActive ? `"${c.name}" ngừng dùng — phiếu cũ giữ nguyên.` : `"${c.name}" dùng lại.`);
  }
}
