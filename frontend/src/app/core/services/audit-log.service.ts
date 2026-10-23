import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';

export type AuditValue = string | number | boolean | null | AuditValue[];

/** One changed field of an edit: "Giá lẻ: 120.000 → 135.000". */
export interface AuditChange {
  field: string;
  label: string;
  from: AuditValue;
  to: AuditValue;
}

/** One line of Nhật ký hoạt động, as GET /audit-logs answers it. */
export interface AuditLogEntry {
  id: string;
  at: string;
  userId?: string;
  userName: string;
  action: string; // <entity>.<verb>: sales_order.deliver, auth.login_failed…
  entityType: string;
  entityId: string;
  entityCode?: string;
  summary: string;
  changes?: AuditChange[];
  related?: string[];
  ip?: string;
  requestId?: string;
}

export interface AuditQuery {
  from?: string | null;
  to?: string | null;
  userId?: string;
  entityType?: string;
  action?: string;
  q?: string;
  before?: string | null;
  limit?: number;
}

/** Reads Nhật ký hoạt động. Lines are written by the server inside each change; nothing here writes. */
@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly api = inject(ApiService);

  /** Newest first, keyset paged by `nextCursor` (needs audit.view). */
  list(query: AuditQuery): Promise<{ items: AuditLogEntry[]; nextCursor: string | null }> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    return this.api.get(`/audit-logs?${params}`);
  }

  /** Lịch sử of one record, oldest first, including lines of other records that name its code. */
  history(entityType: string, entityId: string, code?: string): Promise<AuditLogEntry[]> {
    const q = code ? `?code=${encodeURIComponent(code)}` : '';
    return this.api.get(`/audit-logs/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}${q}`);
  }
}
