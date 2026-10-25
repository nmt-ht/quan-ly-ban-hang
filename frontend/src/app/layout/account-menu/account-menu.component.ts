import { Component, ElementRef, HostListener, computed, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeMode, ThemeService } from '../../core/services/theme.service';
import { DENSITIES, Density, DensityService } from '../../core/services/density.service';
import { NavIconComponent, NavIconName } from '../nav-icon/nav-icon.component';

// Topbar account menu: who is signed in, personal preferences (Giao diện), sign out.
// Follows the WAI-ARIA menu-button pattern: arrows move, Esc/Tab/outside click close.
@Component({
  selector: 'app-account-menu',
  standalone: true,
  imports: [NavIconComponent],
  templateUrl: './account-menu.component.html',
  styleUrl: './account-menu.component.scss',
})
export class AccountMenuComponent {
  readonly open = signal(false);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  /** short: the word on the segment; label: the full name, for screen readers. */
  readonly themes: { value: ThemeMode; label: string; short: string; icon: NavIconName }[] = [
    { value: 'light', label: 'Sáng', short: 'Sáng', icon: 'sun' },
    { value: 'dark', label: 'Tối', short: 'Tối', icon: 'moon' },
    { value: 'system', label: 'Theo hệ thống', short: 'Hệ thống', icon: 'monitor' },
  ];

  readonly densities = DENSITIES;
  /** The chosen mật độ's hint, said once under the row instead of beside every option. */
  readonly densityHint = computed(() => DENSITIES.find((d) => d.value === this.density.mode())?.hint ?? '');

  readonly user = computed(() => this.auth.user());
  readonly name = computed(() => this.user()?.name || 'Người dùng');
  readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/);
    const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
    return letters.toUpperCase();
  });

  constructor(
    private readonly auth: AuthService,
    readonly theme: ThemeService,
    readonly density: DensityService,
    private readonly router: Router,
    private readonly host: ElementRef<HTMLElement>,
  ) {}

  toggle(): void {
    this.open() ? this.close() : this.show(0);
  }

  show(focusIndex: number): void {
    this.open.set(true);
    setTimeout(() => this.items().at(focusIndex)?.focus());
  }

  close(returnFocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.trigger().nativeElement.focus();
  }

  setDensity(mode: Density): void {
    this.density.set(mode); // menu stays open so the effect is visible
  }

  setTheme(mode: ThemeMode): void {
    this.theme.set(mode); // menu stays open so the effect is visible
  }

  changePassword(): void {
    this.close(false);
    this.router.navigateByUrl('/doi-mat-khau');
  }

  logout(): void {
    this.close(false);
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  onTriggerKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.show(event.key === 'ArrowDown' ? 0 : -1);
    }
  }

  onMenuKey(event: KeyboardEvent): void {
    const items = this.items();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      items.at(((to % items.length) + items.length) % items.length)?.focus();
    };
    switch (event.key) {
      // Left / right walk a segmented row the way down / up walk the list.
      case 'ArrowDown':
      case 'ArrowRight': return move(i + 1);
      case 'ArrowUp':
      case 'ArrowLeft': return move(i - 1);
      case 'Home': return move(0);
      case 'End': return move(items.length - 1);
      case 'Escape':
        event.preventDefault();
        return this.close();
      case 'Tab':
        return this.close(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  private items(): HTMLElement[] {
    return [...(this.menu()?.nativeElement.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
  }
}
