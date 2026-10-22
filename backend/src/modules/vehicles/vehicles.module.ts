import { Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { Prisma, Vehicle, VehicleStatus, VehicleType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { OptionalDay, OptionalText, Text } from '../../common/dto.js';
import { fromDay, toDay } from '../../common/text.js';

export class VehicleDto {
  @Text(20) plateNumber!: string;
  @OptionalText(100) name?: string;
  @IsEnum(VehicleType) type!: VehicleType;
  @IsOptional() @IsNumber() @Min(0) loadCapacity?: number;
  @IsOptional() @IsEnum(VehicleStatus) status?: VehicleStatus;
  @OptionalDay() registrationExpiry?: string;
  @OptionalDay() insuranceExpiry?: string;
  @OptionalText(60) driverUserId?: string;
  @OptionalText(100) usualDriver?: string;
  @OptionalText(30) driverPhone?: string;
  @OptionalText(500) note?: string;
}

export class StatusDto {
  @IsEnum(VehicleStatus) status!: VehicleStatus;
}

/** Biển số so khớp không phân biệt dấu chấm, gạch, khoảng trắng, hoa thường (as the frontend). */
const plateKey = (p: string) => p.replace(/[\s.\-]/g, '').toUpperCase();

// Date-only columns go out as "YYYY-MM-DD", the format the form's date inputs use.
const toApi = (v: Vehicle) => ({ ...v, registrationExpiry: toDay(v.registrationExpiry), insuranceExpiry: toDay(v.insuranceExpiry) });

// Danh mục xe: own vehicles only (a hired truck is typed straight onto the trip).
@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  async findAll() {
    return (await this.prisma.vehicle.findMany({ orderBy: { code: 'asc' } })).map(toApi);
  }

  async save(dto: VehicleDto, id?: string) {
    const plate = dto.plateNumber.toUpperCase();
    const all = await this.prisma.vehicle.findMany({ select: { id: true, code: true, plateNumber: true } });
    if (id && !all.some((v) => v.id === id)) throw new NotFoundException('Không tìm thấy xe');
    const dup = all.find((v) => v.id !== id && plateKey(v.plateNumber) === plateKey(plate));
    if (dup) throw new ConflictException(`Biển số ${plate} đã có ở xe ${dup.code}.`);

    // Gắn nhân viên thì tên tài xế là tên nhân viên; không thì tên gõ tay (người lái thuê ngoài).
    const driver = dto.driverUserId ? await this.prisma.user.findUnique({ where: { id: dto.driverUserId } }) : null;
    if (dto.driverUserId && !driver) throw new NotFoundException('Không tìm thấy nhân viên tài xế');
    const data = {
      plateNumber: plate, name: dto.name ?? null, type: dto.type, loadCapacity: dto.loadCapacity || null,
      status: dto.status ?? 'DANG_DUNG', registrationExpiry: fromDay(dto.registrationExpiry), insuranceExpiry: fromDay(dto.insuranceExpiry),
      driverUserId: driver?.id ?? null, usualDriver: driver?.name ?? dto.usualDriver ?? null, driverPhone: dto.driverPhone ?? null,
      note: dto.note ?? null,
    } satisfies Prisma.VehicleUncheckedUpdateInput;

    if (id) return toApi(await this.prisma.vehicle.update({ where: { id }, data }));
    return this.prisma.$transaction(async (tx) =>
      toApi(await tx.vehicle.create({ data: { ...data, code: await this.sequences.nextCode('XE', tx) } })),
    );
  }

  /** Bảo trì / Ngừng dùng is a status, not a delete: trips and costs keep the vehicle. */
  async setStatus(id: string, status: VehicleStatus) {
    return toApi(await this.prisma.vehicle.update({ where: { id }, data: { status } }));
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  findAll() {
    return this.vehicles.findAll();
  }

  @RequirePermissions('vehicle.create')
  @Post()
  create(@Body() dto: VehicleDto) {
    return this.vehicles.save(dto);
  }

  @RequirePermissions('vehicle.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: VehicleDto) {
    return this.vehicles.save(dto, id);
  }

  @RequirePermissions('vehicle.update')
  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.vehicles.setStatus(id, dto.status);
  }
}

@Module({ controllers: [VehiclesController], providers: [VehiclesService], exports: [VehiclesService] })
export class VehiclesModule {}
