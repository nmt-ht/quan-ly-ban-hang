import { Injectable, inject } from '@angular/core';
import { DataStore } from '../../core/services/data-store.service';
import { BomLine, Product } from '../../core/models/domain.models';
import { ApiService, upsertById } from '../../core/api/api.service';
import { BomImportPlan, ProductImportPlan } from './product-excel';
import { ImportResult } from '../../shared/import/import.types';

/** What the form saves; the code (VT/SP/DV + số) is given on creation by the server. */
export type ProductDraft = Omit<Product, 'id' | 'code' | 'createdAt' | 'updatedAt'>;

// All writes for Hàng hoá and định mức go through the API.
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly data = inject(DataStore);
  private readonly api = inject(ApiService);

  async create(d: ProductDraft): Promise<Product> {
    return this.keep(await this.api.post<Product>('/products', d));
  }

  /** Changing giá bán also needs product.update_price; the server says so if it is missing. */
  async update(id: string, d: ProductDraft): Promise<Product> {
    return this.keep(await this.api.put<Product>(`/products/${id}`, d));
  }

  /**
   * Nhập hàng hoá từ Excel (Pha 1.9): the rows parsed here go to the server, which checks and saves each one on its own
   * and answers row by row. dryRun = xem trước (nothing saved). After a real import the list is read again.
   */
  async importProducts(plan: ProductImportPlan, dryRun: boolean): Promise<ImportResult> {
    const strip = ({ id: _i, code: _c, createdAt: _a, updatedAt: _u, ...p }: Product) => p;
    const rows = [
      ...plan.creates.map((p) => ({ row: plan.rowOf.get(p.id) ?? 0, data: strip(p) })),
      ...plan.updates.map((p) => ({ row: plan.rowOf.get(p.id) ?? 0, id: p.id, data: strip(p) })),
    ].sort((a, b) => a.row - b.row);
    const res = await this.api.post<ImportResult>('/products/import', { dryRun, rows });
    if (!dryRun) this.data.products.set(await this.api.get<Product[]>('/products'));
    return res;
  }

  /** Nhập định mức: each finished product in the plan gets exactly its new lines. */
  async importBoms(plan: BomImportPlan): Promise<void> {
    const replacements = [...plan.replacements].map(([finishedProductId, lines]) => ({
      finishedProductId,
      lines: lines.map((l) => ({ componentId: l.componentId, quantityPerUnit: l.quantityPerUnit })),
    }));
    this.data.bomLines.set(await this.api.put<BomLine[]>('/bom-lines', { replacements }));
  }

  private keep(p: Product): Product {
    this.data.products.update((list) => upsertById(list, p));
    return p;
  }
}
