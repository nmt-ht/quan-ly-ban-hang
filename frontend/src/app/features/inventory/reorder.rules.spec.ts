import { Product, PurchaseOrder, Supplier } from '../../core/models/domain.models';
import { reorderLines } from './reorder.rules';

const product = (id: string, minStock: number, type: Product['type'] = 'VAT_TU'): Product => ({
  id, code: id.toUpperCase(), name: id, type, baseUnit: 'Cái', minStock, vatRate: 0, warrantyMonths: 0,
  retailPrice: 0, wholesalePrice: 0, dropshipPrice: 0, unitConversions: [], isSellable: true, isActive: true,
});
const supplier = (id: string, isActive = true) => ({ id, name: id, isActive }) as Supplier;
const po = (supplierId: string, status: PurchaseOrder['status'], date: string, lines: PurchaseOrder['lines']) =>
  ({ id: `${supplierId}-${date}`, code: 'DN', supplierId, status, date, lines }) as PurchaseOrder;
const line = (productId: string, quantity: number, unitPrice: number, receivedQuantity = 0, ratioToBase = 1) =>
  ({ productId, quantity, unitPrice, receivedQuantity, ratioToBase }) as PurchaseOrder['lines'][number];

describe('reorderLines (gợi ý lập đơn nhập)', () => {
  const products = [product('vt1', 10), product('vt2', 5), product('tp1', 3, 'THANH_PHAM'), product('vt3', 0)];
  const stockLevels = [
    { productId: 'vt1', warehouseId: 'a', quantity: 2, minStock: 0 },
    { productId: 'vt1', warehouseId: 'b', quantity: 1, minStock: 0 },
    { productId: 'vt2', warehouseId: 'a', quantity: 1, minStock: 0 },
  ];

  it('chỉ vật tư dưới tối thiểu; số đặt = tối thiểu − tồn − đang về, làm tròn lên', () => {
    const rows = reorderLines({
      products, stockLevels, suppliers: [supplier('ncc1')], supplierProducts: [],
      purchaseOrders: [po('ncc1', 'DA_GUI_NCC', '2026-10-01', [line('vt2', 2.5, 1000)])],
    });
    expect(rows.map((r) => [r.product.id, r.suggest, r.ordered])).toEqual([['vt1', 7, 0], ['vt2', 2, 2.5]]);
  });

  it('đơn đang về đủ bù thì gợi ý 0; đơn Nháp cũng tính', () => {
    const rows = reorderLines({
      products, stockLevels, suppliers: [supplier('ncc1')], supplierProducts: [],
      purchaseOrders: [po('ncc1', 'NHAP', '2026-10-01', [line('vt1', 1, 5000, 0, 10)])],
    });
    expect(rows.find((r) => r.product.id === 'vt1')?.suggest).toBe(0);
  });

  it('NCC gợi ý: giá rẻ nhất trong danh mục NCC đang dùng, không thì NCC mua gần nhất', () => {
    const rows = reorderLines({
      products, stockLevels,
      suppliers: [supplier('re'), supplier('dat'), supplier('nghi', false)],
      supplierProducts: [
        { supplierId: 'dat', productId: 'vt1', purchasePrice: 900 },
        { supplierId: 're', productId: 'vt1', purchasePrice: 800 },
        { supplierId: 'nghi', productId: 'vt1', purchasePrice: 100 },
      ],
      purchaseOrders: [po('dat', 'HOAN_TAT', '2026-09-01', [line('vt2', 1, 1200)]), po('re', 'HUY', '2026-10-01', [line('vt2', 1, 1)])],
    });
    expect(rows.find((r) => r.product.id === 'vt1')).toMatchObject({ supplierId: 're', price: 800 });
    expect(rows.find((r) => r.product.id === 'vt2')).toMatchObject({ supplierId: 'dat', price: 1200 });
  });
});
