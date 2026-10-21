import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type NavIconName =
  | 'dashboard'
  | 'report'
  | 'product'
  | 'stock'
  | 'voucher'
  | 'factory'
  | 'supplier'
  | 'cart'
  | 'money-out'
  | 'customers'
  | 'receipt'
  | 'truck'
  | 'car'
  | 'money-in'
  | 'cash'
  | 'clock'
  | 'company'
  | 'tag'
  | 'user'
  | 'shield'
  | 'panel-close'
  | 'panel-open'
  | 'chevrons-updown'
  | 'search'
  | 'x'
  | 'download'
  | 'upload'
  | 'plus'
  | 'grid'
  | 'table'
  | 'eye'
  | 'pencil'
  | 'chevron-left'
  | 'chevron-right'
  | 'arrow-left'
  | 'copy'
  | 'check'
  | 'refresh'
  | 'trash'
  | 'key'
  | 'lock'
  | 'unlock'
  | 'image-plus'
  | 'star'
  | 'palette'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'log-out'
  | 'chevron-down'
  | 'calendar'
  | 'printer';

// Hand-drawn 24px line icons (stroke = currentColor) — one set for the whole app.
@Component({
  selector: 'app-nav-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (name) {
        @case ('dashboard') {
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        }
        @case ('report') {
          <path d="M3 3v18h18" />
          <path d="M7 15l4-4 3 3 5-6" />
        }
        @case ('product') {
          <path d="M21 7.5 12 3 3 7.5 12 12z" />
          <path d="M3 7.5v9L12 21l9-4.5v-9" />
          <path d="M12 12v9" />
        }
        @case ('stock') {
          <path d="M12 3l9 4.5-9 4.5-9-4.5z" />
          <path d="M3 12l9 4.5 9-4.5" />
          <path d="M3 16.5 12 21l9-4.5" />
        }
        @case ('voucher') {
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 2.5h6v3H9z" />
          <path d="M9 11h6M9 15h4" />
        }
        @case ('factory') {
          <path d="M3 21h18" />
          <path d="M4 21V11l5 3v-3l5 3V4h4.5L19 21" />
          <path d="M8 17.5h.01M12.5 17.5h.01" />
        }
        @case ('supplier') {
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <path d="M9 7.5h1M14 7.5h1M9 11.5h1M14 11.5h1" />
          <path d="M10 21v-4h4v4" />
        }
        @case ('cart') {
          <circle cx="9" cy="20" r="1.25" />
          <circle cx="18" cy="20" r="1.25" />
          <path d="M2.5 3.5h2.8l2.4 12h11.1l2-8.5H6.2" />
        }
        @case ('money-out') {
          <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" />
          <path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" />
        }
        @case ('customers') {
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20.5a6.5 6.5 0 0 1 13 0" />
          <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20.5a6.5 6.5 0 0 0-3.5-5.8" />
        }
        @case ('receipt') {
          <path d="M5 3h14v18l-2.5-1.6L14 21l-2-1.6L10 21l-2.5-1.6L5 21z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        }
        @case ('truck') {
          <path d="M2.5 6h11v10h-11z" />
          <path d="M13.5 9.5H18l3.5 3.5v3h-8" />
          <circle cx="6.5" cy="18" r="2" />
          <circle cx="17.5" cy="18" r="2" />
        }
        @case ('car') {
          <path d="M4 16.5V12l2-5h12l2 5v4.5" />
          <path d="M4 12h16M4 16.5h16" />
          <path d="M6 16.5V19M18 16.5V19" />
          <path d="M7.5 14.2h.01M16.5 14.2h.01" />
        }
        @case ('money-in') {
          <path d="M12 3.5V15M7.5 10.5 12 15l4.5-4.5" />
          <path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" />
        }
        @case ('cash') {
          <rect x="2.5" y="6" width="19" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 12h.01M18 12h.01" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        }
        @case ('company') {
          <path d="M3 21h18" />
          <path d="M5 21V8l7-4.5L19 8v13" />
          <path d="M9.5 21v-5h5v5" />
          <path d="M9.5 11h.01M14.5 11h.01" />
        }
        @case ('tag') {
          <path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9z" />
          <circle cx="7.5" cy="7.5" r="1.25" />
        }
        @case ('user') {
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        }
        @case ('shield') {
          <path d="M12 3l7.5 3v6c0 4.6-3.2 7.8-7.5 9-4.3-1.2-7.5-4.4-7.5-9V6z" />
          <path d="M9 12l2 2 4-4" />
        }
        @case ('panel-close') {
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
          <path d="M16 9.5 13.5 12l2.5 2.5" />
        }
        @case ('panel-open') {
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
          <path d="M13.5 9.5 16 12l-2.5 2.5" />
        }
        @case ('chevrons-updown') {
          <path d="M8 9.5 12 5.5l4 4" />
          <path d="M8 14.5l4 4 4-4" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4.4-4.4" />
        }
        @case ('x') {
          <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
        }
        @case ('download') {
          <path d="M12 3.5V15M7.5 10.5 12 15l4.5-4.5" />
          <path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" />
        }
        @case ('upload') {
          <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" />
          <path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('grid') {
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        }
        @case ('table') {
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9.5h18M9 9.5V20" />
        }
        @case ('eye') {
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.75" />
        }
        @case ('pencil') {
          <path d="M15.5 4.5l4 4L8.5 19.5H4.5v-4z" />
          <path d="M13 7l4 4" />
        }
        @case ('chevron-left') {
          <path d="M14.5 6l-6 6 6 6" />
        }
        @case ('chevron-right') {
          <path d="M9.5 6l6 6-6 6" />
        }
        @case ('arrow-left') {
          <path d="M19 12H5M11 6l-6 6 6 6" />
        }
        @case ('copy') {
          <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
          <path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
        }
        @case ('check') {
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        }
        @case ('refresh') {
          <path d="M20 11a8 8 0 0 0-14.3-4.6L4 8.5" />
          <path d="M4 4v4.5h4.5" />
          <path d="M4 13a8 8 0 0 0 14.3 4.6L20 15.5" />
          <path d="M20 20v-4.5h-4.5" />
        }
        @case ('image-plus') {
          <path d="M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
          <circle cx="9" cy="9.5" r="1.75" />
          <path d="M20 15.5l-4.5-4.5L5.5 20" />
          <path d="M18 2.5v6M15 5.5h6" />
        }
        @case ('palette') {
          <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7h2a4 4 0 0 0 4-4c0-4-3.8-7.2-8.5-7.2z" />
          <circle cx="7.5" cy="11" r="1" />
          <circle cx="10" cy="7" r="1" />
          <circle cx="14.5" cy="7" r="1" />
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        }
        @case ('moon') {
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        }
        @case ('monitor') {
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8.5 20h7M12 16v4" />
        }
        @case ('log-out') {
          <path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5" />
          <path d="M10 16.5 5.5 12 10 7.5M5.5 12h10" />
        }
        @case ('printer') {
          <path d="M7 8.5V3.5h10v5" />
          <rect x="3.5" y="8.5" width="17" height="8" rx="2" />
          <path d="M7 14h10v6.5H7z" />
        }
        @case ('calendar') {
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        }
        @case ('chevron-down') {
          <path d="M6 9.5l6 6 6-6" />
        }
        @case ('star') {
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
        }
        @case ('trash') {
          <path d="M4 6.5h16" />
          <path d="M9.5 6.5V4.5h5v2" />
          <path d="M6.5 6.5l1 13.5h9l1-13.5" />
          <path d="M10 10.5v6M14 10.5v6" />
        }
        @case ('key') {
          <circle cx="8" cy="15" r="4" />
          <path d="M11 12l8.5-8.5" />
          <path d="M16.5 7l2.5 2.5M14.5 9l2 2" />
        }
        @case ('lock') {
          <rect x="5" y="10.5" width="14" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        }
        @case ('unlock') {
          <rect x="5" y="10.5" width="14" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" />
        }
      }
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; width: var(--icon-size, 18px); height: var(--icon-size, 18px); }
    svg { width: 100%; height: 100%; }
  `],
})
export class NavIconComponent {
  @Input({ required: true }) name!: NavIconName;
}
