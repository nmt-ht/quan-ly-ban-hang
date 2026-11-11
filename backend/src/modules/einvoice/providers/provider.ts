// What every hoá đơn điện tử provider adapter does. EInvoiceService speaks only this; an adapter maps the neutral
// ProviderInvoice (einvoice.rules.ts) to the provider's own API.
import type { ProviderInvoice } from '../einvoice.rules.js';

/** Where a hoá đơn stands at the provider. PENDING: accepted, waiting for ký số / mã của cơ quan thuế. */
export interface ProviderResult {
  state: 'PENDING' | 'ISSUED' | 'FAILED';
  /** The provider's id of the hoá đơn (transaction id). */
  ref?: string | null;
  number?: string | null;
  taxAuthorityCode?: string | null;
  lookupCode?: string | null;
  /** FAILED: why, in words the user can act on. */
  error?: string | null;
}

export interface EInvoiceProvider {
  readonly name: string;
  /** "Kết nối thử": signs in, answers the account / ký hiệu the provider sees, or throws. */
  test(): Promise<string>;
  /**
   * Sends a hoá đơn (gốc, điều chỉnh or thay thế — `inv.kind`, with `inv.original`). Must be idempotent on `inv.key`:
   * sending the same key again answers the hoá đơn already made. Throws only when the outcome is unknown (network,
   * timeout) — the caller then asks status() later and never sends again blindly.
   */
  issue(inv: ProviderInvoice): Promise<ProviderResult>;
  /** Where the hoá đơn sent with `key` stands. FAILED with no ref means the provider has no hoá đơn for that key. */
  status(key: string, ref: string | null): Promise<ProviderResult>;
}

/** An outcome that is not known yet: the network failed, or the provider did not answer in time. */
export class ProviderUnreachableError extends Error {}
