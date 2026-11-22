import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import {
  EmailLogRow, MAIL_KIND_LABEL, MailKind, MailService, MailSettings, MailTemplate, MailTemplates, SmtpPreset,
} from '../../../core/services/mail.service';
import { errorText } from '../../../core/api/api.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';

type Mode = MailSettings['mode'];

// Hệ thống › Email gửi đi (as MISA's "Thiết lập email gửi"): how the company sends (its own mailbox over SMTP, or the
// platform sending for it), a test email, the template of each document, and nhật ký gửi. The SMTP password is
// write-only: the server keeps it sealed and only says whether one is stored.
@Component({
  selector: 'app-email-settings',
  standalone: true,
  imports: [FormsModule, NavIconComponent],
  templateUrl: './email-settings.component.html',
  styleUrl: './email-settings.component.scss',
})
export class EmailSettingsComponent {
  private readonly mail = inject(MailService);
  readonly auth = inject(AuthService);
  readonly kindLabel = MAIL_KIND_LABEL;

  readonly loading = signal(true);
  readonly notice = signal('');
  readonly failure = signal('');
  readonly s = signal<MailSettings | null>(null);

  // ---------- form (a copy of the settings, saved together) ----------
  readonly mode = signal<Mode>('OFF');
  readonly fromName = signal('');
  readonly fromEmail = signal('');
  readonly replyTo = signal('');
  readonly bcc = signal('');
  readonly host = signal('');
  readonly port = signal<number | null>(587);
  readonly secure = signal(false);
  readonly username = signal('');
  readonly password = signal('');
  /** True once the user typed a new password (or chose to remove it). */
  readonly passwordTouched = signal(false);
  readonly preset = signal<SmtpPreset | null>(null);
  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly testTo = signal('');

  readonly dirty = signal(false);
  /** True once Lưu was pressed with something missing: the empty fields are then marked. */
  readonly attempted = signal(false);
  /** What a private mailbox still needs, as [field id, label]: the form says which, instead of a generic refusal. */
  readonly missing = computed<[string, string][]>(() => {
    if (this.mode() !== 'SMTP') return [];
    const out: [string, string][] = [];
    if (!this.host().trim()) out.push(['em-host', 'Máy chủ']);
    if (!this.port()) out.push(['em-port', 'Cổng']);
    if (!this.fromEmail().trim()) out.push(['em-from', 'Địa chỉ gửi']);
    if (!this.username().trim()) out.push(['em-user', 'Tài khoản']);
    if (!this.s()?.hasPassword && !this.password()) out.push(['em-pass', 'Mật khẩu ứng dụng']);
    return out;
  });
  isMissing(id: string): boolean {
    return this.attempted() && this.missing().some(([k]) => k === id);
  }
  readonly verified = computed(() => {
    const v = this.s()?.verifiedAt;
    return v ? new Date(v).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  });

  // ---------- templates ----------
  readonly templates = signal<MailTemplates | null>(null);
  readonly kind = signal<MailKind>('quotation');
  readonly current = computed<MailTemplate | null>(() => this.templates()?.items.find((t) => t.kind === this.kind()) ?? null);
  readonly subject = signal('');
  readonly body = signal('');
  readonly tplDirty = signal(false);
  readonly tplSaving = signal(false);
  readonly fields = computed(() => Object.entries(this.templates()?.fields ?? {}));

