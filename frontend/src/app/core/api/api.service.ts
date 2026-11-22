import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from './api.config';

/**
 * What kind of failure it was, which decides what the person is told to do:
 *  - business: a rule or a field the person can fix (the server's own sentence is shown as it is);
 *  - permission: the role may not do this; ask an administrator;
 *  - session: signed out or the session ran out;
 *  - network: the browser could not reach the server (check the connection, then tell IT if it stays);
 *  - system: a fault on our side — nothing the person can fix, so they are told to report it to IT with the code.
 */
export type ApiErrorKind = 'business' | 'permission' | 'session' | 'network' | 'system';

/** A failed API call, with a Vietnamese message ready to show on screen. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: ApiErrorKind = 'business',
    /** The request id the server logged (X-Request-Id): the one code IT needs to find the fault. */
    readonly requestId?: string,
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

/** English default sentences Nest / Express put in an answer when nothing better was written: never shown to a person. */
const GENERIC_ENGLISH = /^(internal server error|bad gateway|service unavailable|gateway timeout|forbidden( resource)?|not found|unauthorized|bad request|conflict|payload too large|too many requests|unprocessable entity|throttlerexception.*|lỗi hệ thống, chưa xử lý được yêu cầu\.?)$/i;

const REPORT_TO_IT = 'báo bộ phận IT kiểm tra';

const stamp = (now = new Date()) => `${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${now.toLocaleDateString('vi-VN')}`;

/** The sentence for a system fault: what happened to the person, what to do, and the code IT searches for. */
function systemMessage(custom: string, requestId: string | undefined, status: number): string {
  const code = requestId ? ` Mã lỗi: ${requestId}.` : '';
  const when = ` Thời điểm: ${stamp()}.`;
  if ((status === 502 || status === 503 || status === 504) && !custom) {
    return `Máy chủ đang bận hoặc đang khởi động lại. Chờ khoảng một phút rồi thử lại; nếu vẫn lỗi, ${REPORT_TO_IT}.${code}${when}`;
  }
  return custom
    ? `${custom.replace(/[.\s]+$/, '')}. Đây là lỗi hệ thống — hãy ${REPORT_TO_IT}.${code}${when}`
    : `Lỗi hệ thống, chưa xử lý được yêu cầu. Việc này không phải do bạn nhập sai — hãy ${REPORT_TO_IT} và đọc mã lỗi sau.${code}${when}`;
}

/**
 * Turns a failed HTTP call into an ApiError a person can act on. Business answers keep the server's own sentence (it names the field
 * or the rule); everything the person cannot fix says so and asks them to tell IT, with the request id from X-Request-Id.
 */
export function describeHttpError(e: HttpErrorResponse): ApiError {
  const body = e.error && typeof e.error === 'object' ? (e.error as { message?: string | string[]; statusCode?: number; requestId?: string }) : null;
  const requestId = e.headers?.get('X-Request-Id') ?? body?.requestId ?? undefined;
  const raw = Array.isArray(body?.message) ? body.message.join('. ') : typeof body?.message === 'string' ? body.message.trim() : '';
  const custom = raw && !GENERIC_ENGLISH.test(raw) ? raw : '';
  const fromApi = !!body && 'statusCode' in body;

  // No answer from our server: no network, or the dev proxy / a gateway returned its own page instead of our JSON.
  if (e.status === 0 || ((e.status === 502 || e.status === 503 || e.status === 504) && !fromApi)) {
    return new ApiError(
      `Không kết nối được máy chủ. Kiểm tra mạng (Wi-Fi, dây mạng) rồi thử lại. Nếu mạng bình thường mà vẫn lỗi, ${REPORT_TO_IT}.`,
      e.status, 'network', requestId,
    );
  }
  if (e.status >= 500) return new ApiError(systemMessage(custom, requestId, e.status), e.status, 'system', requestId);

  switch (e.status) {
    case 401:
      // A wrong password or a locked account comes with its own sentence; a bare 401 means the session ran out.
      return custom
        ? new ApiError(custom, 401, 'business', requestId)
        : new ApiError('Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập. Đăng nhập lại rồi thử lại.', 401, 'session', requestId);
    case 403:
      return new ApiError(`${custom || 'Vai trò của bạn chưa có quyền làm việc này.'} Nhờ quản trị viên cấp quyền nếu bạn cần làm việc này.`, 403, 'permission', requestId);
    case 404:
      return new ApiError(custom || 'Không tìm thấy dữ liệu — có thể đã bị xoá, hoặc bạn không có quyền xem. Tải lại trang rồi thử lại.', 404, 'business', requestId);
    case 413:
      return new ApiError('Dữ liệu gửi lên quá lớn (ví dụ ảnh hoặc file nặng). Giảm dung lượng rồi thử lại.', 413, 'business', requestId);
    case 429:
      return new ApiError('Bạn thao tác quá nhiều lần trong thời gian ngắn. Đợi vài phút rồi thử lại.', 429, 'business', requestId);
    case 400:
    case 422:
      return new ApiError(custom || 'Dữ liệu chưa hợp lệ. Kiểm tra lại các ô đã nhập rồi thử lại.', e.status, 'business', requestId);
    default:
      return new ApiError(custom || `Yêu cầu chưa thực hiện được (mã ${e.status}). Tải lại trang rồi thử lại.`, e.status, 'business', requestId);
  }
}

function toApiError(e: unknown): ApiError {
  if (e instanceof HttpErrorResponse) return describeHttpError(e);
  return new ApiError(`Có lỗi không mong muốn trên máy này. Tải lại trang (F5) rồi thử lại; nếu vẫn lỗi, ${REPORT_TO_IT}.`, 0, 'system');
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

  delete<T = void>(path: string): Promise<T> {
    return this.run(this.http.delete<T>(API_BASE + path));
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
  return e instanceof Error ? e.message : `Có lỗi không mong muốn. Tải lại trang (F5) rồi thử lại; nếu vẫn lỗi, ${REPORT_TO_IT}.`;
}

/** Put the saved row back into a local list: replace it in place, or add it (at the front by default). */
export function upsertById<T extends { id: string }>(list: T[], row: T, atEnd = false): T[] {
  if (list.some((x) => x.id === row.id)) return list.map((x) => (x.id === row.id ? row : x));
  return atEnd ? [...list, row] : [row, ...list];
}
