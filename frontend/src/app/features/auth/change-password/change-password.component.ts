import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BrandService } from '../../../core/services/brand.service';
import { passwordIssue } from '../../settings/users/user.service';

// Tự đổi mật khẩu. Opens by itself after sign-in when an administrator issued the password
// (`mustChangePassword`); anyone can also reach it from the account menu.
@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss',
})
export class ChangePasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly brand = inject(BrandService);

  /** Forced: no way back to the app until the password is changed. */
  readonly forced = this.auth.mustChangePassword;

  readonly current = signal('');
  readonly next = signal('');
  readonly confirm = signal('');
  readonly error = signal('');
  readonly busy = signal(false);

  /** Shown live once something is typed in that field. */
  readonly nextIssue = computed(() => {
    if (!this.next()) return '';
    if (this.next() === this.current()) return 'Mật khẩu mới phải khác mật khẩu hiện tại';
    return passwordIssue(this.next());
  });
  readonly confirmIssue = computed(() => (this.confirm() && this.confirm() !== this.next() ? 'Nhập lại mật khẩu chưa khớp' : ''));
  readonly valid = computed(() => !!this.current() && !!this.next() && !this.nextIssue() && this.next() === this.confirm());

  async submit(): Promise<void> {
    if (this.busy() || !this.valid()) return;
    this.busy.set(true);
    this.error.set('');
    const message = await this.auth.changePassword(this.current(), this.next());
    this.busy.set(false);
    if (message) {
      this.error.set(message);
      return;
    }
    await this.router.navigateByUrl(this.auth.homeUrl());
  }

  back(): void {
    this.router.navigateByUrl(this.auth.homeUrl());
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
