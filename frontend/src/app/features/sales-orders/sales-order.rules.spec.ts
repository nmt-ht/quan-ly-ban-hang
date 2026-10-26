import { Product, ProductionOrder, SalesOrder, SalesOrderLine } from '../../core/models/domain.models';
import {
  canCancel, canClose, canDeliver, canEdit, deriveStatus, defaultWarehouse, lineDiscount, lineRemaining, linesNeedingLsx,
  orderTotals, priceFor, receivedValueOf,
} from './sales-order.rules';

const line = (productId: string, quantity: number, unitPrice: number, extra: Partial<SalesOrderLine> = {}): SalesOrderLine =>
  ({ id: productId, productId, unit: 'Cái', quantity, unitPrice, lineTotal: quantity * unitPrice, ...extra });
const order = (lines: SalesOrderLine[], extra: Partial<SalesOrder> = {}): SalesOrder =>
  ({ id: 'o1', code: 'DH0000001', customerId: 'kh', tagIds: [], orderDate: '2026-10-26', status: 'CHO_GIAO_HANG', lines,
    discountAmount: 0, totalGoods: 0, totalOrder: 0, salesRep: '', createdBy: '', receivedValue: 0, ...extra }) as SalesOrder;
const lsx = (productId: string, status: ProductionOrder['status']) => ({ id: `lsx-${productId}`, productId, status }) as ProductionOrder;
const isTp = (id: string) => id.startsWith('tp');

describe('orderTotals (chiết khấu và thuế theo MISA)', () => {
  it('chiết khấu đơn chia theo giá trị dòng sau chiết khấu dòng; thuế trên phần còn lại', () => {
    // Cùng số với test e2e bán hàng: tiền hàng 520 000, CK dòng 20 000, CK đơn 30 000 chia 18 000 / 10 800 / 1 200.
    const t = orderTotals([
      line('tp1', 3, 100000),
      line('vt1', 4, 50000, { discountRate: 10 }),
      line('dv1', 1, 20000, { vatRate: 10 }),
    ], 30000);
    expect(t.lines.map((l) => [l.gross, l.lineDiscount, l.orderDiscount, l.taxable, l.vat, l.total])).toEqual([
      [300000, 0, 18000, 282000, 0, 282000],
      [200000, 20000, 10800, 169200, 0, 169200],
      [20000, 0, 1200, 18800, 1880, 20680],
    ]);
    expect(t).toMatchObject({ goods: 520000, lineDiscount: 20000, orderDiscount: 30000, discount: 50000, vat: 1880, total: 471880 });
  });

  it('phần lẻ khi chia chiết khấu đơn dồn vào dòng cuối có giá trị, tổng chia đúng bằng chiết khấu', () => {
    const t = orderTotals([line('a', 1, 100), line('b', 1, 100), line('c', 1, 100), line('d', 1, 0)], 100);
    expect(t.lines.map((l) => l.orderDiscount)).toEqual([33, 33, 34, 0]);
    expect(t.total).toBe(200);
  });

  it('chiết khấu không vượt giá trị: chiết khấu dòng tối đa bằng tiền hàng, chiết khấu đơn tối đa bằng phần còn lại', () => {
    expect(lineDiscount(line('a', 1, 1000, { discountAmount: 5000 }))).toBe(1000);
    expect(lineDiscount(line('a', 1, 1000, { discountAmount: -5 }))).toBe(0);
    const t = orderTotals([line('a', 2, 1000)], 9999);
    expect(t).toMatchObject({ orderDiscount: 2000, total: 0 });
    expect(orderTotals([line('a', 2, 1000)], -50).orderDiscount).toBe(0);
  });

  it('tiền làm tròn từng đồng ở mỗi bước', () => {
    const t = orderTotals([line('a', 1.5, 333.33, { vatRate: 8 })], 0);
    expect(t.lines[0]).toMatchObject({ gross: 500, vat: 40, total: 540 });
  });
});

describe('receivedValueOf (= công nợ phải thu)', () => {
  it('phần phải thu của mỗi dòng theo tỷ lệ khách đã nhận', () => {
    const o = order([line('a', 4, 100000, { vatRate: 10, receivedQuantity: 1 }), line('b', 2, 50000, { receivedQuantity: 2 })], { discountAmount: 0 });
    expect(receivedValueOf(o)).toBe(110000 + 100000);
  });

  it('dòng số lượng 0 không làm lỗi phép chia', () => {
    expect(receivedValueOf(order([line('a', 0, 1000, { receivedQuantity: 0 })]))).toBe(0);
  });
});

describe('priceFor (giá theo loại khách, ĐVT, bảng giá riêng)', () => {
  const p = {
    id: 'p1', type: 'VAT_TU', retailPrice: 100, wholesalePrice: 80, dropshipPrice: 90,
    unitConversions: [{ unitName: 'Bó', ratioToBaseUnit: 12, price: 1100, wholesalePrice: 900 }],
  } as unknown as Product;

  it('không có bảng giá: theo loại khách, ĐVT quy đổi có giá riêng thì dùng, không có thì × tỷ lệ', () => {
    expect(priceFor(p, 'LE', '')).toBe(100);
    expect(priceFor(p, 'SI', '')).toBe(80);
    expect(priceFor(p, 'SI', 'Bó')).toBe(900);
    expect(priceFor(p, 'DROPSHIP', 'Bó')).toBe(1080);
  });

  it('bảng giá: đúng ĐVT trước, rồi ĐVT chính × tỷ lệ; mặt hàng không có trong bảng về giá theo loại khách', () => {
    const list = [{ productId: 'p1', unitName: '', price: 75 }] as never[];
    expect(priceFor(p, 'LE', '', list)).toBe(75);
    expect(priceFor(p, 'LE', 'Bó', list)).toBe(900);
    expect(priceFor(p, 'LE', 'Bó', [...list, { productId: 'p1', unitName: 'Bó', price: 800 }] as never[])).toBe(800);
    expect(priceFor(p, 'SI', '', [{ productId: 'khac', unitName: '', price: 1 }] as never[])).toBe(80);
  });
});

