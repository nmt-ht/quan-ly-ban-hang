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
