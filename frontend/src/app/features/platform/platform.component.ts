import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toDataURL } from 'qrcode';
import { CopyButtonComponent } from '../../shared/copy-button/copy-button.component';
import { NewTenant, PlatformApiService, PlatformAuditRow, PlatformTenant, TenantStatus, platformError } from './platform-api.service';

const STATUS: Record<TenantStatus, { label: string; tone: string }> = {
  ACTIVE: { label: 'Đang hoạt động', tone: 'badge-success' },
  SUSPENDED: { label: 'Tạm ngưng', tone: 'badge-muted' },
  PROVISIONING: { label: 'Đang khởi tạo', tone: 'badge-info' },
  FAILED: { label: 'Tạo lỗi', tone: 'badge-danger' },
};

/** A password shown once: after creating a doanh nghiệp, a retry or a reset. */
interface Handover {
  title: string;
  tenant: string;
  email: string;
  password: string;
}

const CODE = /^[a-z][a-z0-9-]{2,29}$/;

/**
 * /quan-tri-nen-tang — the owner's page, outside the app shell and outside every doanh nghiệp: sign in with
 * password + authenticator code, then create, suspend, reopen and update the doanh nghiệp.
 */
@Component({
  selector: 'app-platform',
  standalone: true,
  imports: [FormsModule, DatePipe, CopyButtonComponent],
  templateUrl: './platform.component.html',
  styleUrls: ['./platform.component.scss', './platform-tenants.scss'],
})
export class PlatformComponent implements OnInit, OnDestroy {
  readonly api = inject(PlatformApiService);
  readonly statusOf = (s: TenantStatus) => STATUS[s];

  /** null while the first call is on its way. */
  readonly mode = signal<{ multiTenant: boolean; ownerConfigured: boolean } | null>(null);
  readonly loadError = signal('');

  // Sign-in
  email = '';
  password = '';
  code = '';
  readonly step = signal<'password' | 'totp' | 'enroll'>('password');
  readonly enroll = signal<{ secret: string; qr: string } | null>(null);
  readonly signingIn = signal(false);
  readonly loginError = signal('');

  // Doanh nghiệp
  readonly tenants = signal<PlatformTenant[]>([]);
  readonly latestMigration = signal<string | null>(null);
  readonly busy = signal<string | null>(null);
  readonly notice = signal<{ text: string; error: boolean } | null>(null);
  readonly handover = signal<Handover | null>(null);
  readonly counts = computed(() => {
    const list = this.tenants();
    return {
      active: list.filter((t) => t.status === 'ACTIVE').length,
      suspended: list.filter((t) => t.status === 'SUSPENDED').length,
      failed: list.filter((t) => t.status === 'FAILED').length,
      behind: list.filter((t) => t.needsMigration).length,
    };
  });

  // Thêm doanh nghiệp
  readonly creating = signal(false);
  form: NewTenant = blankForm();
  readonly formError = signal('');

  // Đổi tên / cấp lại mật khẩu, one row at a time
  readonly renaming = signal<string | null>(null);
  renameValue = '';
  readonly resetting = signal<string | null>(null);
  resetEmail = '';

