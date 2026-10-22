import { Prisma } from '@prisma/client';
import { decimalsToNumbers } from './decimal.interceptor.js';

describe('decimalsToNumbers', () => {
  it('turns nested Decimals into numbers and leaves everything else alone', () => {
    const date = new Date('2026-08-12T00:00:00Z');
    const out = decimalsToNumbers({
      code: 'DH0000001',
      orderDate: date,
      discountAmount: new Prisma.Decimal('15000'),
      lines: [{ quantity: new Prisma.Decimal('2.5'), unitPrice: new Prisma.Decimal('185000'), note: null }],
      bomSnapshot: [{ quantityPerUnit: 1.2 }],
    }) as any;

    expect(out.discountAmount).toBe(15000);
    expect(out.lines[0]).toEqual({ quantity: 2.5, unitPrice: 185000, note: null });
    expect(out.orderDate).toBe(date);
    expect(out.bomSnapshot).toEqual([{ quantityPerUnit: 1.2 }]);
    expect(JSON.stringify(out)).not.toContain('"185000"');
  });

  it('passes primitives and top-level Decimals through', () => {
    expect(decimalsToNumbers('ok')).toBe('ok');
    expect(decimalsToNumbers(null)).toBeNull();
    expect(decimalsToNumbers(new Prisma.Decimal('0.1'))).toBe(0.1);
  });
});
