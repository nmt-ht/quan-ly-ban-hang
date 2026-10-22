import { Component, HostListener, ViewEncapsulation, computed, inject, input, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { MockDataService } from '../../core/services/mock-data.service';
import { CompanyLetterheadComponent } from '../company-letterhead/company-letterhead.component';
import { formatDay } from '../period';

export interface PrintSigner {
  role: string;
  hint?: string; // default "(Ký, họ tên)"
  name?: string; // printed under the signature space (e.g. the person who made the document)
}

// The paper every printout is made of: letterhead + document number, centred title, content slot,
// signature block, footer with who printed and when. Styles: shared/print/print.scss (global, print only).
//   <app-print-document title="PHIẾU XUẤT KHO" [no]="v.code" [date]="v.date" [signers]="[...]">
//     <dl pdMeta class="pd-meta">…</dl>      ← optional information block under the title
//     <table class="pd-table">…</table>       ← body (any content)
//   </app-print-document>
@Component({
  selector: 'app-print-document',
  standalone: true,
  imports: [CompanyLetterheadComponent],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'print-only' },
  template: `
    <article class="pd" [class.pd-break]="pageBreak()" [class.pd-landscape]="landscape()">
      <header class="pd-head">
        <app-company-letterhead class="pd-brand" />
        <div class="pd-ref">
          @if (no()) {
            <div>Số: <strong class="num">{{ no() }}</strong></div>
          }
          @if (status()) {
            <div class="pd-stamp">{{ status() }}</div>
          }
        </div>
      </header>

      <div class="pd-titlebar">
        <h1 class="pd-title">{{ title() }}</h1>
        @if (sub()) {
          <p class="pd-sub">{{ sub() }}</p>
        }
        @if (dateText()) {
          <p class="pd-date">{{ dateText() }}</p>
        }
      </div>

      <ng-content select="[pdMeta]" />
      <ng-content />

      @if (signers().length) {
        <div class="pd-sign" [style.--cols]="signers().length">
          @for (s of signers(); track s.role) {
            <div>
              <strong>{{ s.role }}</strong>
              <span>{{ s.hint ?? '(Ký, họ tên)' }}</span>
              @if (s.name) {
                <span class="pd-signer">{{ s.name }}</span>
              }
            </div>
          }
        </div>
      }

      <footer class="pd-foot">
        <span>In lúc {{ printedAt() }} · {{ printedBy() }}</span>
        <span>{{ company().name }}</span>
      </footer>
    </article>
  `,
})
export class PrintDocumentComponent {
  private readonly auth = inject(AuthService);
  private readonly data = inject(MockDataService);

  readonly title = input.required<string>();
  readonly no = input<string | undefined>();
  /** ISO day: printed as "Ngày dd tháng mm năm yyyy" under the title. */
  readonly date = input<string | undefined>();
  /** Extra line under the title (period, "Tính đến ngày …"). */
  readonly sub = input<string | undefined>();
  /** Stamp next to the number, e.g. "ĐÃ HUỶ". */
  readonly status = input<string | undefined>();
  readonly signers = input<PrintSigner[]>([]);
  /** Break the page after this document (several documents printed in one go). */
  readonly pageBreak = input(false);
  /** Print this document on a landscape page (wide tables). */
  readonly landscape = input(false);

  readonly company = computed(() => this.data.companyInfo());
  readonly printedBy = computed(() => this.auth.user()?.name ?? '');
  private readonly now = signal(new Date());
  readonly printedAt = computed(() => this.now().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));

  /** The time on the paper is the time of printing, not of opening the page. */
  @HostListener('window:beforeprint')
  refreshPrintTime(): void {
    this.now.set(new Date());
  }

  readonly dateText = computed(() => {
    const d = this.date();
    if (!d) return '';
    const [y, m, day] = d.slice(0, 10).split('-');
    return `Ngày ${day} tháng ${m} năm ${y}`;
  });

  readonly day = formatDay;
}
