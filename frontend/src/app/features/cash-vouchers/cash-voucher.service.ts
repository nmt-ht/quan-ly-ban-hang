import { Injectable } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { AuthService } from '../../core/services/auth.service';
import { CashAllocation, CashVoucher, VoucherKind } from '../../core/models/domain.models';
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
    const delta = d.kind === 'THU' ? d.amount : -d.amount;
    this.data.cashAccounts.update((list) => list.map((a) => (a.id === d.accountId ? { ...a, balance: a.balance + delta } : a)));
    return voucher;
  }
}
