import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import {
  ExportDatum, OutstandingView, RecordImportResult, RecordImportRow, RecordInvoiceInput, RecordedInvoice,
} from '../../core/models/einvoice.models';

/** Hoá đơn bán ra phát hành ngoài phần mềm: danh sách cần lập, xuất dữ liệu cho cổng, ghi nhận và nhập số về. */
@Injectable({ providedIn: 'root' })
export class EInvoiceService {
  private readonly api = inject(ApiService);

  outstanding(from: string, to: string, search: string) {
    const q = new URLSearchParams({ from, to });
    if (search.trim()) q.set('search', search.trim());
    return this.api.get<OutstandingView>(`/einvoice/outstanding?${q}`);
  }

  list(from: string, to: string, status: string, search: string) {
    const q = new URLSearchParams({ from, to });
    if (status) q.set('status', status);
    if (search.trim()) q.set('search', search.trim());
    return this.api.get<{ from: string; to: string; rows: RecordedInvoice[] }>(`/einvoice?${q}`);
  }

  exportData(items: { orderId: string; deliveryId?: string }[]) {
    return this.api.post<ExportDatum[]>('/einvoice/export-data', { items });
  }

  record(dto: RecordInvoiceInput) {
    return this.api.post<RecordedInvoice>('/einvoice/record', dto);
  }

  importRecords(dryRun: boolean, templateCode: '1' | '2', series: string | undefined, rows: RecordImportRow[]) {
    return this.api.post<RecordImportResult>('/einvoice/record/import', { dryRun, templateCode, series, rows });
  }

  voidRecord(id: string, reason: string) {
    return this.api.post<RecordedInvoice>(`/einvoice/${id}/void`, { reason });
  }
}
