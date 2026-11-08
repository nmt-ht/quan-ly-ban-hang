import { Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Alert, AlertsService } from '../../core/services/alerts.service';
import { AuthService } from '../../core/services/auth.service';
import { NavIconComponent, NavIconName } from '../nav-icon/nav-icon.component';
import { ModuleKey, menuEntryOf } from '../nav-items';

interface Row {
  alert: Alert;
  /** The icon and phân hệ of the screen the row opens — the left menu's, so the two read alike. */
  icon: NavIconName;
  module: ModuleKey | null;
  unread: boolean;
}

type View = 'unread' | 'all';

// Topbar bell: what is wrong right now (AlertsService). A disclosure, not a menu — the panel is a list of links, grouped
// Nghiêm trọng / Theo dõi, under two tabs: Chưa đọc (the default while any is unread) and Tất cả. Opening a row or its ✓
// marks that one read; "Đã đọc tất cả" marks the rest. Esc / outside click close the panel.
@Component({
  selector: 'app-alerts-bell',
  standalone: true,
  imports: [RouterLink, NavIconComponent],
  templateUrl: './alerts-bell.component.html',
  // Split in two so each stylesheet stays under the component-style budget (angular.json).
  styleUrls: ['./alerts-bell.component.scss', './alerts-bell-list.scss'],
})
export class AlertsBellComponent {
  readonly alerts = inject(AlertsService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  readonly canOverview = computed(() => this.auth.canVisit('/tong-quan'));

  readonly open = signal(false);
  readonly view = signal<View>('unread');

  readonly count = computed(() => this.alerts.unread().length);
  readonly label = computed(() => {
    const n = this.count();
    const total = this.alerts.items().length;
    return n ? `Thông báo: ${n} chưa đọc, ${total} việc cần xử lý` : total ? `Thông báo: ${total} việc cần xử lý` : 'Thông báo: không có việc nào';
  });

  readonly groups = computed(() => {
    const list = this.view() === 'unread' ? this.alerts.unread() : this.alerts.items();
    const rows: Row[] = list.map((alert) => {
      const entry = menuEntryOf(alert.to);
      return { alert, icon: entry?.link.icon ?? 'alert', module: entry?.module ?? null, unread: !this.alerts.isRead(alert) };
    });
    return [
      { level: 'bad' as const, title: 'Nghiêm trọng', rows: rows.filter((r) => r.alert.level === 'bad') },
      { level: 'warn' as const, title: 'Theo dõi', rows: rows.filter((r) => r.alert.level === 'warn') },
    ].filter((g) => g.rows.length);
  });

  /** "Cập nhật 18:24" — when the list on screen was read. */
  readonly updated = computed(() => {
    const t = this.alerts.updatedAt();
    return t ? t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
  });

  toggle(): void {
    if (this.open()) return this.close();
    this.view.set(this.count() ? 'unread' : 'all');
    this.open.set(true);
    void this.alerts.refresh();
  }

  close(returnFocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.trigger().nativeElement.focus();
  }

  reload(): void {
    void this.alerts.refresh(true);
  }

  /** ✓ on a row: read, without leaving the page. The row leaves Chưa đọc, so focus moves on to the next one. */
  markRead(a: Alert, event: Event): void {
    const items = [...this.host.nativeElement.querySelectorAll<HTMLElement>('.alert-item')];
    const at = items.indexOf((event.currentTarget as HTMLElement).closest('.alert-item') as HTMLElement);
    this.alerts.markRead(a);
    setTimeout(() => {
      const left = [...this.host.nativeElement.querySelectorAll<HTMLElement>('.alert-item')];
      const next = left[Math.min(at, left.length - 1)];
      (next?.querySelector<HTMLElement>('.alert-read') ?? next?.querySelector<HTMLElement>('.alert-row') ?? this.trigger().nativeElement).focus();
    });
  }

  /** The button disables itself, so focus moves to "Xem tất cả" in the Đã đọc hết state. */
  markAllRead(): void {
    this.alerts.markAllRead();
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.alerts-state .btn, .alert-row')?.focus());
  }

  /** Opening a row reads it. A link to the list already on screen would keep its old filter (the page is reused) — reload it. */
  go(event: MouseEvent, a: Alert): void {
    this.alerts.markRead(a);
    this.close(false);
    const here = this.router.url.split(/[?#]/)[0];
    if (here !== a.to || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    void this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => this.router.navigate([a.to], { queryParams: a.query }));
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.close();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }
}
