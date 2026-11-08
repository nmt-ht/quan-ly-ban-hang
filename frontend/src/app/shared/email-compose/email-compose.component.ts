import { Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataStore } from '../../core/services/data-store.service';
import { EmailLogRow, MAIL_KIND_LABEL, MailKind, MailService, MailStatus, fillTemplate, splitAddresses } from '../../core/services/mail.service';
import { errorText } from '../../core/api/api.service';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { printToPdf } from '../print/print-pdf';

/** What a screen hands the dialog when its "Gửi email" is pressed. */
export interface ComposeRequest {
  kind: MailKind;
  docId?: string;
  docCode?: string;
  /** The partner's email(s) on file — the dialog fills Đến with them. */
  to: (string | null | undefined)[];
  /** Values for the template's {placeholders}: ten_khach, so_chung_tu, ngay, tong_tien, han, so_du. */
  vars: Record<string, string | undefined>;
  /** The PDF of the printout on screen (print-pdf.ts); `prepare` / `done` as for printing (which printout, which paper). */
  pdf?: { filename: string; prepare?: () => void; done?: () => void };
  /** Use this subject / body instead of the template's (e.g. the reminder the user already edited). */
  subject?: string;
  body?: string;
  /** Who the email is to, for the dialog title ("Khách hàng: Anh Nam"). */
  partner?: string;
}

// Gửi email (as MISA): one dialog for every document. Fills Đến from the partner, Tiêu đề / Nội dung from the template
// (Hệ thống › Email gửi đi), attaches the printout as PDF, sends through the server, and shows the document's lịch sử gửi.
@Component({
  selector: 'app-email-compose',
  standalone: true,
  imports: [FormsModule, RouterLink, NavIconComponent],
  templateUrl: './email-compose.component.html',
  styleUrls: ['../../features/products/product-import-dialog/product-import-dialog.component.scss', './email-compose.component.scss'],
})
export class EmailComposeComponent {
  /** "Đã gửi email Báo giá BG… tới a@b.vn" — the host shows it as its quiet notice. */
  readonly sent = output<string>();

  private readonly mail = inject(MailService);
  private readonly auth = inject(AuthService);
  private readonly data = inject(DataStore);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly kindLabel = MAIL_KIND_LABEL;
  readonly canManage = computed(() => this.auth.can('company.update'));

  readonly req = signal<ComposeRequest | null>(null);
  readonly status = signal<MailStatus | null>(null);
  readonly to = signal('');
  readonly cc = signal('');
  readonly subject = signal('');
  readonly body = signal('');
  readonly attach = signal(true);
  readonly busy = signal<'' | 'loading' | 'pdf' | 'sending'>('');
  readonly error = signal('');
  readonly history = signal<EmailLogRow[]>([]);

  readonly title = computed(() => {
    const r = this.req();
    return r ? `Gửi email ${MAIL_KIND_LABEL[r.kind]}${r.docCode ? ' ' + r.docCode : ''}` : 'Gửi email';
  });
  readonly canSend = computed(() => !!this.status()?.ready && !this.busy() && !!splitAddresses(this.to()).length && !!this.subject().trim());

  async open(req: ComposeRequest): Promise<void> {
    this.req.set(req);
    this.to.set([...new Set(req.to.filter((x): x is string => !!x?.trim()).map((x) => x.trim()))].join(', '));
    this.cc.set('');
    this.subject.set('');
    this.body.set('');
    this.attach.set(!!req.pdf);
    this.error.set('');
    this.history.set([]);
    this.status.set(null);
    this.busy.set('loading');
    this.dialog().nativeElement.showModal();
    try {
      const [status, templates, history] = await Promise.all([
        this.mail.status(), this.mail.templates(), req.docId ? this.mail.log(req.kind, req.docId) : Promise.resolve([]),
      ]);
      const t = templates.items.find((x) => x.kind === req.kind);
      const company = this.data.companyInfo();
      const vars = { ten_cong_ty: company.name, dien_thoai: company.phone ?? '', nguoi_gui: this.auth.user()?.name ?? '', ...req.vars };
      this.status.set(status);
      this.subject.set(req.subject ?? (t ? fillTemplate(t.subject, vars) : ''));
      this.body.set(req.body ?? (t ? fillTemplate(t.body, vars) : ''));
      this.history.set(history);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set('');
    }
  }

  close(): void {
    if (this.busy() === 'sending' || this.busy() === 'pdf') return;
    this.dialog().nativeElement.close();
  }

  async send(): Promise<void> {
    const r = this.req();
    if (!r || !this.canSend()) return;
    this.error.set('');
    try {
      let attachment: { filename: string; base64: string } | undefined;
      if (r.pdf && this.attach()) {
        this.busy.set('pdf');
        attachment = { filename: r.pdf.filename, base64: await printToPdf(r.pdf.prepare, r.pdf.done) };
      }
      this.busy.set('sending');
      const to = splitAddresses(this.to());
      await this.mail.send({
        kind: r.kind, docId: r.docId, docCode: r.docCode, to, cc: splitAddresses(this.cc()),
        subject: this.subject().trim(), body: this.body(), attachment,
      });
      this.busy.set('');
      this.sent.emit(`Đã gửi email ${MAIL_KIND_LABEL[r.kind]}${r.docCode ? ' ' + r.docCode : ''} tới ${to.join(', ')}.`);
      this.dialog().nativeElement.close();
    } catch (e) {
      this.error.set(errorText(e));
      if (r.docId) void this.mail.log(r.kind, r.docId).then((h) => this.history.set(h)).catch(() => undefined);
    } finally {
      this.busy.set('');
    }
  }

  when(at: string): string {
    return new Date(at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
