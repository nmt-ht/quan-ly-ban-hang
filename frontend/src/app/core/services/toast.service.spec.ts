import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_MS, ToastService } from './toast.service';

describe('Thông báo tự ẩn (ToastService)', () => {
  let toast: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    toast = new ToastService();
  });

  afterEach(() => vi.useRealTimers());

  it('thông báo thành công tự ẩn sau 5 giây', () => {
    toast.success('Đã lưu hoá đơn HM0000022.');
    expect(toast.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(TOAST_MS.success - 1);
    expect(toast.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(toast.toasts()).toHaveLength(0);
  });

  it('thông báo lỗi ở lại 10 giây, lâu gấp đôi', () => {
    toast.error('Không lưu được.');
    vi.advanceTimersByTime(TOAST_MS.success + 100);
    expect(toast.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(TOAST_MS.error);
    expect(toast.toasts()).toHaveLength(0);
  });

  it('chữ rỗng không hiện gì (cách cũ xoá thông báo bằng notice.set(""))', () => {
    toast.success('');
    toast.error(undefined);
    expect(toast.toasts()).toHaveLength(0);
  });

  it('cùng một câu bấm hai lần liền chỉ hiện một thông báo', () => {
    toast.success('Đã lưu.');
    toast.success('Đã lưu.');
    expect(toast.toasts()).toHaveLength(1);
  });

  it('rê chuột hoặc dừng tiêu điểm vào thì đồng hồ dừng, rời ra thì chạy tiếp', () => {
    toast.success('Đã ghi nhận nhắc nợ.');
    const id = toast.toasts()[0].id;
    vi.advanceTimersByTime(4000);
    toast.pause(id);
    vi.advanceTimersByTime(60000);
    expect(toast.toasts()).toHaveLength(1);
    toast.resume(id);
    vi.advanceTimersByTime(900);
    expect(toast.toasts()).toHaveLength(1); // còn ít nhất 1 giây để đọc nốt
    vi.advanceTimersByTime(200);
    expect(toast.toasts()).toHaveLength(0);
  });

  it('đóng tay xoá ngay và không để lại đồng hồ chạy ngầm', () => {
    toast.success('Đã lưu.');
    toast.dismiss(toast.toasts()[0].id);
    expect(toast.toasts()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('chỉ giữ 4 thông báo cùng lúc, cái cũ nhất nhường chỗ', () => {
    for (let i = 1; i <= 6; i++) toast.success(`Việc ${i}`);
    expect(toast.toasts().map((t) => t.text)).toEqual(['Việc 3', 'Việc 4', 'Việc 5', 'Việc 6']);
  });
});
