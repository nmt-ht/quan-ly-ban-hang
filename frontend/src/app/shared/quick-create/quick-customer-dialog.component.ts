import { Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorText } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DataStore } from '../../core/services/data-store.service';
import { Customer, CustomerType } from '../../core/models/domain.models';
import { CUSTOMER_TYPES, PHONE_PATTERN, TAX_CODE_PATTERN, duplicateOf } from '../../features/customers/customer.rules';
import { CustomerDraft, CustomerService } from '../../features/customers/customer.service';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';

// "Thêm nhanh khách hàng", opened from the "+ Thêm khách hàng mới" row of a customer picker on an order screen (đơn bán, báo giá,
// phiếu thu…). Only what a sale needs right now — tên, điện thoại, loại khách (decides the price tier), mã số thuế, địa chỉ giao
// hàng, số ngày nợ; everything else (tên công ty, hạn mức, bảng giá, nhãn) is completed later on the customer's own form.
// The server issues the code; the new customer is handed to the parent (`created`) so the order selects it at once.
@Component({
  selector: 'app-quick-customer-dialog',
  standalone: true,
  imports: [FormsModule, NavIconComponent],
  styleUrl: './quick-create-dialog.scss',
  template: `
    <dialog #dialog class="qc-dialog" aria-labelledby="qcc-title">
      <header class="qc-head">
        <div>
          <h2 id="qcc-title">Thêm nhanh khách hàng</h2>
          <p class="subtitle">Nhập thông tin cần cho đơn này. Bổ sung phần còn lại ở màn hình Khách hàng sau.</p>
        </div>
        <button type="button" class="icon-action" aria-label="Đóng" (click)="close()"><app-nav-icon name="x" /></button>
      </header>

      <div class="qc-body" (keydown.enter)="onEnter($event)">
        <div class="field span-2">
          <label for="qcc-name">Tên khách hàng <span class="required-mark">*</span></label>
          <input #nameInput id="qcc-name" type="text" maxlength="200" placeholder="VD: Nguyễn Văn A" autocomplete="off"
            [ngModel]="name()" (ngModelChange)="name.set($event)" [attr.aria-invalid]="attempted() && !name().trim() ? 'true' : null" />
          @if (attempted() && !name().trim()) {
            <span class="hint text-danger">Nhập tên khách hàng.</span>
          } @else if (sameName(); as s) {
            <span class="hint text-warning">Đã có khách cùng tên: {{ s.code }}. Kiểm tra để tránh tạo trùng.</span>
          }
        </div>
        <div class="field">
          <label for="qcc-phone">Số điện thoại</label>
          <input id="qcc-phone" type="text" inputmode="tel" maxlength="30" placeholder="VD: 0901234567" autocomplete="off"
            [ngModel]="phone()" (ngModelChange)="phone.set($event)" [attr.aria-invalid]="phoneError() ? 'true' : null" />
          @if (phoneError()) {
            <span class="hint text-danger">{{ phoneError() }}</span>
          } @else if (samePhone(); as s) {
            <span class="hint text-warning">Số này đang dùng cho {{ s.code }} — {{ s.name }}.</span>
          }
        </div>
        <div class="field">
          <label for="qcc-type">Loại khách hàng</label>
          <select id="qcc-type" [ngModel]="type()" (ngModelChange)="type.set($event)">
            @for (t of types; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
          </select>
        </div>
        <div class="field">
          <label for="qcc-tax">Mã số thuế</label>
          <input id="qcc-tax" type="text" inputmode="numeric" maxlength="14" placeholder="10 số, hoặc 13 số có chi nhánh" autocomplete="off"
            [ngModel]="taxCode()" (ngModelChange)="taxCode.set($event)" [attr.aria-invalid]="taxError() ? 'true' : null" />
          @if (taxError()) {
            <span class="hint text-danger">{{ taxError() }}</span>
          } @else if (sameTax(); as s) {
            <span class="hint text-warning">MST này đang dùng cho {{ s.code }} — {{ s.name }}.</span>
          }
        </div>
        <div class="field">
          <label for="qcc-credit">Số ngày được nợ</label>
          <input id="qcc-credit" type="text" inputmode="numeric" maxlength="3" autocomplete="off"
            [ngModel]="creditDays()" (ngModelChange)="creditDays.set($event)" [attr.aria-invalid]="creditError() ? 'true' : null" />
          <span class="hint" [class.text-danger]="creditError()">{{ creditError() || '0 = trả ngay khi nhận hàng.' }}</span>
        </div>
        <div class="field span-2">
          <label for="qcc-address">Địa chỉ giao hàng</label>
          <input id="qcc-address" type="text" maxlength="300" placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" autocomplete="off"
            [ngModel]="address()" (ngModelChange)="address.set($event)" />
        </div>
      </div>

      <footer class="qc-foot">
        @if (error()) { <p class="notice is-error" role="alert">{{ error() }}</p> }
        <div class="toolbar">
          <button type="button" class="btn" (click)="close()">Huỷ</button>
          <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="confirm()">{{ busy() ? 'Đang lưu…' : 'Lưu và chọn' }}</button>
        </div>
      </footer>
    </dialog>
  `,
})
export class QuickCustomerDialogComponent {
  private readonly data = inject(DataStore);
  private readonly svc = inject(CustomerService);
  private readonly auth = inject(AuthService);

