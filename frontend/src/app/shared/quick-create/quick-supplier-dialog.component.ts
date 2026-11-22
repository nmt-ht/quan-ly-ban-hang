import { Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorText } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DataStore } from '../../core/services/data-store.service';
import { Supplier } from '../../core/models/domain.models';
import { PHONE_PATTERN, TAX_CODE_PATTERN, duplicateOf } from '../../features/suppliers/supplier.rules';
import { SupplierDraft, SupplierService } from '../../features/suppliers/supplier.service';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';

// "Thêm nhanh nhà cung cấp", opened from the "+ Thêm nhà cung cấp mới" row of a supplier picker (đơn mua, hoá đơn mua, phiếu chi…).
// Same fields the supplier form asks first: tên, điện thoại, mã số thuế (một MST chỉ cho một NCC, như màn hình đầy đủ), địa chỉ,
// số ngày nợ. The new supplier is handed to the parent (`created`) so the document selects it at once.
@Component({
  selector: 'app-quick-supplier-dialog',
  standalone: true,
  imports: [FormsModule, NavIconComponent],
  styleUrl: './quick-create-dialog.scss',
  template: `
    <dialog #dialog class="qc-dialog" aria-labelledby="qcs-title">
      <header class="qc-head">
        <div>
          <h2 id="qcs-title">Thêm nhanh nhà cung cấp</h2>
          <p class="subtitle">Nhập thông tin cần cho chứng từ này. Bổ sung phần còn lại ở màn hình Nhà cung cấp sau.</p>
        </div>
        <button type="button" class="icon-action" aria-label="Đóng" (click)="close()"><app-nav-icon name="x" /></button>
      </header>

      <div class="qc-body" (keydown.enter)="onEnter($event)">
        <div class="field span-2">
          <label for="qcs-name">Tên nhà cung cấp <span class="required-mark">*</span></label>
          <input #nameInput id="qcs-name" type="text" maxlength="200" placeholder="VD: Công ty TNHH Vật liệu A" autocomplete="off"
            [ngModel]="name()" (ngModelChange)="name.set($event)" [attr.aria-invalid]="attempted() && !name().trim() ? 'true' : null" />
          @if (attempted() && !name().trim()) {
            <span class="hint text-danger">Nhập tên nhà cung cấp.</span>
          } @else if (sameName(); as s) {
            <span class="hint text-warning">Đã có nhà cung cấp cùng tên: {{ s.code }}. Kiểm tra để tránh tạo trùng.</span>
          }
        </div>
        <div class="field">
          <label for="qcs-phone">Số điện thoại</label>
          <input id="qcs-phone" type="text" inputmode="tel" maxlength="30" placeholder="VD: 0281234567" autocomplete="off"
            [ngModel]="phone()" (ngModelChange)="phone.set($event)" [attr.aria-invalid]="phoneError() ? 'true' : null" />
          @if (phoneError()) { <span class="hint text-danger">{{ phoneError() }}</span> }
        </div>
        <div class="field">
          <label for="qcs-tax">Mã số thuế</label>
          <input id="qcs-tax" type="text" inputmode="numeric" maxlength="14" placeholder="10 số, hoặc 13 số có chi nhánh" autocomplete="off"
            [ngModel]="taxCode()" (ngModelChange)="taxCode.set($event)" [attr.aria-invalid]="taxError() ? 'true' : null" />
          @if (taxError()) { <span class="hint text-danger">{{ taxError() }}</span> }
        </div>
        <div class="field">
          <label for="qcs-credit">Số ngày được nợ</label>
          <input id="qcs-credit" type="text" inputmode="numeric" maxlength="3" autocomplete="off"
            [ngModel]="creditDays()" (ngModelChange)="creditDays.set($event)" [attr.aria-invalid]="creditError() ? 'true' : null" />
          <span class="hint" [class.text-danger]="creditError()">{{ creditError() || '0 = trả ngay khi nhập kho.' }}</span>
        </div>
        <div class="field">
          <label for="qcs-address">Địa chỉ</label>
          <input id="qcs-address" type="text" maxlength="300" placeholder="Số nhà, đường, phường/xã, tỉnh/thành" autocomplete="off"
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
export class QuickSupplierDialogComponent {
  private readonly data = inject(DataStore);
  private readonly svc = inject(SupplierService);
  private readonly auth = inject(AuthService);

  /** Fires with the saved supplier, after the dialog has closed. */
  readonly created = output<Supplier>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  readonly name = signal('');
  readonly phone = signal('');
  readonly taxCode = signal('');
  readonly creditDays = signal('0');
  readonly address = signal('');
  readonly attempted = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  /** Text for the picker's "+" row; empty (no row) for someone without the right to add suppliers. */
  readonly label = computed(() => (this.auth.can('supplier.create') ? 'Thêm nhà cung cấp mới' : ''));

  readonly sameName = computed(() => duplicateOf(this.data.suppliers(), null, 'name', this.name()));
  readonly phoneError = computed(() => (this.phone().trim() && !PHONE_PATTERN.test(this.phone().trim()) ? 'Số điện thoại chỉ gồm chữ số (8–15 ký tự).' : ''));
  readonly taxError = computed(() => {
    const t = this.taxCode().trim();
    if (!t) return '';
    if (!TAX_CODE_PATTERN.test(t)) return 'Mã số thuế gồm 10 số (hoặc 10 số, gạch, 3 số chi nhánh).';
    const other = duplicateOf(this.data.suppliers(), null, 'taxCode', t);
    return other ? `MST này đã dùng cho ${other.code} — ${other.name}.` : '';
  });
  readonly creditError = computed(() => {
    const t = String(this.creditDays()).trim();
    return /^\d+$/.test(t) && Number(t) <= 365 ? '' : 'Nhập số ngày từ 0 đến 365.';
  });

  /** Opens with `name` (what was typed in the picker) as the starting name. */
  open(name = ''): void {
    this.name.set(name.trim());
    this.phone.set('');
    this.taxCode.set('');
    this.creditDays.set('0');
    this.address.set('');
    this.attempted.set(false);
    this.error.set('');
    this.dialog().nativeElement.showModal();
    // The name is usually what was just typed, so the next thing to fill is the phone.
    setTimeout(() => (this.name() ? document.getElementById('qcs-phone') : this.nameInput().nativeElement)?.focus());
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
    const draft: SupplierDraft = {
      name: this.name().trim(),
      contactPhone: this.phone().trim() || undefined,
      taxCode: this.taxCode().trim() || undefined,
      creditDays: Number(this.creditDays()) || 0,
      address: this.address().trim() || undefined,
      isActive: true,
    };
    this.busy.set(true);
    this.error.set('');
    try {
      const s = await this.svc.create(draft);
      this.close();
      this.created.emit(s);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
}
