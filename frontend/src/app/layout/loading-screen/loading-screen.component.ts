import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CatalogLoader } from '../../core/api/catalog-loader.service';
import { BrandService } from '../../core/services/brand.service';

/** After this long a first load is slower than usual: say so, so nobody thinks the app froze. */
const SLOW_MS = 8000;

// Màn đang tải: while the danh mục of a fresh sign-in is read (CatalogLoader), before the shell opens. Same look as the
// boot splash in index.html, so the two hand over without a jump: brand mark → name → progress → the step being read.
@Component({
  selector: 'app-loading-screen',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ls" role="status" aria-live="polite" [attr.aria-busy]="true">
      <div class="ls-card">
        @if (brand.logo(); as logo) {
          <img class="ls-logo" [src]="logo" alt="" />
        } @else {
          <span class="ls-mark" aria-hidden="true">{{ brand.monogram() }}</span>
        }
        <p class="ls-name">{{ brand.name() }}</p>
        <p class="ls-lead">Đang chuẩn bị dữ liệu làm việc…</p>

        <div class="ls-bar" role="progressbar" aria-label="Tiến độ tải dữ liệu" aria-valuemin="0" [attr.aria-valuemax]="p().total" [attr.aria-valuenow]="p().done">
          <span [style.width.%]="pct()"></span>
        </div>
        <p class="ls-step">
          <span>Đang tải: {{ p().step }}</span>
          <span class="ls-count">{{ p().done }}/{{ p().total }}</span>
        </p>
        @if (slow()) {
          <p class="ls-slow">Kết nối chậm hơn thường lệ — vẫn đang tải, bạn chờ thêm chút nhé.</p>
        }
      </div>
    </div>
  `,
  styleUrl: './loading-screen.component.scss',
})
export class LoadingScreenComponent {
  readonly brand = inject(BrandService);
  private readonly catalog = inject(CatalogLoader);

  readonly p = this.catalog.progress;
  /** A sliver from the start so the bar never looks stuck at zero while the first request is out. */
  readonly pct = computed(() => Math.max(4, (this.p().done / this.p().total) * 100));
  readonly slow = signal(false);

  constructor() {
    const timer = setTimeout(() => this.slow.set(true), SLOW_MS);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
