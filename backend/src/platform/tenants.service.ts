import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { createDatabase, PlatformDbService, Tenant } from './platform-db.service.js';
import { databaseOf, describeUrl, TENANT_CODE, tenantDbName, withDatabase } from './secret-box.js';
import { errorTail, latestMigration, migrateDeploy, runScript } from './tenant-commands.js';
import { TenantClientsService } from './tenant-clients.service.js';

export interface CreateTenantInput {
  code: string;
  name: string;
  adminEmail: string;
  adminPassword?: string;
  databaseUrl?: string;
  demo?: boolean;
}

export interface TenantView extends Tenant {
  database: string;
  needsMigration: boolean;
}

// Words the login screen or the URLs might confuse with something else.
const RESERVED = new Set(['api', 'admin', 'platform', 'nen-tang', 'quan-tri', 'login', 'root', 'postgres', 'template0', 'template1']);
const PLATFORM_ACTOR = { id: null, name: 'Quản trị nền tảng' };

/** Mật khẩu tạm: 12 ký tự dễ đọc (không có 0/O, 1/l/I), luôn có chữ và số như checkPassword đòi. */
export function temporaryPassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < 12) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Tạo, tạm ngưng, mở lại, cập nhật cấu trúc doanh nghiệp. No delete: a doanh nghiệp's database is its books;
 * stopping service is "Tạm ngưng", and dropping a database stays a deliberate act on the server itself.
 */
@Injectable()
export class TenantsService {
  private readonly logger = new Logger('Tenants');
  /** Jobs still running in this process: the page polls while a doanh nghiệp shows PROVISIONING. */
  private readonly running = new Set<string>();

  constructor(
    private readonly platform: PlatformDbService,
    private readonly clients: TenantClientsService,
    private readonly audit: AuditService,
  ) {}

  list(): TenantView[] {
    const latest = latestMigration();
    return this.platform.list().map((t) => ({
      ...t,
      database: describeUrl(this.platform.find(t.code)!.databaseUrl),
      needsMigration: !!latest && (t.status === 'ACTIVE' || t.status === 'SUSPENDED') && t.schemaVersion !== latest,
      // A row left PROVISIONING by a restart mid-job shows as failed, so it can be retried.
      ...(t.status === 'PROVISIONING' && !this.running.has(t.code) ? { status: 'FAILED' as const, lastError: t.lastError ?? 'Máy chủ khởi động lại khi đang tạo.' } : {}),
    }));
  }

  private get(code: string) {
    const t = this.platform.find(code);
    if (!t) throw new NotFoundException(`Không tìm thấy doanh nghiệp "${code}".`);
    return t;
  }

