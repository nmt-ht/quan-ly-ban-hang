import { Component, ElementRef, HostListener, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommandPaletteService } from '../../core/services/command-palette.service';
import { MockDataService } from '../../core/services/mock-data.service';
import { AuthService } from '../../core/services/auth.service';
import { foldVi } from '../../shared/format.util';
import {
  DELIVERY_TRIP_STATUS_LABEL, PRODUCTION_ORDER_STATUS_LABEL, PURCHASE_ORDER_STATUS_LABEL, SALES_ORDER_STATUS_LABEL,
} from '../../shared/status-labels';
import { NAV_GROUPS } from '../nav-items';
import { NavIconComponent, NavIconName } from '../nav-icon/nav-icon.component';

interface Item {
  id: string;
  group: string;
  label: string;
  code?: string;
  hint?: string;
  icon: NavIconName;
  path: string[];
  haystack: string; // folded text the query is matched against
}

const MAX_PER_GROUP = 5;

const CREATE: { label: string; path: string; icon: NavIconName; words: string }[] = [
  { label: 'Lập đơn hàng bán', path: '/don-hang/them-moi', icon: 'receipt', words: 'tao don ban bao gia' },
  { label: 'Lập đơn nhập hàng', path: '/mua-hang/them', icon: 'cart', words: 'tao don mua nhap' },
  { label: 'Lập phiếu thu', path: '/thu-chi/lap/thu', icon: 'money-in', words: 'thu tien khach' },
  { label: 'Lập phiếu chi', path: '/thu-chi/lap/chi', icon: 'money-out', words: 'chi tien tra ncc' },
  { label: 'Lập phiếu nhập kho', path: '/kho/phieu/lap/in', icon: 'voucher', words: 'nhap kho' },
  { label: 'Lập phiếu xuất kho', path: '/kho/phieu/lap/out', icon: 'voucher', words: 'xuat kho' },
  { label: 'Thêm khách hàng', path: '/khach-hang/them-moi', icon: 'customers', words: 'khach moi' },
  { label: 'Thêm hàng hoá', path: '/hang-hoa/them', icon: 'product', words: 'san pham vat tu' },
  { label: 'Thêm nhà cung cấp', path: '/nha-cung-cap/them', icon: 'supplier', words: 'ncc moi' },
];

