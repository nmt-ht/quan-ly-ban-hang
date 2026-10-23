import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { CustomerAddressDto, CustomerDto } from './dto/create-customer.dto.js';
import { AuditService } from '../../audit/audit.service.js';
import { diff } from '../../audit/audit.diff.js';

const CUSTOMER_FIELDS = {
  name: 'Tên', companyName: 'Tên công ty', type: 'Loại khách', creditDays: 'Số ngày được nợ', phone: 'Điện thoại',
  email: 'Email', idNumber: 'CCCD', personalTaxCode: 'MST cá nhân', companyTaxCode: 'MST công ty', note: 'Ghi chú',
  isActive: 'Đang theo dõi', tags: 'Thẻ', addresses: 'Địa chỉ giao hàng',
};

const addressText = (a: { label?: string | null; address: string; isDefault?: boolean }) =>
  (a.label ? `${a.label}: ` : '') + a.address + (a.isDefault ? ' (mặc định)' : '');

const INCLUDE = {
  tags: { select: { tagId: true } },
  addresses: { orderBy: { sortOrder: 'asc' } },
} as const satisfies Prisma.CustomerInclude;

type Row = Prisma.CustomerGetPayload<{ include: typeof INCLUDE }>;

/** The frontend's Customer: tagIds instead of the join rows, addresses without bookkeeping columns. */
const toApi = ({ tags, addresses, ...c }: Row) => ({
  ...c,
  tagIds: tags.map((t) => t.tagId),
  addresses: addresses.map(({ customerId: _c, sortOrder: _s, ...a }) => a),
});

/** Exactly one default address when there is any: the first marked, else the first. */
function addressRows(list: CustomerAddressDto[]) {
  const defaultIndex = Math.max(0, list.findIndex((a) => a.isDefault));
  return list.map((a, i) => ({
    id: a.id ?? randomUUID(), label: a.label ?? null, recipientName: a.recipientName ?? null, phone: a.phone ?? null,
    address: a.address, isDefault: i === defaultIndex, sortOrder: i,
  }));
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
  ) {}

  /** A customer as the diff compares it: tags by name, addresses as text. */
  private async described(c: ReturnType<typeof toApi>) {
    const tags = c.tagIds.length ? await this.prisma.tag.findMany({ where: { id: { in: c.tagIds } }, select: { name: true } }) : [];
    return { ...c, tags: tags.map((t) => t.name), addresses: c.addresses.map(addressText) };
  }

  async findAll() {
    return (await this.prisma.customer.findMany({ include: INCLUDE, orderBy: { name: 'asc' } })).map(toApi);
  }

  async findOne(id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id }, include: INCLUDE });
    if (!c) throw new NotFoundException('Không tìm thấy khách hàng');
    return toApi(c);
  }

  private fields(dto: CustomerDto) {
    return {
      name: dto.name, companyName: dto.companyName ?? null, type: dto.type, creditDays: dto.creditDays,
      phone: dto.phone ?? null, email: dto.email ?? null, idNumber: dto.idNumber ?? null,
      personalTaxCode: dto.personalTaxCode ?? null, companyTaxCode: dto.companyTaxCode ?? null,
      note: dto.note ?? null, isActive: dto.isActive ?? true,
    };
  }

  async create(dto: CustomerDto) {
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          ...this.fields(dto),
          code: await this.sequences.nextCode('KH', tx),
          tags: { create: [...new Set(dto.tagIds)].map((tagId) => ({ tagId })) },
          addresses: { create: addressRows(dto.addresses ?? []) },
        },
        include: INCLUDE,
      });
      await this.audit.log(tx, { action: 'customer.create', entityType: 'Customer', entityId: c.id, entityCode: c.code, summary: `Thêm khách hàng ${c.code} · ${c.name}` });
      return toApi(c);
    });
  }

  async update(id: string, dto: CustomerDto) {
    const before = await this.described(await this.findOne(id));
    return this.prisma.$transaction(async (tx) => {
      await tx.customerTag.deleteMany({ where: { customerId: id } });
      await tx.customerAddress.deleteMany({ where: { customerId: id } });
      const c = await tx.customer.update({
        where: { id },
        data: {
          ...this.fields(dto),
          tags: { create: [...new Set(dto.tagIds)].map((tagId) => ({ tagId })) },
          addresses: { create: addressRows(dto.addresses ?? []) },
        },
        include: INCLUDE,
      });
      const after = toApi(c);
      await this.audit.log(tx, {
        action: 'customer.update', entityType: 'Customer', entityId: id, entityCode: c.code,
        summary: `Sửa khách hàng ${c.code} · ${c.name}`, changes: diff(before, await this.described(after), CUSTOMER_FIELDS),
      });
      return after;
    });
  }

  /** Địa chỉ giao hàng edited from the customer page (thêm, sửa, xoá, đặt mặc định). */
  async setAddresses(id: string, addresses: CustomerAddressDto[]) {
    const before = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.deleteMany({ where: { customerId: id } });
      await tx.customerAddress.createMany({ data: addressRows(addresses).map((a) => ({ ...a, customerId: id })) });
      const after = toApi(await tx.customer.update({ where: { id }, data: { updatedAt: new Date() }, include: INCLUDE }));
      await this.audit.log(tx, {
        action: 'customer.addresses', entityType: 'Customer', entityId: id, entityCode: after.code,
        summary: `Sửa địa chỉ giao hàng của ${after.code} · ${after.name}`,
        changes: diff({ addresses: before.addresses.map(addressText) }, { addresses: after.addresses.map(addressText) }, { addresses: 'Địa chỉ giao hàng' }),
      });
      return after;
    });
  }

  /** Ngừng theo dõi is a status change, not a delete: orders and công nợ stay. */
  async setActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.customer.update({ where: { id }, data: { isActive }, include: INCLUDE });
      await this.audit.log(tx, {
        action: isActive ? 'customer.activate' : 'customer.deactivate', entityType: 'Customer', entityId: id, entityCode: c.code,
        summary: `${isActive ? 'Theo dõi lại' : 'Ngừng theo dõi'} khách hàng ${c.code} · ${c.name}`,
      });
      return toApi(c);
    });
  }
}
