import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { Customer } from '../../../core/models/domain.models';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './customer-form.component.html',
})
export class CustomerFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    companyName: [''],
    type: ['LE', Validators.required],
    creditDays: [0],
    phone: [''],
    email: [''],
    idNumber: [''],
    personalTaxCode: [''],
    companyTaxCode: [''],
    note: [''],
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
    const customers = this.data.customers();
    const seq = (customers.length + 1).toString().padStart(7, '0');
    const customer: Customer = {
      id: crypto.randomUUID(),
      code: `KH${seq}`,
      name: v.name!,
      companyName: v.companyName || undefined,
      type: v.type as Customer['type'],
      creditDays: v.creditDays ?? 0,
      phone: v.phone || undefined,
      email: v.email || undefined,
      idNumber: v.idNumber || undefined,
      personalTaxCode: v.personalTaxCode || undefined,
      companyTaxCode: v.companyTaxCode || undefined,
      note: v.note || undefined,
      tagIds: [],
      orderCount: 0,
      isActive: true,
    };
    this.data.customers.set([customer, ...customers]);
    this.router.navigateByUrl('/khach-hang');
  }
}
