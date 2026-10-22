import { Injectable, signal } from '@angular/core';

// Open state of the global "Tìm hoặc tạo nhanh" palette (Ctrl K). The topbar button and the
// keyboard shortcut both go through here; the palette component in the shell reacts to it.
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  readonly isOpen = signal(false);

  show(): void {
    this.isOpen.set(true);
  }

  hide(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
  }
}
