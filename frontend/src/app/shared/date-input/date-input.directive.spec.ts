import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DateInputDirective } from './date-input.directive';

@Component({
  standalone: true,
  imports: [FormsModule, DateInputDirective],
  template: `<input appDate [(ngModel)]="value" />`,
})
class HostComponent {
  value = '2026-11-16';
}

describe('ô nhập ngày (appDate)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let input: HTMLInputElement;

  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  };
  const key = (k: string) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    input.dispatchEvent(e);
    return e;
  };
  const panel = () => document.querySelector('app-date-panel');

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    input = fixture.nativeElement.querySelector('input');
  });

  afterEach(() => fixture.destroy());

  it('hiện ngày dd/mm/yyyy, gõ đủ ngày thì đổi giá trị, xoá trắng thì rỗng', () => {
    expect(input.value).toBe('16/11/2026');
    type('05/12/2026');
    expect(fixture.componentInstance.value).toBe('2026-12-05');
    type('');
    expect(fixture.componentInstance.value).toBe('');
  });

  it('ngày gõ dở không đổi giá trị; rời ô thì quay về ngày cũ', () => {
    type('16/11/202');
    expect(fixture.componentInstance.value).toBe('2026-11-16');
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('16/11/2026');
  });

  it('Esc chỉ đóng lịch, không lan ra hộp thoại chứa ô nhập', () => {
    const outer = vi.fn();
    fixture.nativeElement.addEventListener('keydown', outer);
    input.click();
    expect(panel()).not.toBeNull();
    const e = key('Escape');
    expect(e.defaultPrevented).toBe(true);
    expect(outer).not.toHaveBeenCalled();
    expect(panel()).toBeNull();
  });

  it('← / → sửa chữ cho tới khi dùng phím trên lịch; ↓ dời một tuần, Enter chọn', () => {
    input.click();
    expect(key('ArrowLeft').defaultPrevented).toBe(false);
    key('ArrowDown');
    key('ArrowLeft');
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-2026-11-22$/);
    key('Enter');
    expect(fixture.componentInstance.value).toBe('2026-11-22');
    expect(input.value).toBe('22/11/2026');
    expect(panel()).toBeNull();
  });

  it('nút tháng sau dời luôn ngày đang trỏ', () => {
    input.click();
    (panel()!.querySelector('[aria-label="Tháng sau"]') as HTMLButtonElement).click();
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-2026-12-16$/);
  });

  it('rời ô thì lịch đóng', () => {
    input.click();
    input.dispatchEvent(new Event('blur'));
    expect(panel()).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
});
