// "Thử nghiệm (không gửi cơ quan thuế)": a provider that keeps its hoá đơn in memory, for development, demos and tests.
// Accepts a hoá đơn as PENDING, issues it on the next status() call (as a real provider does once ký số and the mã of
// cơ quan thuế come back), and answers the same hoá đơn for the same key. A buyer named "[lỗi]" makes it refuse.
import { randomUUID } from 'node:crypto';
import type { ProviderInvoice } from '../einvoice.rules.js';
import type { EInvoiceProvider, ProviderResult } from './provider.js';

interface Kept {
  ref: string;
  series: string;
  number: string | null;
}

export class FakeProvider implements EInvoiceProvider {
  readonly name = 'FAKE';
  private readonly kept = new Map<string, Kept>();

  /** `nextNumber(series)`: the last số hoá đơn used in that ký hiệu + 1, so numbers stay in order across restarts. */
  constructor(private readonly nextNumber: (series: string) => Promise<number>) {}

  async test(): Promise<string> {
    return 'Môi trường thử nghiệm — hoá đơn không gửi cơ quan thuế.';
  }

  async issue(inv: ProviderInvoice): Promise<ProviderResult> {
    const same = this.kept.get(inv.key);
    if (same) return this.result(same);
    if (inv.buyer.name.includes('[lỗi]') || inv.buyer.companyName.includes('[lỗi]')) return { state: 'FAILED', error: 'Nhà cung cấp thử từ chối hoá đơn (người mua "[lỗi]").' };
    const kept = { ref: randomUUID(), series: inv.series, number: null };
    this.kept.set(inv.key, kept);
    return this.result(kept);
  }

  async status(key: string): Promise<ProviderResult> {
    const kept = this.kept.get(key);
    if (!kept) return { state: 'FAILED', error: 'Nhà cung cấp không có hoá đơn với mã tham chiếu này.' };
    if (!kept.number) kept.number = String(await this.nextNumber(kept.series));
    return this.result(kept);
  }

  private result(k: Kept): ProviderResult {
    if (!k.number) return { state: 'PENDING', ref: k.ref };
    return {
      state: 'ISSUED', ref: k.ref, number: k.number,
      taxAuthorityCode: `M1-${k.series.slice(1, 3)}-FAKE-${k.number.padStart(11, '0')}`, lookupCode: k.ref.slice(0, 8).toUpperCase(),
    };
  }
}
