import { Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { merge } from 'rxjs';
import { MockDataService } from '../../../core/services/mock-data.service';
import {
  MeasureMode, Product, ProductImage, ProductType, UnitConversion, UnitOperation,
} from '../../../core/models/domain.models';
import { ProductImagesComponent } from '../product-images/product-images.component';
import {
  MEASURE_MODES, MEASURE_UNIT, allowsUnitConversions, inferMeasureMode, tracksStock,
} from '../product-type-rules';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { MoneyInputDirective } from '../../../shared/money-input.directive';
import { UNIT_OPERATIONS, describe, isPriceShift, normalize, priceFor, ratioFor } from '../unit-conversion';
import { HasUnsavedChanges, isSaveShortcut, warnBeforeUnload } from '../../../core/guards/unsaved-changes.guard';
import { errorText } from '../../../core/api/api.service';
import { ProductDraft, ProductService } from '../product.service';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';

// × / ÷ need a positive ratio; + / − accept 0 (same price as the base unit).
function factorValidator(group: AbstractControl): ValidationErrors | null {
  const op = group.get('operation')?.value as UnitOperation;
  const f = group.get('factor')?.value;
  if (f === null || f === '' || f === undefined || Number.isNaN(Number(f))) return { factor: 'required' };
  if (isPriceShift(op) ? Number(f) < 0 : Number(f) <= 0) return { factor: 'range' };
  return null;
}

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AllowedLinkDirective, NavIconComponent, MoneyInputDirective, ProductImagesComponent],
  templateUrl: './product-form.component.html',
})
export class ProductFormComponent implements HasUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly operations = UNIT_OPERATIONS;

  readonly form = this.fb.group({
    name: ['', Validators.required],
    type: ['VAT_TU', Validators.required],
    baseUnit: ['', Validators.required],
    crossRefCode: [''],
    categoryId: [''],
    defaultWarehouseId: [''],
    minStock: [0],
    vatRate: [0],
    warrantyMonths: [0],
    origin: [''],
    retailPrice: [0],
    wholesalePrice: [0],
    dropshipPrice: [0],
    purchaseNote: [''],
    saleNote: [''],
    description: [''],
    isSellable: [true],
    isActive: [true],
    measureMode: [null as MeasureMode | null],
    units: this.fb.array<FormGroup>([], { validators: (a) => this.unitNamesValidator(a) }),
  });

  readonly measureModes = MEASURE_MODES;
  readonly images = signal<ProductImage[]>([]);
  private readonly productService = inject(ProductService);
  readonly saving = signal(false);
  readonly saveError = signal('');
  // Thành phẩm saved before Cách tính existed, with a unit that isn't m2 / m.
  legacyUnit = '';
  measureMissing = false;

  get units(): FormArray<FormGroup> {
    return this.form.controls.units;
  }

  get type(): ProductType {
    return this.form.getRawValue().type as ProductType;
  }

  get measure() {
    const mode = this.form.controls.measureMode.value;
    return MEASURE_MODES.find((m) => m.value === mode) ?? null;
  }

  get tracksStock(): boolean {
    return tracksStock(this.type);
  }

  get allowsUnits(): boolean {
    return allowsUnitConversions(this.type);
  }

  setMeasureMode(mode: MeasureMode): void {
    this.form.controls.measureMode.setValue(mode);
    this.measureMissing = false;
  }

  // Thành phẩm: the unit is derived from Cách tính and not typed.
  private applyTypeRules(): void {
    if (this.type !== 'THANH_PHAM') return;
    const mode = this.form.controls.measureMode.value;
    if (mode) this.form.controls.baseUnit.setValue(MEASURE_UNIT[mode], { emitEvent: false });
    else if (!this.legacyUnit) this.setMeasureMode('AREA');
    this.units.updateValueAndValidity();
  }

  // Set on /hang-hoa/:id/sua; null on /hang-hoa/them.
  readonly editing: Product | null;
  readonly notFound: boolean;

  constructor(
    readonly data: MockDataService,
    private readonly router: Router,
    route: ActivatedRoute,
  ) {
    const id = route.snapshot.paramMap.get('id');
    this.editing = id ? (data.products().find((p) => p.id === id) ?? null) : null;
    this.notFound = !!id && !this.editing;
    if (this.editing) {
      const p = this.editing;
      this.form.patchValue({
        ...p,
        crossRefCode: p.crossRefCode ?? '',
        categoryId: p.categoryId ?? '',
        defaultWarehouseId: p.defaultWarehouseId ?? '',
        origin: p.origin ?? '',
        purchaseNote: p.purchaseNote ?? '',
        saleNote: p.saleNote ?? '',
        description: p.description ?? '',
      });
      // The code prefix (VT/SP/DV) is fixed at creation, so the type is too.
      this.form.controls.type.disable();
      for (const u of p.unitConversions) this.addUnit(normalize(u, p));
      this.images.set(p.images ?? []);
      this.savedImages = JSON.stringify(this.images());
      if (p.type === 'THANH_PHAM') {
        const mode = p.measureMode ?? inferMeasureMode(p.baseUnit);
        this.form.controls.measureMode.setValue(mode);
        if (!mode) this.legacyUnit = p.baseUnit;
      }
    }
    // A new base unit name can clash with a conversion row.
    this.form.controls.baseUnit.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.units.updateValueAndValidity());
    merge(this.form.controls.type.valueChanges, this.form.controls.measureMode.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyTypeRules());
    this.applyTypeRules();
  }

  // ---------- Đơn vị quy đổi ----------

  addUnit(existing?: Required<UnitConversion>): void {
    const g = this.fb.group(
      {
        unitName: [existing?.unitName ?? '', Validators.required],
        operation: [(existing?.operation ?? 'MUL') as UnitOperation],
        factor: [existing?.factor ?? (null as number | null)],
        retailPrice: [existing?.price ?? 0],
        wholesalePrice: [existing?.wholesalePrice ?? 0],
        dropshipPrice: [existing?.dropshipPrice ?? 0],
      },
      { validators: factorValidator },
    );
    // "Tự tính sẵn theo tỷ lệ khi khai": prices follow the ratio until edited by hand.
    merge(g.controls.operation.valueChanges, g.controls.factor.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalcRow(g));
    this.units.push(g);
  }

  removeUnit(i: number): void {
    this.units.removeAt(i);
  }

  recalcAll(): void {
    for (const g of this.units.controls) this.recalcRow(g);
  }

  private recalcRow(g: FormGroup): void {
    const op = g.get('operation')!.value as UnitOperation;
    const f = Number(g.get('factor')!.value);
    if (factorValidator(g)) return;
    const base = this.form.getRawValue();
    g.patchValue(
      {
        retailPrice: priceFor(op, f, base.retailPrice ?? 0),
        wholesalePrice: priceFor(op, f, base.wholesalePrice ?? 0),
        dropshipPrice: priceFor(op, f, base.dropshipPrice ?? 0),
      },
      { emitEvent: false },
    );
  }

  unitHint(g: FormGroup): string {
    const v = g.getRawValue();
    return describe(v.operation, Number(v.factor) || 0, v.unitName ?? '', this.form.controls.baseUnit.value ?? '');
  }

  isPriceShift(g: FormGroup): boolean {
    return isPriceShift(g.get('operation')!.value);
  }

  private unitNamesValidator(a: AbstractControl): ValidationErrors | null {
    const names = (a as FormArray).controls.map((c) => String(c.get('unitName')?.value ?? '').trim().toLowerCase());
    const base = String(this.form?.controls.baseUnit.value ?? '').trim().toLowerCase();
    const dup = names.findIndex((x, i) => x && names.indexOf(x) !== i);
    if (dup >= 0) return { duplicate: names[dup] };
    if (base && names.includes(base)) return { sameAsBase: base };
    return null;
  }

  private unitsValue(): UnitConversion[] {
    return this.units.getRawValue().map((u) => {
      const op = u['operation'] as UnitOperation;
      const factor = Number(u['factor']);
      return {
        unitName: String(u['unitName']).trim(),
        operation: op,
        factor,
        ratioToBaseUnit: ratioFor(op, factor),
        price: Number(u['retailPrice']) || 0,
        wholesalePrice: Number(u['wholesalePrice']) || 0,
        dropshipPrice: Number(u['dropshipPrice']) || 0,
      };
    });
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    const type = this.type;
    // Hidden sections must not block saving (or be saved).
    if (!allowsUnitConversions(type)) this.units.clear();
    if (type === 'THANH_PHAM' && !this.form.controls.measureMode.value) {
      this.measureMissing = true;
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const stock = tracksStock(type);

    const draft: ProductDraft = {
      type,
      name: v.name!,
      baseUnit: v.baseUnit!,
      measureMode: type === 'THANH_PHAM' ? (v.measureMode ?? undefined) : undefined,
      crossRefCode: v.crossRefCode || undefined,
      categoryId: v.categoryId || undefined,
      defaultWarehouseId: stock ? v.defaultWarehouseId || undefined : undefined,
      minStock: stock ? (v.minStock ?? 0) : 0,
      vatRate: v.vatRate ?? 0,
      warrantyMonths: v.warrantyMonths ?? 0,
      origin: v.origin || undefined,
      retailPrice: v.retailPrice ?? 0,
      wholesalePrice: v.wholesalePrice ?? 0,
      dropshipPrice: v.dropshipPrice ?? 0,
      unitConversions: allowsUnitConversions(type) ? this.unitsValue() : [],
      images: this.images(),
      purchaseNote: v.purchaseNote || undefined,
      saleNote: v.saleNote || undefined,
      description: v.description || undefined,
      isSellable: !!v.isSellable,
      isActive: !!v.isActive,
    };

    this.saving.set(true);
    this.saveError.set('');
    try {
      const saved = this.editing ? await this.productService.update(this.editing.id, draft) : await this.productService.create(draft);
      this.markSaved();
      if (this.editing) this.router.navigate(['/hang-hoa', saved.id]);
      else this.router.navigateByUrl('/hang-hoa');
    } catch (e) {
      this.saveError.set(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }

  // ---------- unsaved changes + Ctrl+S ----------
  // Ảnh live outside the reactive form, so they are compared against a snapshot.
  private savedImages = '[]';

  private markSaved(): void {
    this.form.markAsPristine();
    this.savedImages = JSON.stringify(this.images());
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty || JSON.stringify(this.images()) !== this.savedImages;
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
