import { Directive, ElementRef, HostListener, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const MAX_DIGITS = 15; // stays inside Number.MAX_SAFE_INTEGER

function group(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

// VND amount input: shows "1.250.000" while the form control holds 1250000.
// Usage: <input type="text" inputmode="numeric" appMoney formControlName="retailPrice" />
@Directive({
  selector: 'input[appMoney]',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MoneyInputDirective), multi: true }],
  host: { inputmode: 'numeric', autocomplete: 'off' },
})
export class MoneyInputDirective implements ControlValueAccessor {
  private onChange: (v: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly el: ElementRef<HTMLInputElement>) {}

  @HostListener('input')
  onInput(): void {
    const input = this.el.nativeElement;
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, '').length;

    const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITS);
    const value = digits ? Number(digits) : null;
    const text = value === null ? '' : group(value);
    input.value = text;

    // Put the caret back after the same number of digits it followed before formatting.
    let pos = 0;
    for (let seen = 0; pos < text.length && seen < digitsBeforeCaret; pos++) {
      if (/\d/.test(text[pos])) seen++;
    }
    input.setSelectionRange(pos, pos);
    this.onChange(value);
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }

  writeValue(v: number | string | null): void {
    const n = v === null || v === undefined || v === '' ? null : Number(v);
    this.el.nativeElement.value = n === null || Number.isNaN(n) ? '' : group(Math.round(n));
  }

  registerOnChange(fn: (v: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.el.nativeElement.disabled = disabled;
  }
}
