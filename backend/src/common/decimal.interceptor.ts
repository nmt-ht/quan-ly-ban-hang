import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, map } from 'rxjs';

/**
 * Prisma returns Decimal columns as Decimal objects, which JSON-encode as strings ("185000").
 * The frontend works with numbers, so every response is walked once and Decimals become numbers.
 * VND amounts and quantities stay well inside the safe range of a double.
 */
export function decimalsToNumbers(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toNumber();
  if (Array.isArray(value)) return value.map(decimalsToNumbers);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value; // Date, Buffer, StreamableFile…
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = decimalsToNumbers(v);
  return out;
}

@Injectable()
export class DecimalInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(decimalsToNumbers));
  }
}
