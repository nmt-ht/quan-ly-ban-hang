import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from './api.config';

/** A failed API call, with the backend's Vietnamese message ready to show on screen. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * The backend answers null for an empty optional column; the frontend models use "absent"
 * (`phone?: string`). Dropping null keys keeps every `x ?? fallback` and `=== undefined` working.
 */
export function stripNulls<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripNulls) as T;
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (v !== null) out[k] = stripNulls(v);
  return out as T;
}

function toApiError(e: unknown): ApiError {
  if (!(e instanceof HttpErrorResponse)) return new ApiError('Có lỗi không mong muốn. Thử lại sau.', 0);
  // Status 0 = no network; a 5xx without our JSON body = the dev proxy could not reach the backend.
  const fromApi = !!e.error && typeof e.error === 'object' && 'statusCode' in e.error;
  if (e.status === 0 || (e.status >= 500 && !fromApi)) return new ApiError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', e.status);
  const msg = (e.error as { message?: string | string[] } | null)?.message;
  if (Array.isArray(msg)) return new ApiError(msg.join('. '), e.status);
  if (typeof msg === 'string' && msg) return new ApiError(msg, e.status);
  if (e.status === 403) return new ApiError('Chức vụ của bạn chưa có quyền làm việc này.', 403);
  return new ApiError(e.status >= 500 ? 'Máy chủ gặp lỗi, chưa lưu được. Thử lại sau ít phút.' : `Yêu cầu không hợp lệ (mã ${e.status}).`, e.status);
}

// Promise-based wrapper over HttpClient for the /api endpoints (the interceptor adds the token).
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string): Promise<T> {
    return this.run(this.http.get<T>(API_BASE + path));
  }

  post<T>(path: string, body: unknown = {}): Promise<T> {
    return this.run(this.http.post<T>(API_BASE + path, body));
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.run(this.http.put<T>(API_BASE + path, body));
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.run(this.http.patch<T>(API_BASE + path, body));
  }

  delete(path: string): Promise<void> {
    return this.run(this.http.delete<void>(API_BASE + path));
  }

  private async run<T>(req: Observable<T>): Promise<T> {
    try {
      return stripNulls(await firstValueFrom(req));
    } catch (e) {
      throw toApiError(e);
    }
  }
}

/** Message for an error thrown by a save (ApiError from the backend, or a rule checked on the page). */
export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Có lỗi không mong muốn. Thử lại sau.';
}

/** Put the saved row back into a local list: replace it in place, or add it (at the front by default). */
export function upsertById<T extends { id: string }>(list: T[], row: T, atEnd = false): T[] {
  if (list.some((x) => x.id === row.id)) return list.map((x) => (x.id === row.id ? row : x));
  return atEnd ? [...list, row] : [row, ...list];
}
