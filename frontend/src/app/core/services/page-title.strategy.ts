import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { NAV_GROUPS } from '../../layout/nav-items';
import { BrandService } from './brand.service';

/**
 * Tab title per page: "Hàng hoá · Ninh Trang". Uses the sidebar label of the closest menu link; the name after
 * the dot is the company's (BrandService), so renaming the company retitles the open tab too.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly brand = inject(BrandService);
  private readonly page = signal('');
  /** Quản trị nền tảng belongs to no company: its tab carries no company name. */
  private readonly bare = signal(false);

  constructor() {
    super();
    effect(() => {
      const page = this.page();
      if (this.bare()) this.title.setTitle(page);
      else this.title.setTitle(page ? `${page} · ${this.brand.name()}` : this.brand.name());
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.bare.set(snapshot.url.startsWith('/quan-tri-nen-tang'));
    this.page.set(this.buildTitle(snapshot) ?? this.fromMenu(snapshot.url));
  }

  private fromMenu(url: string): string {
    const path = url.split(/[?#]/)[0];
    if (path === '/login') return 'Đăng nhập';
    let best: { label: string; len: number } | null = null;
    for (const group of NAV_GROUPS) {
      for (const link of group.links) {
        const hit = path === link.path || path.startsWith(link.path + '/');
        if (hit && (!best || link.path.length > best.len)) best = { label: link.label, len: link.path.length };
      }
    }
    return best?.label ?? '';
  }
}
