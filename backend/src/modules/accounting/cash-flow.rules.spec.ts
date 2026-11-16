import { describe, expect, it } from 'vitest';
import { buildStatement, classifyEntries, FlowLine } from './cash-flow.rules.js';

const dr = (accountCode: string, debit: number): FlowLine => ({ accountCode, debit, credit: 0 });
const cr = (accountCode: string, credit: number): FlowLine => ({ accountCode, debit: 0, credit });

describe('lưu chuyển tiền tệ trực tiếp', () => {
  it('phân loại theo tài khoản đối ứng', () => {
    const r = classifyEntries([
      [dr('111', 1_000_000), cr('131', 1_000_000)], // thu tiền khách
      [dr('331', 400_000), cr('112', 400_000)], // trả NCC
      [dr('334', 300_000), cr('111', 300_000)], // trả lương
      [dr('211', 2_000_000), cr('112', 2_000_000)], // mua TSCĐ
      [dr('112', 5_000_000), cr('411', 5_000_000)], // góp vốn
      [dr('642', 50_000), cr('111', 50_000)], // chi phí
      [dr('3331', 100_000), cr('112', 100_000)], // nộp thuế GTGT
      [dr('112', 20_000), cr('515', 20_000)], // lãi tiền gửi
    ]);
    expect(r.sums).toEqual({ '01': 1_000_000, '02': -450_000, '03': -300_000, '21': -2_000_000, '31': 5_000_000, '07': -100_000, '25': 20_000 });
    expect(r.detail['02']).toEqual({ '331': -400_000, '642': -50_000 });
  });

  it('chuyển tiền nội bộ qua TK 113 không vào báo cáo', () => {
    const r = classifyEntries([
      [dr('113', 500_000), cr('111', 500_000)],
      [dr('112', 500_000), cr('113', 500_000)],
      [dr('112', 200_000), cr('111', 200_000)], // chuyển trực tiếp
    ]);
    expect(r.sums).toEqual({});
  });

  it('bút toán không có dòng tiền bị bỏ qua; một bút toán vừa thu vừa chi vẫn tính cả hai', () => {
    const r = classifyEntries([
      [dr('632', 100), cr('156', 100)],
      [dr('111', 100), cr('131', 100), dr('331', 100), cr('112', 100)],
    ]);
    expect(r.sums).toEqual({ '01': 100, '02': -100 });
  });

  it('bút toán đảo triệt tiêu bút toán gốc', () => {
    const r = classifyEntries([
      [dr('111', 700), cr('131', 700)],
      [dr('131', 700), cr('111', 700)],
    ]);
    expect(r.sums['01']).toBe(0);
  });

  it('dựng báo cáo: tổng từng nhóm, lưu chuyển thuần, tiền cuối kỳ = đầu kỳ + thuần', () => {
    const r = classifyEntries([
      [dr('111', 1_000_000), cr('131', 1_000_000)],
      [dr('331', 400_000), cr('112', 400_000)],
      [dr('211', 2_000_000), cr('112', 2_000_000)],
      [dr('112', 5_000_000), cr('411', 5_000_000)],
    ]);
    const s = buildStatement(r, 3_000_000);
    const by = (c: string) => s.items.find((i) => i.code === c)!.amount;
    expect(by('20')).toBe(600_000); // 1.000.000 − 400.000
    expect(by('30')).toBe(-2_000_000);
    expect(by('40')).toBe(5_000_000);
    expect(by('50')).toBe(3_600_000);
    expect(by('60')).toBe(3_000_000);
    expect(by('70')).toBe(6_600_000);
    expect(s.closing).toBe(6_600_000);
  });
});
