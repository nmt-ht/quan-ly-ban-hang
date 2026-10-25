import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../../core/services/data-store.service';
import { CashCategory, VoucherKind } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { foldVi } from '../../../shared/format.util';
import { PARTNER_LABEL, PartnerType, categoryHint } from '../cash-voucher.rules';
import { CashVoucherService } from '../cash-voucher.service';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { errorText } from '../../../core/api/api.service';

// /thu-chi/loai — loại thu chi quyết định phiếu gắn khách hàng, nhà cung cấp hay không gắn đối tác.
@Component({
  selector: 'app-cash-categories',
  standalone: true,
  imports: [FormsModule, RouterLink, AllowedLinkDirective, NavIconComponent],
  templateUrl: './cash-categories.component.html',
  styleUrls: [
    '../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
    '../../delivery-trips/trip-header-dialog/trip-header-dialog.component.scss',
    '../cash-accounts/cash-accounts.component.scss',
  ],
})
export class CashCategoriesComponent {
  readonly data = inject(DataStore);
  private readonly svc = inject(CashVoucherService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly partnerLabel = PARTNER_LABEL;
  readonly hint = categoryHint;
  readonly partnerTypes: PartnerType[] = ['KHACH_HANG', 'NHA_CUNG_CAP', 'KHAC'];
  readonly notice = signal('');
  readonly dialogError = signal('');
  readonly saving = signal(false);
  /** A save the server refused (or that could not reach it). */
  readonly failure = signal('');

  readonly editing = signal<CashCategory | null>(null);
  readonly name = signal('');
  readonly kind = signal<VoucherKind>('THU');
  readonly partnerType = signal<PartnerType>('KHAC');
  readonly isDefault = signal(false);
  readonly isActive = signal(true);
  readonly attempted = signal(false);

  /** Phiếu chưa huỷ per loại ("THU|Tên") over the whole history, from the server (Pha 1.1). */
  private readonly usage = signal<Record<string, number>>({});
  private readonly loadUsage = effect(() => {
    this.data.cashVouchers();
    untracked(() => this.svc.usage().then((u) => this.usage.set(u.categories), () => undefined));
  });

  used(c: CashCategory): number {
    return this.usage()[`${c.kind}|${c.name}`] ?? 0;
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

  async save(): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length || this.saving()) return;
    const c = this.editing();
    const code = c?.code ?? `${this.kind()}_${Date.now().toString(36).toUpperCase()}`;
    this.saving.set(true);
    this.dialogError.set('');
    try {
    await this.svc.saveCategory({
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
    } catch (e) {
      this.dialogError.set(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }

  async toggle(c: CashCategory): Promise<void> {
    this.failure.set('');
    try {
      await this.svc.setCategoryActive(c.code, !c.isActive);
    } catch (e) {
      this.failure.set(errorText(e));
      return;
    }
    this.notice.set(c.isActive ? `"${c.name}" ngừng dùng — phiếu cũ giữ nguyên.` : `"${c.name}" dùng lại.`);
  }
}
