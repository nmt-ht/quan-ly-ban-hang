import { Injectable, effect, signal } from '@angular/core';

export type Density = 'compact' | 'comfortable' | 'spacious';

export const DENSITIES: { value: Density; label: string; hint: string }[] = [
  { value: 'compact', label: 'Gọn', hint: 'Nhiều dòng trên một màn hình' },
  { value: 'comfortable', label: 'Vừa', hint: 'Chữ và ô nhập lớn hơn một bậc' },
  { value: 'spacious', label: 'Rộng', hint: 'Chữ lớn, dễ đọc, dễ bấm' },
];

const STORAGE_KEY = 'nt.density';

function load(): Density {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'compact' || v === 'comfortable' || v === 'spacious' ? v : 'compact';
  } catch {
    return 'compact';
  }
}

// Mật độ hiển thị: a personal preference like the theme. Sets body[data-density]; tokens.css maps
// each value to control height, row height and the text scale, so every screen follows.
@Injectable({ providedIn: 'root' })
export class DensityService {
  readonly mode = signal<Density>(load());

  constructor() {
    effect(() => {
      document.body.dataset['density'] = this.mode();
      try {
        localStorage.setItem(STORAGE_KEY, this.mode());
      } catch {
        /* storage blocked: the choice lasts for this session */
      }
    });
  }

  set(mode: Density): void {
    this.mode.set(mode);
  }
}
