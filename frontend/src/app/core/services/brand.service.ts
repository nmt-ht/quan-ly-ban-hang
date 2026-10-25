import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { CatalogLoader } from '../api/catalog-loader.service';
import { DataStore } from './data-store.service';
import { squareIcon, trimLogo } from '../../shared/company-letterhead/logo-image';

const FALLBACK = 'Ninh Trang';
const CACHE_KEY = 'nt.brand';

/** "Công ty TNHH MTV Ninh Trang" → "Ninh Trang": the legal form is left out of the sidebar and the tab. */
const LEGAL_FORM =
  /^(?:(?:công\s*ty|cty)\s+(?:(?:tnhh|cổ\s*phần|cp|trách\s+nhiệm\s+hữu\s+hạn)\s+)?(?:(?:mtv|một\s+thành\s+viên|hai\s+thành\s+viên(?:\s+trở\s+lên)?)\s+)?|(?:doanh\s+nghiệp\s+tư\s+nhân|dntn|hộ\s+kinh\s+doanh|hkd)\s+)/iu;

export function shortBrand(name: string): string {
  const full = name.trim().replace(/\s+/g, ' ');
  return full.replace(LEGAL_FORM, '').trim() || full || FALLBACK;
}

/** Initials of the first two words: "Ninh Trang" → "NT". */
export function monogram(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toLocaleUpperCase('vi')).join('') || 'NT';
}

interface Cached { fullName: string; icon: string | null }

function readCache(): Cached {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (raw && typeof raw.fullName === 'string') return { fullName: raw.fullName, icon: typeof raw.icon === 'string' ? raw.icon : null };
  } catch { /* storage blocked: fall back to the defaults */ }
  return { fullName: '', icon: null };
}

/**
 * The company as the app shows it — sidebar name and mark, browser tab title and icon — all from Thông tin công ty,
 * so saving a new name or logo changes them at once. The last brand is remembered per browser so the login page
 * and the first paint show it before the company is read.
 */
@Injectable({ providedIn: 'root' })
export class BrandService {
  private readonly data = inject(DataStore);
  private readonly catalog = inject(CatalogLoader);
  private readonly doc = inject(DOCUMENT);
  private readonly cached = readCache();

  /** Until the catalog is read, the company signal is still empty: keep the remembered brand meanwhile. */
  private readonly loaded = computed(() => this.catalog.status() === 'ready');
  readonly fullName = computed(() => (this.loaded() ? this.data.companyInfo().name.trim() : this.cached.fullName) || FALLBACK);
  readonly name = computed(() => shortBrand(this.fullName()));
  readonly monogram = computed(() => monogram(this.name()));
  /** The uploaded logo with its empty margin trimmed (null = none: the monogram stands in). */
  readonly logo = signal<string | null>(null);
  /** Square tab icon made from the logo; null = the monogram icon. */
  private readonly icon = signal<string | null>(this.cached.icon);

  constructor() {
    effect(() => {
      if (!this.loaded()) return;
      const src = this.data.companyInfo().logo || null;
      this.logo.set(src); // the logo as uploaded right away; the trimmed copy replaces it when ready
      if (!src) {
        this.icon.set(null);
        return;
      }
      void trimLogo(src).then(async (url) => {
        if ((this.data.companyInfo().logo || null) !== src) return;
        this.logo.set(url);
        this.icon.set(await squareIcon(url, this.token('--color-logo-tile')));
      });
    });

    effect(() => {
      const href = this.icon() ?? this.monogramIcon(this.monogram());
      let link = this.doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = this.doc.createElement('link');
        link.rel = 'icon';
        this.doc.head.appendChild(link);
      }
      link.type = href.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png';
      link.href = href;
    });

    effect(() => {
      if (!this.loaded()) return;
      try {
        // name / monogram: what the boot splash in index.html shows before the app has started.
        localStorage.setItem(CACHE_KEY, JSON.stringify({ fullName: this.fullName(), icon: this.icon(), name: this.name(), monogram: this.monogram() }));
      } catch { /* storage blocked: nothing to remember */ }
    });
  }

  private token(name: string): string {
    return getComputedStyle(this.doc.documentElement).getPropertyValue(name).trim();
  }

  /** The sidebar's monogram tile as an SVG icon, in the current theme's ink and paper. */
  private monogramIcon(text: string): string {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${this.token('--color-ink')}"/>` +
      `<text x="16" y="21" text-anchor="middle" font-family="monospace" font-size="13" font-weight="600" fill="${this.token('--color-surface')}">${text.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`)}</text></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
}
