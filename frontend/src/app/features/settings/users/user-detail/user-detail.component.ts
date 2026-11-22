import { ConfirmService } from '../../../../shared/confirm/confirm.service';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DataStore } from '../../../../core/services/data-store.service';
import { NavIconComponent } from '../../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../../shared/copy-button/copy-button.component';
import { formatVnd } from '../../../../shared/format.util';
import { formatDay } from '../../../../shared/period';
import { tagClass } from '../../../../shared/tag-class';
import { USER_STATUS_LABEL } from '../users.component';
import { formatDateTime } from '../../../../shared/format.util';
import { UserService } from '../user.service';
import { UserDialogComponent } from '../user-dialog/user-dialog.component';
import { PasswordDialogComponent } from '../password-dialog/password-dialog.component';
import { AllowedLinkDirective } from '../../../../shared/allowed-link.directive';
import { errorText } from '../../../../core/api/api.service';
import { AuditHistoryComponent } from '../../../../shared/audit/audit-history.component';
import { ToastService } from '../../../../core/services/toast.service';

interface Activity {
  date: string;
  type: string;
  code: string;
  link?: unknown[];
  detail: string;
  amount?: number;
}

// /thiet-lap/nguoi-dung/:id — tài khoản, chức vụ & quyền, hoạt động (chứng từ do người này lập).
@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [NgClass, FormsModule, RouterLink, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, UserDialogComponent, PasswordDialogComponent, AuditHistoryComponent],
  templateUrl: './user-detail.component.html',
  styleUrl: '../../../suppliers/supplier-detail/supplier-detail.component.scss',
})
export class UserDetailComponent {
  protected readonly toast = inject(ToastService);
  private readonly dialogs = inject(ConfirmService);
  readonly data = inject(DataStore);
  readonly svc = inject(UserService);
  private readonly userDialog = viewChild.required<UserDialogComponent>('userDialog');
  private readonly passwordDialog = viewChild.required<PasswordDialogComponent>('passwordDialog');

  readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  readonly user = computed(() => this.data.users().find((u) => u.id === this.id()));
  readonly role = computed(() => this.data.roles().find((r) => r.id === this.user()?.roleId));

  readonly error = signal('');

  readonly statusLabel = USER_STATUS_LABEL;
  readonly statusClass = (s: 'ACTIVE' | 'DISABLED') => tagClass('user-status', s);
  readonly time = formatDateTime;
  readonly day = formatDay;
  readonly money = formatVnd;

  /** Everything this account created or sold, newest first. */
  readonly activity = computed<Activity[]>(() => {
    const u = this.user();
    if (!u) return [];
    const e = u.email;
    const list: Activity[] = [];
    for (const o of this.data.salesOrders()) {
      if (o.createdBy === e || o.salesRep === e) {
        list.push({ date: o.orderDate, type: o.createdBy === e ? 'Lập đơn bán' : 'Nhân viên bán', code: o.code, link: ['/don-hang', o.id], detail: '', amount: o.totalOrder });
      }
    }
    for (const o of this.data.purchaseOrders()) if (o.createdBy === e) list.push({ date: o.date, type: 'Lập đơn mua hàng', code: o.code, link: ['/mua-hang', o.id], detail: '', amount: o.totalValue ?? undefined });
    for (const v of this.data.cashVouchers()) {
      if (v.createdBy === e) list.push({ date: v.date, type: v.kind === 'THU' ? 'Lập phiếu thu' : 'Lập phiếu chi', code: v.code, link: ['/thu-chi', v.id], detail: v.isCancelled ? 'đã huỷ' : '', amount: v.amount });
    }
    for (const v of this.data.warehouseVouchers()) if (v.createdBy === e) list.push({ date: v.date, type: 'Lập chứng từ kho', code: v.code, detail: v.reason ?? '' });
    for (const t of this.data.deliveryTrips()) {
      if (t.createdBy === e) list.push({ date: t.date, type: 'Tạo chuyến giao hàng', code: t.code, link: ['/giao-hang', t.id], detail: '' });
      if (t.driverName === u.name) list.push({ date: t.date, type: 'Lái chuyến', code: t.code, link: ['/giao-hang', t.id], detail: t.plateNumber ?? '' });
    }
    return list.sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code));
  });

  readonly activityCounts = computed(() => {
    const m = new Map<string, number>();
    for (const a of this.activity()) m.set(a.type, (m.get(a.type) ?? 0) + 1);
    return [...m].map(([type, count]) => ({ type, count }));
  });

  readonly showAll = signal(false);
  readonly visibleActivity = computed(() => (this.showAll() ? this.activity() : this.activity().slice(0, 15)));

  edit(): void {
    this.userDialog().open(this.user());
  }

  resetPassword(): void {
    this.passwordDialog().open(this.user()!);
  }

  async endSessions(): Promise<void> {
    if (!(await this.attempt(() => this.svc.endSessions(this.user()!.id)))) return;
    this.toast.success(`Đã đăng xuất mọi phiên của ${this.user()!.name}.`);
  }

  async askLock(): Promise<void> {
    const u = this.user();
    if (!u) return;
    const done = await this.dialogs.form({
      title: `Khoá tài khoản ${u.name}?`, message: 'Người này bị đăng xuất ngay và không đăng nhập được nữa. Chứng từ đã lập vẫn giữ nguyên.',
      confirmLabel: 'Khoá tài khoản', cancelLabel: 'Không khoá', tone: 'danger',
      fields: [{ key: 'reason', label: 'Lý do khoá', placeholder: 'Ví dụ: Nghỉ việc', maxLength: 200 }],
      run: (v) => this.svc.lock(u.id, v['reason']),
    });
    if (done) {
      this.toast.success(`Đã khoá ${u.name}.`);
      this.error.set('');
    }
  }

  async unlock(): Promise<void> {
    if (!(await this.attempt(() => this.svc.unlock(this.user()!.id)))) return;
    this.toast.success(`Đã mở khoá ${this.user()!.name}.`);
  }

  /** Runs a save; on failure shows why and answers false. */
  private async attempt(save: () => Promise<unknown>): Promise<boolean> {
    this.error.set('');
    try {
      await save();
      return true;
    } catch (e) {
      this.error.set(errorText(e));
      return false;
    }
  }
}
