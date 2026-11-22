import { Component, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NgClass } from '@angular/common';
import { DataStore } from '../../../core/services/data-store.service';
import { AuthService } from '../../../core/services/auth.service';
import { errorText } from '../../../core/api/api.service';
import { HasUnsavedChanges, isSaveShortcut, warnBeforeUnload } from '../../../core/guards/unsaved-changes.guard';
import { Contract, ContractDraft, ContractKind } from '../../../core/models/contract.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { AuditHistoryComponent } from '../../../shared/audit/audit-history.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { DateInputDirective } from '../../../shared/date-input/date-input.directive';
import { formatVnd } from '../../../shared/format.util';
import { MoneyInputDirective } from '../../../shared/money-input.directive';
import { formatDay, isoDay } from '../../../shared/period';
import { SearchOption, SearchSelectComponent } from '../../../shared/search-select/search-select.component';
import { CONTRACT_STATUS_LABEL, PURCHASE_ORDER_STATUS_LABEL, SALES_ORDER_STATUS_LABEL, contractStatusClass } from '../../../shared/status-labels';
import { ContractService } from '../contract.service';
import { CONTRACT_KIND_LABEL, CONTRACT_KIND_PATH, CONTRACT_PARTY_LABEL, EXPIRY_LABEL, expiryOf, isOpen, kindOfPath } from '../contract.rules';

type Mode = 'create' | 'edit' | 'view';
type Closing = null | 'liquidate' | 'cancel';

