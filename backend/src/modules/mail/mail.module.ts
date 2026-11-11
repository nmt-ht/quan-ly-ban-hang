import {
  BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Injectable, Logger, Module, NotFoundException, Post, Put, Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { seal, unseal } from '../../common/company-secret.js';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import nodemailer from 'nodemailer';
import type { Prisma } from '@prisma/client';
import { orderVisibleTo, quotationVisibleTo } from '../sales/order-access.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { OptionalEmail, OptionalText, Text } from '../../common/dto.js';
import {
  DEFAULT_TEMPLATES, MAIL_FIELDS, MAIL_KINDS, MAX_ATTACHMENT_BYTES, MAX_RECIPIENTS, SMTP_PORTS, SMTP_PRESETS, explainSmtpError, isMailKind,
  isPrivateAddress, isSmtpPort, parseAddresses, toHtml,
} from './mail.rules.js';
import type { MailKind } from './mail.rules.js';

/** The platform's own sender ("hệ thống gửi hộ"): on only when the server has MAIL_SYSTEM_URL + MAIL_SYSTEM_FROM. */
const systemSender = () => {
  const url = process.env.MAIL_SYSTEM_URL?.trim();
  const from = process.env.MAIL_SYSTEM_FROM?.trim();
  return url && from ? { url, from } : null;
};

/** Development only (a local Mailpit / MailHog): MAIL_ALLOW_PRIVATE_SMTP=1 lifts the public-host and port checks. */
const privateSmtpAllowed = () => process.env.MAIL_ALLOW_PRIVATE_SMTP === '1';

// ---------- DTOs ----------

export class MailSettingsDto {
  @IsIn(['OFF', 'SMTP', 'SYSTEM']) mode!: 'OFF' | 'SMTP' | 'SYSTEM';
  @OptionalText(120) fromName?: string;
  @OptionalEmail() fromEmail?: string;
  @OptionalEmail() replyTo?: string;
  @OptionalEmail() bcc?: string;
  @OptionalText(200) @Matches(/^[a-zA-Z0-9.-]+$/, { message: 'Máy chủ SMTP không hợp lệ' }) host?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsBoolean() secure!: boolean;
  @OptionalText(200) username?: string;
  /** Write-only: absent = keep the stored one; "" = remove it. */
  @IsOptional() @IsString() @MaxLength(300) password?: string;
}

export class MailTemplateDto {
  @IsIn(Object.keys(MAIL_KINDS)) kind!: MailKind;
  @Text(250) subject!: string;
  @Text(5000) body!: string;
}

export class AttachmentDto {
  @Text(150) @Matches(/^[^\\/:*?"<>|]+\.pdf$/i, { message: 'Tệp đính kèm phải là PDF' }) filename!: string;
  @IsString() @Matches(/^[A-Za-z0-9+/=]+$/, { message: 'Tệp đính kèm không hợp lệ' }) base64!: string;
}

export class SendMailDto {
  @IsIn(Object.keys(MAIL_KINDS)) kind!: MailKind;
  @OptionalText(80) docId?: string;
  @OptionalText(40) docCode?: string;
  @IsArray() @ArrayMaxSize(MAX_RECIPIENTS) @IsString({ each: true }) to!: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_RECIPIENTS) @IsString({ each: true }) cc?: string[];
  @Text(250) subject!: string;
  @Text(10000) body!: string;
  @IsOptional() @ValidateNested() @Type(() => AttachmentDto) attachment?: AttachmentDto;
}

export class TestMailDto {
  @IsOptional() @IsString() to?: string;
}

// ---------- service ----------

const SEND_LIMIT = 40;
const SEND_WINDOW = 10 * 60_000;

type Settings = Awaited<ReturnType<PrismaService['mailSettings']['findUnique']>>;

@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async row(): Promise<NonNullable<Settings>> {
    return (await this.prisma.mailSettings.findUnique({ where: { id: 1 } })) ?? (await this.prisma.mailSettings.create({ data: { id: 1 } }));
  }

  /** What the screens may see: never the password, only whether one is stored. */
  async settings() {
    const { passwordSealed, ...s } = await this.row();
    const company = await this.prisma.companyInfo.findUnique({ where: { id: 1 }, select: { name: true, email: true } });
    return {
      ...s, hasPassword: !!passwordSealed, passwordReadable: !passwordSealed || unseal(passwordSealed) !== null,
      systemAvailable: !!systemSender(), systemFrom: systemSender()?.from ?? null, presets: SMTP_PRESETS,
      company: { name: company?.name ?? '', email: company?.email ?? '' },
      ready: this.readiness({ ...s, passwordSealed }).ok,
    };
  }

  /** Can this doanh nghiệp send right now? The reason when not. */
  private readiness(s: NonNullable<Settings>): { ok: true } | { ok: false; reason: string } {
    if (s.mode === 'OFF') return { ok: false, reason: 'Chưa bật gửi email — vào Hệ thống › Email gửi đi để thiết lập.' };
    if (s.mode === 'SYSTEM') return systemSender() ? { ok: true } : { ok: false, reason: 'Máy chủ chưa cấu hình dịch vụ gửi hộ. Chọn "Email riêng của doanh nghiệp".' };
    if (!s.host || !s.port || !s.fromEmail || !s.username || !s.passwordSealed) return { ok: false, reason: 'Thiết lập email gửi đi còn thiếu máy chủ, cổng, địa chỉ gửi, tài khoản hoặc mật khẩu.' };
    if (unseal(s.passwordSealed) === null) return { ok: false, reason: 'Mật khẩu email đã lưu không đọc được nữa (khoá mã hoá đổi) — nhập lại ở Hệ thống › Email gửi đi.' };
    return { ok: true };
  }

  async saveSettings(dto: MailSettingsDto, user: AuthUser) {
    const before = await this.row();
    if (dto.mode === 'SMTP' && !(dto.host && dto.port && dto.fromEmail && dto.username))
      throw new BadRequestException('Email riêng cần máy chủ SMTP, cổng, địa chỉ gửi và tài khoản.');
    if (dto.mode === 'SYSTEM' && !systemSender()) throw new BadRequestException('Máy chủ chưa cấu hình dịch vụ gửi hộ.');
    if (dto.mode === 'SMTP' && !privateSmtpAllowed() && !isSmtpPort(dto.port!)) throw new BadRequestException(`Cổng SMTP phải là một trong: ${SMTP_PORTS.join(', ')}.`);
    const passwordSealed = dto.password === undefined ? before.passwordSealed : dto.password === '' ? null : seal(dto.password);
    // Anything that changes how (or as whom) the mail goes out voids the last "Gửi thử". Absent fields are stored as null,
    // so compare them as null — else every save would look like a change.
    const changed = (k: 'host' | 'port' | 'username' | 'fromEmail') => (dto[k] ?? null) !== before[k];
    const changedTransport = changed('host') || changed('port') || changed('username') || changed('fromEmail') || dto.secure !== before.secure ||
      passwordSealed !== before.passwordSealed || dto.mode !== before.mode;
    await this.prisma.$transaction(async (tx) => {
      await tx.mailSettings.update({
        where: { id: 1 },
        data: {
          mode: dto.mode, fromName: dto.fromName ?? null, fromEmail: dto.fromEmail ?? null, replyTo: dto.replyTo ?? null, bcc: dto.bcc ?? null,
          host: dto.host ?? null, port: dto.port ?? null, secure: dto.secure, username: dto.username ?? null, passwordSealed,
          verifiedAt: changedTransport ? null : before.verifiedAt,
        },
      });
      await this.audit.log(tx, {
        action: 'mail.settings', entityType: 'MailSettings', entityId: '1',
        summary: `Sửa thiết lập email gửi đi (${dto.mode === 'SMTP' ? `email riêng ${dto.fromEmail}` : dto.mode === 'SYSTEM' ? 'hệ thống gửi hộ' : 'tắt'})${dto.password !== undefined ? ' · đổi mật khẩu' : ''}`,
        actor: { id: user.id, name: user.name },
      });
    });
    return this.settings();
  }

  async templates() {
    const saved = new Map((await this.prisma.mailTemplate.findMany()).map((t) => [t.kind, t]));
    return {
      fields: MAIL_FIELDS,
      items: (Object.keys(MAIL_KINDS) as MailKind[]).map((kind) => ({
        kind, label: MAIL_KINDS[kind].label, ...(saved.get(kind) ?? DEFAULT_TEMPLATES[kind]), isDefault: !saved.has(kind), defaults: DEFAULT_TEMPLATES[kind],
      })),
    };
  }

  async saveTemplate(dto: MailTemplateDto, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      await tx.mailTemplate.upsert({ where: { kind: dto.kind }, create: dto, update: { subject: dto.subject, body: dto.body } });
      await this.audit.log(tx, { action: 'mail.template', entityType: 'MailTemplate', entityId: dto.kind, summary: `Sửa mẫu email ${MAIL_KINDS[dto.kind].label}`, actor: { id: user.id, name: user.name } });
    });
    return this.templates();
  }

  async resetTemplate(kind: MailKind, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      await tx.mailTemplate.deleteMany({ where: { kind } });
      await this.audit.log(tx, { action: 'mail.template', entityType: 'MailTemplate', entityId: kind, summary: `Dùng lại mẫu email mặc định ${MAIL_KINDS[kind].label}`, actor: { id: user.id, name: user.name } });
    });
    return this.templates();
  }

  /** The transport and the From / Reply-To for the current settings. */
  private async transport() {
    const s = await this.row();
    const ready = this.readiness(s);
    if (!ready.ok) throw new BadRequestException(ready.reason);
    const company = await this.prisma.companyInfo.findUnique({ where: { id: 1 }, select: { name: true, email: true } });
    const name = (s.fromName || company?.name || 'Ninh Trang').replace(/["\r\n]/g, '');
    const timeouts = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000 };
    if (s.mode === 'SYSTEM') {
      const sys = systemSender()!;
      // The platform's own domain sends (its SPF / DKIM pass); replies go to the company. Never the company's address in
      // From — that would fail DMARC and land in spam.
      return {
        tx: nodemailer.createTransport(sys.url, timeouts), from: { name, address: sys.from },
        replyTo: s.replyTo || company?.email || undefined, bcc: s.bcc || undefined, settings: s,
      };
    }
    // Connect to the address checked here (not the name again), so a DNS answer cannot change between check and connect;
    // TLS still verifies the certificate against the name.
    const address = await this.publicSmtpAddress(s.host!, s.port!);
    return {
      tx: nodemailer.createTransport({
        host: address, port: s.port!, secure: s.secure, auth: { user: s.username!, pass: unseal(s.passwordSealed!)! },
        ...(isIP(s.host!) ? {} : { tls: { servername: s.host! } }), ...timeouts,
      }),
      from: { name, address: s.fromEmail! }, replyTo: s.replyTo || undefined, bcc: s.bcc || undefined, settings: s,
    };
  }

  /**
   * The address an SMTP host resolves to — refused when it is on this server's own network or the port is not a mail
   * port, so a company's settings cannot be used to reach (or scan) the platform's internal services.
   */
  private async publicSmtpAddress(host: string, port: number): Promise<string> {
    const open = privateSmtpAllowed();
    if (!open && !isSmtpPort(port)) throw new BadRequestException(`Cổng SMTP phải là một trong: ${SMTP_PORTS.join(', ')}.`);
    let addresses: { address: string }[];
    try {
      addresses = await lookup(host, { all: true, verbatim: true });
    } catch {
      throw new BadRequestException('Không tìm thấy máy chủ SMTP — kiểm tra lại tên máy chủ.');
    }
    if (!addresses.length) throw new BadRequestException('Không tìm thấy máy chủ SMTP — kiểm tra lại tên máy chủ.');
    if (!open && addresses.some((a) => isPrivateAddress(a.address))) throw new BadRequestException('Máy chủ SMTP phải là một địa chỉ công khai trên Internet.');
    return addresses[0].address;
  }

  /** Writes the log row and audit entry of one send. A write that fails is reported, never thrown: by then the email
   *  has gone (or failed) whatever the database says, and the caller's answer must say so. */
  private async record(data: Omit<Prisma.EmailLogUncheckedCreateInput, 'id' | 'at'>, audit: { action: string; summary: string; entityCode?: string }, user: AuthUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.emailLog.create({ data });
        await this.audit.log(tx, {
          action: audit.action, entityType: data.kind === 'test' ? 'MailSettings' : 'EmailLog', entityId: data.kind === 'test' ? '1' : row.id,
          entityCode: audit.entityCode, summary: audit.summary, actor: { id: user.id, name: user.name },
        });
        return row;
      });
    } catch (err) {
      this.logger.error(`Email ${data.status} but its log could not be written: ${(err as Error)?.message ?? err}`);
      return null;
    }
  }

  /** "Gửi thử": a short email to the signed-in user (or the address given) through the saved settings. */
  async test(to: string | undefined, user: AuthUser) {
    const { ok, bad } = parseAddresses(to || user.email);
    if (bad.length || ok.length !== 1) throw new BadRequestException('Địa chỉ nhận thư thử không hợp lệ.');
    const t = await this.transport();
    const subject = 'Thư thử từ Ninh Trang ERP';
    const base = { kind: 'test', to: ok, cc: [], subject, sentById: user.id, sentByName: user.name };
    let messageId: string | undefined;
    try {
      ({ messageId } = await t.tx.sendMail({
        from: t.from, to: ok[0], replyTo: t.replyTo, subject,
        text: `Thiết lập email gửi đi hoạt động tốt.\n\nGửi bởi ${user.name} lúc ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`,
      }));
    } catch (e) {
      const reason = explainSmtpError(e);
      await this.record({ ...base, status: 'FAILED', error: reason }, { action: 'mail.test_failed', summary: `Gửi thư thử thất bại: ${reason}` }, user);
      throw new BadRequestException(reason);
    }
    // Sent: the settings work, whatever happens to the bookkeeping below.
    await this.prisma.mailSettings.update({ where: { id: 1 }, data: { verifiedAt: new Date() } }).catch((err: Error) => this.logger.error(`verifiedAt not saved: ${err.message}`));
    await this.record({ ...base, status: 'SENT', messageId }, { action: 'mail.test', summary: `Gửi thư thử tới ${ok[0]}` }, user);
    return { ok: true, to: ok[0] };
  }

  /** Per user: at most SEND_LIMIT emails per SEND_WINDOW — a document goes out by hand, never in bulk. */
  private readonly recent = new Map<string, number[]>();

  private brake(userId: string): void {
    const now = Date.now();
    const list = (this.recent.get(userId) ?? []).filter((t) => now - t < SEND_WINDOW);
    if (list.length >= SEND_LIMIT) throw new BadRequestException(`Đã gửi ${SEND_LIMIT} email trong 10 phút — đợi một lát rồi gửi tiếp.`);
    list.push(now);
    this.recent.set(userId, list);
  }

  /** Sends one document email. The result (sent or failed) is logged either way; a failure answers 400 with the reason. */
  async send(dto: SendMailDto, user: AuthUser) {
    this.brake(user.id);
    const need = MAIL_KINDS[dto.kind].permission;
    if (!user.permissions.includes(need)) throw new ForbiddenException(`Vai trò của bạn chưa có quyền: ${need}`);
    if (dto.docId && !(await this.seesDoc(user, dto.kind, dto.docId))) throw new NotFoundException('Không tìm thấy chứng từ');
    const to = parseAddresses(dto.to);
    const cc = parseAddresses(dto.cc ?? []);
    if (to.bad.length || cc.bad.length) throw new BadRequestException(`Địa chỉ email không hợp lệ: ${[...to.bad, ...cc.bad].join(', ')}`);
    if (!to.ok.length) throw new BadRequestException('Nhập ít nhất một người nhận.');
    if (to.ok.length + cc.ok.length > MAX_RECIPIENTS) throw new BadRequestException(`Tối đa ${MAX_RECIPIENTS} người nhận một lần.`);
    let content: Buffer | undefined;
    if (dto.attachment) {
      content = Buffer.from(dto.attachment.base64, 'base64');
      if (content.length > MAX_ATTACHMENT_BYTES) throw new BadRequestException('Tệp PDF quá lớn (tối đa 6 MB).');
      if (content.subarray(0, 5).toString('latin1') !== '%PDF-') throw new BadRequestException('Tệp đính kèm không phải PDF.');
    }
    const t = await this.transport();
    const base = {
      kind: dto.kind, docId: dto.docId ?? null, docCode: dto.docCode ?? null, to: to.ok, cc: cc.ok, subject: dto.subject,
      attachment: dto.attachment?.filename ?? null, sentById: user.id, sentByName: user.name,
    };
    const what = `${MAIL_KINDS[dto.kind].label}${dto.docCode ? ` ${dto.docCode}` : ''}`;
    let messageId: string | undefined;
    try {
      ({ messageId } = await t.tx.sendMail({
        from: t.from, to: to.ok, cc: cc.ok.length ? cc.ok : undefined, bcc: t.bcc, replyTo: t.replyTo, subject: dto.subject,
        text: dto.body, html: toHtml(dto.body),
        attachments: content ? [{ filename: dto.attachment!.filename, content, contentType: 'application/pdf' }] : undefined,
      }));
    } catch (e) {
      const reason = explainSmtpError(e);
      await this.record({ ...base, status: 'FAILED', error: reason }, { action: 'mail.send_failed', entityCode: dto.docCode, summary: `Gửi email ${what} thất bại: ${reason}` }, user);
      throw new BadRequestException(`Chưa gửi được: ${reason}`);
    }
    // The email is out. A log that cannot be written must not turn into "chưa gửi được" — the user would send it again.
    const row = await this.record({ ...base, status: 'SENT', messageId }, { action: 'mail.send', entityCode: dto.docCode, summary: `Gửi email ${what} tới ${to.ok.join(', ')}` }, user);
    return row ?? { id: null, at: new Date(), ...base, status: 'SENT', error: null, messageId: messageId ?? null };
  }

  /** Whether `user` may see the document an email is about. Báo giá and đơn bán follow the seller rule; the other kinds
   *  have no per-user visibility — their permission (MAIL_KINDS) is the rule. */
  private async seesDoc(user: AuthUser, kind: MailKind, docId: string): Promise<boolean> {
    if (kind === 'quotation') return (await this.prisma.quotation.count({ where: { id: docId, ...quotationVisibleTo(user) } })) > 0;
    if (kind === 'sales_order') return (await this.prisma.salesOrder.count({ where: { id: docId, ...orderVisibleTo(user) } })) > 0;
    return true;
  }

  /**
   * Nhật ký gửi: of one document (kind + docId), or the latest 200 for the settings page. Only company.update reads
   * across documents; anyone else reads one document's history, and only of a document they may see.
   */
  async log(user: AuthUser, kind?: string, docId?: string) {
    if (kind && !isMailKind(kind) && kind !== 'test') throw new BadRequestException('Loại chứng từ không hợp lệ');
    if (!user.permissions.includes('company.update')) {
      if (!docId || !kind || !isMailKind(kind)) throw new ForbiddenException('Chỉ người quản lý thiết lập email xem được toàn bộ nhật ký gửi.');
      const need = MAIL_KINDS[kind].permission;
      if (!user.permissions.includes(need)) throw new ForbiddenException(`Vai trò của bạn chưa có quyền: ${need}`);
      if (!(await this.seesDoc(user, kind, docId))) throw new NotFoundException('Không tìm thấy chứng từ');
    }
    return this.prisma.emailLog.findMany({
      where: { ...(kind ? { kind } : {}), ...(docId ? { docId } : {}) }, orderBy: { at: 'desc' }, take: docId ? 50 : 200,
    });
  }
}

