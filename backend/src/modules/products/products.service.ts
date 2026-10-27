import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { BomReplacementDto, CreateProductDto, ProductImageDto, ProductImportDto, UnitConversionDto } from './dto/create-product.dto.js';
import { RowError, UnchangedRow, runImport, validateRow } from '../../common/import.js';
import { AuditService } from '../../audit/audit.service.js';
import { diff } from '../../audit/audit.diff.js';

const PRODUCT_FIELDS = {
  name: 'Tên', baseUnit: 'ĐVT chính', measureMode: 'Cách tính', crossRefCode: 'Mã đối chiếu', category: 'Nhóm hàng',
  defaultWarehouse: 'Kho ngầm định', minStock: 'Tồn tối thiểu', vatRate: 'Thuế GTGT (%)', warrantyMonths: 'Bảo hành (tháng)',
  origin: 'Nguồn gốc', retailPrice: 'Giá lẻ', wholesalePrice: 'Giá sỉ', dropshipPrice: 'Giá dropship', minPrice: 'Giá bán tối thiểu', purchaseNote: 'Diễn giải khi mua',
  saleNote: 'Diễn giải khi bán', description: 'Mô tả', isSellable: 'Được phép bán', isActive: 'Đang kinh doanh',
  units: 'Đơn vị quy đổi', images: 'Số ảnh',
};

const unitText = (u: { unitName: string; ratioToBaseUnit: unknown; price: unknown }) => `${u.unitName} = ${Number(u.ratioToBaseUnit)} · ${Number(u.price)}`;

type Tx = Prisma.TransactionClient;

const PREFIX: Record<string, string> = { VAT_TU: 'VT', THANH_PHAM: 'SP', DICH_VU: 'DV' };
const INCLUDE = {
  unitConversions: { orderBy: { sortOrder: 'asc' } },
  images: { orderBy: { sortOrder: 'asc' } },
} as const satisfies Prisma.ProductInclude;

type Row = Prisma.ProductGetPayload<{ include: typeof INCLUDE }>;

/** The frontend's Product: conversions and images without their bookkeeping columns, and without giá vốn (avgCost). */
const toApi = ({ unitConversions, images, avgCost: _cost, ...p }: Row) => ({
  ...p,
  unitConversions: unitConversions.map(({ id: _i, productId: _p, sortOrder: _s, ...u }) => u),
  images: images.map(({ productId: _p, sortOrder: _s, ...img }) => img),
});

const conversionRows = (list: UnitConversionDto[]) =>
  list.map((u, i) => ({
    unitName: u.unitName, operation: u.operation ?? 'MUL', factor: u.factor ?? null, ratioToBaseUnit: u.ratioToBaseUnit,
    price: u.price, wholesalePrice: u.wholesalePrice ?? null, dropshipPrice: u.dropshipPrice ?? null, sortOrder: i,
  }));

const imageRows = (list: ProductImageDto[]) =>
  list.map((img, i) => ({ id: img.id ?? randomUUID(), url: img.url, name: img.name, width: img.width, height: img.height, sortOrder: i }));

/** Every column of the form; an empty optional field clears the stored value. */
function fields(dto: CreateProductDto) {
  return {
    name: dto.name, baseUnit: dto.baseUnit, measureMode: dto.type === 'THANH_PHAM' ? (dto.measureMode ?? null) : null,
    crossRefCode: dto.crossRefCode ?? null, categoryId: dto.categoryId ?? null, defaultWarehouseId: dto.defaultWarehouseId ?? null,
    minStock: dto.minStock ?? 0, vatRate: dto.vatRate ?? 0, warrantyMonths: dto.warrantyMonths ?? 0, origin: dto.origin ?? null,
    retailPrice: dto.retailPrice ?? 0, wholesalePrice: dto.wholesalePrice ?? 0, dropshipPrice: dto.dropshipPrice ?? 0, minPrice: dto.minPrice ?? 0,
    purchaseNote: dto.purchaseNote ?? null, saleNote: dto.saleNote ?? null, description: dto.description ?? null,
    isSellable: dto.isSellable ?? true, isActive: dto.isActive ?? true,
  };
}