  /** Fires with the saved customer, after the dialog has closed. */
  readonly created = output<Customer>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  readonly types = CUSTOMER_TYPES;
  readonly name = signal('');
  readonly phone = signal('');
  readonly type = signal<CustomerType>('LE');
  readonly taxCode = signal('');
  readonly creditDays = signal('0');
  readonly address = signal('');
  readonly attempted = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  /** Text for the picker's "+" row; empty (no row) for someone without the right to add customers. */
  readonly label = computed(() => (this.auth.can('customer.create') ? 'Thêm khách hàng mới' : ''));

  readonly sameName = computed(() => duplicateOf(this.data.customers(), null, 'name', this.name()));
  readonly samePhone = computed(() => duplicateOf(this.data.customers(), null, 'phone', this.phone()));
  readonly sameTax = computed(() => duplicateOf(this.data.customers(), null, 'companyTaxCode', this.taxCode()));
  readonly phoneError = computed(() => (this.phone().trim() && !PHONE_PATTERN.test(this.phone().trim()) ? 'Số điện thoại chỉ gồm chữ số (8–15 ký tự).' : ''));
  readonly taxError = computed(() => (this.taxCode().trim() && !TAX_CODE_PATTERN.test(this.taxCode().trim()) ? 'Mã số thuế gồm 10 số (hoặc 10 số, gạch, 3 số chi nhánh).' : ''));
  readonly creditError = computed(() => {
    const t = String(this.creditDays()).trim();
    return /^\d+$/.test(t) && Number(t) <= 365 ? '' : 'Nhập số ngày từ 0 đến 365.';
  });

  /** Opens with `name` (what was typed in the picker) as the starting name. */
  open(name = ''): void {
    this.name.set(name.trim());
    this.phone.set('');
    this.type.set('LE');
    this.taxCode.set('');
    this.creditDays.set('0');
    this.address.set('');
    this.attempted.set(false);
    this.error.set('');
    this.dialog().nativeElement.showModal();
    // The name is usually what was just typed, so the next thing to fill is the phone.
    setTimeout(() => (this.name() ? document.getElementById('qcc-phone') : this.nameInput().nativeElement)?.focus());
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  onEnter(e: Event): void {
    if ((e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      void this.confirm();
    }
  }

  async confirm(): Promise<void> {
    this.attempted.set(true);
    if (this.busy()) return;
    if (!this.name().trim() || this.phoneError() || this.taxError() || this.creditError()) {
      setTimeout(() => this.dialog().nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const address = this.address().trim();
    const draft: CustomerDraft = {
      name: this.name().trim(),
      type: this.type(),
      creditDays: Number(this.creditDays()) || 0,
      phone: this.phone().trim() || undefined,
      companyTaxCode: this.taxCode().trim() || undefined,
      tagIds: [],
      isActive: true,
      addresses: address ? [{ id: crypto.randomUUID(), address, isDefault: true }] : [],
    };
    this.busy.set(true);
    this.error.set('');
    try {
      const c = await this.svc.create(draft);
      this.close();
      this.created.emit(c);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
}
