import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, LoginResult } from '../../../core/services/auth.service';

const MESSAGE: Record<Exclude<LoginResult, 'ok'>, string> = {
  invalid: 'Sai email hoặc mật khẩu, hoặc tài khoản đã bị khoá.',
  offline: 'Không kết nối được máy chủ. Kiểm tra mạng hoặc báo quản trị kiểm tra backend.',
  error: 'Máy chủ gặp lỗi, chưa đăng nhập được. Thử lại sau ít phút.',
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly error = signal('');
  readonly busy = signal(false);
  /** Sent here by the interceptor after a 401: the session ran out or the account was locked. */
  readonly expired = this.route.snapshot.queryParamMap.has('expired');

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const result = await this.auth.login(this.email, this.password);
    this.busy.set(false);
    if (result !== 'ok') {
      this.error.set(MESSAGE[result]);
      return;
    }
    const back = this.route.snapshot.queryParamMap.get('returnUrl');
    this.router.navigateByUrl(back && back.startsWith('/') && this.auth.canVisit(back) ? back : this.auth.homeUrl());
  }
}