describe('trạng thái đơn bán', () => {
  it('deriveStatus: chờ sản xuất → đang sản xuất → chờ giao → giao một phần → hoàn thành', () => {
    const lines = [line('tp1', 2, 1000), line('vt1', 1, 1000)];
    expect(deriveStatus(order(lines), [], isTp)).toBe('CHO_SAN_XUAT');
    expect(deriveStatus(order(lines), [lsx('tp1', 'NHAP')], isTp)).toBe('CHO_SAN_XUAT');
    expect(deriveStatus(order(lines), [lsx('tp1', 'DANG_SAN_XUAT')], isTp)).toBe('DANG_SAN_XUAT');
    expect(deriveStatus(order(lines), [lsx('tp1', 'HOAN_TAT')], isTp)).toBe('CHO_GIAO_HANG');
    expect(deriveStatus(order(lines), [lsx('tp1', 'HUY')], isTp)).toBe('CHO_SAN_XUAT'); // lệnh huỷ không tính
    const part = [line('tp1', 2, 1000, { receivedQuantity: 1 }), line('vt1', 1, 1000)];
    expect(deriveStatus(order(part), [lsx('tp1', 'HOAN_TAT')], isTp)).toBe('GIAO_MOT_PHAN');
    const all = [line('tp1', 2, 1000, { receivedQuantity: 2 }), line('vt1', 1, 1000, { receivedQuantity: 1 })];
    expect(deriveStatus(order(all), [], isTp)).toBe('HOAN_THANH');
  });

  it('deriveStatus: Huỷ giữ nguyên; Đang giao / Trả toàn bộ giữ tới khi có lần giao; đơn không có thành phẩm chờ giao luôn', () => {
    expect(deriveStatus(order([line('vt1', 1, 1)], { status: 'HUY' }), [], isTp)).toBe('HUY');
    expect(deriveStatus(order([line('vt1', 1, 1)], { status: 'DANG_GIAO' }), [], isTp)).toBe('DANG_GIAO');
    expect(deriveStatus(order([line('vt1', 1, 1)], { status: 'TRA_TOAN_BO' }), [], isTp)).toBe('TRA_TOAN_BO');
    expect(deriveStatus(order([line('vt1', 1, 1)]), [], isTp)).toBe('CHO_GIAO_HANG');
  });

  it('sửa / huỷ / giao / kết thúc đơn theo trạng thái', () => {
    const open = order([line('vt1', 2, 1000)]);
    const partly = order([line('vt1', 2, 1000, { receivedQuantity: 1 })], { status: 'GIAO_MOT_PHAN', receivedValue: 1000 });
    expect([canEdit(open, []), canCancel(open), canDeliver(open), canClose(open)]).toEqual([true, true, true, false]);
    expect([canEdit(partly, []), canCancel(partly), canDeliver(partly), canClose(partly)]).toEqual([false, false, true, true]);
    expect(canEdit(open, [lsx('tp1', 'DANG_SAN_XUAT')])).toBe(false); // đã bắt đầu sản xuất
    expect(canCancel(order(open.lines, { status: 'DANG_GIAO' }))).toBe(false); // hàng đang trên xe
    expect(canDeliver(order(open.lines, { status: 'DANG_GIAO' }))).toBe(false); // giao qua chốt giao của chuyến
    expect(canDeliver({ ...partly, closedDate: '2026-10-26' })).toBe(false);
    expect(canClose({ ...partly, closedDate: '2026-10-26' })).toBe(false);
  });

  it('linesNeedingLsx: dòng thành phẩm chưa có lệnh còn hiệu lực', () => {
    const o = order([line('tp1', 1, 1), line('vt1', 1, 1), line('tp2', 1, 1)], { status: 'CHO_SAN_XUAT' });
    expect(linesNeedingLsx(o, [lsx('tp1', 'NHAP'), lsx('tp2', 'HUY')], isTp)).toEqual([2]);
    expect(linesNeedingLsx({ ...o, status: 'HUY' }, [], isTp)).toEqual([]);
  });

  it('lineRemaining làm tròn 4 chữ số, không âm', () => {
    expect(lineRemaining(line('a', 0.3, 1, { receivedQuantity: 0.1 }))).toBe(0.2);
    expect(lineRemaining(line('a', 1, 1, { receivedQuantity: 2 }))).toBe(0);
  });

  it('defaultWarehouse: thành phẩm về Kho thành phẩm, dịch vụ không có kho', () => {
    expect(defaultWarehouse({ type: 'THANH_PHAM' } as Product)).toBe('wh-thanhpham');
    expect(defaultWarehouse({ type: 'VAT_TU', defaultWarehouseId: 'wh-vattu' } as Product)).toBe('wh-vattu');
    expect(defaultWarehouse({ type: 'DICH_VU', defaultWarehouseId: 'wh-vattu' } as Product)).toBe('');
    expect(defaultWarehouse(undefined)).toBe('');
  });
});
