import { Injectable, inject } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { AuthService } from '../../core/services/auth.service';
import { CashAccount, CashAllocation, CashCategory, CashVoucher, VoucherKind } from '../../core/models/domain.models';
import { nextCode } from '../purchase-orders/purchase-order.rules';
import { VOUCHER_PREFIX, PartnerType } from './cash-voucher.rules';
import { ApiService, upsertById } from '../../core/api/api.service';
import { CASH_FROM_API, CATALOG_FROM_API } from '../../core/api/api.config';

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

// Writes for Phiếu thu chi: the API (CASH_FROM_API) — the server numbers the phiếu, checks the đối trừ
// and derives số dư quỹ — or, in demo mode, the in-browser store. Tài khoản tiền and loại thu chi go to
// the API with the danh mục (CATALOG_FROM_API).
@Injectable({ providedIn: 'root' })
export class CashVoucherService {
  private readonly api = inject(ApiService);

  constructor(
    private readonly data: MockDataService,
    private readonly auth: AuthService,
  ) {}

  async create(d: CashVoucherDraft): Promise<CashVoucher> {
    if (CASH_FROM_API) {
      const v = await this.api.post<CashVoucher>('/cash-vouchers', {
        ...d,
        partnerId: d.partnerType === 'KHAC' ? undefined : d.partnerId,
        allocations: d.allocations?.length ? d.allocations : undefined,
      });
      this.data.cashVouchers.update((list) => [v, ...list]);
      await this.refreshBalances();
      return v;
    }
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
    this.recomputeLocal();
    return voucher;
  }

  /**
   * Huỷ phiếu: không xoá, phiếu vẫn hiện (lọc "Hiện phiếu đã huỷ"); không tính vào số dư quỹ, báo cáo
   * và đối trừ công nợ nữa — DebtService đã bỏ qua phiếu huỷ nên công nợ tự mở lại.
   */
  async cancel(id: string, reason: string): Promise<void> {
    if (CASH_FROM_API) {
      const v = await this.api.post<CashVoucher>(`/cash-vouchers/${id}/cancel`, { reason: reason.trim() || undefined });
      this.data.cashVouchers.update((list) => upsertById(list, v));
      await this.refreshBalances();
      return;
    }
    this.data.cashVouchers.update((list) =>
      list.map((v) => (v.id === id && !v.isCancelled
        ? { ...v, isCancelled: true, cancelReason: reason.trim() || undefined, cancelledAt: new Date().toISOString() }
        : v)),
    );
    this.recomputeLocal();
  }

  /** Số dư quỹ as of now: read from the server (which sums the phiếu), or recomputed in demo mode. */
  async refreshBalances(): Promise<void> {
    if (CASH_FROM_API) {
      this.data.cashAccounts.set(await this.api.get<CashAccount[]>('/cash-accounts'));
      return;
    }
    this.recomputeLocal();
  }

  /** Số dư từng tài khoản = số dư đầu kỳ + thu − chi của phiếu chưa huỷ. */
  private recomputeLocal(): void {
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

  async saveAccount(a: Omit<CashAccount, 'balance' | 'id'> & { id?: string }): Promise<CashAccount> {
    if (CATALOG_FROM_API) {
      const { id, ...body } = a;
      const saved = id ? await this.api.put<CashAccount>(`/cash-accounts/${id}`, body) : await this.api.post<CashAccount>('/cash-accounts', body);
      // Only one default: the server cleared the others, so the whole list is read again.
      this.data.cashAccounts.set(await this.api.get<CashAccount[]>('/cash-accounts'));
      return saved;
    }
    const exists = !!a.id && this.data.cashAccounts().some((x) => x.id === a.id);
    const next: CashAccount = { ...a, id: a.id || crypto.randomUUID(), balance: 0 };
    this.data.cashAccounts.update((list) => {
      // "Chọn sẵn khi lập phiếu": chỉ một tài khoản mặc định.
      const base = next.isDefault ? list.map((x) => ({ ...x, isDefault: false })) : list;
      return exists ? base.map((x) => (x.id === next.id ? next : x)) : [...base, next];
    });
    this.recomputeLocal();
    return this.data.cashAccounts().find((x) => x.id === next.id)!;
  }

  /** Ngừng dùng (không xoá): phiếu cũ giữ nguyên, tài khoản không chọn được khi lập phiếu mới. */
  async setAccountActive(id: string, isActive: boolean): Promise<void> {
    if (CATALOG_FROM_API) {
      const saved = await this.api.patch<CashAccount>(`/cash-accounts/${id}/active`, { isActive });
      this.data.cashAccounts.update((list) => upsertById(list, saved, true));
      return;
    }
    this.data.cashAccounts.update((list) => list.map((a) => (a.id === id ? { ...a, isActive, isDefault: isActive ? a.isDefault : false } : a)));
  }

  // ---------- loại thu chi ----------

  async saveCategory(c: CashCategory): Promise<void> {
    const list = this.data.cashCategories();
    const old = list.find((x) => x.code === c.code);
    const exists = !!old;
    if (CATALOG_FROM_API) {
      const { code, isSystem: _s, ...body } = c;
      await this.api.put<CashCategory>(`/cash-categories/${code}`, body);
    }
    // Phiếu lưu tên loại: đổi tên thì phiếu cũ đổi theo để thống kê không bị tách đôi.
    // (The server renames its own; this keeps the loaded list in step.)
    if (old && old.name !== c.name) {
      this.data.cashVouchers.update((vs) => vs.map((v) => (v.kind === old.kind && v.category === old.name ? { ...v, category: c.name } : v)));
    }
    if (CATALOG_FROM_API) {
      // The default flag moves between rows on the server: read the list again.
      this.data.cashCategories.set(await this.api.get<CashCategory[]>('/cash-categories'));
      return;
    }
    const base = c.isDefault ? list.map((x) => (x.kind === c.kind ? { ...x, isDefault: false } : x)) : list;
    this.data.cashCategories.set(exists ? base.map((x) => (x.code === c.code ? c : x)) : [...base, c]);
  }

  async setCategoryActive(code: string, isActive: boolean): Promise<void> {
    if (CATALOG_FROM_API) {
      const saved = await this.api.patch<CashCategory>(`/cash-categories/${code}/active`, { isActive });
      this.data.cashCategories.update((list) => list.map((c) => (c.code === code ? saved : c)));
      return;
    }
    this.data.cashCategories.update((list) =>
      list.map((c) => (c.code === code ? { ...c, isActive, isDefault: isActive ? c.isDefault : false } : c)),
    );
  }
}
