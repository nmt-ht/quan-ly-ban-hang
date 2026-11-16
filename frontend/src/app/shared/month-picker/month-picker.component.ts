/* Hallmark · component: month picker · genre: modern-minimal · design-system: design.md */
import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Chọn kỳ theo tháng, hoàn toàn bằng tiếng Việt ("Tháng 11" + năm). Thay cho <input type="month">, vì hộp chọn gốc của trình duyệt
 * hiện tên tháng, "This month", "Clear" theo ngôn ngữ của trình duyệt chứ không theo ngôn ngữ của trang.
 * Giá trị là "YYYY-MM" (cùng dạng với input month), rỗng thì dùng tháng hiện tại.
 */
@Component({
  selector: 'app-month-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <select [attr.id]="inputId() || null" [attr.aria-label]="ariaLabel() ? ariaLabel() + ' — tháng' : 'Tháng'" (change)="setMonth(+$any($event.target).value)">
      @for (m of months; track m) { <option [value]="m" [selected]="m === month()">Tháng {{ m }}</option> }
    </select>
    <select [attr.aria-label]="ariaLabel() ? ariaLabel() + ' — năm' : 'Năm'" (change)="setYear(+$any($event.target).value)">
      @for (y of years(); track y) { <option [value]="y" [selected]="y === year()">{{ y }}</option> }
    </select>
  `,
  styles: [`:host { display: inline-flex; align-items: center; gap: var(--space-2xs); }`],
})
export class MonthPickerComponent {
  readonly value = model<string>('');
  readonly inputId = input('');
  readonly ariaLabel = input('');
  readonly months = MONTHS;

  private readonly parts = computed(() => {
    const m = /^(\d{4})-(\d{2})$/.exec(this.value());
    const now = new Date();
    return { year: m ? Number(m[1]) : now.getFullYear(), month: m ? Number(m[2]) : now.getMonth() + 1 };
  });
  readonly year = computed(() => this.parts().year);
  readonly month = computed(() => this.parts().month);
  /** Năm chọn được: từ 6 năm trước đến 2 năm sau năm hiện tại, luôn có năm đang chọn. */
  readonly years = computed(() => {
    const now = new Date().getFullYear();
    const from = Math.min(now - 6, this.year());
    const to = Math.max(now + 2, this.year());
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });

  setMonth(m: number) { this.value.set(`${this.year()}-${String(m).padStart(2, '0')}`); }
  setYear(y: number) { this.value.set(`${y}-${String(this.month()).padStart(2, '0')}`); }
}
