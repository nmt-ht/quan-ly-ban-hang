import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { CustomerAddressDto, CustomerDto } from './dto/create-customer.dto.js';

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
  ) {}

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
      return toApi(c);
    });
  }

  async update(id: string, dto: CustomerDto) {
    await this.findOne(id);
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
      return toApi(c);
    });
  }

  /** Địa chỉ giao hàng edited from the customer page (thêm, sửa, xoá, đặt mặc định). */
  async setAddresses(id: string, addresses: CustomerAddressDto[]) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.deleteMany({ where: { customerId: id } });
      await tx.customerAddress.createMany({ data: addressRows(addresses).map((a) => ({ ...a, customerId: id })) });
      return toApi(await tx.customer.update({ where: { id }, data: { updatedAt: new Date() }, include: INCLUDE }));
    });
  }

  /** Ngừng theo dõi is a status change, not a delete: orders and công nợ stay. */
  async setActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return toApi(await this.prisma.customer.update({ where: { id }, data: { isActive }, include: INCLUDE }));
  }
}
