import { ApplicationRef, ComponentRef, Directive, ElementRef, EnvironmentInjector, HostListener, Input, OnChanges, OnDestroy, createComponent, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DatePanelComponent } from './date-panel.component';
import { dmyToIso, isoToDmy, maskDmy } from './date-utils';

let nextId = 0;

/**
 * Ô nhập ngày dd/mm/yyyy (tiếng Việt) thay cho <input type="date"> của trình duyệt, vốn hiện theo ngôn ngữ của trình duyệt
 * (tháng/ngày/năm, lịch tiếng Anh). Gõ số là tự chèn "/", hoặc bấm vào ô (hay phím ↓) để chọn trên lịch; khi lịch mở, phím mũi tên /
 * PageUp / PageDown dời ngày, Enter chọn, Esc đóng. Giá trị của form luôn là "YYYY-MM-DD" (rỗng khi xoá trắng ô), như input date;
 * ngày gõ dở không đổi giá trị, rời ô thì ô quay về ngày hợp lệ gần nhất. `min` / `max` (YYYY-MM-DD) chỉ làm mờ ngày không chọn được
 * trên lịch; kiểm tra khoảng ngày vẫn do từng màn hình làm như trước.
 * Dùng: <input appDate [(ngModel)]="..." [max]="today" />
 */
