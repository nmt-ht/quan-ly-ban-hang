import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

// Turns the Prisma errors a user can actually cause into the same JSON shape Nest uses
// for HttpException ({ statusCode, message, error }); anything else stays a 500.
const MAP: Record<string, { status: number; error: string; message: (e: Prisma.PrismaClientKnownRequestError) => string }> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    error: 'Conflict',
    message: (e) => `Dữ liệu bị trùng (${duplicateField(e)}).`,
  },
  P2003: { status: HttpStatus.CONFLICT, error: 'Conflict', message: () => 'Dữ liệu đang được chứng từ khác dùng, hoặc tham chiếu không tồn tại.' },
  P2025: { status: HttpStatus.NOT_FOUND, error: 'Not Found', message: () => 'Không tìm thấy bản ghi.' },
};

// With driver adapters (Prisma 7) the field list moves from meta.target to the adapter's cause.
function duplicateField(e: Prisma.PrismaClientKnownRequestError): string {
  const meta = e.meta as { target?: string[] | string; driverAdapterError?: { cause?: { constraint?: { fields?: string[]; index?: string } } } } | undefined;
  const c = meta?.driverAdapterError?.cause?.constraint;
  return [meta?.target ?? c?.fields ?? c?.index ?? 'khoá duy nhất'].flat().join(', ');
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const known = MAP[exception.code];
    if (!known || host.getType() !== 'http') return super.catch(exception, host);
    host.switchToHttp().getResponse().status(known.status).json({
      statusCode: known.status,
      message: known.message(exception),
      error: known.error,
    });
  }
}
