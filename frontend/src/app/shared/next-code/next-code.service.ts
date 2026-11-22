import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/api/api.service';

/** The number prefix of each phiếu kho by type (the server's VOUCHER_PREFIX). */
export const WAREHOUSE_PREFIX: Record<string, string> = { NHAP: 'PNK', XUAT: 'PXK', CHUYEN: 'PCK', KIEM_KE: 'PKK' };

/**
 * The number a new chứng từ will probably get ("dự kiến"). It is only read: the real number is cut inside the saving transaction, so
 * it can differ when someone else saves first. After a save, `noteIfChanged` says so.
 */
@Injectable({ providedIn: 'root' })
export class NextCodeService {
  private readonly api = inject(ApiService);
  /** What each form showed, to compare with the number the save really took. */
  private readonly shown = new Map<string, string>();

  /** null when the server cannot say (the form then shows "Tự sinh khi lưu"). */
  async peek(prefix: string): Promise<string | null> {
    try {
      const code = (await this.api.get<{ code: string }>(`/sequences/next?prefix=${encodeURIComponent(prefix)}`)).code;
      this.shown.set(prefix, code);
      return code;
    } catch {
      return null;
    }
  }

  /** "" when the saved number is the one the form showed; else a sentence for the notice after the save. */
  noteIfChanged(prefix: string, saved: string): string {
    const was = this.shown.get(prefix);
    this.shown.delete(prefix);
    return was && was !== saved ? `Số chứng từ là ${saved} (không phải ${was} như dự kiến: có người lưu trước).` : '';
  }
}
