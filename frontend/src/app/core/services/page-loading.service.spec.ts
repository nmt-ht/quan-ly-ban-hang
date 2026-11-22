import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageLoadingService } from './page-loading.service';

describe('Màn xoay toàn trang (PageLoadingService)', () => {
  let loading: PageLoadingService;

  beforeEach(() => {
    vi.useFakeTimers();
    loading = new PageLoadingService();
  });

  afterEach(() => vi.useRealTimers());

  it('trang mở nhanh không bao giờ hiện màn xoay (chưa tới 150 ms)', () => {
    loading.navigationStart();
    vi.advanceTimersByTime(100);
    loading.navigationEnd();
    vi.advanceTimersByTime(1000);
    expect(loading.visible()).toBe(false);
  });

  it('chuyển trang chậm: hiện sau 150 ms, và ở lại ít nhất 350 ms rồi mới tắt', () => {
    loading.navigationStart();
    vi.advanceTimersByTime(149);
    expect(loading.visible()).toBe(false);
    vi.advanceTimersByTime(2);
    expect(loading.visible()).toBe(true);

    vi.advanceTimersByTime(50);
    loading.navigationEnd(); // trang mở xong sau khi màn vừa hiện 50 ms
    vi.advanceTimersByTime(290);
    expect(loading.visible()).toBe(true);
    vi.advanceTimersByTime(20);
    expect(loading.visible()).toBe(false);
  });

  it('các lần đọc dữ liệu trang gọi lúc mở giữ màn xoay đến khi có đủ câu trả lời', () => {
    loading.navigationStart();
    loading.navigationEnd();
    expect(loading.requestStart()).toBe(true);
    expect(loading.requestStart()).toBe(true);
    vi.advanceTimersByTime(200);
    expect(loading.visible()).toBe(true);

    loading.requestEnd();
    vi.advanceTimersByTime(1000);
    expect(loading.visible()).toBe(true); // còn một lần đọc chưa xong
    loading.requestEnd();
    vi.advanceTimersByTime(400);
    expect(loading.visible()).toBe(false);
  });

  it('lần đọc bắt đầu sau khi trang đã mở (làm mới, lọc, thăm dò) không phải là tải trang', () => {
    loading.navigationStart();
    loading.navigationEnd();
    vi.advanceTimersByTime(800); // hết cửa sổ mở trang
    expect(loading.requestStart()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(loading.visible()).toBe(false);
  });

  it('một lần đọc treo không giữ trang mãi: nhả sau 20 giây', () => {
    loading.navigationStart();
    loading.navigationEnd();
    loading.requestStart(); // không bao giờ trả lời
    vi.advanceTimersByTime(1000);
    expect(loading.visible()).toBe(true);
    vi.advanceTimersByTime(20_000);
    expect(loading.visible()).toBe(false);
  });
});