  async create(input: CreateTenantInput, ip: string | null): Promise<{ tenant: TenantView; adminPassword: string }> {
    const code = input.code.trim().toLowerCase();
    if (!TENANT_CODE.test(code)) throw new BadRequestException('Mã doanh nghiệp: 3–30 ký tự, chữ thường không dấu, số hoặc gạch ngang, bắt đầu bằng chữ.');
    if (RESERVED.has(code)) throw new BadRequestException(`Mã "${code}" để dành cho hệ thống, chọn mã khác.`);
    if (this.platform.find(code)) throw new ConflictException(`Mã "${code}" đã có doanh nghiệp dùng.`);
    const adminPassword = input.adminPassword?.trim() || temporaryPassword();
    if (adminPassword.length < 8 || !/[a-zA-Z]/.test(adminPassword) || !/\d/.test(adminPassword)) {
      throw new BadRequestException('Mật khẩu quản trị: từ 8 ký tự, có cả chữ và số.');
    }

    const custom = input.databaseUrl?.trim();
    if (custom && !/^postgres(ql)?:\/\//.test(custom)) throw new BadRequestException('Chuỗi kết nối phải bắt đầu bằng postgresql://');
    const databaseUrl = custom || withDatabase(process.env.PLATFORM_DATABASE_URL!, tenantDbName(code));
    if (this.platform.list().some((t) => this.platform.find(t.code)!.databaseUrl === databaseUrl)) {
      throw new ConflictException('Cơ sở dữ liệu này đã thuộc một doanh nghiệp khác.');
    }

    const adminEmail = input.adminEmail.trim().toLowerCase();
    await this.platform.insert({ code, name: input.name.trim(), dbName: databaseOf(databaseUrl), databaseUrl, adminEmail, managed: !custom });
    await this.platform.audit('tenant.create', code, `Tạo doanh nghiệp "${input.name.trim()}" (${code}), CSDL ${describeUrl(databaseUrl)}, quản trị ${adminEmail}${input.demo ? ', có dữ liệu mẫu' : ''}`, ip);
    this.start(code, adminPassword, !!input.demo, ip);
    return { tenant: this.view(code), adminPassword };
  }

  /** A failed creation, again from the top: every step is safe to repeat. A new admin password is issued. */
  async retry(code: string, ip: string | null): Promise<{ tenant: TenantView; adminPassword: string }> {
    const t = this.get(code);
    if (this.running.has(code) || (t.status !== 'FAILED' && t.status !== 'PROVISIONING')) {
      throw new BadRequestException('Chỉ chạy lại được doanh nghiệp tạo chưa thành công.');
    }
    const adminPassword = temporaryPassword();
    await this.platform.update(code, { status: 'PROVISIONING', lastError: null });
    await this.platform.audit('tenant.retry', code, `Chạy lại việc tạo doanh nghiệp ${code}`, ip);
    this.start(code, adminPassword, false, ip);
    return { tenant: this.view(code), adminPassword };
  }

  private start(code: string, adminPassword: string, demo: boolean, ip: string | null): void {
    this.running.add(code);
    void this.provision(code, adminPassword, demo, ip).finally(() => this.running.delete(code));
  }

  private async provision(code: string, adminPassword: string, demo: boolean, ip: string | null): Promise<void> {
    const t = this.get(code);
    const failed = async (stage: string, detail: string) => {
      this.logger.error(`Tạo doanh nghiệp ${code} lỗi ở bước ${stage}: ${detail}`);
      await this.platform.update(code, { status: 'FAILED', lastError: `${stage}: ${detail}` });
      await this.platform.audit('tenant.create_failed', code, `Tạo doanh nghiệp ${code} lỗi ở bước ${stage}`, ip);
    };
    try {
      if (t.managed) await createDatabase(process.env.PLATFORM_DATABASE_URL!, t.dbName);

      const migrated = await migrateDeploy(t.databaseUrl);
      if (!migrated.ok) return await failed('Tạo cấu trúc dữ liệu', errorTail(migrated.output));

      const seeded = await runScript('prisma/seed.ts', {
        DATABASE_URL: t.databaseUrl,
        SEED_PROFILE: demo ? 'sample' : 'tenant',
        SEED_COMPANY_NAME: t.name,
        SEED_ADMIN_EMAIL: t.adminEmail ?? '',
        SEED_ADMIN_PASSWORD: adminPassword,
      });
      if (!seeded.ok) return await failed('Nạp danh mục ban đầu', errorTail(seeded.output));

      if (demo) {
        const sample = await runScript('prisma/seed-demo.ts', { DATABASE_URL: t.databaseUrl, SEED_DEMO: 'true', DEMO_USER_PASSWORD: adminPassword });
        if (!sample.ok) return await failed('Nạp dữ liệu mẫu', errorTail(sample.output));
      }

      // The seed leaves an existing admin alone; a retry still has to hand over the password it showed.
      await this.withClient(t.databaseUrl, (db) => this.setPassword(db, t.adminEmail ?? '', adminPassword, 'Mật khẩu ban đầu do quản trị nền tảng cấp'));
      await this.platform.update(code, { status: 'ACTIVE', lastError: null, migratedAt: new Date(), schemaVersion: latestMigration() });
      await this.platform.audit('tenant.ready', code, `Doanh nghiệp ${code} sẵn sàng sử dụng`, ip);
    } catch (e) {
      await failed('Khởi tạo', errorTail(e instanceof Error ? e.message : String(e))).catch(() => undefined);
    }
  }

  async rename(code: string, name: string, ip: string | null): Promise<TenantView> {
    const t = this.get(code);
    const next = name.trim();
    if (!next) throw new BadRequestException('Tên doanh nghiệp không được để trống.');
    await this.platform.update(code, { name: next });
    await this.platform.audit('tenant.rename', code, `Đổi tên doanh nghiệp ${code}: "${t.name}" → "${next}"`, ip);
    return this.view(code);
  }

  async suspend(code: string, ip: string | null): Promise<TenantView> {
    const t = this.get(code);
    if (t.status !== 'ACTIVE') throw new BadRequestException('Chỉ tạm ngưng được doanh nghiệp đang hoạt động.');
    await this.platform.update(code, { status: 'SUSPENDED' });
    await this.platform.audit('tenant.suspend', code, `Tạm ngưng doanh nghiệp ${code}: người dùng không đăng nhập hay thao tác được nữa`, ip);
    return this.view(code);
  }

  async reopen(code: string, ip: string | null): Promise<TenantView> {
    const t = this.get(code);
    if (t.status !== 'SUSPENDED') throw new BadRequestException('Chỉ mở lại được doanh nghiệp đang tạm ngưng.');
    await this.platform.update(code, { status: 'ACTIVE' });
    await this.platform.audit('tenant.reopen', code, `Mở lại doanh nghiệp ${code}`, ip);
    return this.view(code);
  }

  /** prisma migrate deploy on one doanh nghiệp's database (start-up does it for all: prisma/migrate-tenants.ts). */
  async migrate(code: string, ip: string | null): Promise<TenantView> {
    const t = this.get(code);
    if (t.status !== 'ACTIVE' && t.status !== 'SUSPENDED') throw new BadRequestException('Doanh nghiệp chưa tạo xong, hãy chạy lại việc tạo.');
    const r = await migrateDeploy(t.databaseUrl);
    if (!r.ok) {
      await this.platform.update(code, { lastError: `Cập nhật cấu trúc: ${errorTail(r.output)}` });
      await this.platform.audit('tenant.migrate_failed', code, `Cập nhật cấu trúc dữ liệu ${code} lỗi`, ip);
      throw new BadRequestException(`Cập nhật cấu trúc lỗi: ${errorTail(r.output)}`);
    }
    await this.platform.update(code, { lastError: null, migratedAt: new Date(), schemaVersion: latestMigration() });
    await this.platform.audit('tenant.migrate', code, `Cập nhật cấu trúc dữ liệu ${code} lên ${latestMigration()}`, ip);
    return this.view(code);
  }

  /** One after another: a failure is reported and the next doanh nghiệp still runs. */
  async migrateAll(ip: string | null): Promise<{ code: string; ok: boolean; error?: string }[]> {
    const results: { code: string; ok: boolean; error?: string }[] = [];
    for (const t of this.platform.list().filter((x) => x.status === 'ACTIVE' || x.status === 'SUSPENDED')) {
      try {
        await this.migrate(t.code, ip);
        results.push({ code: t.code, ok: true });
      } catch (e) {
        results.push({ code: t.code, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return results;
  }

  /**
   * Cấp lại mật khẩu cho tài khoản quản trị của doanh nghiệp (or another account by email): a temporary
   * password to change at the next sign-in, every session of that account ends, the account is unlocked.
   * The doanh nghiệp's own Nhật ký hoạt động records it, under "Quản trị nền tảng".
   */
  async resetPassword(code: string, email: string | undefined, ip: string | null): Promise<{ email: string; password: string }> {
    const t = this.get(code);
    if (t.status !== 'ACTIVE' && t.status !== 'SUSPENDED') throw new BadRequestException('Doanh nghiệp chưa tạo xong.');
    const target = (email ?? t.adminEmail ?? '').trim().toLowerCase();
    if (!target) throw new BadRequestException('Nhập email tài khoản cần cấp lại mật khẩu.');
    const password = temporaryPassword();
    const db = await this.clients.get(code, t.databaseUrl);
    const found = await this.setPassword(db, target, password, 'Quản trị nền tảng cấp lại mật khẩu tạm, các phiên đăng nhập cũ đã kết thúc');
    if (!found) throw new NotFoundException(`Doanh nghiệp ${code} không có tài khoản ${target}.`);
    await this.platform.audit('tenant.reset_password', code, `Cấp lại mật khẩu tạm cho ${target} của doanh nghiệp ${code}`, ip);
    return { email: target, password };
  }

  private async setPassword(db: PrismaClient, email: string, password: string, summary: string): Promise<boolean> {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return false;
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordUpdatedAt: now, mustChangePassword: true, sessionsRevokedAt: now, status: 'ACTIVE' },
      });
      await this.audit.log(tx, { action: 'user.platform_reset_password', entityType: 'User', entityId: user.id, entityCode: user.email, summary, actor: PLATFORM_ACTOR });
    });
    return true;
  }

  private async withClient<T>(url: string, fn: (db: PrismaClient) => Promise<T>): Promise<T> {
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 1 }) });
    try {
      return await fn(db);
    } finally {
      await db.$disconnect();
    }
  }

  private view(code: string): TenantView {
    return this.list().find((t) => t.code === code)!;
  }
}
