import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { PHONE_PATTERN, TAX_CODE_PATTERN, duplicateOf } from '../supplier.rules';
import { SupplierDraft, SupplierService } from '../supplier.service';
import { HasUnsavedChanges, isSaveShortcut, warnBeforeUnload } from '../../../core/guards/unsaved-changes.guard';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { errorText } from '../../../core/api/api.service';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AllowedLinkDirective, NavIconComponent],
  templateUrl: './supplier-form.component.html',
})
export class SupplierFormComponent implements HasUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly data = inject(MockDataService);
  private readonly svc = inject(SupplierService);

  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly editing = this.id ? this.data.suppliers().find((s) => s.id === this.id) : undefined;
  readonly notFound = !!this.id && !this.editing;

  // Mã số thuế đã dùng cho NCC khác → chặn lưu.
  private readonly uniqueTaxCode = (c: AbstractControl): ValidationErrors | null => {
    const other = duplicateOf(this.data.suppliers(), this.id, 'taxCode', c.value ?? '');
    return other ? { duplicate: `${other.code} — ${other.name}` } : null;
  };

  readonly form = this.fb.nonNullable.group({
    name: [this.editing?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    contactPhone: [this.editing?.contactPhone ?? '', Validators.pattern(PHONE_PATTERN)],
    email: [this.editing?.email ?? '', Validators.email],
    taxCode: [this.editing?.taxCode ?? '', [Validators.pattern(TAX_CODE_PATTERN), this.uniqueTaxCode]],
    creditDays: [this.editing?.creditDays ?? 0, [Validators.required, Validators.min(0), Validators.max(365), Validators.pattern(/^\d+$/)]],
    address: [this.editing?.address ?? ''],
    note: [this.editing?.note ?? ''],
    isActive: [this.editing?.isActive ?? true],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  // Same name as another supplier: allowed (chi nhánh khác nhau) but worth a warning.
  readonly sameName = computed(() => duplicateOf(this.data.suppliers(), this.id, 'name', this.value().name ?? ''));
  readonly creditDays = computed(() => Number(this.value().creditDays) || 0);

  showError(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      document.querySelector<HTMLElement>('.ng-invalid:not(form)')?.focus();
      return;
    }
    const v = this.form.getRawValue();
    const draft: SupplierDraft = {
      name: v.name.trim(),
      contactPhone: v.contactPhone.trim() || undefined,
      email: v.email.trim() || undefined,
      taxCode: v.taxCode.trim() || undefined,
      creditDays: Number(v.creditDays) || 0,
      address: v.address.trim() || undefined,
      note: v.note.trim() || undefined,
      isActive: v.isActive,
    };
    if (this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');
    try {
      if (this.editing) {
        await this.svc.update(this.editing.id, draft);
        this.form.markAsPristine();
        this.router.navigate(['/nha-cung-cap', this.editing.id], { state: { notice: 'Đã lưu thay đổi.' } });
      } else {
        const s = await this.svc.create(draft);
        this.form.markAsPristine();
        this.router.navigate(['/nha-cung-cap', s.id], { state: { notice: `Đã tạo nhà cung cấp ${s.code}.` } });
      }
    } catch (e) {
      this.saveError.set(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }

  /** Why the last save failed (shown in the action bar). */
  readonly saveError = signal('');
  readonly saving = signal(false);

  // ---------- unsaved changes + Ctrl+S ----------
  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    warnBeforeUnload(e, this.hasUnsavedChanges());
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (!isSaveShortcut(e)) return;
    e.preventDefault();
    this.save();
  }
}
