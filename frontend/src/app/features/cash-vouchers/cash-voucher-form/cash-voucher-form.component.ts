import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { MockDataService } from '../../../core/services/mock-data.service';
import { DebtRow, DebtService } from '../../../core/services/debt.service';
import { CashAllocation, VoucherKind } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { MoneyInputDirective } from '../../../shared/money-input.directive';
import { formatVnd } from '../../../shared/format.util';
import { formatDay, isoDay } from '../../../shared/period';
import { ACCOUNT_TYPE_LABEL, KIND_TEXT, autoAllocate, categoryHint } from '../cash-voucher.rules';
import { CashVoucherService } from '../cash-voucher.service';

interface Partner {
  id: string;
  code: string;
  name: string;
  taxCode?: string;
  phone?: string;
  address?: string;
}

// One screen for Lập phiếu thu (/thu-chi/lap/thu) and Lập phiếu chi (/thu-chi/lap/chi).
// ?supplierId= / ?customerId= pre-selects the partner (row menu "Lập phiếu chi" on Nhà cung cấp).
@Component({
  selector: 'app-cash-voucher-form',
  standalone: true,
  imports: [FormsModule, RouterLink, NavIconComponent, MoneyInputDirective],
  templateUrl: './cash-voucher-form.component.html',
  styleUrl: './cash-voucher-form.component.scss',
})
export class CashVoucherFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly data = inject(MockDataService);
  private readonly debt = inject(DebtService);
  private readonly svc = inject(CashVoucherService);

  readonly kind = toSignal(
    this.route.paramMap.pipe(map((p) => (p.get('kind') === 'thu' ? 'THU' : 'CHI') as VoucherKind)),
    { initialValue: (this.route.snapshot.paramMap.get('kind') === 'thu' ? 'THU' : 'CHI') as VoucherKind },
  );
  readonly text = computed(() => KIND_TEXT[this.kind()]);
  /** Loại đang dùng của loại phiếu; loại mặc định đứng đầu. */
  readonly categories = computed(() =>
    this.data.cashCategories()
      .filter((c) => c.kind === this.kind() && c.isActive)
      .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault)),
  );
  readonly categoryHint = categoryHint;

  readonly money = formatVnd;
  readonly day = formatDay;
  readonly accountTypeLabel = ACCOUNT_TYPE_LABEL;

  // ---------- draft ----------
  readonly categoryCode = signal('');
  readonly date = signal(isoDay(new Date()));
  readonly partnerId = signal('');
  readonly amount = signal<number | null>(null);
  readonly accountId = signal('');
  readonly description = signal('');
  readonly manual = signal(false);
  readonly picks = signal<Record<string, number | null>>({});
  readonly attempted = signal(false);

  /** Where "Huỷ" and a successful save go back to. */
  private returnTo: { path: unknown[]; query?: Record<string, string> } = { path: ['/thu-chi'] };

  constructor() {
    effect(() => {
      const kind = this.kind();
      untracked(() => {
        const q = this.route.snapshot.queryParamMap;
        const fromSupplier = kind === 'CHI' ? q.get('supplierId') : null;
        const fromCustomer = kind === 'THU' ? q.get('customerId') : null;
        // ?category=CHI_KHAC&amount=…&desc=… pre-fill a voucher from another screen (e.g. chi phí chuyến).
        const cats = this.data.cashCategories().filter((c) => c.kind === kind && c.isActive);
        const cat = cats.find((c) => c.code === q.get('category'));
        this.categoryCode.set(cat?.code ?? cats.find((c) => c.isDefault)?.code ?? cats[0]?.code ?? '');
        this.date.set(isoDay(new Date()));
        this.partnerId.set(fromSupplier ?? fromCustomer ?? '');
        if (!this.partner()) this.partnerId.set('');
        const presetAmount = Number(q.get('amount'));
        this.amount.set(presetAmount > 0 ? Math.round(presetAmount) : null);
        const accounts = this.accounts();
        this.accountId.set((accounts.find((a) => a.isDefault) ?? accounts.find((a) => a.type === 'TIEN_MAT') ?? accounts[0])?.id ?? '');
        this.description.set(q.get('desc') ?? '');
        this.manual.set(false);
        this.picks.set({});
        this.attempted.set(false);
        // ?back=/app/path?x=y returns to the calling page (only in-app paths are honoured).
        const back = q.get('back');
        const tree = back && back.startsWith('/') && !back.startsWith('//') ? this.router.parseUrl(back) : null;
        const segments = tree?.root.children['primary']?.segments.map((x) => x.path);
        this.returnTo = segments
          ? { path: ['/', ...segments], query: { ...tree!.queryParams } }
          : fromSupplier && this.partnerId()
            ? { path: ['/nha-cung-cap', fromSupplier], query: { tab: 'cong-no' } }
            : { path: ['/thu-chi'] };
      });
    });
  }

  readonly category = computed(() => this.categories().find((c) => c.code === this.categoryCode()) ?? this.categories()[0]);
  readonly needsPartner = computed(() => this.category().partnerType !== 'KHAC');

  readonly partners = computed<Partner[]>(() =>
    this.kind() === 'CHI'
      ? this.data.suppliers()
          .filter((s) => s.isActive || s.id === this.partnerId())
          .map((s) => ({ id: s.id, code: s.code, name: s.name, taxCode: s.taxCode, phone: s.contactPhone, address: s.address }))
      : this.data.customers()
          .filter((c) => c.isActive || c.id === this.partnerId())
          .map((c) => ({ id: c.id, code: c.code, name: c.companyName || c.name, taxCode: c.companyTaxCode, phone: c.phone })),
  );

  readonly partner = computed(() => this.partners().find((p) => p.id === this.partnerId()));

  readonly debtRow = computed<DebtRow | undefined>(() => {
    if (!this.needsPartner() || !this.partnerId()) return undefined;
    const rows = this.kind() === 'CHI' ? this.debt.payables() : this.debt.receivables();
    return rows.find((r) => r.partnerId === this.partnerId());
  });
  readonly openItems = computed(() => this.debtRow()?.items ?? []);
  readonly openTotal = computed(() => this.openItems().reduce((s, i) => s + i.amount, 0));

  /** Tài khoản đang dùng, theo thứ tự hiển thị. */
  readonly accounts = computed(() =>
    this.data.cashAccounts().filter((a) => a.isActive !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  );
  readonly account = computed(() => this.accounts().find((a) => a.id === this.accountId()));

  // ---------- đối trừ ----------
  /** Số chọn tay theo chứng từ (rỗng khi Tự động). */
  readonly manualPicks = computed<Map<string, number>>(() => {
    const m = new Map<string, number>();
    if (!this.manual()) return m;
    for (const [ref, v] of Object.entries(this.picks())) if (v && v > 0) m.set(ref, v);
    return m;
  });
  readonly pickedTotal = computed(() => [...this.manualPicks().values()].reduce((s, v) => s + v, 0));

  /**
   * Phần tự động: số tiền chưa chọn tay trừ tiếp vào khoản cũ nhất trước (kể cả phần còn lại của
   * khoản đã chọn), giống hệt cách DebtService đối trừ — còn dư mới là trả trước.
   */
  readonly autoPart = computed<Map<string, number>>(() => {
    if (!this.needsPartner()) return new Map();
    const picks = this.manualPicks();
    const rest = this.openItems().map((i) => ({ ref: i.ref, amount: Math.max(0, i.amount - (picks.get(i.ref) ?? 0)) }));
    return autoAllocate(rest, (this.amount() ?? 0) - this.pickedTotal());
  });

  readonly allocation = computed<Map<string, number>>(() => {
    const m = new Map(this.manualPicks());
    for (const [ref, v] of this.autoPart()) m.set(ref, (m.get(ref) ?? 0) + v);
    return m;
  });
  readonly allocated = computed(() => [...this.allocation().values()].reduce((s, v) => s + v, 0));
  readonly prepaid = computed(() => (this.needsPartner() ? Math.max(0, (this.amount() ?? 0) - this.allocated()) : 0));

  isPicked(ref: string): boolean {
    return this.picks()[ref] !== undefined;
  }

  togglePick(ref: string, open: number): void {
    this.picks.update((p) => {
      const next = { ...p };
      if (ref in next) {
        delete next[ref];
      } else {
        // Default: what is still unallocated of the amount (or the whole open amount when no amount yet).
        const free = (this.amount() ?? 0) - this.pickedTotal();
        next[ref] = this.amount() ? Math.max(0, Math.min(open, free)) : open;
      }
      return next;
    });
    // Picking documents first: let the amount follow the picks.
    if (!this.amount()) this.amount.set(this.pickedTotal() || null);
  }

  setPick(ref: string, v: number | null): void {
    this.picks.update((p) => ({ ...p, [ref]: v }));
  }

  setManual(on: boolean): void {
    this.manual.set(on);
    this.picks.set({});
  }

  payAll(): void {
    this.amount.set(this.openTotal());
    this.manual.set(false);
    this.picks.set({});
  }

  onPartnerChange(id: string): void {
    this.partnerId.set(id);
    this.picks.set({});
    this.manual.set(false);
  }

  onCategoryChange(code: string): void {
    this.categoryCode.set(code);
    if (!this.needsPartner()) this.partnerId.set('');
    this.picks.set({});
    this.manual.set(false);
  }

  // ---------- validation ----------
  readonly issues = computed(() => {
    const out: string[] = [];
    if (this.needsPartner() && !this.partnerId()) out.push(this.text().partnerPick);
    if (!((this.amount() ?? 0) > 0)) out.push('Nhập số tiền để tạo phiếu');
    if (!this.accountId()) out.push(`Chọn ${this.text().account.toLowerCase()}`);
    if (!this.date()) out.push('Chọn ngày phiếu');
    if (this.manual()) {
      for (const i of this.openItems()) {
        const v = this.picks()[i.ref];
        if (v !== undefined && v !== null && v > i.amount) out.push(`${i.ref}: đối trừ vượt số còn nợ ${formatVnd(i.amount)}`);
      }
      if (this.pickedTotal() > (this.amount() ?? 0)) out.push('Tổng chọn tay vượt số tiền của phiếu');
    }
    return out;
  });

  /** Chi vượt số dư: allowed (the money may arrive later), but say so. */
  readonly overdraw = computed(() => {
    const a = this.account();
    return this.kind() === 'CHI' && !!a && (this.amount() ?? 0) > a.balance ? a.balance : null;
  });

  cancelLink(): unknown[] {
    return this.returnTo.path;
  }

  cancelQuery(): Record<string, string> | undefined {
    return this.returnTo.query;
  }

  save(): void {
    this.attempted.set(true);
    if (this.issues().length) return;
    const allocations: CashAllocation[] | undefined = this.manual()
      ? [...this.manualPicks()].map(([ref, amount]) => ({ ref, amount }))
      : undefined;
    const v = this.svc.create({
      kind: this.kind(),
      date: this.date(),
      category: this.category().name,
      partnerType: this.category().partnerType,
      partnerId: this.needsPartner() ? this.partnerId() : undefined,
      accountId: this.accountId(),
      amount: this.amount()!,
      description: this.description().trim() || undefined,
      allocations,
      settledAmount: this.allocated(),
    });
    const notice = `Đã tạo ${this.kind() === 'CHI' ? 'phiếu chi' : 'phiếu thu'} ${v.code} — ${formatVnd(v.amount)}.`;
    this.router.navigate(this.returnTo.path, { queryParams: this.returnTo.query, state: { notice } });
  }
}
