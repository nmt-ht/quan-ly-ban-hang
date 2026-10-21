import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { CashAccount, CashAccountType } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { MoneyInputDirective } from '../../../shared/money-input.directive';
import { formatVnd } from '../../../shared/format.util';
import { CashVoucherService } from '../cash-voucher.service';

interface Draft {
  id?: string;
  code: string;
  type: CashAccountType;
  name: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  openingBalance: number | null;
  sortOrder: number | null;
  note: string;
  isDefault: boolean;
  isActive: boolean;
}

const EMPTY: Draft = {
  code: '', type: 'TIEN_MAT', name: '', bankName: '', accountNumber: '', accountHolder: '', branch: '',
  openingBalance: null, sortOrder: 0, note: '', isDefault: false, isActive: true,
};

// /thu-chi/tai-khoan — quỹ tiền mặt và các tài khoản ngân hàng; số dư tính riêng từng cái.
@Component({
  selector: 'app-cash-accounts',
  standalone: true,
  imports: [FormsModule, RouterLink, NavIconComponent, MoneyInputDirective],
  templateUrl: './cash-accounts.component.html',
  styleUrls: [
    '../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
    '../../delivery-trips/trip-header-dialog/trip-header-dialog.component.scss',
    './cash-accounts.component.scss',
  ],
})
export class CashAccountsComponent {
  readonly data = inject(MockDataService);
  private readonly svc = inject(CashVoucherService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly money = formatVnd;
  readonly notice = signal('');
  readonly draft = signal<Draft>({ ...EMPTY });
  readonly attempted = signal(false);

  constructor() {
    this.svc.recomputeBalances();
  }

  private readonly voucherCount = computed(() => {
    const m = new Map<string, number>();
    for (const v of this.data.cashVouchers()) if (!v.isCancelled) m.set(v.accountId, (m.get(v.accountId) ?? 0) + 1);
    return m;
  });

  count(id: string): number {
    return this.voucherCount().get(id) ?? 0;
  }

  readonly groups = computed(() => {
    const sorted = [...this.data.cashAccounts()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'vi'));
    return [
      { type: 'TIEN_MAT' as const, label: 'Tiền mặt', items: sorted.filter((a) => a.type === 'TIEN_MAT') },
      { type: 'NGAN_HANG' as const, label: 'Ngân hàng', items: sorted.filter((a) => a.type === 'NGAN_HANG') },
    ];
  });

  readonly total = computed(() => this.data.cashAccounts().filter((a) => a.isActive !== false).reduce((s, a) => s + a.balance, 0));

  open(a?: CashAccount): void {
    this.draft.set(a ? {
      id: a.id, code: a.code ?? '', type: a.type, name: a.name, bankName: a.bankName ?? '', accountNumber: a.accountNumber ?? '',
      accountHolder: a.accountHolder ?? '', branch: a.branch ?? '', openingBalance: a.openingBalance || null, sortOrder: a.sortOrder ?? 0,
      note: a.note ?? '', isDefault: !!a.isDefault, isActive: a.isActive !== false,
    } : { ...EMPTY, sortOrder: this.data.cashAccounts().length });
    this.attempted.set(false);
    this.dialog().nativeElement.showModal();
    setTimeout(() => document.getElementById('ca-name')?.focus());
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  patch(change: Partial<Draft>): void {
    this.draft.update((d) => ({ ...d, ...change }));
  }

  readonly issues = computed(() => {
    const d = this.draft();
    const out: string[] = [];
    if (!d.name.trim()) out.push('Nhập tên tài khoản');
    if (d.type === 'NGAN_HANG' && !d.accountNumber.trim()) out.push('Nhập số tài khoản ngân hàng');
    const dupCode = d.code.trim() && this.data.cashAccounts().find((a) => a.id !== d.id && (a.code ?? '').toUpperCase() === d.code.trim().toUpperCase());
    if (dupCode) out.push(`Mã ${d.code.trim()} đã dùng cho ${dupCode.name}`);
    return out;
  });

  save(): void {
    this.attempted.set(true);
    if (this.issues().length) return;
    const d = this.draft();
    const bank = d.type === 'NGAN_HANG';
    const a = this.svc.saveAccount({
      id: d.id,
      code: d.code.trim() || undefined,
      type: d.type,
      name: d.name.trim(),
      bankName: bank ? d.bankName.trim() || undefined : undefined,
      accountNumber: bank ? d.accountNumber.trim() : undefined,
      accountHolder: bank ? d.accountHolder.trim() || undefined : undefined,
      branch: bank ? d.branch.trim() || undefined : undefined,
      openingBalance: d.openingBalance ?? 0,
      sortOrder: d.sortOrder ?? 0,
      note: d.note.trim() || undefined,
      isDefault: d.isDefault && d.isActive,
      isActive: d.isActive,
    });
    this.close();
    this.notice.set(d.id ? `Đã lưu ${a.name}.` : `Đã thêm ${a.name}.`);
  }

  toggleActive(a: CashAccount): void {
    const on = a.isActive === false;
    this.svc.setAccountActive(a.id, on);
    this.notice.set(on ? `${a.name} dùng lại.` : `${a.name} ngừng dùng — phiếu cũ giữ nguyên, không chọn được khi lập phiếu mới.`);
  }
}