// Hợp đồng (bán / mua): lập, sửa khi còn đang thực hiện, xem các đơn đã gắn, thanh lý hoặc huỷ (một chiều).
@Component({
  selector: 'app-contract-page',
  standalone: true,
  imports: [NgClass, FormsModule, RouterLink, NavIconComponent, CopyButtonComponent, DateInputDirective, MoneyInputDirective, SearchSelectComponent, AuditHistoryComponent],
  templateUrl: './contract-page.component.html',
  styleUrls: ['../../../shared/voucher/voucher.scss'],
})
export class ContractPageComponent implements HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contracts = inject(ContractService);
  private readonly auth = inject(AuthService);
  readonly data = inject(DataStore);

  readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), { initialValue: this.route.snapshot.paramMap.get('id') });
  private readonly kindParam = toSignal(this.route.paramMap.pipe(map((p) => p.get('kind'))), { initialValue: this.route.snapshot.paramMap.get('kind') });
  private readonly editRoute = this.route.snapshot.url.at(-1)?.path === 'sua';
  readonly today = isoDay(new Date());

  readonly contract = computed(() => {
    const id = this.id();
    return id ? this.data.contracts().find((c) => c.id === id) : undefined;
  });
  /** Danh sách lấy từ máy chủ không kèm đơn; trang chi tiết đọc thêm các đơn gắn vào. */
  readonly full = signal<Contract | null>(null);
  readonly notFound = computed(() => !!this.id() && !this.contract());
  readonly kind = computed<ContractKind>(() => this.contract()?.kind ?? kindOfPath(this.kindParam()));
  readonly mode = computed<Mode>(() => {
    if (!this.id()) return 'create';
    return this.editRoute && this.contract() && isOpen(this.contract()!) && this.auth.can('contract.update') ? 'edit' : 'view';
  });
  readonly editable = computed(() => this.mode() !== 'view');
  readonly kindLabel = computed(() => CONTRACT_KIND_LABEL[this.kind()]);
  readonly partyLabel = computed(() => CONTRACT_PARTY_LABEL[this.kind()]);
  readonly listPath = computed(() => ['/hop-dong', CONTRACT_KIND_PATH[this.kind()]]);

  // ---------- draft ----------
  readonly contractNo = signal('');
  readonly title = signal('');
  readonly partnerId = signal('');
  readonly signedDate = signal(this.today);
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly value = signal<number | null>(null);
  readonly paymentTerms = signal('');
  readonly description = signal('');
  readonly owner = signal('');
  readonly attempted = signal(false);
  readonly failure = signal('');
  readonly saving = signal(false);
  private baseline = '';

  // ---------- thanh lý / huỷ ----------
  readonly closing = signal<Closing>(null);
  readonly closeDate = signal(this.today);
  readonly closeNote = signal('');

  readonly statusLabel = CONTRACT_STATUS_LABEL;
  readonly statusClass = contractStatusClass;
  readonly salesStatus = SALES_ORDER_STATUS_LABEL as Record<string, string>;
  readonly purchaseStatus = PURCHASE_ORDER_STATUS_LABEL as Record<string, string>;
  readonly money = formatVnd;
  readonly day = formatDay;
  readonly canUpdate = computed(() => !!this.contract() && isOpen(this.contract()!) && this.auth.can('contract.update'));
  /** Lập đơn từ hợp đồng còn đang thực hiện: người dùng phải có quyền tạo đơn bán / đơn mua. */
  readonly canMakeOrder = computed(() => !!this.contract() && isOpen(this.contract()!) && this.auth.can(this.kind() === 'BAN' ? 'order.create' : 'purchase.create'));
  readonly canClose = computed(() => !!this.contract() && isOpen(this.contract()!) && this.auth.can('contract.close'));
  readonly expiry = computed(() => (this.contract() ? expiryOf(this.contract()!, this.today) : 'none'));
  readonly expiryLabel = EXPIRY_LABEL;

  readonly partnerOptions = computed<SearchOption[]>(() => {
    if (this.kind() === 'BAN') {
      return this.data.customers().filter((c) => c.isActive || c.id === this.partnerId())
        .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
        .map((c) => ({ value: c.id, code: c.code, label: c.name, hint: c.phone, search: c.companyName }));
    }
    return this.data.suppliers().filter((s) => s.isActive || s.id === this.partnerId())
      .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
      .map((s) => ({ value: s.id, code: s.code, label: s.name }));
  });

  readonly ownerOptions = computed<SearchOption[]>(() => {
    const roles = new Map(this.data.roles().map((r) => [r.id, r.name]));
    return this.data.users()
      .map((u): SearchOption => ({ value: u.email, label: u.name, hint: roles.get(u.roleId) ?? '', search: u.email }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  });

  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.title().trim()) out.push('Nhập trích yếu của hợp đồng.');
    if (!this.partnerId()) out.push(`Chọn ${this.partyLabel().toLowerCase()}.`);
    if (!this.signedDate()) out.push('Nhập ngày ký.');
    if (this.startDate() && this.endDate() && this.endDate() < this.startDate()) out.push('Ngày hết hiệu lực không được trước ngày bắt đầu.');
    if ((this.value() ?? 0) < 0) out.push('Giá trị hợp đồng không được âm.');
    return out;
  });

  constructor() {
    // Điền form từ hợp đồng đang mở (một lần cho mỗi hợp đồng); đọc thêm các đơn gắn vào.
    let filled: string | null = null;
    effect(() => {
      const c = this.contract();
      if (!c || c.id === filled) return;
      filled = c.id;
      untracked(() => {
        this.fill(c);
        void this.contracts.detail(c.id).then((d) => this.full.set(d)).catch(() => undefined);
      });
    });
    if (!this.id()) this.baseline = this.snapshot();
  }

  private fill(c: Contract): void {
    this.contractNo.set(c.contractNo ?? '');
    this.title.set(c.title);
    this.partnerId.set(c.partnerId ?? '');
    this.signedDate.set(c.signedDate);
    this.startDate.set(c.startDate ?? '');
    this.endDate.set(c.endDate ?? '');
    this.value.set(c.value || null);
    this.paymentTerms.set(c.paymentTerms ?? '');
    this.description.set(c.description ?? '');
    this.owner.set(c.owner);
    this.baseline = this.snapshot();
  }

  private snapshot(): string {
    return JSON.stringify([this.contractNo(), this.title(), this.partnerId(), this.signedDate(), this.startDate(), this.endDate(), this.value(), this.paymentTerms(), this.description(), this.owner()]);
  }

  userName(email: string): string {
    return this.data.users().find((u) => u.email === email)?.name ?? (email || '—');
  }

  orderLink(o: { id: string }): string[] {
    return [this.kind() === 'BAN' ? '/don-hang' : '/mua-hang', o.id];
  }

  orderStatus(s: string): string {
    return (this.kind() === 'BAN' ? this.salesStatus[s] : this.purchaseStatus[s]) ?? s;
  }

  async save(): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length || this.saving()) return;
    const kind = this.kind();
    const draft: ContractDraft = {
      kind,
      contractNo: this.contractNo().trim() || undefined,
      title: this.title().trim(),
      customerId: kind === 'BAN' ? this.partnerId() : undefined,
      supplierId: kind === 'MUA' ? this.partnerId() : undefined,
      signedDate: this.signedDate(),
      startDate: this.startDate() || undefined,
      endDate: this.endDate() || undefined,
      value: this.value() ?? 0,
      paymentTerms: this.paymentTerms().trim() || undefined,
      description: this.description().trim() || undefined,
      owner: this.owner() || undefined,
    };
    this.saving.set(true);
    this.failure.set('');
    try {
      const id = this.id();
      const saved = id ? await this.contracts.update(id, draft) : await this.contracts.create(draft);
      this.baseline = this.snapshot();
      this.full.set(saved);
      await this.router.navigate(['/hop-dong/chi-tiet', saved.id]);
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }

  cancelEditing(): void {
    this.baseline = this.snapshot();
    const id = this.id();
    if (id) void this.router.navigate(['/hop-dong/chi-tiet', id]);
    else void this.router.navigate(this.listPath());
  }

  startClosing(kind: Exclude<Closing, null>): void {
    this.closeDate.set(this.today);
    this.closeNote.set('');
    this.closing.set(kind);
  }

  async confirmClose(): Promise<void> {
    const c = this.contract();
    const kind = this.closing();
    if (!c || !kind || this.saving()) return;
    this.saving.set(true);
    this.failure.set('');
    try {
      const next = kind === 'liquidate' ? await this.contracts.liquidate(c.id, this.closeDate(), this.closeNote()) : await this.contracts.cancel(c.id, this.closeDate(), this.closeNote());
      this.full.set(next);
      this.closing.set(null);
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }

  hasUnsavedChanges(): boolean {
    return this.editable() && this.snapshot() !== this.baseline;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    warnBeforeUnload(e, this.hasUnsavedChanges());
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (!this.editable() || !isSaveShortcut(e)) return;
    e.preventDefault();
    void this.save();
  }
}
