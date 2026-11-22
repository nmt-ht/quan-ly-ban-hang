import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { ApiError, describeHttpError } from '../api/api.service';

export interface ErrorNotice {
  /** Short heading: "Lỗi hệ thống" when IT has to look at it, else "Có lỗi xảy ra". */
  title: string;
  message: string;
  /** What IT searches for: the server's request id, or the code made here for an error that never reached the server. */
  code?: string;
  /** Offer "Tải lại trang": a page that did not load, or one left in an unknown state. */
  reload: boolean;
}

/** Noise the browser raises on its own that nobody can act on. */
const IGNORED = /ResizeObserver loop|AbortError|The user aborted a request|Navigation Cancelled|Script error\.?$/i;
/** The app was updated while the page was open, or the network dropped while a page's code was being fetched. */
const CHUNK = /dynamically imported module|ChunkLoadError|Loading chunk .* failed|Importing a module script failed/i;

const REPORT_TO_IT = 'báo bộ phận IT kiểm tra';

/** A code for an error that never reached the server: LOI-, the time in base 36, three random characters. */
function newClientErrorId(): string {
  return `LOI-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

/** "Mã lỗi: X." is shown on its own line with a copy button, so it comes out of the sentence. */
const withoutCode = (message: string) => message.replace(/\s*Mã lỗi: \S+?\.(?=\s|$)/, '');

/**
 * Errors nothing on the page caught (the Angular ErrorHandler hands them here): a promise that rejected with no catch, a template
 * that threw, a page's code that did not load. A save that fails is NOT here — the page shows its own message from errorText().
 * Business-type answers stay on the page; this is for faults, so the person is told whether it is theirs to fix or IT's.
 */
@Injectable({ providedIn: 'root' })
export class ErrorNoticeService {
  readonly current = signal<ErrorNotice | null>(null);
  private last = { message: '', at: 0 };

  /** Shows the notice for `error`. Returns the client error id when one was made (for Sentry), or null when nothing was shown. */
  report(error: unknown): { clientErrorId?: string } | null {
    const text = error instanceof Error ? error.message : String(error ?? '');
    if (IGNORED.test(text)) return null;

    let notice: ErrorNotice;
    let clientErrorId: string | undefined;
    const api = error instanceof HttpErrorResponse ? describeHttpError(error) : error instanceof ApiError ? error : null;
    if (api) {
      // The session ran out: the interceptor already sent the person to the sign-in page.
      if (api.kind === 'session') return null;
      notice = {
        title: api.kind === 'system' || api.kind === 'network' ? 'Lỗi hệ thống' : 'Có lỗi xảy ra',
        message: withoutCode(api.message),
        code: api.requestId,
        reload: false,
      };
    } else if (CHUNK.test(text)) {
      clientErrorId = newClientErrorId();
      notice = {
        title: 'Không tải được trang',
        message: `Có thể vừa có bản cập nhật mới hoặc mạng đang yếu. Tải lại trang (hoặc nhấn Ctrl + F5) rồi thử lại; nếu vẫn lỗi, ${REPORT_TO_IT}.`,
        code: clientErrorId,
        reload: true,
      };
    } else {
      clientErrorId = newClientErrorId();
      notice = {
        title: 'Lỗi hệ thống',
        message: `Màn hình này gặp lỗi và có thể chưa hoạt động đúng. Việc này không phải do bạn nhập sai. Thử tải lại trang (F5); nếu vẫn lỗi, ${REPORT_TO_IT} và đọc mã lỗi bên dưới.`,
        code: clientErrorId,
        reload: true,
      };
    }

    // The same fault repeating in a loop is one notice, not a pile.
    const now = Date.now();
    if (notice.message === this.last.message && now - this.last.at < 5000) return { clientErrorId };
    this.last = { message: notice.message, at: now };
    this.current.set(notice);
    return { clientErrorId };
  }

  dismiss(): void {
    this.current.set(null);
  }
}
