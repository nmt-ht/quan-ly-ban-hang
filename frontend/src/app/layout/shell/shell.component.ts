import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NAV_GROUPS } from '../nav-items';
import { AuthService } from '../../core/services/auth.service';
import { NavIconComponent } from '../nav-icon/nav-icon.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, NavIconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly navGroups = NAV_GROUPS;
  readonly collapsed = signal(false);
  readonly darkMode = signal(false);
  readonly menuOpen = signal(false);

  constructor(private readonly auth: AuthService, private readonly router: Router) {}

  get user() {
    return this.auth.user();
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

  toggleDarkMode(): void {
    this.darkMode.update((v) => !v);
    document.body.classList.toggle('dark-theme', this.darkMode());
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
