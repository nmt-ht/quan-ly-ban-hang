import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { AuthService } from './auth.service';
import { DataStore } from './data-store.service';

/**
 * Giá vốn bình quân gia quyền di động theo ĐVT chính, as it stands today (GET /product-costs, Pha 1.3); a product
 * that has not moved since falls back to the old estimate (giá nhập gần nhất / định mức × giá vật tư). The backend computes it and refuses roles without product.view_cost_price
 * or stock.view_value, so the figures never reach a browser that may not show them. Screens still hide
 * what the role may not see with canViewCost / canViewStockValue.
 * Used by Tổng quan, Tồn kho (giá trị tồn), tab Giá vốn của đơn bán and chi phí lệnh sản xuất.
 */
@Injectable({ providedIn: 'root' })
export class CostService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly data = inject(DataStore);

  /** Giá vốn, tab Giá vốn của đơn bán, chi phí lệnh sản xuất. */
  readonly canViewCost = computed(() => this.auth.can('product.view_cost_price'));
  /** Giá trị tồn kho (tồn × giá vốn). */
  readonly canViewStockValue = computed(() => this.auth.can('stock.view_value'));

  private readonly costs = signal<ReadonlyMap<string, number>>(new Map());
  private loadSeq = 0;

  constructor() {
    // Reload when anything the server derives the cost from changes (nhận hàng, sửa đơn nhập, định mức)
    // or the signed-in role changes; clear it when the role may not see costs.
    effect(() => {
      this.data.purchaseOrders();
      this.data.bomLines();
      this.data.products();
      void this.load(this.canViewCost() || this.canViewStockValue());
    });
  }

  private async load(allowed: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    if (!allowed) {
      this.costs.set(new Map());
      return;
    }
    try {
      const body = await this.api.get<Record<string, number>>('/product-costs');
      if (seq === this.loadSeq) this.costs.set(new Map(Object.entries(body)));
    } catch {
      /* offline or refused: costs stay as they were; screens show — for what is missing */
    }
  }

  costOf(productId: string): number {
    return this.costs().get(productId) ?? 0;
  }
}
