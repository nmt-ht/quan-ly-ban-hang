import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { MockDataService } from '../../../core/services/mock-data.service';
import { DebtService } from '../../../core/services/debt.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { formatVnd, formatVndSigned } from '../../../shared/format.util';
import { formatDay } from '../../../shared/period';
import { vndInWords } from '../../../shared/vnd-words';
import { ACCOUNT_TYPE_LABEL } from '../cash-voucher.rules';
import { CashVoucherService } from '../cash-voucher.service';

// One phiếu thu / phiếu chi: xem, in (mẫu phiếu thu / phiếu chi), huỷ. Sửa = huỷ rồi lập lại (giữ dấu vết).
@Component({
  selector: 'app-cash-voucher-view',
  standalone: true,
  imports: [FormsModule, RouterLink, NavIconComponent, CopyButtonComponent],
  templateUrl: './cash-voucher-view.component.html',
  styleUrls: ['../../../shared/voucher/voucher.scss', './cash-voucher-view.component.scss'],
})
export class CashVoucherViewComponent {
  readonly data = inject(MockDataService);
  private readonly debt = inject(DebtService);
  private readonly svc = inject(CashVoucherService);

  readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  readonly voucher = computed(() => this.data.cashVouchers().find((v) => v.id === this.id()));

  readonly money = formatVnd;
  readonly signed = formatVndSigned;
  readonly day = formatDay;
  readonly words = vndInWords;
  readonly notice = signal('');
  readonly confirmCancel = signal(false);
  readonly cancelReason = signal('');

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        this.notice.set((history.state as { notice?: string } | null)?.notice ?? '');
        this.confirmCancel.set(false);
        this.cancelReason.set('');
      });
    });
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

  print(): void {
    window.print();
  }

  doCancel(): void {
    const v = this.voucher()!;
    this.svc.cancel(v.id, this.cancelReason());
    this.confirmCancel.set(false);
    this.notice.set(`Đã huỷ ${v.code} — không còn tính vào số dư quỹ${v.partnerType === 'KHAC' ? '' : ' và công nợ đã mở lại'}.`);
  }
}
