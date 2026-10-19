import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NAV_GROUPS } from '../nav-items';
import { NavIconComponent } from '../nav-icon/nav-icon.component';
import { AccountMenuComponent } from '../account-menu/account-menu.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, NavIconComponent, AccountMenuComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly navGroups = NAV_GROUPS;
  readonly collapsed = signal(false);
  readonly menuOpen = signal(false);

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
