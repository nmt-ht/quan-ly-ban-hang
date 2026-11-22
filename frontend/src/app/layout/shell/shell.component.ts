import { Component, HostListener, computed, inject, signal } from '@angular/core';
import {
  NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { NAV_GROUPS, NavGroup, NavLink, menuEntryOf } from '../nav-items';
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

/** A run of links under one heading of a group (a group with no sections is one block without heading). */
export interface NavBlock {
  /** Folding key: the group's label, then "group/section". */
  key: string;
  label: string | null;
  links: NavLink[];
}
export interface NavTree extends NavGroup {
  blocks: NavBlock[];
}

/** Consecutive links with the same `section` become one block under that heading. */
function blocksOf(group: NavGroup): NavBlock[] {
  const out: NavBlock[] = [];
  for (const link of group.links) {
    const last = out.at(-1);
    if (last && (last.label ?? null) === (link.section ?? null)) last.links.push(link);
    else out.push({ key: link.section ? `${group.label}/${link.section}` : `${group.label}`, label: link.section ?? null, links: [link] });
  }
  return out;
}

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
  readonly navGroups = computed<NavTree[]>(() =>
    NAV_GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => this.auth.canVisit(l.path)) }))
      .filter((g) => g.links.length)
      .map((g) => ({ ...g, blocks: blocksOf(g) })),
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
  /** The sơ đồ page being shown ("/so-do/ban-hang"), so the group it belongs to reads as current. */
  readonly hubPath = signal<string | null>(this.router.url.startsWith('/so-do/') ? this.router.url.split(/[?#]/)[0] : null);
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
      this.hubPath.set(e.urlAfterRedirects.startsWith('/so-do/') ? e.urlAfterRedirects.split(/[?#]/)[0] : null);
      // Moving to another feature folds the one that was open: only the group of the page (reached by a link, the search, the back
      // button or a sơ đồ) stays unfolded. A page outside every group (Tổng quan, Báo cáo) leaves the menu as it is.
      const url = e.urlAfterRedirects;
      const hub = this.hubPath();
      const g = this.navGroups().find((x) => x.label && (x.hub === hub || x.links.some((l) => url === l.path || url.startsWith(l.path + '/') || url.startsWith(l.path + '?'))));
      if (g?.label) this.openOnly(g.label);
    });
  }

  /** The icon rail has no group headings, so every link shows there. */
  isOpen(group: NavGroup): boolean {
    return !group.label || this.collapsed() || !this.closedGroups().includes(group.label);
  }

  /** Opening a group folds the others (one feature open at a time); folding it just folds it. */
  toggleGroup(group: NavGroup): void {
    if (!group.label) return;
    if (this.closedGroups().includes(group.label)) this.openOnly(group.label);
    else this.setClosed([...this.closedGroups(), group.label]);
  }

  private openOnly(label: string): void {
    const next = NAV_GROUPS.map((g) => g.label).filter((l): l is string => !!l && l !== label);
    if (next.length !== this.closedGroups().length || next.some((l) => !this.closedGroups().includes(l))) this.setClosed(next);
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
