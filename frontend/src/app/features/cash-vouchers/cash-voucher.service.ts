import { Injectable, inject } from '@angular/core';
import { DataStore } from '../../core/services/data-store.service';
import { CashAccount, CashAllocation, CashCategory, CashVoucher, VoucherKind } from '../../core/models/domain.models';
import { PartnerType } from './cash-voucher.rules';
import { ApiService, upsertById } from '../../core/api/api.service';
import { onDemand, pageQuery } from '../../core/api/on-demand';

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

/** Bộ lọc của danh sách phiếu thu chi theo trang (Pha 1.1) — the server's CashVoucherPageQuery. */
export interface CashVoucherPageQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  kind?: VoucherKind;
  categories?: string[];
  method?: 'TIEN_MAT' | 'NGAN_HANG';
  accountId?: string;
  partnerType?: PartnerType;
  partnerId?: string;
  createdBy?: string[];
  from?: string;
  to?: string;
  min?: number;
  max?: number;
  cancelled?: boolean;
  sort?: string;
  dir?: 'asc' | 'desc';
}

export interface CashPeriodCards {
  thu: number;
  thuCash: number;
  thuBank: number;
  chi: number;
  chiCash: number;
  chiBank: number;
  net: number;
  count: number;
}

export interface CashVoucherPage {
  rows: CashVoucher[];
  total: number;
  page: number;
  pageSize: number;
  categoryCounts: Record<string, number>;
  cards: CashPeriodCards;
}

// Writes for Phiếu thu chi, tài khoản tiền and loại thu chi. The server numbers the phiếu, checks the
// đối trừ and derives số dư quỹ.
@Injectable({ providedIn: 'root' })
export class CashVoucherService {
  private readonly api = inject(ApiService);
  private readonly data = inject(DataStore);

  private readonly older = onDemand(this.api, this.data.cashVouchers, '/cash-vouchers');

  // ---------- Pha 1.1: phiếu không nạp sẵn ----------

  /** One page of the list, filtered, sorted and totalled on the server. */
  page(q: CashVoucherPageQuery): Promise<CashVoucherPage> {
    return this.api.get<CashVoucherPage>(`/cash-vouchers/page${pageQuery(q)}`);
  }

  /** Phiếu older than the window, by id or số phiếu. */
  ensureMany(ids: string[], codes: string[] = []): Promise<void> {
    return this.older.byIds(ids, codes);
  }

  /** Every phiếu naming a chứng từ (đối trừ chọn tay, or its mã in the diễn giải). */
  ensureFor(ref: string): Promise<void> {
    return this.older.where({ ref });
  }

  /** Số phiếu chưa huỷ của từng tài khoản và từng loại ("THU|Tên loại") trên toàn bộ lịch sử. */
  usage(): Promise<{ accounts: Record<string, number>; categories: Record<string, number> }> {
    return this.api.get('/cash-vouchers/usage');
  }

  async create(d: CashVoucherDraft): Promise<CashVoucher> {
    const v = await this.api.post<CashVoucher>('/cash-vouchers', {
      ...d,
      partnerId: d.partnerType === 'KHAC' ? undefined : d.partnerId,
      allocations: d.allocations?.length ? d.allocations : undefined,
    });
    this.data.cashVouchers.update((list) => [v, ...list]);
    await this.refreshBalances();
    return v;
  }

  /**
   * Huỷ phiếu: không xoá, phiếu vẫn hiện (lọc "Hiện phiếu đã huỷ"); không tính vào số dư quỹ, báo cáo
   * và đối trừ công nợ nữa — công nợ đọc lại từ server nên tự mở lại.
   */
  async cancel(id: string, reason: string): Promise<void> {
    const v = await this.api.post<CashVoucher>(`/cash-vouchers/${id}/cancel`, { reason: reason.trim() || undefined });
    this.data.cashVouchers.update((list) => upsertById(list, v));
    await this.refreshBalances();
  }

  /** Số dư quỹ as of now, read from the server (which sums the phiếu). */
  async refreshBalances(): Promise<void> {
    this.data.cashAccounts.set(await this.api.get<CashAccount[]>('/cash-accounts'));
  }

  // ---------- tài khoản tiền ----------

  async saveAccount(a: Omit<CashAccount, 'balance' | 'id'> & { id?: string }): Promise<CashAccount> {
    const { id, ...body } = a;
    const saved = id ? await this.api.put<CashAccount>(`/cash-accounts/${id}`, body) : await this.api.post<CashAccount>('/cash-accounts', body);
    // Only one default: the server cleared the others, so the whole list is read again.
    await this.refreshBalances();
    return saved;
  }

  /** Ngừng dùng (không xoá): phiếu cũ giữ nguyên, tài khoản không chọn được khi lập phiếu mới. */
  async setAccountActive(id: string, isActive: boolean): Promise<void> {
    const saved = await this.api.patch<CashAccount>(`/cash-accounts/${id}/active`, { isActive });
    this.data.cashAccounts.update((list) => upsertById(list, saved, true));
  }

  // ---------- loại thu chi ----------

  async saveCategory(c: CashCategory): Promise<void> {
    const old = this.data.cashCategories().find((x) => x.code === c.code);
    const { code, isSystem: _s, ...body } = c;
    await this.api.put<CashCategory>(`/cash-categories/${code}`, body);
    // Phiếu lưu tên loại: đổi tên thì phiếu cũ đổi theo để thống kê không bị tách đôi.
    // (The server renames its own; this keeps the loaded list in step.)
    if (old && old.name !== c.name) {
      this.data.cashVouchers.update((vs) => vs.map((v) => (v.kind === old.kind && v.category === old.name ? { ...v, category: c.name } : v)));
    }
    // The default flag moves between rows on the server: read the list again.
    this.data.cashCategories.set(await this.api.get<CashCategory[]>('/cash-categories'));
  }

  async setCategoryActive(code: string, isActive: boolean): Promise<void> {
    const saved = await this.api.patch<CashCategory>(`/cash-categories/${code}/active`, { isActive });
    this.data.cashCategories.update((list) => list.map((c) => (c.code === code ? saved : c)));
  }
}