  readonly audit = signal<PlatformAuditRow[] | null>(null);
  private poll: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    try {
      this.mode.set(await this.api.status());
      if (this.api.token()) await this.refresh();
    } catch (e) {
      this.loadError.set(platformError(e));
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  async signIn(): Promise<void> {
    if (this.signingIn()) return;
    this.signingIn.set(true);
    this.loginError.set('');
    try {
      const res = await this.api.login(this.email.trim(), this.password, this.step() === 'password' ? undefined : this.code);
      if (res.step === 'done') {
        this.password = '';
        this.code = '';
        this.step.set('password');
        this.enroll.set(null);
        await this.refresh();
      } else if (res.step === 'enroll') {
        this.enroll.set({ secret: res.secret, qr: await toDataURL(res.otpauthUrl, { margin: 1, width: 200 }) });
        this.step.set('enroll');
      } else {
        this.step.set('totp');
      }
    } catch (e) {
      this.loginError.set(platformError(e));
      this.code = '';
    } finally {
      this.signingIn.set(false);
    }
  }

  backToPassword(): void {
    this.step.set('password');
    this.code = '';
    this.password = '';
    this.loginError.set('');
  }

  signOut(): void {
    this.api.signOut();
    this.tenants.set([]);
    this.audit.set(null);
    this.handover.set(null);
    this.stopPolling();
  }

  async refresh(): Promise<void> {
    try {
      const res = await this.api.tenants();
      this.tenants.set(res.tenants);
      this.latestMigration.set(res.latestMigration);
      if (res.tenants.some((t) => t.status === 'PROVISIONING')) this.startPolling();
      else this.stopPolling();
      if (this.audit()) this.audit.set(await this.api.audit());
    } catch (e) {
      if (this.api.token()) this.notice.set({ text: platformError(e), error: true });
    }
  }

  openCreate(): void {
    this.form = blankForm();
    this.formError.set('');
    this.creating.set(true);
  }

  /** Mã từ tên: "Công ty Hoa Mai" → "hoa-mai" — only while the mã is still empty. */
  suggestCode(): void {
    if (this.form.code) return;
    const slug = this.form.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/^(cong ty|cty)\s+((tnhh|co phan|cp)\s+)?((mtv|mot thanh vien)\s+)?/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
    if (CODE.test(slug)) this.form.code = slug;
  }

  async create(): Promise<void> {
    const f = this.form;
    f.code = f.code.trim().toLowerCase();
    if (!CODE.test(f.code)) return this.formError.set('Mã doanh nghiệp: 3–30 ký tự, chữ thường không dấu, số hoặc gạch ngang, bắt đầu bằng chữ.');
    if (!f.name.trim()) return this.formError.set('Nhập tên doanh nghiệp.');
    if (!f.adminEmail.trim()) return this.formError.set('Nhập email tài khoản quản trị của doanh nghiệp.');
    this.busy.set('create');
    this.formError.set('');
    try {
      const res = await this.api.create({ ...f, adminPassword: f.adminPassword || undefined, databaseUrl: f.databaseUrl || undefined });
      this.creating.set(false);
      this.handover.set({ title: `Tài khoản quản trị của ${res.tenant.name}`, tenant: res.tenant.code, email: res.tenant.adminEmail ?? f.adminEmail, password: res.adminPassword });
      await this.refresh();
    } catch (e) {
      this.formError.set(platformError(e));
    } finally {
      this.busy.set(null);
    }
  }

  async retry(t: PlatformTenant): Promise<void> {
    await this.run(t.code, async () => {
      const res = await this.api.retry(t.code);
      this.handover.set({ title: `Tài khoản quản trị của ${t.name} (tạo lại)`, tenant: t.code, email: res.tenant.adminEmail ?? '', password: res.adminPassword });
    });
  }

  async toggle(t: PlatformTenant): Promise<void> {
    const suspend = t.status === 'ACTIVE';
    if (suspend && !confirm(`Tạm ngưng ${t.name}? Mọi người dùng của doanh nghiệp này sẽ không đăng nhập hay thao tác được nữa, dữ liệu vẫn giữ nguyên.`)) return;
    await this.run(t.code, async () => {
      await this.api.action(t.code, suspend ? 'suspend' : 'reopen');
      this.notice.set({ text: suspend ? `Đã tạm ngưng ${t.name}.` : `Đã mở lại ${t.name}.`, error: false });
    });
  }

  async migrate(t: PlatformTenant): Promise<void> {
    await this.run(t.code, async () => {
      await this.api.action(t.code, 'migrate');
      this.notice.set({ text: `Đã cập nhật cấu trúc dữ liệu của ${t.name}.`, error: false });
    });
  }

  async migrateAll(): Promise<void> {
    await this.run('all', async () => {
      const results = await this.api.migrateAll();
      const failed = results.filter((r) => !r.ok);
      this.notice.set(
        failed.length
          ? { text: `Lỗi khi cập nhật: ${failed.map((r) => `${r.code} (${r.error})`).join('; ')}`, error: true }
          : { text: `Đã cập nhật cấu trúc dữ liệu cho ${results.length} doanh nghiệp.`, error: false },
      );
    });
  }

  startRename(t: PlatformTenant): void {
    this.resetting.set(null);
    this.renameValue = t.name;
    this.renaming.set(t.code);
  }

  async saveRename(t: PlatformTenant): Promise<void> {
    await this.run(t.code, async () => {
      await this.api.rename(t.code, this.renameValue);
      this.renaming.set(null);
    });
  }

  startReset(t: PlatformTenant): void {
    this.renaming.set(null);
    this.resetEmail = t.adminEmail ?? '';
    this.resetting.set(t.code);
  }

  async saveReset(t: PlatformTenant): Promise<void> {
    await this.run(t.code, async () => {
      const res = await this.api.resetPassword(t.code, this.resetEmail.trim());
      this.resetting.set(null);
      this.handover.set({ title: `Mật khẩu tạm mới cho ${t.name}`, tenant: t.code, email: res.email, password: res.password });
    });
  }

  async toggleAudit(): Promise<void> {
    if (this.audit()) return this.audit.set(null);
    try {
      this.audit.set(await this.api.audit());
    } catch (e) {
      this.notice.set({ text: platformError(e), error: true });
    }
  }

  /** Login link for a doanh nghiệp: the login screen fills the mã from ?dn=. */
  loginLink(code: string): string {
    return `${location.origin}/login?dn=${encodeURIComponent(code)}`;
  }

  private async run(key: string, work: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(key);
    this.notice.set(null);
    try {
      await work();
    } catch (e) {
      this.notice.set({ text: platformError(e), error: true });
    } finally {
      this.busy.set(null);
      await this.refresh();
    }
  }

  private startPolling(): void {
    this.poll ??= setInterval(() => void this.refresh(), 2000);
  }

  private stopPolling(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }
}

function blankForm(): NewTenant {
  return { code: '', name: '', adminEmail: '', adminPassword: '', databaseUrl: '', demo: false };
}
