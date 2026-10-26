import { TestBed } from '@angular/core/testing';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';
import { SalesOrderService } from './sales-order.service';

// Đơn hàng bán đọc theo nhu cầu (lệnh sản xuất, chuyến, phiếu thu… nhắc tới đơn chưa nạp). Chức vụ không có
// order.view (Nhân viên xưởng) bị máy chủ từ chối mọi lệnh đọc đơn: trang không được gọi rồi nhận 403.
describe('SalesOrderService: đọc đơn theo nhu cầu', () => {
  let granted: Set<string>;
  let calls: string[];

  beforeEach(() => {
    calls = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { can: (code: string) => granted.has(code), user: () => null } },
        { provide: ApiService, useValue: { get: async (url: string) => (calls.push(url), url.includes('?') ? [] : { id: 'x' }) } },
      ],
    });
  });

  it('không có quyền xem đơn: không gọi /sales-orders', async () => {
    granted = new Set(['production.view']);
    const svc = TestBed.inject(SalesOrderService);
    await svc.ensureMany(['dh-1', 'dh-2']);
    expect(await svc.ensure('dh-3')).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('có quyền xem đơn: đọc các đơn còn thiếu', async () => {
    granted = new Set(['order.view']);
    const svc = TestBed.inject(SalesOrderService);
    await svc.ensureMany(['dh-1', 'dh-2']);
    await svc.ensure('dh-3');
    expect(calls.length).toBe(2);
    expect(calls[0]).toContain('/sales-orders');
    expect(calls[1]).toBe('/sales-orders/dh-3');
  });
});
