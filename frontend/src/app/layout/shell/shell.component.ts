import { Component, HostListener, computed, inject, signal } from '@angular/core';
import {
  NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { NAV_GROUPS, NavGroup, menuEntryOf } from '../nav-items';
import { PageLoadingService } from '../../core/services/page-loading.service';
import { NavIconComponent } from '../nav-icon/nav-icon.component';
import { AccountMenuComponent } from '../account-menu/account-menu.component';
import { AlertsBellComponent } from '../alerts-bell/alerts-bell.component';
import { CommandPaletteComponent } from '../command-palette/command-palette.component';
import { CommandPaletteService } from '../../core/services/command-palette.service';
import { AuthService } from '../../core/services/auth.service';
import { CatalogLoader } from '../../core/api/catalog-loader.service';
import { BrandService } from '../../core/services/brand.service';
import { APP_VERSION } from '../../version';

const CLOSED_KEY = 'nt.navClosed';

function loadClosed(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CLOSED_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterOutlet, NavIconComponent, AccountMenuComponent, AlertsBellComponent, CommandPaletteComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly palette = inject(CommandPaletteService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  /** Company name, logo and tab icon from Thông tin công ty (the NT monogram stands in until a logo exists). */
  readonly brand = inject(BrandService);
  readonly catalog = inject(CatalogLoader);
  /** Only the pages the role may open; a group with none left disappears. */
  readonly navGroups = computed<NavGroup[]>(() =>
    NAV_GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => this.auth.canVisit(l.path)) })).filter((g) => g.links.length),
  );
  readonly homeUrl = computed(() => this.auth.homeUrl());
  /** Running version under the name (package.json, via scripts/write-version.mjs). */
  readonly versionLabel = `v${APP_VERSION}`;
  readonly collapsed = signal(false);
  readonly menuOpen = signal(false);
  /** Labels of the sub menus the user folded; remembered per browser. */
  readonly closedGroups = signal<string[]>(loadClosed());
  /** The one menu link the page belongs to (longest matching path): "Tổng quan kế toán" (/ke-toan) must not light up on /ke-toan/so-chi-tiet. */
  readonly activePath = signal<string | null>(menuEntryOf(this.router.url)?.link.path ?? null);
  /** Màn xoay toàn trang khi chuyển trang và khi trang đang đọc dữ liệu lúc mở (PageLoadingService). */
  readonly pageLoading = inject(PageLoadingService);

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) this.pageLoading.navigationStart();
      else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) this.pageLoading.navigationEnd();
    });
    // Landing on a page inside a folded group (link, search, back button) unfolds it.
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      this.activePath.set(menuEntryOf(e.urlAfterRedirects)?.link.path ?? null);
      const g = this.navGroups().find((x) => x.label && x.links.some((l) => e.urlAfterRedirects === l.path || e.urlAfterRedirects.startsWith(l.path + '/') || e.urlAfterRedirects.startsWith(l.path + '?')));
      if (g?.label && this.closedGroups().includes(g.label)) this.setClosed(this.closedGroups().filter((x) => x !== g.label));
    });
  }

  /** The icon rail has no group headings, so every link shows there. */
  isOpen(group: NavGroup): boolean {
    return !group.label || this.collapsed() || !this.closedGroups().includes(group.label);
  }

  toggleGroup(group: NavGroup): void {
    if (!group.label) return;
    const label = group.label;
    this.setClosed(this.closedGroups().includes(label) ? this.closedGroups().filter((x) => x !== label) : [...this.closedGroups(), label]);
  }

  private setClosed(list: string[]): void {
    this.closedGroups.set(list);
    try {
      localStorage.setItem(CLOSED_KEY, JSON.stringify(list));
    } catch {
      /* private mode: folding still works for this visit */
    }
  }

  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  @HostListener('document:keydown.escape')
  closeMenu(): void {
    this.menuOpen.set(false);
  }
}
