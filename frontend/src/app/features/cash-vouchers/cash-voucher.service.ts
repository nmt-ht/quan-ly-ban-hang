import { Injectable } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { AuthService } from '../../core/services/auth.service';
import { CashAccount, CashAllocation, CashCategory, CashVoucher, VoucherKind } from '../../core/models/domain.models';
import { nextCode } from '../purchase-orders/purchase-order.rules';
import { VOUCHER_PREFIX, PartnerType } from './cash-voucher.rules';

export interface CashVoucherDraft {
  kind: VoucherKind;
  date: string;
  category: string;
  partnerType: PartnerType;
  partnerId?: string;
  accountId: string;
  amount: number;
  description?: string;
  /** Chỉ khi đối trừ "Chọn tay"; bỏ trống = tự động (cũ nhất trước). */
  allocations?: CashAllocation[];
  /** Số tiền đối trừ vào công nợ hiện có (phần còn lại là trả trước). */
  settledAmount: number;
}

// Writes for Phiếu thu chi. Against the mock store today; maps 1:1 to backend endpoints later.
@Injectable({ providedIn: 'root' })
export class CashVoucherService {
  constructor(
    private readonly data: MockDataService,
    private readonly auth: AuthService,
  ) {}

  create(d: CashVoucherDraft): CashVoucher {
    if (!(d.amount > 0)) throw new Error('Số tiền phải lớn hơn 0');
    if (d.partnerType !== 'KHAC' && !d.partnerId) throw new Error('Thiếu đối tác');
    if (!this.data.cashAccounts().some((a) => a.id === d.accountId)) throw new Error('Tài khoản tiền không tồn tại');
    const prefix = VOUCHER_PREFIX[d.kind];
    const codes = this.data.cashVouchers().filter((v) => v.code.startsWith(prefix)).map((v) => v.code);
    const voucher: CashVoucher = {
      id: crypto.randomUUID(),
      code: nextCode(codes, prefix),
      date: d.date,
      kind: d.kind,
      category: d.category,
      partnerType: d.partnerType,
      partnerId: d.partnerType === 'KHAC' ? undefined : d.partnerId,
      accountId: d.accountId,
      amount: d.amount,
      settledAmount: d.settledAmount,
      description: d.description,
      allocations: d.allocations?.length ? d.allocations : undefined,
      isCancelled: false,
      createdBy: this.auth.user()?.email ?? 'unknown',
      createdAt: new Date().toISOString(),
    };
    this.data.cashVouchers.update((list) => [voucher, ...list]);
    this.recomputeBalances();
    return voucher;
  }

  /**
   * Huỷ phiếu: không xoá, phiếu vẫn hiện (lọc "Hiện phiếu đã huỷ"); không tính vào số dư quỹ, báo cáo
   * và đối trừ công nợ nữa — DebtService đã bỏ qua phiếu huỷ nên công nợ tự mở lại.
   */
  cancel(id: string, reason: string): void {
    this.data.cashVouchers.update((list) =>
      list.map((v) => (v.id === id && !v.isCancelled
        ? { ...v, isCancelled: true, cancelReason: reason.trim() || undefined, cancelledAt: new Date().toISOString() }
        : v)),
    );
    this.recomputeBalances();
  }

  /** Số dư từng tài khoản = số dư đầu kỳ + thu − chi của phiếu chưa huỷ. */
  recomputeBalances(): void {
    const vouchers = this.data.cashVouchers().filter((v) => !v.isCancelled);
    this.data.cashAccounts.update((list) =>
      list.map((a) => ({
        ...a,
        balance: (a.openingBalance ?? 0) + vouchers
          .filter((v) => v.accountId === a.id)
          .reduce((s, v) => s + (v.kind === 'THU' ? v.amount : -v.amount), 0),
      })),
    );
  }

  // ---------- tài khoản tiền ----------

  saveAccount(a: Omit<CashAccount, 'balance' | 'id'> & { id?: string }): CashAccount {
    const exists = !!a.id && this.data.cashAccounts().some((x) => x.id === a.id);
    const next: CashAccount = { ...a, id: a.id || crypto.randomUUID(), balance: 0 };
    this.data.cashAccounts.update((list) => {
      // "Chọn sẵn khi lập phiếu": chỉ một tài khoản mặc định.
      const base = next.isDefault ? list.map((x) => ({ ...x, isDefault: false })) : list;
      return exists ? base.map((x) => (x.id === next.id ? next : x)) : [...base, next];
    });
    this.recomputeBalances();
    return this.data.cashAccounts().find((x) => x.id === next.id)!;
  }

  /** Ngừng dùng (không xoá): phiếu cũ giữ nguyên, tài khoản không chọn được khi lập phiếu mới. */
  setAccountActive(id: string, isActive: boolean): void {
    this.data.cashAccounts.update((list) => list.map((a) => (a.id === id ? { ...a, isActive, isDefault: isActive ? a.isDefault : false } : a)));
  }

  // ---------- loại thu chi ----------

  saveCategory(c: CashCategory): void {
    const list = this.data.cashCategories();
    const old = list.find((x) => x.code === c.code);
    const exists = !!old;
    // Phiếu lưu tên loại: đổi tên thì phiếu cũ đổi theo để thống kê không bị tách đôi.
    if (old && old.name !== c.name) {
      this.data.cashVouchers.update((vs) => vs.map((v) => (v.kind === old.kind && v.category === old.name ? { ...v, category: c.name } : v)));
    }
    const base = c.isDefault ? list.map((x) => (x.kind === c.kind ? { ...x, isDefault: false } : x)) : list;
    this.data.cashCategories.set(exists ? base.map((x) => (x.code === c.code ? c : x)) : [...base, c]);
  }

  setCategoryActive(code: string, isActive: boolean): void {
    this.data.cashCategories.update((list) =>
      list.map((c) => (c.code === code ? { ...c, isActive, isDefault: isActive ? c.isDefault : false } : c)),
    );
  }
}
