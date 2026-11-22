import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Mock, vi } from 'vitest';
import { ApiError } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DataStore } from '../../core/services/data-store.service';
import { Customer, Supplier } from '../../core/models/domain.models';
import { CustomerService } from '../../features/customers/customer.service';
import { SupplierService } from '../../features/suppliers/supplier.service';
import { QuickCustomerDialogComponent } from './quick-customer-dialog.component';
import { QuickSupplierDialogComponent } from './quick-supplier-dialog.component';

@Component({
  standalone: true,
  imports: [QuickCustomerDialogComponent, QuickSupplierDialogComponent],
  template: `
    <app-quick-customer-dialog #c (created)="customers.push($event)" />
    <app-quick-supplier-dialog #s (created)="suppliers.push($event)" />
  `,
})
class HostComponent {
  customers: Customer[] = [];
  suppliers: Supplier[] = [];
}

const customer = (over: Partial<Customer> = {}): Customer => ({
  id: 'c1', code: 'KH001', name: 'Nguyễn Văn A', type: 'LE', creditDays: 0, tagIds: [], isActive: true, ...over,
});
const supplier = (over: Partial<Supplier> = {}): Supplier => ({
  id: 's1', code: 'NCC001', name: 'Công ty A', creditDays: 0, isActive: true, ...over,
});

