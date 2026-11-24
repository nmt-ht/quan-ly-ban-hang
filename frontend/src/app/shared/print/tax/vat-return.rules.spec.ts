import { describe, expect, it } from 'vitest';
import { VatReturnLine, vatReturnLines } from './vat-return.rules';
import { VatSummaryView } from '../../../core/models/books-vat.models';

const summary = (over: Partial<VatSummaryView> = {}): VatSummaryView => ({
  from: '2026-01-01',
  to: '2026-01-31',
  output: {
    buckets: [
      { rate: 0, taxable: 1000, vat: 0 },
      { rate: 5, taxable: 2000, vat: 100 },
      { rate: 10, taxable: 3000, vat: 300 },
      { rate: 8, taxable: 500, vat: 40 },
    ],
    taxable: 6500,
    vat: 440,
    invoices: 4,
  },
  input: { buckets: [], taxable: 4000, vat: 280, invoices: 3, uninvoicedVat: 0, uninvoicedCount: 0 },
  carryForward: 50,
  payable: 110,
  carryOver: 0,
  reconciliation: {
    outputVatLedger: 440, outputVatInvoiced: 440, outputDifference: 0,
    inputVatLedger: 280, inputVatListed: 280, inputDifference: 0,
  },
  ...over,
});

const by = (lines: VatReturnLine[], code: string) => lines.find((l) => l.code === code)!;

describe('vatReturnLines', () => {
  it('maps carry-forward, purchases and deductible input', () => {
    const l = vatReturnLines(summary());
    expect(by(l, '[22]').value).toBe(50);
    expect(by(l, '[23]').value).toBe(4000);
    expect(by(l, '[24]').value).toBe(280);
    expect(by(l, '[25]').value).toBe(280);
  });

  it('splits sales by rate and folds 8%/other into [32a]/[33a]', () => {
    const l = vatReturnLines(summary());
    expect(by(l, '[29]').value).toBe(1000); // 0%
    expect(by(l, '[30]').value).toBe(2000); // 5%
    expect(by(l, '[31]').value).toBe(100);
    expect(by(l, '[32]').value).toBe(3000); // 10%
    expect(by(l, '[33]').value).toBe(300);
    expect(by(l, '[32a]').value).toBe(500); // 8% folded into "other"
    expect(by(l, '[33a]').value).toBe(40);
  });

  it('keeps the value and VAT breakdowns consistent with the totals', () => {
    const l = vatReturnLines(summary());
    const values = by(l, '[29]').value! + by(l, '[30]').value! + by(l, '[32]').value! + by(l, '[32a]').value!;
    const vats = by(l, '[31]').value! + by(l, '[33]').value! + by(l, '[33a]').value!;
    expect(by(l, '[27]').value).toBe(values);
    expect(by(l, '[28]').value).toBe(vats);
    expect(by(l, '[34]').value).toBe(by(l, '[26]').value! + by(l, '[27]').value!);
    expect(by(l, '[35]').value).toBe(by(l, '[28]').value);
  });

  it('computes arising tax [36] = [35] − [25]', () => {
    const l = vatReturnLines(summary());
    expect(by(l, '[36]').value).toBe(by(l, '[35]').value! - by(l, '[25]').value!);
    expect(by(l, '[36]').value).toBe(160);
  });

  it('carries payable and carry-over straight from the summary', () => {
    const l = vatReturnLines(summary({ payable: 0, carryOver: 220 }));
    expect(by(l, '[40a]').value).toBe(0);
    expect(by(l, '[43]').value).toBe(220);
  });

  it('leaves prior-period adjustments [37]/[38] blank', () => {
    const l = vatReturnLines(summary());
    expect(by(l, '[37]').value).toBeNull();
    expect(by(l, '[38]').value).toBeNull();
  });
});