// Global "Tìm hoặc tạo nhanh": jump to any page or record by code / name, or start a new document
// without walking the menu. WAI-ARIA combobox + listbox inside a native <dialog> (focus trap + Esc).
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [NavIconComponent],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss',
})
export class CommandPaletteComponent {
  private readonly palette = inject(CommandPaletteService);
  private readonly data = inject(MockDataService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  readonly query = signal('');
  readonly active = signal(0);

  private readonly allCreates: Item[] = CREATE.map((c) => ({
    id: 'new:' + c.path, group: 'Tạo mới', label: c.label, icon: c.icon, path: [c.path], haystack: foldVi(`${c.label} ${c.words}`),
  }));

  private readonly allPages: Item[] = NAV_GROUPS.flatMap((g) =>
    g.links.map((l) => ({
      id: 'page:' + l.path, group: 'Đi tới', label: l.label, hint: g.label ?? undefined, icon: l.icon, path: [l.path],
      haystack: foldVi(`${l.label} ${g.label ?? ''}`),
    })),
  );

  // Only what the role may open (rules: core/auth/route-access.ts).
  private readonly allowed = (i: Item) => this.auth.canVisit(i.path.join('/'));
  private readonly creates = computed(() => this.allCreates.filter(this.allowed));
  private readonly pages = computed(() => this.allPages.filter(this.allowed));

  // Records are only collected while the user is typing — the empty palette stays cheap.
  private readonly records = computed<Item[]>(() => {
    if (!this.query().trim()) return [];
    const d = this.data;
    const customer = new Map(d.customers().map((c) => [c.id, c.name]));
    const supplier = new Map(d.suppliers().map((s) => [s.id, s.name]));
    const rec = (group: string, icon: NavIconName, base: string, id: string, code: string, label: string, hint: string | undefined, extra: string): Item => ({
      id: `${group}:${id}`, group, label, code, hint, icon, path: [base, id], haystack: foldVi(`${code} ${label} ${extra}`),
    });
    return [
      ...d.salesOrders().map((o) => rec('Đơn hàng bán', 'receipt', '/don-hang', o.id, o.code, customer.get(o.customerId) ?? '—',
        SALES_ORDER_STATUS_LABEL[o.status], `${o.recipientName ?? ''} ${o.recipientPhone ?? ''}`)),
      ...d.customers().map((c) => rec('Khách hàng', 'customers', '/khach-hang', c.id, c.code, c.name, c.phone, `${c.companyName ?? ''} ${c.phone ?? ''}`)),
      ...d.products().map((p) => rec('Hàng hoá', 'product', '/hang-hoa', p.id, p.code, p.name, p.baseUnit, p.crossRefCode ?? '')),
      ...d.suppliers().map((s) => rec('Nhà cung cấp', 'supplier', '/nha-cung-cap', s.id, s.code, s.name, s.contactPhone, s.contactPhone ?? '')),
      ...d.purchaseOrders().map((o) => rec('Đơn nhập hàng', 'cart', '/mua-hang', o.id, o.code, supplier.get(o.supplierId) ?? '—',
        PURCHASE_ORDER_STATUS_LABEL[o.status], '')),
      ...d.warehouseVouchers().map((v) => rec('Phiếu kho', 'voucher', '/kho/phieu', v.id, v.code, v.reason || '—', v.date.slice(0, 10), '')),
      ...d.productionOrders().map((x) => rec('Lệnh sản xuất', 'factory', '/san-xuat', x.id, x.code,
        d.products().find((p) => p.id === x.productId)?.name ?? '—', PRODUCTION_ORDER_STATUS_LABEL[x.status], '')),
      ...d.deliveryTrips().map((t) => rec('Chuyến giao hàng', 'truck', '/giao-hang', t.id, t.code, t.driverName || '—',
        DELIVERY_TRIP_STATUS_LABEL[t.status], '')),
      ...d.vehicles().map((v) => rec('Xe', 'car', '/xe', v.id, v.plateNumber, v.name || '—', undefined, v.plateNumber.replace(/[^0-9a-z]/gi, ''))),
      ...d.cashVouchers().map((v) => rec('Phiếu thu chi', 'cash', '/thu-chi', v.id, v.code, v.description || v.category, v.date.slice(0, 10), '')),
    ];
  });

  /** Flat, ordered list that keyboard navigation moves through. */
  readonly results = computed<Item[]>(() => {
    const q = foldVi(this.query().trim());
    if (!q) return [...this.creates(), ...this.pages()];
    const words = q.split(/\s+/);
    const score = (i: Item) => {
      const code = foldVi(i.code ?? '');
      const label = foldVi(i.label);
      return code === q ? 0 : code.startsWith(q) ? 1 : label.startsWith(q) ? 2 : 3;
    };
    const hit = (i: Item) => words.every((w) => i.haystack.includes(w));
    const take = (items: Item[]) => items.filter(hit).sort((a, b) => score(a) - score(b)).slice(0, MAX_PER_GROUP);
    const byGroup = new Map<string, Item[]>();
    for (const i of [...this.creates(), ...this.pages(), ...this.records().filter(this.allowed)]) byGroup.set(i.group, [...(byGroup.get(i.group) ?? []), i]);
    return [...byGroup.values()].flatMap(take);
  });

  /** The same results split by group for rendering, each carrying its index in the flat list. */
  readonly groups = computed(() => {
    const out: { name: string; items: { item: Item; index: number }[] }[] = [];
    this.results().forEach((item, index) => {
      const last = out[out.length - 1];
      if (last && last.name === item.group) last.items.push({ item, index });
      else out.push({ name: item.group, items: [{ item, index }] });
    });
    return out;
  });

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.palette.isOpen() && !el.open) {
        untracked(() => {
          this.query.set('');
          this.active.set(0);
        });
        el.showModal();
        setTimeout(() => this.input()?.nativeElement.focus());
      } else if (!this.palette.isOpen() && el.open) {
        el.close();
      }
    });
    effect(() => {
      this.results();
      untracked(() => this.active.set(0));
    });
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.palette.toggle();
      return;
    }
    // "/" opens the palette unless the user is typing somewhere.
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !this.palette.isOpen()) {
      e.preventDefault();
      this.palette.show();
    }
  }

  onInputKey(e: KeyboardEvent): void {
    const n = this.results().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!n) return;
      this.active.update((i) => (e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n));
      this.scrollToActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = this.results()[this.active()];
      if (item) this.go(item);
    }
  }

  onClose(): void {
    this.palette.hide(); // Esc closes the native dialog; keep the service in sync
  }

  onBackdrop(e: MouseEvent): void {
    if (e.target === this.dialog().nativeElement) this.palette.hide();
  }

  go(item: Item): void {
    this.palette.hide();
    this.router.navigate(item.path);
  }

  private scrollToActive(): void {
    setTimeout(() => this.list()?.nativeElement.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' }));
  }
}
