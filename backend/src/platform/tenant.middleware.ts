import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PlatformDbService } from './platform-db.service.js';
import { multiTenant } from './secret-box.js';
import { TenantClientsService } from './tenant-clients.service.js';
import { runInTenant } from './tenant.context.js';

// Routes that belong to no doanh nghiệp. Health and client-config read nothing of a doanh nghiệp's data
// (health pings DATABASE_URL); the platform's own routes must never reach a doanh nghiệp's database.
const OPEN = new Set(['/api/health', '/api/client-config']);
const PLATFORM = '/api/platform';

/**
 * Multi-tenant mode: every /api request names its doanh nghiệp in the X-Tenant header (the login screen's
 * "Mã doanh nghiệp", remembered by the browser). The request then runs with that doanh nghiệp's database;
 * the JWT carries the same mã (`tid`) and JwtStrategy refuses a token used for another one.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly platform: PlatformDbService,
    private readonly clients: TenantClientsService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Express matches routes case-insensitively: /API/auth/login reaches the same controller, so it must
    // not slip past the doanh nghiệp lookup (and its tạm ngưng check) onto DATABASE_URL.
    const path = req.originalUrl.split('?')[0].toLowerCase();
    if (!multiTenant() || !(path === '/api' || path.startsWith('/api/')) || OPEN.has(path)) return next();
    if (path === PLATFORM || path.startsWith(`${PLATFORM}/`)) return runInTenant({ code: null, client: null }, next);

    const code = String(req.headers['x-tenant'] ?? '').trim().toLowerCase();
    const refuse = (status: number, message: string) => void res.status(status).json({ statusCode: status, message, tenant: code || null });
    if (!code) return refuse(400, 'Chưa nhập mã doanh nghiệp.');
    const tenant = this.platform.find(code);
    if (!tenant) return refuse(404, `Không tìm thấy doanh nghiệp có mã "${code}".`);
    if (tenant.status === 'SUSPENDED') return refuse(403, 'Doanh nghiệp này đang tạm ngưng sử dụng. Vui lòng liên hệ đơn vị cung cấp phần mềm.');
    if (tenant.status !== 'ACTIVE') return refuse(503, 'Doanh nghiệp này đang được khởi tạo, chưa dùng được. Vui lòng thử lại sau.');

    let client;
    try {
      client = await this.clients.get(code, tenant.databaseUrl);
    } catch {
      return refuse(503, 'Không kết nối được cơ sở dữ liệu của doanh nghiệp. Vui lòng thử lại sau ít phút.');
    }
    runInTenant({ code, client }, next);
  }
}
