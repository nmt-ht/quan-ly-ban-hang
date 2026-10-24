import { Injectable, inject } from '@angular/core';
import { DataStore } from '../../core/services/data-store.service';
import { Quotation, QuotationLine } from '../../core/models/domain.models';
import { ApiService, upsertById } from '../../core/api/api.service';

export interface QuotationDraft {
  customerId: string;
  recipientName?: string;
  recipientPhone?: string;
  deliveryAddress?: string;
  description?: string;
  quoteDate: string;
  validUntil?: string;
  salesRep: string;
  discountAmount: number;
  promotionId?: string;
  lines: QuotationLine[];
}

// Writes for Báo giá. The server checks the rules (đơn giá theo bảng giá without order.update_price, chỉ sửa / huỷ
// khi còn mở) and numbers the BG…; Lập đơn goes through SalesOrderService.create with quotationId.
@Injectable({ providedIn: 'root' })
export class QuotationService {
  private readonly data = inject(DataStore);
  private readonly api = inject(ApiService);

  private keep(q: Quotation): Quotation {
    this.data.quotations.update((list) => upsertById(list, q));
    return q;
  }

  find(id: string): Quotation | undefined {
    return this.data.quotations().find((q) => q.id === id);
  }

  async create(d: QuotationDraft): Promise<Quotation> {
    return this.keep(await this.api.post<Quotation>('/quotations', d));
  }

  async update(id: string, d: QuotationDraft): Promise<Quotation> {
    // updatedAt: the server refuses the save if someone else changed the báo giá since it was loaded.
    return this.keep(await this.api.put<Quotation>(`/quotations/${id}`, { ...d, updatedAt: this.find(id)?.updatedAt }));
  }

  async cancel(id: string, reason: string): Promise<Quotation> {
    return this.keep(await this.api.post<Quotation>(`/quotations/${id}/cancel`, { reason: reason || undefined }));
  }

  /** After Lập đơn: the báo giá is Đã chốt on the server — read it again. */
  async reload(id: string): Promise<void> {
    this.keep(await this.api.get<Quotation>(`/quotations/${id}`));
  }
}
