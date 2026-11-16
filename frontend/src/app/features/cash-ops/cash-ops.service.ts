import { Injectable, inject } from '@angular/core';
import { ApiService, upsertById } from '../../core/api/api.service';
import { DataStore } from '../../core/services/data-store.service';
import { CashAccount, CashVoucher } from '../../core/models/domain.models';
import {
  CashCountInput, CashCountView, CashFlowView, CashTransferInput, CashTransferView, CountResolution, ReconciliationView, StatementRowInput,
} from '../../core/models/cash-ops.models';

/** Chuyển tiền nội bộ, kiểm kê quỹ, đối chiếu sao kê ngân hàng và lưu chuyển tiền tệ. */
@Injectable({ providedIn: 'root' })
export class CashOpsService {
  private readonly api = inject(ApiService);
  private readonly data = inject(DataStore);

  /** Số dư các quỹ và hai phiếu của một chuyển tiền đã đổi: đọc lại để màn hình Thu, chi tiền thấy ngay. */
  private async refreshCash(t: CashTransferView): Promise<void> {
    const [accounts, vouchers] = await Promise.all([
      this.api.get<CashAccount[]>('/cash-accounts'),
      this.api.get<CashVoucher[]>('/cash-vouchers?codes=' + [t.outVoucherCode, t.inVoucherCode].join(',')),
    ]);
    this.data.cashAccounts.set(accounts);
    this.data.cashVouchers.update((list) => vouchers.reduce((acc, v) => upsertById(acc, v), list));
  }

  // ---------- chuyển tiền nội bộ ----------
  transfers() {
    return this.api.get<CashTransferView[]>('/cash-transfers');
  }

  async createTransfer(dto: CashTransferInput) {
    const t = await this.api.post<CashTransferView>('/cash-transfers', dto);
    await this.refreshCash(t);
    return t;
  }

  async cancelTransfer(id: string, reason?: string) {
    const t = await this.api.post<CashTransferView>(`/cash-transfers/${id}/cancel`, { reason });
    await this.refreshCash(t);
    return t;
  }

  // ---------- kiểm kê quỹ ----------
  counts() {
    return this.api.get<CashCountView[]>('/cash-counts');
  }

  bookAmount(accountId: string, date: string) {
    return this.api.get<{ bookAmount: number }>(`/cash-counts/book/${accountId}/${date}`);
  }

  createCount(dto: CashCountInput) {
    return this.api.post<CashCountView>('/cash-counts', dto);
  }

  /** Số dư các quỹ và phiếu xử lý chênh lệch đã đổi: đọc lại để màn hình Thu, chi tiền thấy ngay. */
  private async refreshCount(...voucherCodes: (string | undefined)[]): Promise<void> {
    const codes = voucherCodes.filter((c): c is string => !!c);
    const [accounts, vouchers] = await Promise.all([
      this.api.get<CashAccount[]>('/cash-accounts'),
      codes.length ? this.api.get<CashVoucher[]>('/cash-vouchers?codes=' + codes.join(',')) : Promise.resolve([] as CashVoucher[]),
    ]);
    this.data.cashAccounts.set(accounts);
    this.data.cashVouchers.update((list) => vouchers.reduce((acc, v) => upsertById(acc, v), list));
  }

  async cancelCount(c: CashCountView, reason?: string) {
    const out = await this.api.post<CashCountView>(`/cash-counts/${c.id}/cancel`, { reason });
    if (c.resolutionVoucherCode) await this.refreshCount(c.resolutionVoucherCode);
    return out;
  }

  /** Lập phiếu thu / chi xử lý chênh lệch của biên bản. */
  async resolveCount(c: CashCountView, option: CountResolution) {
    const out = await this.api.post<CashCountView>(`/cash-counts/${c.id}/resolve`, { option });
    await this.refreshCount(out.resolutionVoucherCode);
    return out;
  }

  /** Huỷ phiếu xử lý chênh lệch: biên bản trở lại chưa xử lý. */
  async unresolveCount(c: CashCountView, reason?: string) {
    const out = await this.api.post<CashCountView>(`/cash-counts/${c.id}/unresolve`, { reason });
    await this.refreshCount(c.resolutionVoucherCode);
    return out;
  }

  // ---------- đối chiếu sao kê ----------
  reconciliation(accountId: string, from: string, to: string) {
    return this.api.get<ReconciliationView>('/bank-reconciliation?' + new URLSearchParams({ accountId, from, to }).toString());
  }

  importStatement(accountId: string, rows: StatementRowInput[]) {
    return this.api.post<{ inserted: number; skipped: number }>('/bank-reconciliation/import', { accountId, rows });
  }

  autoMatch(accountId: string, from: string, to: string) {
    return this.api.post<{ matched: number; lines: number }>('/bank-reconciliation/auto-match', { accountId, from, to });
  }

  match(lineId: string, voucherId: string) {
    return this.api.post<{ ok: boolean }>(`/bank-reconciliation/lines/${lineId}/match`, { voucherId });
  }

  unmatch(lineId: string) {
    return this.api.post<{ ok: boolean }>(`/bank-reconciliation/lines/${lineId}/unmatch`);
  }

  removeLine(lineId: string) {
    return this.api.post<{ ok: boolean }>(`/bank-reconciliation/lines/${lineId}/delete`);
  }

  // ---------- lưu chuyển tiền tệ ----------
  cashFlow(from: string, to: string) {
    return this.api.get<CashFlowView>('/accounting/cash-flow?' + new URLSearchParams({ from, to }).toString());
  }
}
