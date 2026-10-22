import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NAV_GROUPS, NavGroup } from '../nav-items';
import { NavIconComponent } from '../nav-icon/nav-icon.component';
import { AccountMenuComponent } from '../account-menu/account-menu.component';
import { CommandPaletteComponent } from '../command-palette/command-palette.component';
import { CommandPaletteService } from '../../core/services/command-palette.service';
import { AuthService } from '../../core/services/auth.service';
import { CatalogLoader } from '../../core/api/catalog-loader.service';

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
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NavIconComponent, AccountMenuComponent, CommandPaletteComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly palette = inject(CommandPaletteService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly catalog = inject(CatalogLoader);
  /** Only the pages the role may open; a group with none left disappears. */
  readonly navGroups = computed<NavGroup[]>(() =>
    NAV_GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => this.auth.canVisit(l.path)) })).filter((g) => g.links.length),
  );
  readonly homeUrl = computed(() => this.auth.homeUrl());
  readonly collapsed = signal(false);
  readonly menuOpen = signal(false);
  /** Labels of the sub menus the user folded; remembered per browser. */
  readonly closedGroups = signal<string[]>(loadClosed());

  constructor() {
    // Landing on a page inside a folded group (link, search, back button) unfolds it.
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
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
