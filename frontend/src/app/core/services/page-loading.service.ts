import { Injectable, signal } from '@angular/core';

/** Quick pages never flash the veil: it appears only if the page is still loading after this long. */
const SHOW_AFTER_MS = 150;
/** Once shown it stays at least this long, so a load that ends right after it appeared does not blink. */
const MIN_VISIBLE_MS = 350;
/** After a page opens, the reads it starts on its own (ngOnInit) count as the page loading for this long. */
const PAGE_WINDOW_MS = 700;
/** Never hold the page hostage: a read that hangs releases the veil after this long. */
const GIVE_UP_MS = 20_000;

/**
 * "Đang tải trang": the full-page spinner. A page is loading from the moment a navigation starts until it has opened AND
 * the GET calls it made while opening (within PAGE_WINDOW_MS) have answered. Reads started later — a refresh, a filter, a
 * poll, a button — are not the page loading and never raise the veil (page-loading.interceptor.ts decides which count).
 */
@Injectable({ providedIn: 'root' })
export class PageLoadingService {
  readonly visible = signal(false);

  private navigating = false;
  private pending = 0;
  private windowUntil = 0;
  private shownAt = 0;
  private showTimer: ReturnType<typeof setTimeout> | undefined;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private giveUpTimer: ReturnType<typeof setTimeout> | undefined;

  navigationStart(): void {
    this.navigating = true;
    this.sync();
  }

  navigationEnd(): void {
    this.navigating = false;
    this.windowUntil = Date.now() + PAGE_WINDOW_MS;
    this.sync();
  }

  /** A GET is starting: true when it is part of the page loading (the interceptor then calls requestEnd when it settles). */
  requestStart(): boolean {
    if (!this.navigating && Date.now() > this.windowUntil) return false;
    this.pending++;
    this.sync();
    return true;
  }

  requestEnd(): void {
    this.pending = Math.max(0, this.pending - 1);
    this.sync();
  }

  private busy(): boolean {
    return this.navigating || this.pending > 0;
  }

  private sync(): void {
    if (this.busy()) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
      if (!this.visible() && !this.showTimer) {
        this.showTimer = setTimeout(() => {
          this.showTimer = undefined;
          if (!this.busy()) return;
          this.shownAt = Date.now();
          this.visible.set(true);
          clearTimeout(this.giveUpTimer);
          this.giveUpTimer = setTimeout(() => this.release(), GIVE_UP_MS);
        }, SHOW_AFTER_MS);
      }
      return;
    }
    clearTimeout(this.showTimer);
    this.showTimer = undefined;
    if (!this.visible() || this.hideTimer) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - this.shownAt));
    this.hideTimer = setTimeout(() => this.release(), wait);
  }

  private release(): void {
    clearTimeout(this.giveUpTimer);
    clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    this.pending = 0;
    this.navigating = false;
    this.visible.set(false);
  }
}
