import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataStore } from '../../../core/services/data-store.service';
import { AuthService } from '../../../core/services/auth.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { formatVnd } from '../../../shared/format.util';
import { ReorderDraft, ReorderLine, reorderLines } from '../reorder.rules';

interface Row extends ReorderLine {
  picked: boolean;
  quantity: number | null;
}

interface Group {
  supplierId: string;
  name: string;
  rows: Row[];
  picked: Row[];
  value: number;
}

// "Gợi ý lập đơn nhập" (Pha 1.8): vật tư dưới tồn tối thiểu, gom theo NCC gợi ý. Mỗi nhóm lập một đơn nhập Nháp sẵn
// các dòng đã chọn (/mua-hang/them?ncc=… with the lines in history.state) — người dùng xem lại giá, kho rồi mới lưu.
@Component({
  selector: 'app-reorder-dialog',
  standalone: true,
  imports: [FormsModule, NavIconComponent],
  templateUrl: './reorder-dialog.component.html',
  styleUrls: ['../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss', './reorder-dialog.component.scss'],
})
export class ReorderDialogComponent {
  private readonly data = inject(DataStore);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly rows = signal<Row[]>([]);
  readonly money = formatVnd;
  readonly canBuy = computed(() => this.auth.can('purchase.create'));
  readonly suppliers = computed(() => this.data.suppliers().filter((s) => s.isActive));

  /** Rows by NCC: the known ones A → Z, "Chưa rõ nhà cung cấp" last. */
  readonly groups = computed<Group[]>(() => {
    const names = new Map(this.data.suppliers().map((s) => [s.id, s.name]));
    const by = new Map<string, Row[]>();
    for (const r of this.rows()) by.set(r.supplierId, [...(by.get(r.supplierId) ?? []), r]);
    return [...by]
      .map(([supplierId, rows]) => {
        const picked = rows.filter((r) => r.picked && (r.quantity ?? 0) > 0);
        return {
          supplierId, rows, picked, name: supplierId ? (names.get(supplierId) ?? '—') : 'Chưa rõ nhà cung cấp',
          value: picked.reduce((s, r) => s + Math.round((r.quantity ?? 0) * r.price), 0),
        };
      })
      .sort((a, b) => (!a.supplierId ? 1 : !b.supplierId ? -1 : a.name.localeCompare(b.name, 'vi')));
  });

  readonly covered = computed(() => this.rows().filter((r) => r.suggest === 0).length);

  open(): void {
    const lines = reorderLines({
      products: this.data.products(), stockLevels: this.data.stockLevels(), purchaseOrders: this.data.purchaseOrders(),
      suppliers: this.data.suppliers(), supplierProducts: this.data.supplierProducts(),
    });
    this.rows.set(lines.map((l) => ({ ...l, picked: l.suggest > 0, quantity: l.suggest || null })));
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  patch(productId: string, change: Partial<Row>): void {
    this.rows.update((rs) => rs.map((r) => (r.product.id === productId ? { ...r, ...change } : r)));
  }

  /** Moving a row to another NCC takes that NCC's catalogue price, if it lists the item. */
  moveTo(productId: string, supplierId: string): void {
    const listed = this.data.supplierProducts().find((c) => c.supplierId === supplierId && c.productId === productId);
    const row = this.rows().find((r) => r.product.id === productId);
    this.patch(productId, { supplierId, price: listed?.purchasePrice ?? row?.price ?? 0 });
  }

  /** Lập đơn nhập for one NCC: the voucher opens as a new đơn with these lines, nothing is saved yet. */
  createOrder(g: Group): void {
    if (!g.picked.length) return;
    const state: ReorderDraft = { reorder: g.picked.map((r) => ({ productId: r.product.id, quantity: r.quantity ?? 0 })) };
    this.close();
    this.router.navigate(['/mua-hang/them'], { queryParams: g.supplierId ? { ncc: g.supplierId } : {}, state });
  }

  qty(n: number): string {
    return n.toLocaleString('vi-VN');
  }
}
