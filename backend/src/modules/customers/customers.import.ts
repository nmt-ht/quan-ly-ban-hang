import { Injectable } from '@nestjs/common';
import { CustomerType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { ImportDto, ImportResult, RowError, cellBool, cellNumber, cellText, fold, runImport, validateRow } from '../../common/import.js';
import { CustomersService } from './customers.service.js';
import { CustomerDto } from './dto/create-customer.dto.js';

/** Column keys the screen sends (its headers map to these), with the label used in messages. */
export const CUSTOMER_IMPORT_LABELS: Record<string, string> = {
  code: 'Mã KH', name: 'Tên khách hàng', companyName: 'Tên công ty', type: 'Loại khách', priceList: 'Bảng giá',
  creditDays: 'Số ngày được nợ', creditLimit: 'Hạn mức công nợ', phone: 'Điện thoại', email: 'Email', idNumber: 'CCCD',
  personalTaxCode: 'MST cá nhân', companyTaxCode: 'MST công ty', address: 'Địa chỉ giao mặc định', recipientName: 'Người nhận',
  tags: 'Thẻ', note: 'Ghi chú', isActive: 'Đang theo dõi',
};

/** Validator property → column label. */
const DTO_LABELS: Record<string, string> = { ...CUSTOMER_IMPORT_LABELS, priceListId: 'Bảng giá', tagIds: 'Thẻ', addresses: 'Địa chỉ giao mặc định' };

const TYPES: Record<string, CustomerType> = {
  le: 'LE', 'khach le': 'LE', si: 'SI', 'khach si': 'SI', dropship: 'DROPSHIP', 'khach dropship': 'DROPSHIP',
};

/** Fields compared to say what an update changes. */
const COMPARED = ['name', 'companyName', 'type', 'priceListId', 'creditDays', 'creditLimit', 'phone', 'email', 'idNumber',
  'personalTaxCode', 'companyTaxCode', 'note', 'isActive'] as const;

/**
 * Nhập khách hàng từ Excel (Pha 1.9). Có "Mã KH" → cập nhật khách đó (ô trống hoặc cột không có trong file giữ
 * nguyên — xoá thông tin thì sửa ở form); không có mã → thêm mới. Một khách mới trùng điện thoại với khách đã có bị chặn,
 * để chạy lại cùng một file không nhân đôi danh bạ. "Địa chỉ giao mặc định" thêm (hoặc chọn) địa chỉ mặc định,
 * các địa chỉ khác của khách giữ nguyên.
 */
@Injectable()
export class CustomerImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly audit: AuditService,
  ) {}

  async run(dto: ImportDto, user: AuthUser): Promise<ImportResult> {
    const [all, lists, tags] = await Promise.all([
      this.customers.findAll(),
      this.prisma.priceList.findMany({ select: { id: true, name: true } }),
      this.prisma.tag.findMany({ select: { id: true, name: true } }),
    ]);
    const byCode = new Map(all.map((c) => [fold(c.code), c]));
    const byPhone = new Map(all.filter((c) => c.phone).map((c) => [digits(c.phone!), c]));
    const listByName = new Map(lists.map((l) => [fold(l.name), l]));
    const tagByName = new Map(tags.map((t) => [fold(t.name), t.id]));
    const canCreate = user.permissions.includes('customer.create');
    const canUpdate = user.permissions.includes('customer.update');
    const seen = new Set<string>();

    return runImport(this.prisma, dto, async (tx, r) => {
      const c = r.cells;
      // Ô trống (hoặc cột không có trong file) = giữ nguyên khi cập nhật, mặc định khi thêm mới.
      const has = (k: string) => cellText(c[k]) !== '';
      const errors: string[] = [];
      const code = cellText(c.code);
      const existing = code ? byCode.get(fold(code)) : undefined;
      if (code && !existing) errors.push(`không có khách mã "${code}" — để trống Mã KH nếu muốn thêm mới`);
      if (existing && !canUpdate) errors.push('chức vụ của bạn chưa có quyền sửa khách hàng');
      if (!code && !canCreate) errors.push('chức vụ của bạn chưa có quyền thêm khách hàng');

      const phone = has('phone') ? cellText(c.phone) : existing?.phone ?? '';
      const key = existing ? `id:${existing.id}` : phone ? `phone:${digits(phone)}` : `name:${fold(cellText(c.name))}`;
      if (seen.has(key)) errors.push('trùng với một dòng phía trên trong file');
      seen.add(key);
      const twin = !existing && phone ? byPhone.get(digits(phone)) : undefined;
      if (twin) errors.push(`điện thoại đã thuộc ${twin.code} · ${twin.name} — ghi Mã KH ${twin.code} để cập nhật`);

      const text = (k: string, old?: string | null) => (has(k) ? cellText(c[k]) || undefined : old ?? undefined);
      let type = existing?.type ?? 'LE';
      if (has('type') && cellText(c.type)) {
        const t = TYPES[fold(cellText(c.type))];
        if (t) type = t;
        else errors.push(`Loại khách "${cellText(c.type)}" không hợp lệ (Lẻ / Sỉ / Dropship)`);
      }
      let priceListId = existing?.priceListId ?? undefined;
      if (has('priceList')) {
        const name = cellText(c.priceList);
        const l = name ? listByName.get(fold(name)) : undefined;
        if (name && !l) errors.push(`không có bảng giá "${name}"`);
        priceListId = l?.id;
      }
      const int = (k: string, old: number) => {
        if (!has(k)) return old;
        const n = cellNumber(c[k]);
        if (n === null) return 0;
        if (Number.isNaN(n) || n < 0) errors.push(`${CUSTOMER_IMPORT_LABELS[k]} phải là số không âm`);
        return Number.isNaN(n) ? old : n;
      };
      const creditDays = int('creditDays', existing?.creditDays ?? 0);
      if (!Number.isInteger(creditDays)) errors.push('Số ngày được nợ phải là số nguyên');
      const creditLimit = Math.round(int('creditLimit', Number(norm(existing?.creditLimit) || 0)));
      const isActive = has('isActive') ? cellBool(c.isActive, true) : existing?.isActive ?? true;
      if (isActive === null) errors.push('Đang theo dõi phải là Có / Không');

      let tagIds = existing?.tagIds ?? [];
      if (has('tags')) {
        const names = cellText(c.tags).split(/[,;]/).map((s) => s.trim()).filter(Boolean);
        const missing = names.filter((n) => !tagByName.has(fold(n)));
        if (missing.length) errors.push(`không có thẻ: ${missing.join(', ')}`);
        tagIds = names.map((n) => tagByName.get(fold(n))).filter((x): x is string => !!x);
      }

      // Địa chỉ giao mặc định: chọn địa chỉ đã có cùng nội dung, không thì thêm làm mặc định; địa chỉ khác giữ nguyên.
      let addresses = (existing?.addresses ?? []).map((a) => ({ ...a, label: a.label ?? undefined, recipientName: a.recipientName ?? undefined, phone: a.phone ?? undefined }));
      const address = has('address') ? cellText(c.address) : '';
      if (address) {
        const same = addresses.find((a) => fold(a.address) === fold(address));
        const recipient = has('recipientName') ? cellText(c.recipientName) || undefined : same?.recipientName;
        addresses = same
          ? addresses.map((a) => ({ ...a, isDefault: a === same, recipientName: a === same ? recipient : a.recipientName }))
          : [{ address, recipientName: recipient, isDefault: true } as (typeof addresses)[number], ...addresses.map((a) => ({ ...a, isDefault: false }))];
      }

      if (errors.length) throw new RowError(errors);
      const plain = {
        name: text('name', existing?.name), companyName: text('companyName', existing?.companyName), type, creditDays, creditLimit,
        priceListId, phone: phone || undefined, email: text('email', existing?.email), idNumber: text('idNumber', existing?.idNumber),
        personalTaxCode: text('personalTaxCode', existing?.personalTaxCode), companyTaxCode: text('companyTaxCode', existing?.companyTaxCode),
        note: text('note', existing?.note), isActive, tagIds, addresses,
      };
      const next = await validateRow(CustomerDto, plain, DTO_LABELS);

      if (!existing) {
        const created = await this.customers.createIn(tx, next, 'excel');
        return { action: 'create', code: created.code, name: created.name };
      }
      const changes = COMPARED.filter((k) => norm(existing[k as keyof typeof existing]) !== norm(next[k as keyof CustomerDto])).map((k) => DTO_LABELS[k]);
      if (!sameSet(existing.tagIds, next.tagIds)) changes.push('Thẻ');
      if (address && (existing.addresses ?? []).find((a) => a.isDefault)?.address !== address) changes.push('Địa chỉ giao mặc định');
      if (!changes.length) return { action: 'unchanged', code: existing.code, name: existing.name };
      await this.customers.updateIn(tx, existing.id, next, 'excel');
      return { action: 'update', code: existing.code, name: next.name, changes };
    }, async (tx, res) => {
      await this.audit.log(tx, {
        action: 'customer.import', entityType: 'Customer', entityId: 'import',
        summary: `Nhập khách hàng từ Excel: ${res.created} thêm mới, ${res.updated} cập nhật, ${res.unchanged} không đổi, ${res.failed} dòng lỗi bỏ qua`,
      });
    });
  }
}

const digits = (s: string) => s.replace(/\D/g, '');
function norm(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Prisma.Decimal) return String(v.toNumber());
  return typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean);
}
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
