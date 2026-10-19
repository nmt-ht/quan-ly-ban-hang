import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { MockDataService } from '../../core/services/mock-data.service';
import { DebtService } from '../../core/services/debt.service';
import { formatVnd } from '../../shared/format.util';
import { SalesOrder } from '../../core/models/domain.models';

const DAY = 86_400_000;
const PERIOD_DAYS = 30;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, StatCardComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  readonly today = new Date().toLocaleDateString('vi-VN');
  readonly periodDays = PERIOD_DAYS;
  readonly formatVnd = formatVnd;

  private readonly now = new Date(new Date().toISOString().slice(0, 10)).getTime();
  private readonly start = this.now - (PERIOD_DAYS - 1) * DAY;
  private readonly prevStart = this.start - PERIOD_DAYS * DAY;

  private inRange(o: SalesOrder, from: number, to: number): boolean {
    const d = o.deliveredDate ? new Date(o.deliveredDate).getTime() : NaN;
    return o.receivedValue > 0 && d >= from && d < to;
  }

  readonly current = computed(() => this.data.salesOrders().filter((o) => this.inRange(o, this.start, this.now + DAY)));
  readonly previous = computed(() => this.data.salesOrders().filter((o) => this.inRange(o, this.prevStart, this.start)));

  readonly revenue = computed(() => this.current().reduce((s, o) => s + o.receivedValue, 0));
  readonly prevRevenue = computed(() => this.previous().reduce((s, o) => s + o.receivedValue, 0));
  readonly orderCount = computed(() => this.current().length);
  readonly avgOrder = computed(() => (this.orderCount() ? Math.round(this.revenue() / this.orderCount()) : 0));
  readonly discountGiven = computed(() => this.current().reduce((s, o) => s + o.discountAmount, 0));

  readonly pendingProduction = computed(() => this.data.salesOrders().filter((o) => o.status === 'CHO_SAN_XUAT').length);
  readonly shipping = computed(() => this.data.salesOrders().filter((o) => o.status === 'DANG_GIAO').length);

  readonly belowMin = computed(() => {
    const byProduct = new Map<string, number>();
    for (const s of this.data.stockLevels()) byProduct.set(s.productId, (byProduct.get(s.productId) ?? 0) + s.quantity);
    return this.data.products().filter(
      (p) => p.type !== 'DICH_VU' && p.isActive && p.minStock > 0 && (byProduct.get(p.id) ?? 0) < p.minStock,
    ).length;
  });

  readonly byDay = computed(() => {
    const map = new Map<string, number>();
    for (const o of this.current()) {
      const k = o.deliveredDate!.slice(0, 10);
      map.set(k, (map.get(k) ?? 0) + o.receivedValue);
    }
    const days = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const max = Math.max(1, ...days.map((d) => d[1]));
    return days.map(([date, value]) => ({ date, value, pct: Math.round((value / max) * 100) }));
  });

  readonly topProducts = computed(() => {
    const map = new Map<string, { qty: number; value: number }>();
    for (const o of this.current()) {
      for (const l of o.lines) {
        const qty = l.receivedQuantity ?? 0;
        if (!qty) continue;
        const cur = map.get(l.productId) ?? { qty: 0, value: 0 };
        cur.qty += qty;
        cur.value += qty * l.unitPrice;
        map.set(l.productId, cur);
      }
    }
    return [...map.entries()]
      .map(([id, v]) => ({
        name: this.data.products().find((p) => p.id === id)?.name ?? id,
        unit: this.data.products().find((p) => p.id === id)?.baseUnit ?? '',
        ...v,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  });

  private vouchersInPeriod = computed(() =>
    this.data.cashVouchers().filter((v) => !v.isCancelled && v.date >= isoDay(this.start) && v.date <= isoDay(this.now)),
  );
  readonly cashIn = computed(() => this.vouchersInPeriod().filter((v) => v.kind === 'THU').reduce((s, v) => s + v.amount, 0));
  readonly cashOut = computed(() => this.vouchersInPeriod().filter((v) => v.kind === 'CHI').reduce((s, v) => s + v.amount, 0));
  readonly cashBalance = computed(() => this.data.cashAccounts().reduce((s, a) => s + a.balance, 0));

  constructor(readonly data: MockDataService, readonly debt: DebtService) {}
}
