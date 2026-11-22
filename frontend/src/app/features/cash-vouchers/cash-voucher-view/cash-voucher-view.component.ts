import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { EmailComposeComponent } from '../../../shared/email-compose/email-compose.component';
import { pdfName } from '../../../shared/print/print-pdf';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DataStore } from '../../../core/services/data-store.service';
import { DebtService } from '../../../core/services/debt.service';
import { errorText } from '../../../core/api/api.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { formatVnd, formatVndSigned } from '../../../shared/format.util';
import { formatDay } from '../../../shared/period';
import { vndInWords } from '../../../shared/vnd-words';
import { ACCOUNT_TYPE_LABEL } from '../cash-voucher.rules';
import { CashVoucherService } from '../cash-voucher.service';
import { PrintDocumentComponent } from '../../../shared/print/print-document.component';
import { PrintMenuComponent } from '../../../shared/print/print-menu.component';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { AuditHistoryComponent } from '../../../shared/audit/audit-history.component';
import { SalesOrderService } from '../../sales-orders/sales-order.service';
import { ToastService } from '../../../core/services/toast.service';

// One phiếu thu / phiếu chi: xem, in (mẫu phiếu thu / phiếu chi), huỷ. Sửa = huỷ rồi lập lại (giữ dấu vết).
@Component({
  selector: 'app-cash-voucher-view',
  standalone: true,
  imports: [EmailComposeComponent, FormsModule, RouterLink, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, PrintDocumentComponent, PrintMenuComponent, AuditHistoryComponent],
  templateUrl: './cash-voucher-view.component.html',
  styleUrls: ['../../../shared/voucher/voucher.scss', './cash-voucher-view.component.scss'],
})
export class CashVoucherViewComponent {
  protected readonly toast = inject(ToastService);
  private readonly dialogs = inject(ConfirmService);
  readonly data = inject(DataStore);
  private readonly salesOrders = inject(SalesOrderService);
  // Đơn cũ hơn 90 ngày không nạp sẵn (Pha 1.1): đọc các đơn màn hình này cần.
  private readonly loadOrders = effect(() => {
    const codes = (this.data.cashVouchers().find((v) => v.id === this.id())?.allocations ?? []).map((a) => a.ref);
    if (codes.length) untracked(() => void this.salesOrders.ensureMany([], codes));
  });
  private readonly debt = inject(DebtService);
  private readonly svc = inject(CashVoucherService);

  readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  readonly voucher = computed(() => this.data.cashVouchers().find((v) => v.id === this.id()));
  /** A phiếu older than what the app loads at sign-in is read on demand (Pha 1.1). */
  readonly fetching = signal(false);
  private readonly fetchMissing = effect(() => {
    const id = this.id();
    if (!id || untracked(() => this.voucher())) return;
    this.fetching.set(true);
    void this.svc.ensureMany([id]).finally(() => this.fetching.set(false));
  });

  readonly money = formatVnd;
  readonly signed = formatVndSigned;
  readonly day = formatDay;
  readonly words = vndInWords;

  // ---------- gửi email: phiếu thu (biên nhận) cho khách + PDF ----------
  private readonly emailDlg = viewChild<EmailComposeComponent>('emailDlg');
  private readonly auth = inject(AuthService);
  readonly canEmail = computed(() => this.auth.can('email.send') && this.voucher()?.kind === 'THU' && !this.voucher()?.isCancelled);

  email(): void {
    const v = this.voucher();
    if (!v) return;
    const p = this.partner();
    const mail = v.partnerType === 'KHACH_HANG' ? this.data.customers().find((x) => x.id === v.partnerId)?.email
      : v.partnerType === 'NHA_CUNG_CAP' ? this.data.suppliers().find((x) => x.id === v.partnerId)?.email : undefined;
    void this.emailDlg()?.open({
      kind: 'cash_receipt', docId: v.id, docCode: v.code, to: [mail], partner: p?.name,
      vars: { ten_khach: p?.name, so_chung_tu: v.code, ngay: formatDay(v.date), tong_tien: formatVnd(v.amount) },
      pdf: { filename: pdfName('Phieu thu', v.code) },
    });
  }
  readonly cancelling = signal(false);
  /** A huỷ the server refused (or that could not reach it). */

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        this.toast.success((history.state as { notice?: string } | null)?.notice ?? '');
      });
    });
  }

  /** Đơn hàng bán mà dòng đối trừ trỏ tới (mã DH…), để bấm mở được. */
  orderOf(ref: string) {
    return this.data.salesOrders().find((o) => o.code === ref);
  }

  readonly isThu = computed(() => this.voucher()?.kind === 'THU');
  readonly title = computed(() => (this.isThu() ? 'Phiếu thu' : 'Phiếu chi'));
  readonly account = computed(() => this.data.cashAccounts().find((a) => a.id === this.voucher()?.accountId));
  readonly method = computed(() => (this.account() ? ACCOUNT_TYPE_LABEL[this.account()!.type] : '—'));
  readonly company = computed(() => this.data.companyInfo());

  readonly partner = computed(() => {
    const v = this.voucher();
    if (!v?.partnerId) return undefined;
    if (v.partnerType === 'KHACH_HANG') {
      const c = this.data.customers().find((x) => x.id === v.partnerId);
      const addr = c?.addresses?.find((a) => a.isDefault)?.address;
      return c && { code: c.code, name: c.companyName || c.name, contact: c.name, address: addr, link: ['/khach-hang', c.id], ledger: '/cong-no/khach-hang', id: c.id };
    }
    const s = this.data.suppliers().find((x) => x.id === v.partnerId);
    return s && { code: s.code, name: s.name, contact: s.name, address: s.address, link: ['/nha-cung-cap', s.id], ledger: '/cong-no/nha-cung-cap', id: s.id };
  });

  /** Đã đối trừ / trả trước của phiếu, from the debt engine (phiếu huỷ không đối trừ). */
  readonly settlement = computed(() => {
    const v = this.voucher();
    if (!v || v.partnerType === 'KHAC') return undefined;
    const rows = v.partnerType === 'KHACH_HANG' ? this.debt.receivables() : this.debt.payables();
    const e = rows.find((r) => r.partnerId === v.partnerId)?.entries.find((x) => x.kind === 'THANH_TOAN' && x.ref === v.code);
    return e ? { settled: e.settled, remaining: e.remaining } : { settled: 0, remaining: 0 };
  });

  creator(email: string | undefined): string {
    return (email && this.data.users().find((u) => u.email === email)?.name) || email || '—';
  }

  time(iso: string | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async askCancel(): Promise<void> {
    const v = this.voucher();
    if (!v) return;
    const done = await this.dialogs.form({
      title: `Huỷ ${v.code}?`, message: 'Phiếu vẫn lưu để đối chiếu nhưng không tính vào số dư quỹ và công nợ nữa.',
      confirmLabel: 'Huỷ phiếu', cancelLabel: 'Không huỷ', tone: 'danger', fields: [{ key: 'reason', label: 'Lý do huỷ', type: 'textarea', placeholder: 'Không bắt buộc', maxLength: 300 }],
      run: (x) => this.svc.cancel(v.id, x['reason']),
    });
    if (done) this.toast.success(`Đã huỷ ${v.code} — không còn tính vào số dư quỹ${v.partnerType === 'KHAC' ? '' : ' và công nợ đã mở lại'}.`);
  }

}
