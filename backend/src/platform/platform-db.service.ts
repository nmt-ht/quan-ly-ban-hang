import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import pg from 'pg';
import { PrismaService } from '../prisma/prisma.service.js';
import { databaseOf, defaultTenantCode, multiTenant, seal, unseal } from './secret-box.js';
import { latestMigration } from './tenant-commands.js';

export type TenantStatus = 'PROVISIONING' | 'FAILED' | 'ACTIVE' | 'SUSPENDED';

export interface Tenant {
  code: string;
  name: string;
  dbName: string;
  status: TenantStatus;
  adminEmail: string | null;
  lastError: string | null;
  /** True when the platform created the database itself (CREATE DATABASE nt_<mã>). */
  managed: boolean;
  createdAt: Date;
  updatedAt: Date;
  migratedAt: Date | null;
  schemaVersion: string | null;
}

interface TenantRow extends Tenant {
  databaseUrl: string;
}

export interface OwnerRow {
  totpSecret: string | null;
  totpPending: string | null;
  totpLastStep: number | null;
  enrolledAt: Date | null;
}

export interface PlatformAuditRow {
  id: string;
  at: Date;
  action: string;
  tenantCode: string | null;
  summary: string;
  ip: string | null;
}

// The platform database holds three small tables, created on start (no Prisma: it is not a doanh nghiệp).
// platform_audit refuses UPDATE and DELETE like the doanh nghiệp's own AuditLog.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS platform_tenant (
  code text PRIMARY KEY,
  name text NOT NULL,
  db_name text NOT NULL,
  database_url_enc text NOT NULL,
  status text NOT NULL,
  admin_email text,
  last_error text,
  managed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  migrated_at timestamptz,
  schema_version text
);
CREATE TABLE IF NOT EXISTS platform_owner (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  totp_secret_enc text,
  totp_pending_enc text,
  totp_last_step bigint,
  enrolled_at timestamptz
);
CREATE TABLE IF NOT EXISTS platform_audit (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  tenant_code text,
  summary text NOT NULL,
  ip text
);
CREATE OR REPLACE FUNCTION platform_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'platform_audit chỉ được ghi thêm'; END $$;
DROP TRIGGER IF EXISTS platform_audit_append_only ON platform_audit;
CREATE TRIGGER platform_audit_append_only BEFORE UPDATE OR DELETE ON platform_audit
  FOR EACH ROW EXECUTE FUNCTION platform_audit_append_only();
