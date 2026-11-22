import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchSelectComponent } from './search-select.component';

@Component({
  standalone: true,
  imports: [SearchSelectComponent],
  template: `<app-search-select [options]="options" [(value)]="value" [createLabel]="label()" (create)="made.push($event)" />`,
})
class HostComponent {
  options = [
    { value: 'a', code: 'KH001', label: 'Nguyễn Văn A' },
    { value: 'b', code: 'KH002', label: 'Trần Thị B' },
  ];
  value = signal('');
  label = signal('Thêm khách hàng mới');
  made: string[] = [];
}

describe('ô chọn có tìm kiếm — hàng "+ Thêm mới"', () => {
  let fixture: ComponentFixture<HostComponent>;
  const el = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
  const open = async () => {
    el('.pp-trigger')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const type = async (text: string) => {
    const input = el('.pp-search input') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const key = async (k: string) => {
    el('.pp-search input')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    // jsdom has no layout, so no scrollIntoView.
    Element.prototype.scrollIntoView = () => undefined;
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());

  it('có createLabel thì dưới danh sách hiện hàng thêm mới; bấm vào thì báo lên cha kèm chữ đã gõ và đóng bảng', async () => {
    await open();
    await type('  Lê Văn C ');
    const row = el('.ss-create')!;
    expect(row.textContent).toContain('Thêm khách hàng mới');
    expect(row.textContent).toContain('Lê Văn C');
    row.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.made).toEqual(['Lê Văn C']);
    expect(el('.pp-panel')).toBeNull();
    expect(fixture.componentInstance.value()).toBe('');
  });

  it('không có createLabel (không đủ quyền) thì không có hàng thêm mới', async () => {
    fixture.componentInstance.label.set('');
    fixture.detectChanges();
    await open();
    expect(el('.ss-create')).toBeNull();
  });

  it('bàn phím: mũi tên xuống qua hết các lựa chọn tới hàng thêm mới, Enter để thêm; không tìm thấy gì thì Enter cũng thêm', async () => {
    await open();
    await key('ArrowDown');
    await key('ArrowDown');
    expect(el('.ss-create')!.classList.contains('is-active')).toBe(true);
    await key('ArrowDown'); // đã ở hàng cuối
    expect(el('.ss-create')!.classList.contains('is-active')).toBe(true);
    await key('Enter');
    expect(fixture.componentInstance.made).toEqual(['']);

    await open();
    await type('không có ai tên này');
    expect(el('.pp-empty')).not.toBeNull();
    await key('ArrowDown');
    await key('Enter');
    expect(fixture.componentInstance.made).toEqual(['', 'không có ai tên này']);
  });

  it('Enter trên một lựa chọn vẫn là chọn, không phải thêm mới', async () => {
    await open();
    await key('Enter');
    expect(fixture.componentInstance.value()).toBe('a');
    expect(fixture.componentInstance.made).toEqual([]);
  });
});
