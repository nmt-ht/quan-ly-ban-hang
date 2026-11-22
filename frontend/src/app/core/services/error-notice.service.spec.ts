import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/api.service';
import { ErrorNoticeService } from './error-notice.service';

describe('Thông báo cho lỗi không ai bắt (ErrorNoticeService)', () => {
  it('lỗi hệ thống từ máy chủ: hiện câu bảo báo IT, mã lỗi tách riêng (không lặp trong câu)', () => {
    const svc = new ErrorNoticeService();
    svc.report(new ApiError('Lỗi hệ thống, chưa xử lý được yêu cầu. Vui lòng báo bộ phận IT kiểm tra. Mã lỗi: req-12345678. Thời điểm: 10:00 23/11/2026.', 500, 'system', 'req-12345678'));
    const n = svc.current()!;
    expect(n).toMatchObject({ title: 'Lỗi hệ thống', code: 'req-12345678', reload: false });
    expect(n.message).toContain('báo bộ phận IT');
    expect(n.message).not.toContain('Mã lỗi:');
  });

  it('lỗi của chính màn hình (không tới máy chủ): tạo mã LOI-…, đề nghị tải lại và báo IT', () => {
    const svc = new ErrorNoticeService();
    const shown = svc.report(new TypeError("Cannot read properties of undefined (reading 'x')"));
    expect(shown?.clientErrorId).toMatch(/^LOI-[A-Z0-9]+$/);
    expect(svc.current()).toMatchObject({ title: 'Lỗi hệ thống', code: shown!.clientErrorId, reload: true });
    expect(svc.current()!.message).toContain('không phải do bạn nhập sai');
  });

  it('không tải được mã của trang (cập nhật phiên bản, mạng yếu): bảo tải lại bằng Ctrl + F5', () => {
    const svc = new ErrorNoticeService();
    svc.report(new Error('Failed to fetch dynamically imported module: https://x/chunk-ABC.js'));
    expect(svc.current()).toMatchObject({ title: 'Không tải được trang', reload: true });
    expect(svc.current()!.message).toContain('Ctrl + F5');
  });

  it('bỏ qua nhiễu của trình duyệt và lỗi phiên hết hạn (đã chuyển sang trang đăng nhập)', () => {
    const svc = new ErrorNoticeService();
    expect(svc.report(new Error('ResizeObserver loop completed with undelivered notifications.'))).toBeNull();
    expect(svc.report(new ApiError('Phiên đăng nhập đã hết hạn.', 401, 'session'))).toBeNull();
    expect(svc.current()).toBeNull();
  });

  it('HttpErrorResponse chưa qua ApiService cũng được phân loại; cùng một lỗi lặp liên tục chỉ hiện một thông báo', () => {
    const svc = new ErrorNoticeService();
    const err = new HttpErrorResponse({ status: 500, error: { statusCode: 500, message: 'Internal server error' }, headers: new HttpHeaders({ 'X-Request-Id': 'req-87654321' }) });
    svc.report(err);
    expect(svc.current()?.code).toBe('req-87654321');
    svc.dismiss();
    svc.report(err); // trong 5 giây: không bật lại
    expect(svc.current()).toBeNull();
  });
});
