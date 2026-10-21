import { Component, ElementRef, computed, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppUser } from '../../../../core/models/domain.models';
import { NavIconComponent } from '../../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../../shared/copy-button/copy-button.component';
import { UserService, generatePassword, passwordIssue } from '../user.service';

// "Đặt lại mật khẩu": admin sets a temporary password, shown once, then every session is ended.
@Component({
  selector: 'app-password-dialog',
  standalone: true,
  imports: [FormsModule, NavIconComponent, CopyButtonComponent],
  templateUrl: './password-dialog.component.html',
  styleUrls: [
    '../../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
    '../../../delivery-trips/trip-header-dialog/trip-header-dialog.component.scss',
    '../user-dialog/user-dialog.component.scss',
  ],
})
export class PasswordDialogComponent {
  readonly done = output<string>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly user = signal<AppUser | null>(null);
  readonly password = signal('');
  readonly confirmPw = signal('');
  readonly mustChange = signal(true);
  readonly show = signal(true);
  readonly attempted = signal(false);
  readonly saved = signal(false); // step 2: show the password once
  readonly error = signal('');

  constructor(private readonly svc: UserService) {}

  open(u: AppUser): void {
    this.user.set(u);
    const pw = generatePassword();
    this.password.set(pw);
    this.confirmPw.set(pw);
    this.mustChange.set(true);
    this.show.set(true);
    this.attempted.set(false);
    this.saved.set(false);
    this.error.set('');
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
    // Forget the password as soon as the dialog closes.
    this.password.set('');
    this.confirmPw.set('');
  }

  regenerate(): void {
    const pw = generatePassword();
    this.password.set(pw);
    this.confirmPw.set(pw);
    this.show.set(true);
  }

  readonly issue = computed(() => passwordIssue(this.password()) || (this.password() !== this.confirmPw() ? 'Nhập lại mật khẩu chưa khớp' : ''));

  confirm(): void {
    this.attempted.set(true);
    if (this.issue()) return;
    try {
      this.svc.resetPassword(this.user()!.id, this.password(), this.mustChange());
      this.saved.set(true);
      this.done.emit(`Đã đặt lại mật khẩu cho ${this.user()!.name} — mọi phiên đăng nhập đã kết thúc.`);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
}
