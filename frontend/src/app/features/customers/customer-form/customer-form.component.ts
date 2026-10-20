import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { CustomerAddress, CustomerType } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { FilterMultiSelectComponent, FilterOption } from '../../../shared/filter-multi-select/filter-multi-select.component';
import { CUSTOMER_TYPES, ID_NUMBER_PATTERN, PHONE_PATTERN, TAX_CODE_PATTERN, duplicateOf } from '../customer.rules';
import { CustomerDraft, CustomerService } from '../customer.service';

interface AddressDraft extends CustomerAddress {
  key: string;
}

// /khach-hang/them-moi and /khach-hang/:id/sua — same fields as production, plus địa chỉ giao hàng
// (free text: the Phường/Xã catalogue is not loaded yet).
@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, NavIconComponent, FilterMultiSelectComponent],
  templateUrl: './customer-form.component.html',
  styleUrl: './customer-form.component.scss',
})
export class CustomerFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly data = inject(MockDataService);
  private readonly svc = inject(CustomerService);

  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly editing = this.id ? this.data.customers().find((c) => c.id === this.id) : undefined;
  readonly notFound = !!this.id && !this.editing;
  readonly types = CUSTOMER_TYPES;

  readonly form = this.fb.nonNullable.group({
    name: [this.editing?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    companyName: [this.editing?.companyName ?? ''],
    type: [(this.editing?.type ?? 'LE') as CustomerType],
    creditDays: [this.editing?.creditDays ?? 0, [Validators.required, Validators.min(0), Validators.max(365), Validators.pattern(/^\d+$/)]],
    phone: [this.editing?.phone ?? '', Validators.pattern(PHONE_PATTERN)],
    email: [this.editing?.email ?? '', Validators.email],
    idNumber: [this.editing?.idNumber ?? '', Validators.pattern(ID_NUMBER_PATTERN)],
    personalTaxCode: [this.editing?.personalTaxCode ?? '', Validators.pattern(TAX_CODE_PATTERN)],
    companyTaxCode: [this.editing?.companyTaxCode ?? '', Validators.pattern(TAX_CODE_PATTERN)],
    note: [this.editing?.note ?? ''],
    isActive: [this.editing?.isActive ?? true],
  });

  readonly tagIds = signal<string[]>(this.editing?.tagIds ?? []);
  readonly addresses = signal<AddressDraft[]>((this.editing?.addresses ?? []).map((a) => ({ ...a, key: a.id })));
  readonly attempted = signal(false);

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly tagOptions = computed<FilterOption[]>(() =>
    this.data.tags().filter((t) => t.isActive || this.tagIds().includes(t.id)).map((t) => ({ value: t.id, label: t.name })),
  );

  // Duplicates only warn: a household or company can share a phone / tax code across contacts.
  readonly samePhone = computed(() => duplicateOf(this.data.customers(), this.id, 'phone', this.value().phone ?? ''));
  readonly sameTax = computed(() => duplicateOf(this.data.customers(), this.id, 'companyTaxCode', this.value().companyTaxCode ?? ''));
  readonly sameName = computed(() => duplicateOf(this.data.customers(), this.id, 'name', this.value().name ?? ''));
  readonly typeHint = computed(() => this.types.find((t) => t.value === this.value().type)?.hint ?? '');

  showError(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  // ---------- địa chỉ giao hàng ----------
  addAddress(): void {
    const key = crypto.randomUUID();
    this.addresses.update((list) => [...list, { key, id: key, address: '', isDefault: list.length === 0 }]);
    setTimeout(() => document.getElementById(`addr-${key}`)?.focus());
  }

  patchAddress(key: string, change: Partial<AddressDraft>): void {
    this.addresses.update((list) => list.map((a) => (a.key === key ? { ...a, ...change } : a)));
  }

  setDefault(key: string): void {
    this.addresses.update((list) => list.map((a) => ({ ...a, isDefault: a.key === key })));
  }

  removeAddress(key: string): void {
    this.addresses.update((list) => {
      const next = list.filter((a) => a.key !== key);
      if (next.length && !next.some((a) => a.isDefault)) next[0] = { ...next[0], isDefault: true };
      return next;
    });
  }

  addressError(a: AddressDraft): string {
    if (!a.address.trim() && (a.label || a.recipientName || a.phone)) return 'Nhập địa chỉ hoặc xoá dòng này';
    if (a.phone && !PHONE_PATTERN.test(a.phone)) return 'Số điện thoại không hợp lệ';
    return '';
  }

  readonly addressIssues = computed(() => this.addresses().some((a) => this.addressError(a)));

  save(): void {
    this.attempted.set(true);
    if (this.form.invalid || this.addressIssues()) {
      this.form.markAllAsTouched();
      setTimeout(() => document.querySelector<HTMLElement>('.ng-invalid:not(form), [aria-invalid="true"]')?.focus());
      return;
    }
    const v = this.form.getRawValue();
    const addresses: CustomerAddress[] = this.addresses()
      .filter((a) => a.address.trim())
      .map(({ key, ...a }) => ({
        ...a,
        id: a.id || key,
        label: a.label?.trim() || undefined,
        recipientName: a.recipientName?.trim() || undefined,
        phone: a.phone?.trim() || undefined,
        address: a.address.trim(),
      }));
    const draft: CustomerDraft = {
      name: v.name.trim(),
      companyName: v.companyName.trim() || undefined,
      type: v.type,
      creditDays: Number(v.creditDays) || 0,
      phone: v.phone.trim() || undefined,
      email: v.email.trim() || undefined,
      idNumber: v.idNumber.trim() || undefined,
      personalTaxCode: v.personalTaxCode.trim() || undefined,
      companyTaxCode: v.companyTaxCode.trim() || undefined,
      note: v.note.trim() || undefined,
      tagIds: this.tagIds(),
      isActive: v.isActive,
      addresses,
    };
    if (this.editing) {
      this.svc.update(this.editing.id, draft);
      this.router.navigate(['/khach-hang', this.editing.id], { state: { notice: 'Đã lưu thay đổi.' } });
    } else {
      const c = this.svc.create(draft);
      this.router.navigate(['/khach-hang', c.id], { state: { notice: `Đã tạo khách hàng ${c.code}.` } });
    }
  }
}