// Giá bán of a product and of its units, as one comparable string.
const priceKey = (p: { retailPrice: unknown; wholesalePrice: unknown; dropshipPrice: unknown; minPrice?: unknown }, units: { unitName: string; price: unknown; wholesalePrice?: unknown; dropshipPrice?: unknown }[]) =>
  JSON.stringify([
    Number(p.retailPrice), Number(p.wholesalePrice), Number(p.dropshipPrice), Number(p.minPrice ?? 0),
    ...units.map((u) => [u.unitName, Number(u.price), Number(u.wholesalePrice ?? 0), Number(u.dropshipPrice ?? 0)]),
  ]);

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
  ) {}

  /** A product as the diff compares it: nhóm hàng and kho by name, units as text, images as a count. */
  private async described(tx: Tx, p: {
    categoryId: string | null; defaultWarehouseId: string | null;
    unitConversions?: { unitName: string; ratioToBaseUnit: unknown; price: unknown }[]; images?: unknown[];
  }) {
    const [category, warehouse] = await Promise.all([
      p.categoryId ? tx.productCategory.findUnique({ where: { id: p.categoryId }, select: { name: true } }) : null,
      p.defaultWarehouseId ? tx.warehouse.findUnique({ where: { id: p.defaultWarehouseId }, select: { name: true } }) : null,
    ]);
    return {
      ...p, category: category?.name ?? null, defaultWarehouse: warehouse?.name ?? null,
      units: p.unitConversions?.map(unitText), images: p.images?.length,
    };
  }

  async findAll() {
    return (await this.prisma.product.findMany({ include: INCLUDE, orderBy: { name: 'asc' } })).map(toApi);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: INCLUDE });
    if (!product) throw new NotFoundException('Không tìm thấy hàng hoá');
    return toApi(product);
  }

  create(dto: CreateProductDto) {
    return this.prisma.$transaction(async (tx) => toApi(await this.insert(tx, dto, 'form')));
  }

  // The code prefix (VT/SP/DV) is fixed at creation, so the type cannot change.
  async update(id: string, dto: CreateProductDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => toApi((await this.replace(tx, id, dto, user, true)).saved));
  }

  /** Ngừng kinh doanh / kinh doanh lại: products are never hard-deleted. */
  async setActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.product.update({ where: { id }, data: { isActive }, include: INCLUDE });
      await this.audit.log(tx, {
        action: isActive ? 'product.activate' : 'product.deactivate', entityType: 'Product', entityId: id, entityCode: p.code,
        summary: `${isActive ? 'Kinh doanh lại' : 'Ngừng kinh doanh'} ${p.code} · ${p.name}`,
      });
      return toApi(p);
    });
  }

  /**
   * Nhập hàng hoá từ Excel (Pha 1.9): the frontend parses the sheet, the server checks and saves each row on its own
   * (savepoint) with the form's rules — a row that fails is reported and skipped. dryRun = xem trước, nothing is kept.
   * Images are not part of the sheet and stay as they are.
   */
  async import(dto: ProductImportDto, user: AuthUser) {
    const canCreate = user.permissions.includes('product.create');
    return runImport(this.prisma, dto, async (tx, r) => {
      if (!r.id && !canCreate) throw new RowError(['chức vụ của bạn chưa có quyền thêm hàng hoá']);
      const data = await validateRow(CreateProductDto, r.data, PRODUCT_FIELDS);
      if (!r.id) {
        const p = await this.insert(tx, data, 'excel');
        return { action: 'create', code: p.code, name: p.name };
      }
      const { saved, changes } = await this.replace(tx, r.id, data, user, false);
      if (!changes.length) throw new UnchangedRow(saved.code, saved.name);
      return { action: 'update', code: saved.code, name: saved.name, changes: changes.map((c) => c.label) };
    }, async (tx, res) => {
      await this.audit.log(tx, {
        action: 'product.import', entityType: 'Product', entityId: 'import',
        summary: `Nhập hàng hoá từ Excel: ${res.created} thêm mới, ${res.updated} cập nhật, ${res.unchanged} không đổi, ${res.failed} dòng lỗi bỏ qua`,
      });
    });
  }

  private async insert(tx: Tx, dto: CreateProductDto, source: 'form' | 'excel') {
    const p = await tx.product.create({
      data: {
        ...fields(dto),
        type: dto.type,
        code: await this.sequences.nextCode(PREFIX[dto.type], tx),
        unitConversions: { create: conversionRows(dto.unitConversions ?? []) },
        images: { create: imageRows(dto.images ?? []) },
      },
      include: INCLUDE,
    });
    await this.audit.log(tx, {
      action: 'product.create', entityType: 'Product', entityId: p.id, entityCode: p.code,
      summary: `Thêm hàng hoá ${p.code} · ${p.name}${source === 'excel' ? ' (nhập Excel)' : ''}`,
    });
    return p;
  }

  private async replace(tx: Tx, id: string, dto: CreateProductDto, user: AuthUser, withImages: boolean) {
    const old = await tx.product.findUnique({ where: { id }, include: { unitConversions: { orderBy: { sortOrder: 'asc' } }, images: true } });
    if (!old) throw new NotFoundException(`Không tìm thấy hàng hoá ${id}`);
    if (old.type !== dto.type) throw new BadRequestException(`${old.code}: không đổi được tính chất hàng hoá (mã ${PREFIX[old.type]}… gắn với tính chất).`);
    const units = dto.unitConversions ?? old.unitConversions.map((u) => ({ ...u, price: u.price.toNumber() }));
    const next = fields(dto);
    if (!user.permissions.includes('product.update_price') && priceKey(old, old.unitConversions) !== priceKey(next, units)) {
      throw new ForbiddenException(`${old.code}: chức vụ của bạn chưa có quyền sửa giá bán.`);
    }
    if (dto.unitConversions) {
      await tx.unitConversion.deleteMany({ where: { productId: id } });
      await tx.unitConversion.createMany({ data: conversionRows(dto.unitConversions).map((r) => ({ ...r, productId: id })) });
    }
    if (withImages && dto.images) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({ data: imageRows(dto.images).map((r) => ({ ...r, productId: id })) });
    }
    const saved = await tx.product.update({ where: { id }, data: next, include: INCLUDE });
    const changes = diff(await this.described(tx, old), await this.described(tx, saved), PRODUCT_FIELDS);
    await this.audit.log(tx, {
      action: changes.some((c) => /Price$/.test(c.field)) ? 'product.update_price' : 'product.update', entityType: 'Product', entityId: id,
      entityCode: saved.code, summary: `Sửa hàng hoá ${saved.code} · ${saved.name}${withImages ? '' : ' (nhập Excel)'}`, changes,
    });
    return { saved, changes };
  }

  // ---------- Định mức ----------

  async bomLines() {
    return this.prisma.bomLine.findMany({ select: { finishedProductId: true, componentId: true, quantityPerUnit: true } });
  }

  async replaceBoms(replacements: BomReplacementDto[]) {
    const ids = [...new Set(replacements.flatMap((r) => [r.finishedProductId, ...r.lines.map((l) => l.componentId)]))];
    const code = new Map((await this.prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } })).map((p) => [p.id, p.code]));
    const lineText = (l: { componentId: string; quantityPerUnit: unknown }) => `${code.get(l.componentId) ?? l.componentId} × ${Number(l.quantityPerUnit)}`;
    await this.prisma.$transaction(async (tx) => {
      for (const r of replacements) {
        const before = await tx.bomLine.findMany({ where: { finishedProductId: r.finishedProductId } });
        await tx.bomLine.deleteMany({ where: { finishedProductId: r.finishedProductId } });
        await tx.bomLine.createMany({
          data: r.lines.map((l) => ({ finishedProductId: r.finishedProductId, componentId: l.componentId, quantityPerUnit: l.quantityPerUnit })),
        });
        await this.audit.log(tx, {
          action: 'product.bom', entityType: 'Product', entityId: r.finishedProductId, entityCode: code.get(r.finishedProductId),
          summary: `Nhập định mức cho ${code.get(r.finishedProductId) ?? r.finishedProductId}: ${r.lines.length} dòng vật tư`,
          changes: diff({ lines: before.map(lineText) }, { lines: r.lines.map(lineText) }, { lines: 'Định mức' }),
        });
      }
    });
    return this.bomLines();
  }
}
