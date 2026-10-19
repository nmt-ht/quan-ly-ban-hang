import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

const PREFIX: Record<string, string> = { VAT_TU: 'VT', THANH_PHAM: 'SP', DICH_VU: 'DV' };

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(search?: string) {
    return this.prisma.product.findMany({
      where: search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }] }
        : undefined,
      include: { category: true, unitConversions: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, unitConversions: true },
    });
    if (!product) throw new NotFoundException('Không tìm thấy hàng hoá');
    return product;
  }

  async create(dto: CreateProductDto) {
    const count = await this.prisma.product.count();
    const code = `${PREFIX[dto.type]}${String(count + 1).padStart(7, '0')}`;

    return this.prisma.product.create({
      data: {
        code,
        name: dto.name,
        type: dto.type,
        baseUnit: dto.baseUnit,
        crossRefCode: dto.crossRefCode,
        categoryId: dto.categoryId,
        defaultWarehouseId: dto.defaultWarehouseId,
        minStock: dto.minStock ?? 0,
        vatRate: dto.vatRate ?? 0,
        warrantyMonths: dto.warrantyMonths ?? 0,
        origin: dto.origin,
        retailPrice: dto.retailPrice ?? 0,
        wholesalePrice: dto.wholesalePrice ?? 0,
        dropshipPrice: dto.dropshipPrice ?? 0,
        purchaseNote: dto.purchaseNote,
        saleNote: dto.saleNote,
        description: dto.description,
        isSellable: dto.isSellable ?? true,
        isActive: dto.isActive ?? true,
        unitConversions: dto.unitConversions
          ? { create: dto.unitConversions.map((u) => ({ unitName: u.unitName, ratioToBaseUnit: u.ratioToBaseUnit, price: u.price })) }
          : undefined,
      },
      include: { unitConversions: true },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto as any });
  }

  // Products are never hard-deleted — matches product.delete meaning
  // "ngừng kinh doanh" (deactivate), not row removal.
  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }
}
