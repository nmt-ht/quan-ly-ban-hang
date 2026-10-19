import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { StockLevel } from '../../core/models/domain.models';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './inventory.component.html',
})
export class InventoryComponent {
  readonly rows = computed(() => this.data.stockLevels());

  readonly columns: DataTableColumn<StockLevel>[] = [
    { key: 'productId', label: 'Mặt hàng', format: (r) => this.data.products().find((p) => p.id === r.productId)?.name ?? r.productId },
    { key: 'warehouseId', label: 'Kho', format: (r) => this.data.warehouses().find((w) => w.id === r.warehouseId)?.name ?? r.warehouseId },
    { key: 'quantity', label: 'Tồn', align: 'right' },
    { key: 'minStock', label: 'Tối thiểu', align: 'right' },
  ];

  constructor(readonly data: MockDataService) {}
}
