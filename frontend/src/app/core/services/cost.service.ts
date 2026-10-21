import { Injectable, computed } from '@angular/core';
import { MockDataService } from './mock-data.service';

/**
 * Giá vốn ước tính theo ĐVT chính — there is no costing engine yet:
 * vật tư = giá nhập gần nhất (đơn nhập chưa huỷ), thành phẩm = định mức × giá vật tư, dịch vụ = 0.
 * Used by Tổng quan (lãi gộp, bán dưới giá vốn) and Tồn kho (giá trị tồn).
 */
@Injectable({ providedIn: 'root' })
export class CostService {
  constructor(private readonly data: MockDataService) {}

  readonly unitCost = computed(() => {
    const last = new Map<string, { date: string; price: number }>();
    for (const o of this.data.purchaseOrders()) {
      if (o.status === 'HUY') continue;
      for (const l of o.lines) {
        const price = l.unitPrice / (l.ratioToBase ?? 1);
        const cur = last.get(l.productId);
        if (!cur || o.date > cur.date) last.set(l.productId, { date: o.date, price });
      }
    }
    const cost = new Map<string, number>();
    for (const p of this.data.products()) {
      if (p.type === 'DICH_VU') cost.set(p.id, 0);
      else if (p.type === 'THANH_PHAM') {
        const bom = this.data.bomLines().filter((b) => b.finishedProductId === p.id);
        cost.set(p.id, bom.reduce((s, b) => s + b.quantityPerUnit * (last.get(b.componentId)?.price ?? 0), 0));
      } else cost.set(p.id, last.get(p.id)?.price ?? 0);
    }
    return cost;
  });

  costOf(productId: string): number {
    return this.unitCost().get(productId) ?? 0;
  }
}
