import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';

/** The documents an email can be about (backend modules/mail/mail.rules.ts › MAIL_KINDS). */
export type MailKind = 'quotation' | 'sales_order' | 'purchase_order' | 'cash_receipt' | 'debt_reminder' | 'debt_reconcile';

export interface MailStatus {
  ready: boolean;
  mode: 'OFF' | 'SMTP' | 'SYSTEM';
  from: string | null;
}

export interface SmtpPreset {
  key: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  hint: string;
}

export interface MailSettings {
  mode: 'OFF' | 'SMTP' | 'SYSTEM';
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  bcc: string | null;
  host: string | null;
  port: number | null;
  secure: boolean;
  username: string | null;
  hasPassword: boolean;
  passwordReadable: boolean;
  verifiedAt: string | null;
  updatedAt: string;
  systemAvailable: boolean;
  systemFrom: string | null;
  presets: SmtpPreset[];
  company: { name: string; email: string };
  ready: boolean;
}

export interface MailSettingsInput {
  mode: MailSettings['mode'];
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  bcc?: string;
  host?: string;
  port?: number;
  secure: boolean;
  username?: string;
  /** Absent = keep the stored password; "" = remove it. */
  password?: string;
}

export interface MailTemplate {
  kind: MailKind;
  label: string;
  subject: string;
  body: string;
  isDefault: boolean;
  defaults: { subject: string; body: string };
}

export interface MailTemplates {
  fields: Record<string, string>;
  items: MailTemplate[];
}

export interface EmailLogRow {
  id: string;
  at: string;
  kind: MailKind | 'test';
  docId: string | null;
  docCode: string | null;
  to: string[];
  cc: string[];
  subject: string;
  attachment: string | null;
  status: 'SENT' | 'FAILED';
  error: string | null;
  sentByName: string;
}

export interface SendMailInput {
  kind: MailKind;
  docId?: string;
  docCode?: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachment?: { filename: string; base64: string };
}

export const MAIL_KIND_LABEL: Record<MailKind | 'test', string> = {
  quotation: 'Báo giá',
  sales_order: 'Chứng từ bán hàng',
  purchase_order: 'Đơn mua hàng',
  cash_receipt: 'Phiếu thu',
  debt_reminder: 'Nhắc nợ',
  debt_reconcile: 'Đối chiếu công nợ',
  test: 'Thư thử',
};

/** {ten_khach} → value; a missing one shows as … (seen before sending), an optional " · {x}" tail drops out — as the server's fill(). */
export function fillTemplate(text: string, values: Record<string, string | undefined>): string {
  const has = (k: string) => !!values[k]?.trim();
  return text
    .replace(/ · \{([a-z_]+)\}/g, (all, k: string) => (has(k) ? all : ''))
    .replace(/\{([a-z_]+)\}/g, (_, k: string) => (has(k) ? values[k]!.trim() : '…'));
}

/** "a@x.vn, b@y.vn; c@z.vn" → addresses (the server checks them again). */
export const splitAddresses = (s: string): string[] => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

// Email gửi đi: settings (Hệ thống › Email gửi đi), templates, sending one document, and nhật ký gửi.
@Injectable({ providedIn: 'root' })
export class MailService {
  private readonly api = inject(ApiService);

  status(): Promise<MailStatus> {
    return this.api.get<MailStatus>('/mail/status');
  }

  templates(): Promise<MailTemplates> {
    return this.api.get<MailTemplates>('/mail/templates');
  }

  send(input: SendMailInput): Promise<EmailLogRow> {
    return this.api.post<EmailLogRow>('/mail/send', input);
  }

  /** Nhật ký gửi of one document, or (no docId) the latest 200. */
  log(kind?: MailKind, docId?: string): Promise<EmailLogRow[]> {
    const q = new URLSearchParams();
    if (kind) q.set('kind', kind);
    if (docId) q.set('docId', docId);
    const s = q.toString();
    return this.api.get<EmailLogRow[]>('/mail/log' + (s ? `?${s}` : ''));
  }

  settings(): Promise<MailSettings> {
    return this.api.get<MailSettings>('/mail/settings');
  }

  saveSettings(input: MailSettingsInput): Promise<MailSettings> {
    return this.api.put<MailSettings>('/mail/settings', input);
  }

  test(to?: string): Promise<{ ok: true; to: string }> {
    return this.api.post<{ ok: true; to: string }>('/mail/settings/test', { to });
  }

  saveTemplate(t: { kind: MailKind; subject: string; body: string }): Promise<MailTemplates> {
    return this.api.put<MailTemplates>('/mail/templates', t);
  }

  resetTemplate(kind: MailKind): Promise<MailTemplates> {
    return this.api.post<MailTemplates>('/mail/templates/reset', { kind });
  }
}
