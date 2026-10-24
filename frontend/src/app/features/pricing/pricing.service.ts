import { Injectable, inject } from '@angular/core';
import { DataStore } from '../../core/services/data-store.service';
import { CustomerType, DiscountType, PriceList, PriceListItem, Promotion, PromotionKind, PromotionScope } from '../../core/models/domain.models';
import { ApiService, upsertById } from '../../core/api/api.service';

export interface PriceListDraft {
  name: string;
  note?: string;
  isActive: boolean;
  items: PriceListItem[];
}

export interface PromotionDraft {
  name: string;
  kind: PromotionKind;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  note?: string;
  scope: PromotionScope;
  customerTypes: CustomerType[];
  priceListIds: string[];
  productIds: string[];
  categoryIds: string[];
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  tiers: { minQuantity: number; value: number }[];
  buyQuantity: number;
  giftProductId?: string;
  giftQuantity: number;
}

/** Trạng thái chương trình hôm nay, cho danh sách. */
export type PromotionState = 'DANG_CHAY' | 'SAP_CHAY' | 'HET_HAN' | 'DA_DUNG';
export const PROMOTION_STATE_LABEL: Record<PromotionState, string> = {
  DANG_CHAY: 'Đang chạy', SAP_CHAY: 'Sắp chạy', HET_HAN: 'Đã hết hạn', DA_DUNG: 'Đã dừng',
};
export function promotionState(p: Promotion, today: string): PromotionState {
  if (!p.isActive) return 'DA_DUNG';
  if (p.startDate.slice(0, 10) > today) return 'SAP_CHAY';
  if (p.endDate && p.endDate.slice(0, 10) < today) return 'HET_HAN';
  return 'DANG_CHAY';
}

// Bảng giá and khuyến mãi (Pha 1.6): saved on the server, kept in DataStore so the order and báo giá forms price with them.
@Injectable({ providedIn: 'root' })
export class PricingService {
  private readonly data = inject(DataStore);
  private readonly api = inject(ApiService);

  async saveList(id: string | null, d: PriceListDraft): Promise<PriceList> {
    const l = id ? await this.api.put<PriceList>(`/price-lists/${id}`, d) : await this.api.post<PriceList>('/price-lists', d);
    this.data.priceLists.update((list) => upsertById(list, l).sort((a, b) => a.name.localeCompare(b.name, 'vi')));
    return l;
  }

  async savePromotion(id: string | null, d: PromotionDraft): Promise<Promotion> {
    return this.keep(id ? await this.api.put<Promotion>(`/promotions/${id}`, d) : await this.api.post<Promotion>('/promotions', d));
  }

  async setPromotionActive(id: string, isActive: boolean): Promise<Promotion> {
    return this.keep(await this.api.post<Promotion>(`/promotions/${id}/active`, { isActive }));
  }

  private keep(p: Promotion): Promotion {
    this.data.promotions.update((list) => upsertById(list, p));
    return p;
  }
}
