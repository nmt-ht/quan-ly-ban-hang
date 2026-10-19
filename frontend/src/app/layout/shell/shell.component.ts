import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NAV_GROUPS } from '../nav-items';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly navGroups = NAV_GROUPS;
  readonly collapsed = signal(false);
  readonly darkMode = signal(false);

  constructor(private readonly auth: AuthService, private readonly router: Router) {}

  get user() {
    return this.auth.user();
  }

  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
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
