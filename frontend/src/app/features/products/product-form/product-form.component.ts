import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { Product } from '../../../core/models/domain.models';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './product-form.component.html',
})
export class ProductFormComponent {
  private readonly fb = inject(FormBuilder);

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
  });

  constructor(
    readonly data: MockDataService,
    private readonly router: Router,
  ) {}

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const products = this.data.products();
    const seq = (products.length + 1).toString().padStart(7, '0');
    const prefix = v.type === 'VAT_TU' ? 'VT' : v.type === 'THANH_PHAM' ? 'SP' : 'DV';
    const product: Product = {
      id: crypto.randomUUID(),
      code: `${prefix}${seq}`,
      name: v.name!,
      type: v.type as Product['type'],
      baseUnit: v.baseUnit!,
      crossRefCode: v.crossRefCode || undefined,
      categoryId: v.categoryId || undefined,
      defaultWarehouseId: v.defaultWarehouseId || undefined,
      minStock: v.minStock ?? 0,
      vatRate: v.vatRate ?? 0,
      warrantyMonths: v.warrantyMonths ?? 0,
      origin: v.origin || undefined,
      retailPrice: v.retailPrice ?? 0,
      wholesalePrice: v.wholesalePrice ?? 0,
      dropshipPrice: v.dropshipPrice ?? 0,
      unitConversions: [],
      purchaseNote: v.purchaseNote || undefined,
      saleNote: v.saleNote || undefined,
      description: v.description || undefined,
      isSellable: !!v.isSellable,
      isActive: !!v.isActive,
    };
    this.data.products.set([product, ...products]);
    this.router.navigateByUrl('/hang-hoa');
  }
}
