import { Component, computed, inject, input } from '@angular/core';
import { CompanyInfo } from '../../core/models/domain.models';
import { DataStore } from '../../core/services/data-store.service';
import { companyContactRows } from './company-lines';

// Tiêu đề công ty ở đầu mọi bản in (phiếu kho, phiếu thu chi, chuyến giao hàng, công nợ, tuổi nợ):
// logo (nếu có) + tên công ty + các dòng có nhãn (Địa chỉ, Mã số thuế, Điện thoại, Email, Website).
// One component so every printout — and the live preview in Thiết lập › Thông tin công ty — shows
// the same thing in the same order. Pass [info] to preview a draft; omit it to use the saved company.
@Component({
  selector: 'app-company-letterhead',
  standalone: true,
  template: `
    @if (info().logo) {
      <img class="lh-logo" [src]="info().logo" alt="Logo công ty" />
    }
    <div class="lh-text">
      <strong class="lh-name">{{ info().name }}</strong>
      @for (row of rows(); track $index) {
        <div class="lh-row">
          @for (item of row; track item.label) {
            <span class="lh-item"><span class="lh-label">{{ item.label }}:</span> {{ item.value }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 0.875rem;
    }

    .lh-logo {
      flex-shrink: 0;
      max-width: 6rem;
      max-height: 3.5rem;
      object-fit: contain;
    }

    .lh-text {
      min-width: 0;
      line-height: 1.5;
    }

    .lh-name {
      display: block;
      margin-bottom: 0.125rem;
      font-size: 1.15em;
      letter-spacing: 0.01em;
      text-transform: uppercase;
    }

    .lh-row {
      display: flex;
      flex-wrap: wrap;
      column-gap: 1.25rem;
    }

    .lh-label {
      color: var(--color-muted);
    }
  `,
})
export class CompanyLetterheadComponent {
  private readonly data = inject(DataStore);

  readonly draft = input<CompanyInfo | null>(null, { alias: 'info' });
  readonly info = computed(() => this.draft() ?? this.data.companyInfo());
  readonly rows = computed(() => companyContactRows(this.info()));
}