  // ---------- nhật ký ----------
  readonly log = signal<EmailLogRow[]>([]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [s, t, log] = await Promise.all([this.mail.settings(), this.mail.templates(), this.mail.log()]);
      this.apply(s);
      this.templates.set(t);
      this.pickKind(this.kind());
      this.log.set(log);
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.loading.set(false);
    }
  }

  private apply(s: MailSettings): void {
    this.s.set(s);
    this.mode.set(s.mode);
    this.fromName.set(s.fromName ?? s.company.name ?? '');
    this.fromEmail.set(s.fromEmail ?? '');
    this.replyTo.set(s.replyTo ?? '');
    this.bcc.set(s.bcc ?? '');
    this.host.set(s.host ?? '');
    this.port.set(s.port ?? 587);
    this.secure.set(s.secure);
    this.username.set(s.username ?? '');
    this.password.set('');
    this.passwordTouched.set(false);
    this.preset.set(s.presets.find((p) => p.host === s.host) ?? null);
    this.testTo.set(this.auth.user()?.email ?? '');
    this.dirty.set(false);
  }

  touch(): void {
    this.dirty.set(true);
  }

  setMode(m: Mode): void {
    this.mode.set(m);
    if (m === 'SYSTEM' && !this.replyTo()) this.replyTo.set(this.s()?.company.email ?? '');
    this.touch();
  }

  usePreset(p: SmtpPreset): void {
    this.preset.set(p);
    this.host.set(p.host);
    this.port.set(p.port);
    this.secure.set(p.secure);
    if (!this.username() && this.fromEmail()) this.username.set(this.fromEmail());
    this.touch();
  }

  /** 465 = SSL from the start, 587 / 25 = STARTTLS: picking the port picks the usual security. */
  setPort(v: number | null): void {
    this.port.set(v);
    if (v === 465) this.secure.set(true);
    if (v === 587 || v === 25) this.secure.set(false);
    this.touch();
  }

  setFromEmail(v: string): void {
    if (!this.username() || this.username() === this.fromEmail()) this.username.set(v);
    this.fromEmail.set(v);
    this.touch();
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.failure.set('');
    this.notice.set('');
    const missing = this.missing();
    if (missing.length) {
      this.attempted.set(true);
      this.failure.set(`Còn thiếu: ${missing.map(([, label]) => label).join(', ')}. Chọn nhanh Gmail / Outlook… ở trên để điền sẵn máy chủ và cổng.`);
      document.getElementById(missing[0][0])?.focus();
      return;
    }
    // 465 only speaks SSL from the first byte, 587 / 25 only STARTTLS: a mismatch (a saved "SSL" beside port 587) never connects.
    if (this.port() === 465 && !this.secure()) this.secure.set(true);
    if ((this.port() === 587 || this.port() === 25) && this.secure()) this.secure.set(false);
    this.saving.set(true);
    try {
      const s = await this.mail.saveSettings({
        mode: this.mode(), fromName: this.fromName().trim() || undefined, fromEmail: this.fromEmail().trim() || undefined,
        replyTo: this.replyTo().trim() || undefined, bcc: this.bcc().trim() || undefined, host: this.host().trim() || undefined,
        port: this.port() ?? undefined, secure: this.secure(), username: this.username().trim() || undefined,
        password: this.passwordTouched() ? this.password() : undefined,
      });
      this.apply(s);
      this.attempted.set(false);
      this.notice.set(s.mode === 'OFF' ? 'Đã tắt gửi email.' : 'Đã lưu. Bấm "Gửi thử" để chắc chắn email đi được.');
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }

  async test(): Promise<void> {
    if (this.testing() || this.dirty()) return;
    this.testing.set(true);
    this.failure.set('');
    this.notice.set('');
    try {
      const r = await this.mail.test(this.testTo().trim() || undefined);
      this.notice.set(`Đã gửi thư thử tới ${r.to} — kiểm tra hộp thư (cả mục Spam).`);
      this.apply(await this.mail.settings());
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.testing.set(false);
      this.log.set(await this.mail.log().catch(() => this.log()));
    }
  }

  // ---------- templates ----------

  pickKind(k: MailKind): void {
    this.kind.set(k);
    const t = this.current();
    this.subject.set(t?.subject ?? '');
    this.body.set(t?.body ?? '');
    this.tplDirty.set(false);
  }

  /** Puts {field} at the end of the body (the user moves it where it belongs). */
  insert(field: string): void {
    this.body.set(this.body().replace(/\s*$/, '') + ` {${field}}`);
    this.tplDirty.set(true);
  }

  async saveTemplate(): Promise<void> {
    if (this.tplSaving()) return;
    this.tplSaving.set(true);
    this.failure.set('');
    try {
      this.templates.set(await this.mail.saveTemplate({ kind: this.kind(), subject: this.subject().trim(), body: this.body() }));
      this.pickKind(this.kind());
      this.notice.set(`Đã lưu mẫu email ${MAIL_KIND_LABEL[this.kind()]}.`);
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.tplSaving.set(false);
    }
  }

  async resetTemplate(): Promise<void> {
    this.failure.set('');
    try {
      this.templates.set(await this.mail.resetTemplate(this.kind()));
      this.pickKind(this.kind());
      this.notice.set(`Đã dùng lại mẫu mặc định cho ${MAIL_KIND_LABEL[this.kind()]}.`);
    } catch (e) {
      this.failure.set(errorText(e));
    }
  }

  when(at: string): string {
    return new Date(at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
