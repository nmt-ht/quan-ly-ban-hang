import { ApplicationRef, ComponentRef, Directive, ElementRef, EnvironmentInjector, HostListener, Input, OnDestroy, createComponent, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DatePanelComponent } from './date-panel.component';
import { dmyToIso, isoToDmy, maskDmy } from './date-utils';

/**
 * Ô nhập ngày dd/mm/yyyy (tiếng Việt) thay cho <input type="date"> của trình duyệt, vốn hiện theo ngôn ngữ của trình duyệt
 * (tháng/ngày/năm, lịch tiếng Anh). Gõ số là tự chèn "/", hoặc bấm vào ô để chọn trên lịch. Giá trị của form luôn là "YYYY-MM-DD"
 * (rỗng khi chưa nhập đủ ngày có thật), như input date. `min` / `max` (YYYY-MM-DD) chỉ làm mờ ngày không chọn được trên lịch;
 * kiểm tra khoảng ngày vẫn do từng màn hình làm như trước.
 * Dùng: <input appDate [(ngModel)]="..." [max]="today" />
 */
@Directive({
  selector: 'input[appDate]',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInputDirective), multi: true }],
  host: { type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: '10', '[attr.placeholder]': 'placeholder || "dd/mm/yyyy"', class: 'date-input' },
})
export class DateInputDirective implements ControlValueAccessor, OnDestroy {
  @Input() min: string | null | undefined = '';
  @Input() max: string | null | undefined = '';
  @Input() placeholder = '';

  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};
  /** Giá trị hợp lệ gần nhất ("YYYY-MM-DD" hoặc ""): ô quay về đây khi rời ô mà ngày gõ dở. */
  private iso = '';
  private panel?: ComponentRef<DatePanelComponent>;
  private lastLength = 0;
  private offOutside?: () => void;

  writeValue(v: string | null): void {
    this.iso = typeof v === 'string' ? v.slice(0, 10) : '';
    this.el.nativeElement.value = isoToDmy(this.iso);
    this.lastLength = this.el.nativeElement.value.length;
    this.syncPanel();
  }

  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.el.nativeElement.disabled = disabled; if (disabled) this.close(); }

  @HostListener('input')
  onInput(): void {
    const input = this.el.nativeElement;
    const masked = maskDmy(input.value, input.value.length >= this.lastLength);
    if (masked !== input.value) input.value = masked;
    this.lastLength = masked.length;
    const next = dmyToIso(masked) ?? '';
    if (next !== this.iso) { this.iso = next; this.onChange(next); }
    this.syncPanel();
  }

  @HostListener('click')
  @HostListener('keydown.arrowDown')
  open(): void {
    if (this.panel || this.el.nativeElement.disabled || this.el.nativeElement.readOnly) return;
    const ref = createComponent(DatePanelComponent, { environmentInjector: this.injector });
    this.appRef.attachView(ref.hostView);
    const host = ref.location.nativeElement as HTMLElement;
    host.style.position = 'fixed';
    host.style.zIndex = '1000';
    // Trong hộp thoại (<dialog> mở bằng showModal) phải gắn vào chính hộp thoại, nếu không lịch nằm dưới lớp phủ của nó.
    (this.el.nativeElement.closest('dialog') ?? document.body).appendChild(host);
    ref.instance.pick.subscribe((iso) => this.choose(iso));
    this.panel = ref;
    this.syncPanel();
    this.place();
    const outside = (e: Event) => {
      const t = e.target as Node;
      if (!host.contains(t) && t !== this.el.nativeElement) this.close();
    };
    document.addEventListener('mousedown', outside, true);
    window.addEventListener('resize', this.close);
    window.addEventListener('scroll', this.close, true);
    this.offOutside = () => {
      document.removeEventListener('mousedown', outside, true);
      window.removeEventListener('resize', this.close);
      window.removeEventListener('scroll', this.close, true);
    };
  }

  @HostListener('keydown.escape')
  @HostListener('keydown.tab')
  onEscape(): void { this.close(); }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
    // Ngày gõ dở hoặc không có thật: quay về ngày hợp lệ gần nhất thay vì để chữ lạ trong ô.
    const shown = this.el.nativeElement.value;
    if (shown && dmyToIso(shown) === null) {
      this.el.nativeElement.value = isoToDmy(this.iso);
      this.lastLength = this.el.nativeElement.value.length;
    } else if (!shown && this.iso) {
      this.iso = '';
    }
  }

  private choose(iso: string): void {
    this.iso = iso;
    this.el.nativeElement.value = isoToDmy(iso);
    this.lastLength = this.el.nativeElement.value.length;
    this.onChange(iso);
    this.close();
    this.el.nativeElement.focus();
  }

  private syncPanel(): void {
    if (!this.panel) return;
    this.panel.setInput('selected', this.iso);
    this.panel.setInput('min', this.min ?? '');
    this.panel.setInput('max', this.max ?? '');
  }

  /** Dưới ô nhập; không đủ chỗ thì ở trên. */
  private place(): void {
    if (!this.panel) return;
    const host = this.panel.location.nativeElement as HTMLElement;
    const r = this.el.nativeElement.getBoundingClientRect();
    const h = host.offsetHeight || 320;
    const below = window.innerHeight - r.bottom;
    host.style.top = `${below >= h + 8 || r.top < h + 8 ? r.bottom + 4 : r.top - h - 4}px`;
    host.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - host.offsetWidth - 8))}px`;
  }

  private readonly close = (): void => {
    this.offOutside?.();
    this.offOutside = undefined;
    if (this.panel) {
      this.appRef.detachView(this.panel.hostView);
      this.panel.destroy();
      this.panel = undefined;
    }
  };

  ngOnDestroy(): void { this.close(); }
}
