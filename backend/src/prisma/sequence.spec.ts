import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SequenceController } from './sequence.controller.js';
import { SequenceService } from './sequence.service.js';

/** A database that answers the one query peekCode makes. */
const db = (value: number | null) => ({ $queryRaw: async () => (value === null ? [] : [{ value }]) }) as never;

describe('SequenceService.peekCode', () => {
  const s = new SequenceService(null as never);

  it('is the number after the last one handed out, padded like a real code', async () => {
    expect(await s.peekCode('DN', db(22))).toBe('DN0000023');
    expect(await s.peekCode('LSX', db(0))).toBe('LSX0000001');
  });

  it('starts at 1 for a prefix nothing was ever numbered with', async () => {
    expect(await s.peekCode('HDB', db(null))).toBe('HDB0000001');
  });

  it('never hands out a number: it only reads (one query, no insert)', async () => {
    let calls = 0;
    await s.peekCode('DH', { $queryRaw: async (...a: unknown[]) => { calls++; expect(String(a[0])).not.toMatch(/INSERT|UPDATE/i); return [{ value: 5 }]; } } as never);
    expect(calls).toBe(1);
  });
});

describe('SequenceController', () => {
  const c = new SequenceController({ peekCode: async (p: string) => `${p}0000007` } as never);

  it('answers for the prefixes the app really numbers with', async () => {
    expect(await c.next('DN')).toEqual({ code: 'DN0000007' });
    expect(SequenceService.PREFIXES).toEqual(expect.arrayContaining(['DN', 'DH', 'BG', 'PT', 'PC', 'PNK', 'PXK', 'HDB', 'HDM', 'KH', 'NCC']));
  });

  it('refuses anything else (no probing of other keys)', async () => {
    await expect(c.next('XYZ')).rejects.toBeInstanceOf(BadRequestException);
    await expect(c.next(undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(c.next("DN'; DROP TABLE x;--")).rejects.toBeInstanceOf(BadRequestException);
  });
});
