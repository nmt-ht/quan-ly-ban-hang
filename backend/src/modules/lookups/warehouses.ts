import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, Patch, Post, Put, UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { foldVi } from '../../common/text.js';
import { AuditService } from '../../audit/audit.service.js';
import { diff } from '../../audit/audit.diff.js';

export class WarehouseDto {
  @Text(100) name!: string;
  @OptionalText(300) address?: string;
  @OptionalText(30) phone?: string;
  /** Thủ kho: a user of the system. */
  @OptionalText(60) managerId?: string;
  @OptionalText(1000) note?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class WarehouseActiveDto {
  @IsBoolean() isActive!: boolean;
}

/**
 * Who may be thủ kho: an active user whose (active) chức vụ does warehouse work — lập phiếu nhập / xuất / chuyển kho,
 * điều chỉnh tồn or kiểm kê. Seeing tồn kho alone (a Sale does) is not enough.
 */
export const KEEPER_PERMISSIONS = ['stock.import', 'stock.export', 'stock.transfer', 'stock.adjust', 'stock.stocktake'];

const FIELDS = { name: 'Tên kho', address: 'Địa chỉ', phone: 'Điện thoại', managerId: 'Thủ kho', note: 'Ghi chú', isActive: 'Đang dùng' };

/**
 * Kho (Thiết lập › Kho). Code KHO0000001 from the "KHO" sequence. A kho that has history (phiếu, order or trip lines,
 * tồn) is never deleted — Ngừng dùng hides it from new chứng từ and keeps its past readable; one never used may go.
 */
@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    const rows = await this.prisma.warehouse.findMany({ orderBy: { name: 'asc' }, include: { manager: { select: { name: true } } } });
    return rows.map(({ manager, ...w }) => ({ ...w, managerName: manager?.name ?? null }));
  }

  private async one(id: string) {
    const w = await this.prisma.warehouse.findUnique({ where: { id }, include: { manager: { select: { name: true } } } });
    if (!w) throw new NotFoundException('Không tìm thấy kho');
    const { manager, ...rest } = w;
    return { ...rest, managerName: manager?.name ?? null };
  }

  /** Users who may be thủ kho (KEEPER_PERMISSIONS), A → Z, with their chức vụ. */
  async managerCandidates() {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', role: { isActive: true, permissions: { some: { permissionCode: { in: KEEPER_PERMISSIONS } } } } },
      select: { id: true, name: true, phone: true, role: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return users.map((u) => ({ id: u.id, name: u.name, phone: u.phone, roleName: u.role.name }));
  }

  /** `keep` = the kho's current thủ kho: still accepted after their chức vụ changed, so an unrelated edit never fails. */
  private async check(dto: WarehouseDto, selfId?: string, keep?: string | null) {
    const all = await this.prisma.warehouse.findMany({ select: { id: true, name: true } });
    if (all.some((x) => x.id !== selfId && foldVi(x.name) === foldVi(dto.name))) throw new ConflictException(`Đã có kho "${dto.name}".`);
    if (dto.managerId && dto.managerId !== keep && !(await this.managerCandidates()).some((u) => u.id === dto.managerId)) {
      throw new BadRequestException('Thủ kho phải là người đang hoạt động, có chức vụ được lập phiếu kho hoặc kiểm kê.');
    }
  }

  private data(dto: WarehouseDto) {
    return {
      name: dto.name, address: dto.address ?? null, phone: dto.phone ?? null, managerId: dto.managerId ?? null,
      note: dto.note ?? null, isActive: dto.isActive ?? true,
    };
  }

  /** Thủ kho shows by name in Nhật ký, not by id. */
  private async withManagerName<T extends { managerId: string | null }>(row: T) {
    if (!row.managerId) return { ...row, managerId: null };
    const u = await this.prisma.user.findUnique({ where: { id: row.managerId }, select: { name: true } });
    return { ...row, managerId: u?.name ?? row.managerId };
  }

  async create(dto: WarehouseDto) {
    await this.check(dto);
    const id = await this.prisma.$transaction(async (tx) => {
      const w = await tx.warehouse.create({ data: { ...this.data(dto), code: await this.sequences.nextCode('KHO', tx) } });
      await this.audit.log(tx, { action: 'warehouse.create', entityType: 'Warehouse', entityId: w.id, entityCode: w.code, summary: `Thêm kho ${w.code} · ${w.name}` });
      return w.id;
    });
    return this.one(id);
  }

  async update(id: string, dto: WarehouseDto) {
    const before = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Không tìm thấy kho');
    await this.check(dto, id, before.managerId);
    const data = this.data(dto);
    const changes = diff(await this.withManagerName(before), await this.withManagerName(data), FIELDS);
    await this.prisma.$transaction(async (tx) => {
      const w = await tx.warehouse.update({ where: { id }, data });
      await this.audit.log(tx, {
        action: 'warehouse.update', entityType: 'Warehouse', entityId: id, entityCode: w.code,
        summary: before.name !== w.name ? `Đổi tên kho "${before.name}" thành "${w.name}"` : `Sửa kho ${w.code} · ${w.name}`, changes,
      });
    });
    return this.one(id);
  }

  /** Ngừng dùng: no new chứng từ can pick it; its tồn and phiếu stay. */
  async setActive(id: string, isActive: boolean) {
    await this.prisma.$transaction(async (tx) => {
      const w = await tx.warehouse.update({ where: { id }, data: { isActive } });
      await this.audit.log(tx, {
        action: isActive ? 'warehouse.activate' : 'warehouse.deactivate', entityType: 'Warehouse', entityId: id, entityCode: w.code,
        summary: `${isActive ? 'Dùng lại' : 'Ngừng dùng'} kho ${w.code} · ${w.name}`,
      });
    });
    return this.one(id);
  }

  /** Deletes a kho that was never used. Products that had it as kho ngầm định lose it (one Nhật ký line each). */
  async remove(id: string) {
    const wh = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!wh) throw new NotFoundException('Không tìm thấy kho');
    return this.prisma.$transaction(async (tx) => {
      const [vouchers, purchaseLines, salesLines, tripLoads, stocked] = await Promise.all([
        tx.warehouseVoucher.count({ where: { OR: [{ warehouseId: id }, { targetWarehouseId: id }] } }),
        tx.purchaseOrderLine.count({ where: { warehouseId: id } }),
        tx.salesOrderLine.count({ where: { warehouseId: id } }),
        tx.deliveryTripLoad.count({ where: { warehouseId: id } }),
        tx.stockLevel.count({ where: { warehouseId: id, quantity: { not: 0 } } }),
      ]);
      const uses = [
        vouchers && `${vouchers} phiếu kho`, purchaseLines && `${purchaseLines} dòng đơn nhập`, salesLines && `${salesLines} dòng đơn bán`,
        tripLoads && `${tripLoads} dòng chuyến giao hàng`, stocked && `${stocked} mặt hàng còn tồn`,
      ].filter(Boolean);
      if (uses.length) {
        throw new ConflictException(`Kho "${wh.name}" đã có ${uses.join(', ')} — giữ lại để không mất lịch sử tồn kho; chọn Ngừng dùng thay vì xoá.`);
      }
      const products = await tx.product.findMany({ where: { defaultWarehouseId: id }, select: { id: true, code: true } });
      if (products.length) {
        await tx.product.updateMany({ where: { defaultWarehouseId: id }, data: { defaultWarehouseId: null } });
        for (const p of products) {
          await this.audit.log(tx, {
            action: 'product.update', entityType: 'Product', entityId: p.id, entityCode: p.code,
            summary: `Bỏ kho ngầm định ${wh.name} (kho bị xoá)`,
            changes: [{ field: 'defaultWarehouseId', label: 'Kho ngầm định', from: wh.name, to: null }],
          });
        }
      }
      await tx.stockLevel.deleteMany({ where: { warehouseId: id } }); // only zero rows are left (tồn tối thiểu of this kho)
      await tx.warehouse.delete({ where: { id } });
      await this.audit.log(tx, {
        action: 'warehouse.delete', entityType: 'Warehouse', entityId: id, entityCode: wh.code ?? wh.name,
        summary: `Xoá kho ${wh.code ?? ''} · ${wh.name}`, related: products.map((p) => p.code),
      });
      return { clearedDefaults: products.length };
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  findAll() {
    return this.warehouses.findAll();
  }

  /** People the Thủ kho picker offers (see KEEPER_PERMISSIONS). */
  @RequirePermissions('warehouse.view')
  @Get('manager-candidates')
  managerCandidates() {
    return this.warehouses.managerCandidates();
  }

  @RequirePermissions('warehouse.create')
  @Post()
  create(@Body() dto: WarehouseDto) {
    return this.warehouses.create(dto);
  }

  @RequirePermissions('warehouse.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: WarehouseDto) {
    return this.warehouses.update(id, dto);
  }

  @RequirePermissions('warehouse.update')
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: WarehouseActiveDto) {
    return this.warehouses.setActive(id, dto.isActive);
  }

  /** Only a kho that was never used (see WarehousesService.remove). */
  @RequirePermissions('warehouse.delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.warehouses.remove(id);
  }
}
