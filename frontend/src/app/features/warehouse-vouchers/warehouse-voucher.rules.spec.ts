import { WarehouseVoucher } from '../../core/models/domain.models';
import { kindOf, sourceOf, SourceLookup } from './warehouse-voucher.rules';

const voucher = (extra: Partial<WarehouseVoucher>) => ({ id: 'v', code: 'PNK', type: 'NHAP', date: '2026-10-26', lines: [], ...extra }) as WarehouseVoucher;
const data: SourceLookup = {
  purchaseOrders: () => [{ id: 'po1', code: 'DN0000001' }],
  salesOrders: () => [{ id: 'so1', code: 'DH0000001' }],
  productionOrders: () => [{ id: 'x1', code: 'LSX0000001' }],
  deliveryTrips: () => [{ id: 't1', code: 'CH0000001' }],
};

describe('phiếu kho', () => {
  it('kindOf: phiếu nhập khi xe về kho hiện là "Nhập trả về"', () => {
    expect(kindOf(voucher({ reason: 'Nhập trả về chuyến CH0000001' }))).toBe('TRA_VE');
    expect(kindOf(voucher({ reason: 'Nhập hàng' }))).toBe('NHAP');
    expect(kindOf(voucher({ type: 'XUAT', reason: 'Nhập trả về' }))).toBe('XUAT');
  });

  it('sourceOf: chứng từ gốc theo id đã lưu, hoặc theo mã trong diễn giải (phiếu cũ)', () => {
    expect(sourceOf(voucher({ purchaseOrderId: 'po1' }), data)).toEqual({ label: 'Đơn nhập hàng', code: 'DN0000001', link: ['/mua-hang', 'po1'] });
    expect(sourceOf(voucher({ type: 'XUAT', salesOrderId: 'so1' }), data)).toEqual({ label: 'Đơn hàng bán', code: 'DH0000001', link: ['/don-hang', 'so1'] });
    expect(sourceOf(voucher({ reason: 'Nhập kho theo đơn DN0000001' }), data)).toEqual({ label: 'Đơn nhập hàng', code: 'DN0000001', link: ['/mua-hang', 'po1'] });
    expect(sourceOf(voucher({ type: 'XUAT', reason: 'Xuất vật tư LSX0000001' }), data)).toMatchObject({ label: 'Lệnh sản xuất', link: ['/san-xuat', 'x1'] });
    expect(sourceOf(voucher({ reason: 'Nhập trả về chuyến CH0000001' }), data)).toMatchObject({ label: 'Chuyến giao hàng', link: ['/giao-hang', 't1'] });
  });

  it('sourceOf: không tra được danh sách thì vẫn có nhãn, mã và đường dẫn theo id; phiếu lập tay là null', () => {
    expect(sourceOf(voucher({ purchaseOrderId: 'po9' }))).toEqual({ label: 'Đơn nhập hàng', code: undefined, link: ['/mua-hang', 'po9'] });
    expect(sourceOf(voucher({ reason: 'theo đơn DN0000042' }))).toEqual({ label: 'Đơn nhập hàng', code: 'DN0000042', link: undefined });
    expect(sourceOf(voucher({ reason: 'Kiểm kê tháng 9' }), data)).toBeNull();
  });
});
