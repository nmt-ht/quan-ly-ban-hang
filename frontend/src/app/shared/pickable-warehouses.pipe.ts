import { Pipe, PipeTransform } from '@angular/core';
import { Warehouse, pickableWarehouses } from '../core/models/domain.models';

/**
 * `@for (w of data.warehouses() | pickable: current)` — the kho a chứng từ may pick: đang dùng ones, plus `current`
 * (an old choice of a kho since put out of use still shows). Filters (Lọc theo kho) list every kho instead.
 */
@Pipe({ name: 'pickable', standalone: true })
export class PickableWarehousesPipe implements PipeTransform {
  transform(all: Warehouse[], current?: string | null): Warehouse[] {
    return pickableWarehouses(all, current);
  }
}
