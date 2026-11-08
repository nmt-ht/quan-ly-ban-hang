import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'nt.theme';

function load(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

// The tokens are OKLCH; browser chrome reads theme-color most reliably as #rrggbb, so paint one pixel and read it.
function toHex(color: string): string | null {
  if (!color) return null;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Giao diện sáng / tối / theo hệ thống. Applies body.dark-theme and remembers the choice
// per browser (a personal preference, unlike the company-wide tag colours).
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(load());
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media.matches);

  readonly isDark = computed(() => this.mode() === 'dark' || (this.mode() === 'system' && this.systemDark()));

  constructor() {
    this.media.addEventListener('change', (e) => this.systemDark.set(e.matches));
    effect(() => {
      document.body.classList.toggle('dark-theme', this.isDark());
      // Browser chrome (mobile address bar, PWA title bar) wears the page ground, so it follows the theme too.
      const paper = toHex(getComputedStyle(document.body).getPropertyValue('--color-paper').trim());
      if (paper) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
      try {
        localStorage.setItem(STORAGE_KEY, this.mode());
      } catch {
        /* storage blocked: the choice lasts for this session */
      }
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }
}
