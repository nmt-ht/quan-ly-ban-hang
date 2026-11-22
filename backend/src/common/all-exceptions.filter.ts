import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

// Every answer to an error has the shape Nest uses for HttpException ({ statusCode, message, error }) and a Vietnamese message the
// screen can show as is:
//  - errors a user can cause (Prisma unique / reference / missing row) become 409 / 404 with a plain explanation;
//  - HttpException (validation, permission, business rules) keeps its own answer, untouched;
//  - anything else is OUR fault: a generic 500 plus `requestId`, the same id as the X-Request-Id header, the server log and Sentry,
//    so the person who reports it to IT can quote one code. The details never leave the server.
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

export const SYSTEM_ERROR_MESSAGE = 'Lỗi hệ thống, chưa xử lý được yêu cầu.';

/** Set on an error once ErrorReportInterceptor has logged it, so the filter does not log it twice. */
export interface ReportedError { reported?: boolean }

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return super.catch(exception, host);
    const http = host.switchToHttp();
    const res = http.getResponse<{ status: (n: number) => { json: (b: unknown) => void } }>();
    const req = http.getRequest<{ id?: string; method?: string; originalUrl?: string }>();

    if (exception instanceof Prisma.PrismaClientKnownRequestError && MAP[exception.code]) {
      const known = MAP[exception.code];
      res.status(known.status).json({ statusCode: known.status, message: known.message(exception), error: known.error, requestId: req.id });
      return;
    }
    if (exception instanceof HttpException) return super.catch(exception, host);

    // Not caught by the interceptor (guards, pipes, middleware, a failed adapter): log it here.
    const fault = exception as ReportedError | null;
    if (!fault?.reported) {
      const e = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`[${req.id ?? '-'}] ${req.method} ${req.originalUrl}: ${e.message}`, e.stack);
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: SYSTEM_ERROR_MESSAGE,
      error: 'Internal Server Error',
      requestId: req.id,
    });
  }
}
