import { Component, ElementRef, computed, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStore } from '../../../../core/services/data-store.service';
import { AppUser } from '../../../../core/models/domain.models';
import { NavIconComponent } from '../../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../../shared/copy-button/copy-button.component';
import { PHONE_PATTERN } from '../../../customers/customer.rules';
import { EMAIL_PATTERN, UserService, generatePassword, passwordIssue } from '../user.service';
import { errorText } from '../../../../core/api/api.service';

// "Thêm người dùng" / "Sửa người dùng" — họ tên, email đăng nhập, mật khẩu (chỉ khi thêm), chức vụ.
@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [FormsModule, NavIconComponent, CopyButtonComponent],
  templateUrl: './user-dialog.component.html',
  styleUrls: [
    '../../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
    '../../../delivery-trips/trip-header-dialog/trip-header-dialog.component.scss',
    './user-dialog.component.scss',
  ],
})
export class UserDialogComponent {
  readonly saved = output<{ user?: AppUser; message: string }>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly editing = signal<AppUser | null>(null);
  readonly name = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly roleId = signal('');
  readonly note = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly attempted = signal(false);
  readonly error = signal('');

  constructor(
    readonly data: DataStore,
    private readonly svc: UserService,
  ) {}

  readonly roles = computed(() => this.data.roles().filter((r) => r.isActive || r.id === this.roleId()));
  readonly role = computed(() => this.data.roles().find((r) => r.id === this.roleId()));
  readonly duplicate = computed(() => this.svc.duplicateEmail(this.email(), this.editing()?.id ?? null));
  readonly lockedRole = computed(() => !!this.editing() && this.svc.isLastAdmin(this.editing()!));

  open(u?: AppUser): void {
    this.editing.set(u ?? null);
    this.name.set(u?.name ?? '');
    this.email.set(u?.email ?? '');
    this.phone.set(u?.phone ?? '');
    this.roleId.set(u?.roleId ?? '');
    this.note.set(u?.note ?? '');
    this.password.set('');
    this.showPassword.set(false);
    this.attempted.set(false);
    this.error.set('');
    this.dialog().nativeElement.showModal();
    setTimeout(() => document.getElementById('ud-name')?.focus());
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  suggestPassword(): void {
    this.password.set(generatePassword());
    this.showPassword.set(true);
  }

  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.name().trim()) out.push('Nhập họ tên');
    if (!this.email().trim()) out.push('Nhập email đăng nhập');
    else if (!EMAIL_PATTERN.test(this.email().trim())) out.push('Email không đúng định dạng');
    else if (this.duplicate()) out.push(`Email đã dùng cho ${this.duplicate()!.name}`);
    if (!this.editing()) {
      const p = passwordIssue(this.password());
      if (p) out.push(p);
    }
    if (!this.roleId()) out.push('Chọn chức vụ');
    if (this.phone() && !PHONE_PATTERN.test(this.phone())) out.push('Số điện thoại không hợp lệ');
    return out;
  });

  async confirm(): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length) return;
    const draft = { name: this.name(), email: this.email(), roleId: this.roleId(), phone: this.phone(), note: this.note() };
    try {
      const u = this.editing();
      if (u) {
        await this.svc.update(u.id, draft);
        this.close();
        this.saved.emit({ message: `Đã lưu ${draft.name.trim()}.` });
      } else {
        const created = await this.svc.create(draft, this.password());
        this.close();
        this.saved.emit({ user: created, message: `Đã tạo tài khoản ${created.email}. Nhắn riêng mật khẩu cho nhân viên và bảo họ đổi lại.` });
      }
    } catch (e) {
      this.error.set(errorText(e));
    }
  }
}