@Directive({
  selector: 'input[appDate]',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInputDirective), multi: true }],
  host: {
    type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: '10', class: 'date-input',
    role: 'combobox', 'aria-haspopup': 'grid', 'aria-expanded': 'false', '[attr.placeholder]': 'placeholder || "dd/mm/yyyy"',
  },
})
export class DateInputDirective implements ControlValueAccessor, OnChanges, OnDestroy {
  @Input() min: string | null | undefined = '';
  @Input() max: string | null | undefined = '';
  @Input() placeholder = '';

  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly panelId = `date-panel-${nextId++}`;
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};
  /** Giá trị hợp lệ gần nhất ("YYYY-MM-DD" hoặc ""): ô quay về đây khi rời ô mà ngày gõ dở. */
  private iso = '';
  private panel?: ComponentRef<DatePanelComponent>;
  private lastLength = 0;
  private offListeners?: () => void;

  ngOnChanges(): void { this.syncPanel(); }

  writeValue(v: string | null): void {
    this.iso = typeof v === 'string' ? v.slice(0, 10) : '';
    this.show(this.iso);
    this.syncPanel();
    if (this.iso && this.panel) { this.panel.instance.focusDay(this.iso); this.markActive(); }
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
    // Chỉ đổi giá trị khi đã gõ đủ một ngày có thật, hoặc xoá trắng ô; ngày gõ dở giữ nguyên giá trị cũ.
    const next = masked ? dmyToIso(masked) : '';
    if (next === null || next === this.iso) return;
    this.iso = next;
    this.onChange(next);
    this.syncPanel();
    if (next && this.panel) { this.panel.instance.focusDay(next); this.markActive(); }
  }

  @HostListener('click')
  open(): void {
    if (this.panel || this.el.nativeElement.disabled || this.el.nativeElement.readOnly) return;
    const ref = createComponent(DatePanelComponent, { environmentInjector: this.injector });
    this.appRef.attachView(ref.hostView);
    const host = ref.location.nativeElement as HTMLElement;
    host.id = this.panelId;
    host.style.position = 'fixed';
    host.style.zIndex = '1000';
    // Trong hộp thoại (<dialog> mở bằng showModal) phải gắn vào chính hộp thoại, nếu không lịch nằm dưới lớp phủ của nó.
    (this.el.nativeElement.closest('dialog') ?? document.body).appendChild(host);
    ref.instance.pick.subscribe((iso) => this.choose(iso));
    ref.setInput('idPrefix', this.panelId);
    this.panel = ref;
    this.syncPanel();
    ref.instance.focusDay(this.iso || ref.instance.today);
    // Vẽ lịch ngay để đo đúng chiều cao trước khi đặt vị trí (lật lên trên khi bên dưới không đủ chỗ).
    ref.changeDetectorRef.detectChanges();
    this.place();
    this.setExpanded(true);
    this.markActive();

    const outside = (e: Event) => {
      const t = e.target as Node;
      if (!host.contains(t) && t !== this.el.nativeElement) this.close();
    };
    // Cuộn trang hay đổi cỡ cửa sổ (kể cả khi bàn phím điện thoại bật lên) thì lịch đi theo ô nhập, không đóng.
    document.addEventListener('mousedown', outside, true);
    window.addEventListener('resize', this.place);
    window.addEventListener('scroll', this.place, true);
    this.offListeners = () => {
      document.removeEventListener('mousedown', outside, true);
      window.removeEventListener('resize', this.place);
      window.removeEventListener('scroll', this.place, true);
    };
  }

  @HostListener('keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    const panel = this.panel?.instance;
    if (!panel) {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.open(); }
      else if (e.key === 'Enter') this.revertIfPartial(); // giá trị gửi đi khớp với chữ trong ô
      return;
    }
    const moves: Record<string, () => void> = {
      ArrowLeft: () => panel.moveDays(-1),
      ArrowRight: () => panel.moveDays(1),
      ArrowUp: () => panel.moveDays(-7),
      ArrowDown: () => panel.moveDays(7),
      PageUp: () => panel.moveMonths(-1),
      PageDown: () => panel.moveMonths(1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      moves[e.key]();
      this.markActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!panel.blocked(panel.active())) this.choose(panel.active());
    } else if (e.key === 'Escape') {
      // Không để Esc đóng luôn hộp thoại chứa ô nhập: Esc lần này chỉ đóng lịch.
      e.preventDefault();
      e.stopPropagation();
      this.close();
    } else if (e.key === 'Tab') {
      this.close();
    }
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
    this.revertIfPartial();
  }

  /** Ngày gõ dở hoặc không có thật: quay về ngày hợp lệ gần nhất thay vì để chữ lạ trong ô. */
  private revertIfPartial(): void {
    const shown = this.el.nativeElement.value;
    if (shown && dmyToIso(shown) === null) this.show(this.iso);
  }

  private show(iso: string): void {
    this.el.nativeElement.value = isoToDmy(iso);
    this.lastLength = this.el.nativeElement.value.length;
  }

  private choose(iso: string): void {
    this.iso = iso;
    this.show(iso);
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

  /** Dưới ô nhập; không đủ chỗ thì ở trên. Ô nhập bị cuộn khuất hẳn thì đóng lịch. */  private readonly place = (): void => {
    if (!this.panel) return;
    const host = this.panel.location.nativeElement as HTMLElement;
    const r = this.el.nativeElement.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) { this.close(); return; }
    const h = host.offsetHeight;
    const below = window.innerHeight - r.bottom;
    // Bên nào đủ chỗ thì đặt bên đó (ưu tiên bên dưới); cả hai không đủ thì chọn bên rộng hơn và giữ lịch trong màn hình.
    const top = below >= h + 8 || below >= r.top ? r.bottom + 4 : r.top - h - 4;
    host.style.top = `${Math.max(8, Math.min(top, window.innerHeight - h - 8))}px`;
    host.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - host.offsetWidth - 8))}px`;
  };

  /** Ô nhập trỏ tới ô ngày đang chọn bằng bàn phím, để trình đọc màn hình đọc ngày đó. */
  private markActive(): void {
    const panel = this.panel?.instance;
    if (panel) this.el.nativeElement.setAttribute('aria-activedescendant', panel.cellId(panel.active()));
  }

  private setExpanded(open: boolean): void {
    const input = this.el.nativeElement;
    input.setAttribute('aria-expanded', String(open));
    if (open) input.setAttribute('aria-controls', this.panelId);
    else { input.removeAttribute('aria-controls'); input.removeAttribute('aria-activedescendant'); }
  }

  private readonly close = (): void => {
    this.offListeners?.();
    this.offListeners = undefined;
    if (this.panel) {
      this.appRef.detachView(this.panel.hostView);
      this.panel.destroy();
      this.panel = undefined;
      this.setExpanded(false);
    }
  };

  ngOnDestroy(): void { this.close(); }
}
