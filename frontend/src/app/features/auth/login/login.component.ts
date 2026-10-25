import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, LoginResult } from '../../../core/services/auth.service';
import { BrandService } from '../../../core/services/brand.service';
import { ClientConfigService } from '../../../core/services/client-config.service';
import { TenantService, normalizeTenant } from '../../../core/services/tenant.service';

const MESSAGE: Record<Exclude<LoginResult, 'ok' | { tenant: string }>, string> = {
  invalid: 'Sai email hoặc mật khẩu, hoặc tài khoản đã bị khoá.',
  throttled: 'Thử đăng nhập quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.',
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
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly tenants = inject(TenantService);
  private readonly config = inject(ClientConfigService);
  /** The company last seen in this browser (the catalog is read only after login). */
  readonly brand = inject(BrandService);

  /** Nhiều doanh nghiệp: ask for the mã doanh nghiệp (prefilled from ?dn= or the last one used here). */
  readonly multiTenant = signal(false);
  tenant = this.route.snapshot.queryParamMap.get('dn') ?? this.tenants.code();
  email = '';
  password = '';
  readonly error = signal('');
  readonly busy = signal(false);
  /** Sent here by the interceptor after a 401: the session ran out or the account was locked. */
  readonly expired = this.route.snapshot.queryParamMap.has('expired');
  /** Sent here by the interceptor after the doanh nghiệp was suspended mid-session. */
  readonly suspended = this.route.snapshot.queryParamMap.has('suspended');

  /** The remembered company name belongs to the mã typed: show it; another mã gets a plain heading. */
  knownBrand(): boolean {
    return !this.multiTenant() || normalizeTenant(this.tenant) === this.brand.cachedTenant;
  }

  async ngOnInit(): Promise<void> {
    this.multiTenant.set((await this.config.load()).multiTenant);
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    const tenant = normalizeTenant(this.tenant);
    if (this.multiTenant() && !tenant) {
      this.error.set('Nhập mã doanh nghiệp (do đơn vị cung cấp phần mềm cấp).');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const previous = this.tenants.code();
    if (this.multiTenant()) this.tenants.set(tenant);
    const result = await this.auth.login(this.email, this.password);
    this.busy.set(false);
    if (result !== 'ok') {
      this.error.set(typeof result === 'object' ? result.tenant : MESSAGE[result]);
      return;
    }
    const back = this.route.snapshot.queryParamMap.get('returnUrl');
    const target = this.auth.mustChangePassword()
      ? '/doi-mat-khau'
      : back && back.startsWith('/') && this.auth.canVisit(back) ? back : this.auth.homeUrl();
    // Another doanh nghiệp than the one this page loaded for: start clean, nothing of the other one's data stays in memory.
    if (this.multiTenant() && previous && previous !== tenant) {
      location.assign(target);
      return;
    }
    this.router.navigateByUrl(target);
  }
}
