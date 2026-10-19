import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { Product } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterLink, DataTableComponent],
  templateUrl: './products.component.html',
})
export class ProductsComponent {
  readonly search = signal('');
  readonly products = computed(() => {
    const q = this.search().toLowerCase();
    return this.data.products().filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  });

  readonly columns: DataTableColumn<Product>[] = [
    { key: 'code', label: 'Mã / Tên', format: (r) => `${r.code} — ${r.name}` },
    { key: 'type', label: 'Tính chất' },
    { key: 'baseUnit', label: 'ĐVT' },
    { key: 'minStock', label: 'Tồn tối thiểu', align: 'right' },
    { key: 'retailPrice', label: 'Giá lẻ', align: 'right', format: (r) => formatVnd(r.retailPrice) },
    { key: 'wholesalePrice', label: 'Giá sỉ', align: 'right', format: (r) => formatVnd(r.wholesalePrice) },
  ];

  constructor(readonly data: MockDataService) {}
}