describe('thêm nhanh khách hàng / nhà cung cấp từ màn hình lên chứng từ', () => {
  let fixture: ComponentFixture<HostComponent>;
  let customerCreate: Mock<CustomerService['create']>;
  let supplierCreate: Mock<SupplierService['create']>;
  const perms = signal<string[]>(['customer.create', 'supplier.create']);
  const stored = { customers: signal<Customer[]>([]), suppliers: signal<Supplier[]>([]) };

  const dialog = (tag: 'app-quick-customer-dialog' | 'app-quick-supplier-dialog') => {
    const root = fixture.nativeElement.querySelector(tag) as HTMLElement;
    const d = root.querySelector('dialog') as HTMLDialogElement;
    return {
      d,
      field: (id: string) => root.querySelector(`#${id}`) as HTMLInputElement,
      save: () => (Array.from(root.querySelectorAll('.qc-foot .btn-primary'))[0] as HTMLButtonElement).click(),
      error: () => root.querySelector('.qc-foot .notice.is-error')?.textContent?.trim() ?? '',
      hints: () => Array.from(root.querySelectorAll('.hint')).map((h) => h.textContent?.trim()),
    };
  };
  const set = async (input: HTMLInputElement, text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const component = <T>(tag: string) => fixture.debugElement.children.find((c) => c.nativeElement.tagName.toLowerCase() === tag)!.componentInstance as T;

  beforeEach(async () => {
    // jsdom has no modal dialog; the logic under test does not depend on the browser's own.
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    customerCreate = vi.fn<CustomerService['create']>(async (draft) => customer({ id: 'new-c', code: 'KH002', ...draft }));
    supplierCreate = vi.fn<SupplierService['create']>(async (draft) => supplier({ id: 'new-s', code: 'NCC002', ...draft }));
    stored.customers.set([customer()]);
    stored.suppliers.set([supplier({ taxCode: '0312345678' })]);
    perms.set(['customer.create', 'supplier.create']);
    TestBed.configureTestingModule({
      providers: [
        { provide: DataStore, useValue: { customers: stored.customers, suppliers: stored.suppliers } },
        { provide: AuthService, useValue: { can: (p: string) => perms().includes(p) } },
        { provide: CustomerService, useValue: { create: (d: Parameters<CustomerService['create']>[0]) => customerCreate(d) } },
        { provide: SupplierService, useValue: { create: (d: Parameters<SupplierService['create']>[0]) => supplierCreate(d) } },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());

  it('nhãn hàng "+ Thêm mới" chỉ có khi người dùng có quyền tạo', () => {
    const c = component<QuickCustomerDialogComponent>('app-quick-customer-dialog');
    const s = component<QuickSupplierDialogComponent>('app-quick-supplier-dialog');
    expect(c.label()).toBe('Thêm khách hàng mới');
    expect(s.label()).toBe('Thêm nhà cung cấp mới');
    perms.set(['customer.create']);
    expect(c.label()).toBe('Thêm khách hàng mới');
    expect(s.label()).toBe('');
    perms.set([]);
    expect(c.label()).toBe('');
  });

  it('khách hàng: mở với chữ đã gõ làm tên; thiếu tên thì không lưu; lưu thì gửi đủ dữ liệu và trả khách mới cho màn hình chọn', async () => {
    const c = component<QuickCustomerDialogComponent>('app-quick-customer-dialog');
    c.open('  Lê Văn C ');
    fixture.detectChanges();
    await fixture.whenStable(); // ngModel writes its value in a microtask
    const ui = dialog('app-quick-customer-dialog');
    expect(ui.field('qcc-name').value).toBe('Lê Văn C');

    await set(ui.field('qcc-name'), '   ');
    ui.save();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(customerCreate).not.toHaveBeenCalled();
    expect(ui.hints()).toContain('Nhập tên khách hàng.');

    await set(ui.field('qcc-name'), 'Lê Văn C');
    await set(ui.field('qcc-phone'), '0901234567');
    await set(ui.field('qcc-tax'), '0312345679');
    await set(ui.field('qcc-credit'), '15');
    await set(ui.field('qcc-address'), '12 Lê Lợi, Q1');
    ui.save();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(customerCreate).toHaveBeenCalledTimes(1);
    const draft = customerCreate.mock.calls[0][0];
    expect(draft).toMatchObject({
      name: 'Lê Văn C', type: 'LE', creditDays: 15, phone: '0901234567', companyTaxCode: '0312345679', tagIds: [], isActive: true,
    });
    expect(draft.addresses).toEqual([expect.objectContaining({ address: '12 Lê Lợi, Q1', isDefault: true })]);
    expect(fixture.componentInstance.customers.map((x) => x.id)).toEqual(['new-c']);
    expect(ui.d.open).toBe(false);
  });

  it('khách hàng: số điện thoại, MST, số ngày nợ sai thì chặn và nói rõ; trùng tên / số điện thoại chỉ cảnh báo', async () => {
    stored.customers.set([customer({ phone: '0901234567' })]);
    const c = component<QuickCustomerDialogComponent>('app-quick-customer-dialog');
    c.open('Nguyễn Văn A');
    fixture.detectChanges();
    await fixture.whenStable(); // ngModel writes its value in a microtask
    const ui = dialog('app-quick-customer-dialog');
    await set(ui.field('qcc-phone'), '0901 234 567');
    expect(ui.hints().join(' ')).toContain('Đã có khách cùng tên: KH001');
    expect(ui.hints().join(' ')).toContain('Số này đang dùng cho KH001');

    await set(ui.field('qcc-phone'), 'abc');
    await set(ui.field('qcc-tax'), '12');
    await set(ui.field('qcc-credit'), '400');
    ui.save();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(customerCreate).not.toHaveBeenCalled();
    expect(ui.hints().join(' ')).toContain('Số điện thoại chỉ gồm chữ số');
    expect(ui.hints().join(' ')).toContain('Mã số thuế gồm 10 số');
    expect(ui.hints().join(' ')).toContain('Nhập số ngày từ 0 đến 365');

    // Trùng thì vẫn lưu được: một hộ có thể có nhiều người mua.
    await set(ui.field('qcc-phone'), '0901234567');
    await set(ui.field('qcc-tax'), '');
    await set(ui.field('qcc-credit'), '0');
    ui.save();
    await fixture.whenStable();
    expect(customerCreate).toHaveBeenCalledTimes(1);
  });

  it('khách hàng: máy chủ từ chối thì dialog giữ nguyên, hiện đúng câu lỗi, không chọn khách nào', async () => {
    customerCreate.mockRejectedValueOnce(new ApiError('Mã số thuế đã được dùng cho khách khác.', 409, 'business'));
    const c = component<QuickCustomerDialogComponent>('app-quick-customer-dialog');
    c.open('Lê Văn C');
    fixture.detectChanges();
    await fixture.whenStable(); // ngModel writes its value in a microtask
    const ui = dialog('app-quick-customer-dialog');
    ui.save();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(ui.error()).toBe('Mã số thuế đã được dùng cho khách khác.');
    expect(ui.d.open).toBe(true);
    expect(fixture.componentInstance.customers).toEqual([]);
  });

  it('nhà cung cấp: lưu đủ dữ liệu; MST đã có ở NCC khác thì chặn như màn hình đầy đủ', async () => {
    const s = component<QuickSupplierDialogComponent>('app-quick-supplier-dialog');
    s.open('Công ty B');
    fixture.detectChanges();
    await fixture.whenStable(); // ngModel writes its value in a microtask
    const ui = dialog('app-quick-supplier-dialog');
    await set(ui.field('qcs-tax'), '0312345678');
    ui.save();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(supplierCreate).not.toHaveBeenCalled();
    expect(ui.hints().join(' ')).toContain('MST này đã dùng cho NCC001');

    await set(ui.field('qcs-tax'), '0312345679');
    await set(ui.field('qcs-phone'), '0281234567');
    await set(ui.field('qcs-credit'), '30');
    await set(ui.field('qcs-address'), 'KCN Tân Bình');
    ui.save();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(supplierCreate).toHaveBeenCalledWith({
      name: 'Công ty B', contactPhone: '0281234567', taxCode: '0312345679', creditDays: 30, address: 'KCN Tân Bình', isActive: true,
    });
    expect(fixture.componentInstance.suppliers.map((x) => x.id)).toEqual(['new-s']);
    expect(ui.d.open).toBe(false);
  });

  it('mở lại thì các ô được làm sạch, không giữ dữ liệu của lần trước', async () => {
    const c = component<QuickCustomerDialogComponent>('app-quick-customer-dialog');
    c.open('Lần một');
    fixture.detectChanges();
    await fixture.whenStable(); // ngModel writes its value in a microtask
    const ui = dialog('app-quick-customer-dialog');
    await set(ui.field('qcc-phone'), '0901234567');
    c.close();
    c.open('');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(ui.field('qcc-name').value).toBe('');
    expect(ui.field('qcc-phone').value).toBe('');
  });
});
