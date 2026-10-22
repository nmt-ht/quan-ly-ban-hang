import { Injectable, inject } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { BomLine, Product } from '../../core/models/domain.models';
import { ApiService, upsertById } from '../../core/api/api.service';
import { CATALOG_FROM_API } from '../../core/api/api.config';
import { BomImportPlan, ProductImportPlan, applyBomImport, applyProductImport } from './product-excel';

/** What the form saves; the code (VT/SP/DV + số) is given on creation. */
export type ProductDraft = Omit<Product, 'id' | 'code' | 'createdAt' | 'updatedAt'>;

const PREFIX = { VAT_TU: 'VT', THANH_PHAM: 'SP', DICH_VU: 'DV' } as const;

// All writes for Hàng hoá and định mức: the API (CATALOG_FROM_API) or, in demo mode, the in-browser store.
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly data = inject(MockDataService);
  private readonly api = inject(ApiService);

  async create(d: ProductDraft): Promise<Product> {
    if (CATALOG_FROM_API) return this.keep(await this.api.post<Product>('/products', d));
    const products = this.data.products();
    const now = new Date().toISOString();
    const product: Product = { ...d, id: crypto.randomUUID(), code: `${PREFIX[d.type]}${String(products.length + 1).padStart(7, '0')}`, createdAt: now, updatedAt: now };
    this.data.products.set([product, ...products]);
    return product;
  }

  /** Changing giá bán also needs product.update_price; the server says so if it is missing. */
  async update(id: string, d: ProductDraft): Promise<Product> {
    if (CATALOG_FROM_API) return this.keep(await this.api.put<Product>(`/products/${id}`, d));
    const old = this.data.products().find((p) => p.id === id);
    if (!old) throw new Error('Không tìm thấy hàng hoá');
    const updated: Product = { ...old, ...d, updatedAt: new Date().toISOString() };
    this.data.products.update((list) => list.map((p) => (p.id === id ? updated : p)));
    return updated;
  }

  /** Nhập hàng hoá từ Excel, all or nothing on the server. Codes of new rows are given there. */
  async importProducts(plan: ProductImportPlan): Promise<void> {
    if (!CATALOG_FROM_API) {
      this.data.products.set(applyProductImport(this.data.products(), plan));
      return;
    }
    const strip = ({ id: _i, code: _c, createdAt: _a, updatedAt: _u, ...p }: Product) => p;
    const res = await this.api.post<{ created: Product[]; updated: Product[] }>('/products/import', {
      creates: plan.creates.map(strip),
      updates: plan.updates.map((p) => ({ ...strip(p), id: p.id })),
    });
    this.data.products.update((list) => [...res.created, ...res.updated].reduce((acc, p) => upsertById(acc, p), list));
  }

  /** Nhập định mức: each finished product in the plan gets exactly its new lines. */
  async importBoms(plan: BomImportPlan): Promise<void> {
    if (!CATALOG_FROM_API) {
      this.data.bomLines.set(applyBomImport(this.data.bomLines(), plan));
      return;
    }
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