`;

const TENANT_COLUMNS = `code, name, db_name, database_url_enc, status, admin_email, last_error, managed,
  created_at, updated_at, migrated_at, schema_version`;

/**
 * The platform database (PLATFORM_DATABASE_URL): which doanh nghiệp exist, where their databases are,
 * the owner's second factor and the owner's log. Tenants are cached in memory for the per-request lookup
 * and reloaded after every change this process makes (one Render instance: no other writer).
 */
@Injectable()
export class PlatformDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Platform');
  private pool: pg.Pool | null = null;
  private cache = new Map<string, TenantRow>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    if (!multiTenant()) return;
    this.pool = await openPool(process.env.PLATFORM_DATABASE_URL!);
    await this.pool.query(SCHEMA);
    if (process.env.PLATFORM_TOTP_RESET === 'true') {
      await this.pool.query('UPDATE platform_owner SET totp_secret_enc = NULL, totp_pending_enc = NULL, enrolled_at = NULL');
      await this.audit('owner.totp_reset', null, 'Xoá mã xác thực của chủ nền tảng (PLATFORM_TOTP_RESET=true), cần đăng ký lại', null);
      this.logger.warn('PLATFORM_TOTP_RESET=true: đã xoá mã xác thực, hãy bỏ biến này sau khi đăng ký lại.');
    }
    await this.registerDefaultTenant();
    await this.reload();
    this.logger.log(`Nhiều doanh nghiệp: ${this.cache.size} doanh nghiệp.`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  get db(): pg.Pool {
    if (!this.pool) throw new Error('Chưa bật nhiều doanh nghiệp (PLATFORM_DATABASE_URL)');
    return this.pool;
  }

  /** The doanh nghiệp of DATABASE_URL becomes the first one, so turning the mode on changes nothing for it. */
  private async registerDefaultTenant(): Promise<void> {
    const { rows } = await this.db.query<{ n: string }>('SELECT count(*) AS n FROM platform_tenant');
    if (Number(rows[0].n) > 0) return;
    const url = process.env.DATABASE_URL!;
    const company = await this.prisma.companyInfo.findUnique({ where: { id: 1 } }).catch(() => null);
    const admin = await this.prisma.user.findFirst({ where: { roleId: 'role-ceo' }, orderBy: { createdAt: 'asc' } }).catch(() => null);
    const code = defaultTenantCode();
    await this.db.query(
      `INSERT INTO platform_tenant (code, name, db_name, database_url_enc, status, admin_email, managed, migrated_at, schema_version)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, false, now(), $6)`,
      [code, company?.name ?? 'Doanh nghiệp đầu tiên', databaseOf(url), seal(url), admin?.email ?? null, latestMigration()],
    );
    await this.audit('tenant.register_default', code, `Đăng ký doanh nghiệp đầu tiên "${code}" từ DATABASE_URL`, null);
  }

  async reload(): Promise<void> {
    const { rows } = await this.db.query(`SELECT ${TENANT_COLUMNS} FROM platform_tenant ORDER BY created_at, code`);
    this.cache = new Map(rows.map((r) => [r.code as string, toTenant(r)]));
  }

  /** From memory: called on every request. */
  find(code: string): TenantRow | undefined {
    return this.cache.get(code);
  }

  list(): Tenant[] {
    return [...this.cache.values()].map(({ databaseUrl: _url, ...t }) => t);
  }

  async insert(t: { code: string; name: string; dbName: string; databaseUrl: string; adminEmail: string; managed: boolean }): Promise<void> {
    await this.db.query(
      `INSERT INTO platform_tenant (code, name, db_name, database_url_enc, status, admin_email, managed)
       VALUES ($1, $2, $3, $4, 'PROVISIONING', $5, $6)`,
      [t.code, t.name, t.dbName, seal(t.databaseUrl), t.adminEmail, t.managed],
    );
    await this.reload();
  }

  async update(code: string, patch: Partial<Pick<Tenant, 'name' | 'status' | 'lastError' | 'migratedAt' | 'schemaVersion'>>): Promise<void> {
    const columns: Record<string, string> = { name: 'name', status: 'status', lastError: 'last_error', migratedAt: 'migrated_at', schemaVersion: 'schema_version' };
    const keys = Object.keys(patch) as (keyof typeof patch)[];
    if (!keys.length) return;
    const sets = keys.map((k, i) => `${columns[k]} = $${i + 2}`).join(', ');
    await this.db.query(`UPDATE platform_tenant SET ${sets}, updated_at = now() WHERE code = $1`, [code, ...keys.map((k) => patch[k] ?? null)]);
    await this.reload();
  }

  async owner(): Promise<OwnerRow> {
    await this.db.query('INSERT INTO platform_owner (id) VALUES (1) ON CONFLICT DO NOTHING');
    const { rows } = await this.db.query('SELECT totp_secret_enc, totp_pending_enc, totp_last_step, enrolled_at FROM platform_owner WHERE id = 1');
    const r = rows[0];
    return {
      totpSecret: r.totp_secret_enc ? unseal(r.totp_secret_enc) : null,
      totpPending: r.totp_pending_enc ? unseal(r.totp_pending_enc) : null,
      totpLastStep: r.totp_last_step === null ? null : Number(r.totp_last_step),
      enrolledAt: r.enrolled_at,
    };
  }

  async setPendingTotp(secret: string): Promise<void> {
    await this.db.query('UPDATE platform_owner SET totp_pending_enc = $1 WHERE id = 1', [seal(secret)]);
  }

  async confirmTotp(secret: string, step: number): Promise<void> {
    await this.db.query('UPDATE platform_owner SET totp_secret_enc = $1, totp_pending_enc = NULL, totp_last_step = $2, enrolled_at = now() WHERE id = 1', [seal(secret), step]);
  }

  /** Marks a code as used; false when it (or a later one) already was — a replayed code. */
  async useTotpStep(step: number): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'UPDATE platform_owner SET totp_last_step = $1 WHERE id = 1 AND (totp_last_step IS NULL OR totp_last_step < $1)',
      [step],
    );
    return rowCount === 1;
  }

  async audit(action: string, tenantCode: string | null, summary: string, ip: string | null): Promise<void> {
    await this.db.query('INSERT INTO platform_audit (action, tenant_code, summary, ip) VALUES ($1, $2, $3, $4)', [action, tenantCode, summary, ip]);
  }

  async auditLog(limit = 100): Promise<PlatformAuditRow[]> {
    const { rows } = await this.db.query('SELECT id, at, action, tenant_code, summary, ip FROM platform_audit ORDER BY id DESC LIMIT $1', [limit]);
    return rows.map((r) => ({ id: String(r.id), at: r.at, action: r.action, tenantCode: r.tenant_code, summary: r.summary, ip: r.ip }));
  }
}

function toTenant(r: Record<string, any>): TenantRow {
  return {
    code: r.code,
    name: r.name,
    dbName: r.db_name,
    databaseUrl: unseal(r.database_url_enc),
    status: r.status,
    adminEmail: r.admin_email,
    lastError: r.last_error,
    managed: r.managed,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    migratedAt: r.migrated_at,
    schemaVersion: r.schema_version,
  };
}

/** Opens the platform database, creating it first when the server has no database of that name yet. */
async function openPool(url: string): Promise<pg.Pool> {
  const pool = new pg.Pool({ connectionString: url, max: 3 });
  try {
    await pool.query('SELECT 1');
    return pool;
  } catch (e) {
    await pool.end();
    if ((e as { code?: string }).code !== '3D000') throw e; // 3D000: database does not exist
    await createDatabase(adminUrlFor(url), databaseOf(url));
    return new pg.Pool({ connectionString: url, max: 3 });
  }
}

/** CREATE DATABASE runs from a connection to another database on the same server: DATABASE_URL when it is there. */
export function adminUrlFor(url: string): string {
  const main = process.env.DATABASE_URL;
  if (main && new URL(main).host === new URL(url).host) return main;
  return Object.assign(new URL(url), { pathname: '/postgres' }).toString();
}

/** False when the database already exists (a retried creation). */
export async function createDatabase(adminUrl: string, name: string): Promise<boolean> {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rowCount) return false;
    await client.query(`CREATE DATABASE ${quoteIdent(name)}`);
    return true;
  } finally {
    await client.end();
  }
}

export const quoteIdent = (name: string): string => `"${name.replace(/"/g, '""')}"`;