// ---------- controller ----------

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  /** Whether sending is set up (every signed-in user: the compose dialog says why it cannot send). */
  @Get('status')
  async status() {
    const s = await this.mail.settings();
    return { ready: s.ready, mode: s.mode, from: s.mode === 'SYSTEM' ? s.systemFrom : s.fromEmail };
  }

  @RequirePermissions('company.update')
  @Get('settings')
  settings() {
    return this.mail.settings();
  }

  @RequirePermissions('company.update')
  @Put('settings')
  saveSettings(@Body() dto: MailSettingsDto, @CurrentUser() user: AuthUser) {
    return this.mail.saveSettings(dto, user);
  }

  @RequirePermissions('company.update')
  @Post('settings/test')
  @HttpCode(HttpStatus.OK)
  test(@Body() dto: TestMailDto, @CurrentUser() user: AuthUser) {
    return this.mail.test(dto.to, user);
  }

  /** Templates: everyone who may send reads them (the compose dialog fills from them); only company.update edits. */
  @RequirePermissions('email.send')
  @Get('templates')
  templates() {
    return this.mail.templates();
  }

  @RequirePermissions('company.update')
  @Put('templates')
  saveTemplate(@Body() dto: MailTemplateDto, @CurrentUser() user: AuthUser) {
    return this.mail.saveTemplate(dto, user);
  }

  @RequirePermissions('company.update')
  @Post('templates/reset')
  @HttpCode(HttpStatus.OK)
  resetTemplate(@Body() dto: Pick<MailTemplateDto, 'kind'>, @CurrentUser() user: AuthUser) {
    if (!isMailKind(dto?.kind)) throw new BadRequestException('Loại chứng từ không hợp lệ');
    return this.mail.resetTemplate(dto.kind, user);
  }

  @RequirePermissions('email.send')
  @Post('send')
  @HttpCode(HttpStatus.OK)
  send(@Body() dto: SendMailDto, @CurrentUser() user: AuthUser) {
    return this.mail.send(dto, user);
  }

  /** Nhật ký gửi of one document (anyone who may send), or all of them (company.update). */
  @RequirePermissions('email.send')
  @Get('log')
  log(@CurrentUser() user: AuthUser, @Query('kind') kind?: string, @Query('docId') docId?: string) {
    return this.mail.log(user, kind, docId);
  }
}

@Module({
  controllers: [MailController],
  providers: [MailService],
})
export class MailModule {}
