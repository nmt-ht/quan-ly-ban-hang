import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { NAV_GROUPS } from '../../layout/nav-items';

const APP_NAME = 'Ninh Trang';

/** Tab title per page: "Hàng hoá · Ninh Trang". Uses the sidebar label of the closest menu link. */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const explicit = this.buildTitle(snapshot);
    this.title.setTitle(explicit ? `${explicit} · ${APP_NAME}` : this.fromMenu(snapshot.url));
  }

  private fromMenu(url: string): string {
    const path = url.split(/[?#]/)[0];
    if (path === '/login') return `Đăng nhập · ${APP_NAME}`;
    let best: { label: string; len: number } | null = null;
    for (const group of NAV_GROUPS) {
      for (const link of group.links) {
        const hit = path === link.path || path.startsWith(link.path + '/');
        if (hit && (!best || link.path.length > best.len)) best = { label: link.label, len: link.path.length };
      }
    }
    return best ? `${best.label} · ${APP_NAME}` : APP_NAME;
  }
}
