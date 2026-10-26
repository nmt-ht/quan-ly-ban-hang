// Giao diện và máy chủ tính đơn bán bằng hai bản quy tắc giống nhau (frontend sales-order.rules.ts và file này
// bên cạnh). Test này chạy cả hai trên cùng một loạt đơn sinh ngẫu nhiên (hạt giống cố định) và đòi kết quả
// khớp tới từng đồng — sửa một bên mà quên bên kia là đỏ.
import * as server from './sales-order.rules.js';

/** The part of the frontend's rules this test calls; its own types live in the frontend project. */
interface ScreenRules {
  orderTotals(lines: unknown[], orderDiscount: number): { goods: number; vat: number; total: number; lines: unknown[] };
  receivedValueOf(o: { lines: unknown[]; discountAmount: number }): number;
  deriveStatus(o: never, lsx: never[], isTp: (id: string) => boolean): string;
  canEdit(o: never, lsx: never[]): boolean;
  canCancel(o: never): boolean;
  canDeliver(o: never): boolean;
  canClose(o: never): boolean;
  linesNeedingLsx(o: never, lsx: never[], isTp: (id: string) => boolean): number[];
  priceFor(p: never, type: string, unitName: string, list: never[]): number;
}
// Loaded by URL at run time: the frontend lies outside this project's rootDir, so tsc must not follow the import.
const SCREEN_RULES = new URL('../../../../frontend/src/app/features/sales-orders/sales-order.rules.ts', import.meta.url).href;
const screen = (await import(/* @vite-ignore */ SCREEN_RULES)) as ScreenRules;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

const STATUSES = ['CHO_SAN_XUAT', 'DANG_SAN_XUAT', 'CHO_GIAO_HANG', 'DANG_GIAO', 'GIAO_MOT_PHAN', 'HOAN_THANH', 'TRA_TOAN_BO', 'HUY'] as const;
const LSX_STATUSES = ['NHAP', 'DANG_SAN_XUAT', 'HOAN_TAT', 'HUY'] as const;

function sample(seed: number) {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const lines = Array.from({ length: 1 + Math.floor(r() * 5) }, (_, i) => {
    const quantity = pick([0, 1, 2, 3, 7, 0.5, 1.25, 12]);
    const discount = r();
    return {
      id: `l${i}`, productId: pick(['tp1', 'tp2', 'vt1', 'vt2', 'dv1']), unit: 'Cái', lineTotal: 0,
      quantity, unitPrice: pick([0, 999, 1500, 33333, 47000, 120000, 1234567]),
      discountRate: discount < 0.3 ? pick([0, 5, 10, 33]) : undefined,
      discountAmount: discount > 0.8 ? pick([0, 100, 5000, 9_999_999]) : undefined,
      vatRate: pick([0, 5, 8, 10]),
      receivedQuantity: pick([0, 0, quantity, Math.min(quantity, 1), quantity / 2]),
      ratioToBase: pick([1, 12, 0.1]),
    };
  });
  return {
    lines,
    orderDiscount: pick([0, 0, 1000, 33333, 10_000_000, -5]),
    status: pick(STATUSES),
    closedDate: r() < 0.2 ? '2026-10-26' : null,
    lsx: Array.from({ length: Math.floor(r() * 3) }, () => ({ productId: pick(['tp1', 'tp2']), status: pick(LSX_STATUSES) })),
  };
}

const isTp = (id: string) => id.startsWith('tp');

describe('quy tắc đơn bán: giao diện và máy chủ ra cùng kết quả', () => {
  const cases = Array.from({ length: 500 }, (_, i) => sample(i + 1));

  it('orderTotals và receivedValueOf khớp từng đồng', () => {
    for (const c of cases) {
      const a = server.orderTotals(c.lines, c.orderDiscount);
      const b = screen.orderTotals(c.lines, c.orderDiscount);
      expect({ goods: b.goods, vat: b.vat, total: b.total, lines: b.lines }).toEqual({ goods: a.goods, vat: a.vat, total: a.total, lines: a.lines });
      expect(screen.receivedValueOf({ lines: c.lines, discountAmount: c.orderDiscount })).toBe(server.receivedValueOf(c.lines, c.orderDiscount));
    }
  });

  it('trạng thái và các nút sửa / huỷ / giao / kết thúc / lập lệnh SX khớp', () => {
    for (const c of cases) {
      const receivedValue = server.receivedValueOf(c.lines, c.orderDiscount);
      const state = { status: c.status, lines: c.lines, receivedValue, closedDate: c.closedDate };
      const o = { ...state, id: 'o', code: 'DH', customerId: 'kh', tagIds: [], orderDate: '2026-10-26', discountAmount: c.orderDiscount,
        totalGoods: 0, totalOrder: 0, salesRep: '', createdBy: '', closedDate: c.closedDate ?? undefined } as never;
      const lsx = c.lsx.map((x, i) => ({ ...x, id: `x${i}` })) as never[];
      expect(screen.deriveStatus(o, lsx, isTp)).toBe(server.deriveStatus(state, c.lsx, isTp));
      expect(screen.canEdit(o, lsx)).toBe(server.canEdit(state, c.lsx));
      expect(screen.canCancel(o)).toBe(server.canCancel(state));
      expect(screen.canDeliver(o)).toBe(server.canDeliver(state));
      expect(screen.canClose(o)).toBe(server.canClose(state));
      expect(screen.linesNeedingLsx(o, lsx, isTp)).toEqual(server.linesNeedingLsx(state, c.lsx, isTp));
    }
  });

  it('priceFor khớp với mọi loại khách, ĐVT và bảng giá', () => {
    const product = {
      id: 'p1', type: 'VAT_TU' as const, retailPrice: 100, wholesalePrice: 80, dropshipPrice: 90,
      unitConversions: [
        { unitName: 'Bó', ratioToBaseUnit: 12, price: 1100, wholesalePrice: 900, dropshipPrice: null },
        { unitName: 'Lạng', ratioToBaseUnit: 0.1, price: 0, wholesalePrice: null, dropshipPrice: null },
      ],
    };
    const lists = [
      [],
      [{ productId: 'p1', unitName: '', price: 75 }],
      [{ productId: 'p1', unitName: 'Bó', price: 800 }],
      [{ productId: 'p1', unitName: '', price: 75 }, { productId: 'p1', unitName: 'Lạng', price: 9 }],
      [{ productId: 'khac', unitName: '', price: 1 }],
    ];
    const screenProduct = { ...product, unitConversions: product.unitConversions.map((u) => ({ ...u, wholesalePrice: u.wholesalePrice ?? undefined, dropshipPrice: u.dropshipPrice ?? undefined })) } as never;
    for (const type of ['LE', 'SI', 'DROPSHIP'] as const) {
      for (const unit of ['', 'Bó', 'Lạng', 'Không có']) {
        for (const list of lists) {
          expect([type, unit, list, screen.priceFor(screenProduct, type, unit, list as never[])]).toEqual([type, unit, list, server.priceFor(product, type, unit, list)]);
        }
      }
    }
  });
});
