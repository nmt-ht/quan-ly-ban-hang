import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { Customer, Product, SalesOrder, SalesOrderLine } from '../../../core/models/domain.models';
import { formatVnd } from '../../../shared/format.util';

@Component({
  selector: 'app-sales-order-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './sales-order-form.component.html',
})
export class SalesOrderFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly formatVnd = formatVnd;

  readonly form = this.fb.group({
    customerId: ['', Validators.required],
    recipientName: [''],
    recipientPhone: [''],
    description: [''],
    source: [''],
    orderDate: [this.today()],
    neededByDate: [''],
    discountAmount: [0],
    lines: this.fb.array<FormGroup>([]),
  });

  readonly selectedCustomer = signal<Customer | undefined>(undefined);

  get lines(): FormArray<FormGroup> {
    return this.form.get('lines') as FormArray<FormGroup>;
  }

  constructor(
    readonly data: MockDataService,
    private readonly router: Router,
  ) {
    this.addLine();
    this.form.get('customerId')!.valueChanges.subscribe((id) => {
      this.selectedCustomer.set(this.data.customers().find((c) => c.id === id));
      this.repriceLines();
    });
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private priceFor(product: Product): number {
    const type = this.selectedCustomer()?.type ?? 'LE';
    if (type === 'SI') return product.wholesalePrice;
    if (type === 'DROPSHIP') return product.dropshipPrice;
    return product.retailPrice;
  }

  addLine(): void {
    this.lines.push(
      this.fb.group({
        productId: [''],
        quantity: [1],
        unitPrice: [0],
        note: [''],
      }),
    );
  }

  removeLine(i: number): void {
    this.lines.removeAt(i);
  }

  onProductChange(i: number): void {
    const group = this.lines.at(i);
    const product = this.data.products().find((p) => p.id === group.value.productId);
    if (product) group.patchValue({ unitPrice: this.priceFor(product) });
  }

  private repriceLines(): void {
    this.lines.controls.forEach((group, i) => this.onProductChange(i));
  }

  productName(id: string): string {
    return this.data.products().find((p) => p.id === id)?.name ?? '';
  }

  productUnit(id: string): string {
    return this.data.products().find((p) => p.id === id)?.baseUnit ?? '—';
  }

  lineTotal(i: number): number {
    const v = this.lines.at(i).value;
    return (v.quantity ?? 0) * (v.unitPrice ?? 0);
  }

  linesTotal(): number {
    return this.lines.controls.reduce((sum, _, i) => sum + this.lineTotal(i), 0);
  }

  orderTotal(): number {
    return this.linesTotal() - (this.form.value.discountAmount ?? 0);
  }

  save(): void {
    if (this.form.invalid || this.lines.length === 0) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const orders = this.data.salesOrders();
    const seq = (orders.length + 1).toString().padStart(7, '0');
    const lines: SalesOrderLine[] = this.lines.controls.map((g, i) => ({
      id: crypto.randomUUID(),
      productId: g.value.productId,
      unit: this.productUnit(g.value.productId),
      quantity: g.value.quantity ?? 0,
      unitPrice: g.value.unitPrice ?? 0,
      lineTotal: this.lineTotal(i),
      note: g.value.note || undefined,
    }));
    const order: SalesOrder = {
      id: crypto.randomUUID(),
      code: `DH${seq}`,
      customerId: v.customerId!,
      recipientName: v.recipientName || undefined,
      recipientPhone: v.recipientPhone || undefined,
      description: v.description || undefined,
      source: v.source || undefined,
      tagIds: [],
      orderDate: v.orderDate!,
      neededByDate: v.neededByDate || undefined,
      status: 'CHO_SAN_XUAT',
      lines,
      discountAmount: v.discountAmount ?? 0,
      totalGoods: this.linesTotal(),
      totalOrder: this.orderTotal(),
      salesRep: 'admin@ninhtrang.local',
      createdBy: 'admin@ninhtrang.local',
      receivedValue: 0,
    };
    this.data.salesOrders.set([order, ...orders]);
    this.router.navigateByUrl('/don-hang');
  }
}
