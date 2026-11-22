import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { ApiError, describeHttpError, errorText } from './api.service';

const http = (status: number, error: unknown = null, requestId?: string) =>
  describeHttpError(new HttpErrorResponse({ status, error, headers: requestId ? new HttpHeaders({ 'X-Request-Id': requestId }) : undefined }));

describe('Thông báo lỗi cho người dùng (describeHttpError)', () => {
  it('lỗi nghiệp vụ / nhập liệu: giữ nguyên câu của máy chủ (nó nói rõ ô hoặc quy tắc nào)', () => {
    const a = http(400, { statusCode: 400, message: 'Số lượng trả vượt số đã nhận.' });
    expect(a).toMatchObject({ status: 400, kind: 'business', message: 'Số lượng trả vượt số đã nhận.' });
    expect(http(400, { statusCode: 400, message: ['Ngày phải có dạng YYYY-MM-DD', 'Nhập lý do'] }).message).toBe('Ngày phải có dạng YYYY-MM-DD. Nhập lý do');
    expect(http(409, { statusCode: 409, message: 'Dữ liệu bị trùng (code).' }).message).toBe('Dữ liệu bị trùng (code).');
  });

  it('câu tiếng Anh mặc định của Nest không bao giờ hiện ra: thay bằng hướng dẫn tiếng Việt', () => {
    expect(http(400, { statusCode: 400, message: 'Bad Request' }).message).toContain('Kiểm tra lại các ô đã nhập');
    expect(http(404, { statusCode: 404, message: 'Not Found' }).message).toContain('Tải lại trang');
    expect(http(429, { statusCode: 429, message: 'ThrottlerException: Too Many Requests' }).message).toContain('Đợi vài phút');
    expect(http(413, { statusCode: 413, message: 'Payload Too Large' }).message).toContain('quá lớn');
  });

  it('thiếu quyền: nói rõ và bảo nhờ quản trị viên', () => {
    const a = http(403, { statusCode: 403, message: 'Chức vụ của bạn chưa có quyền: order.return' });
    expect(a.kind).toBe('permission');
    expect(a.message).toContain('chưa có quyền: order.return');
    expect(a.message).toContain('quản trị viên');
    expect(http(403, { statusCode: 403, message: 'Forbidden resource' }).message).toContain('Vai trò của bạn chưa có quyền');
  });

  it('đăng nhập sai có câu riêng; 401 trơn nghĩa là phiên hết hạn', () => {
    expect(http(401, { statusCode: 401, message: 'Sai email hoặc mật khẩu.' })).toMatchObject({ kind: 'business', message: 'Sai email hoặc mật khẩu.' });
    expect(http(401, { statusCode: 401, message: 'Unauthorized' })).toMatchObject({ kind: 'session' });
  });

  it('lỗi hệ thống (5xx): nói không phải do người dùng, bảo báo IT, kèm mã yêu cầu và thời điểm', () => {
    const a = http(500, { statusCode: 500, message: 'Lỗi hệ thống, chưa xử lý được yêu cầu.', requestId: 'body-id' }, 'abcd1234-5678');
    expect(a).toMatchObject({ kind: 'system', status: 500, requestId: 'abcd1234-5678' });
    expect(a.message).toContain('báo bộ phận IT kiểm tra');
    expect(a.message).toContain('Mã lỗi: abcd1234-5678.');
    expect(a.message).toContain('Thời điểm:');
    expect(a.message).not.toContain('Internal');
    // Máy chủ chưa gửi header: lấy mã trong thân câu trả lời.
    expect(http(500, { statusCode: 500, message: 'Internal server error', requestId: 'body-id' }).requestId).toBe('body-id');
  });

  it('lỗi 5xx có câu riêng của máy chủ: giữ câu đó và vẫn bảo báo IT', () => {
    const a = http(503, { statusCode: 503, message: 'Máy chủ này chưa cài pg_dump nên không xuất trực tiếp được.' }, 'req-12345678');
    expect(a.kind).toBe('system');
    expect(a.message).toContain('chưa cài pg_dump');
    expect(a.message).toContain('Đây là lỗi hệ thống');
    expect(a.message).toContain('req-12345678');
  });

  it('không tới được máy chủ (mạng, hoặc cổng trả trang riêng): hướng dẫn kiểm tra mạng rồi mới báo IT', () => {
    for (const a of [http(0), http(502, '<html>Bad Gateway</html>'), http(504, null)]) {
      expect(a.kind).toBe('network');
      expect(a.message).toContain('Kiểm tra mạng');
      expect(a.message).toContain('báo bộ phận IT');
    }
  });

  it('máy chủ trả 503 gọn (đang khởi động lại): bảo chờ một phút', () => {
    const a = http(503, { statusCode: 503, message: 'Service Unavailable' }, 'req-12345678');
    expect(a.message).toContain('khởi động lại');
    expect(a.message).toContain('Chờ khoảng một phút');
  });

  it('errorText: ApiError thì lấy câu của nó, thứ khác thì câu chung bảo tải lại và báo IT', () => {
    expect(errorText(new ApiError('Câu sẵn có', 400))).toBe('Câu sẵn có');
    expect(errorText('hỏng')).toContain('báo bộ phận IT');
  });
});
