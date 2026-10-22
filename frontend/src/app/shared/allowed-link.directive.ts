import { Directive, computed, inject, input } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { linkToUrl } from '../core/auth/route-access';

/**
 * Hides an action link (`a.btn`, `a.icon-action`, `a.link-btn` with routerLink) whose page the signed-in role may not open (rules: core/auth/route-access.ts),
 * so "Thêm …", "Lập phiếu …" and "Sửa" never lead to a refused route. Inline
 * code links stay visible (hiding them would drop the text); the route guard covers those.
 */
@Directive({
  selector: 'a.btn[routerLink], a.icon-action[routerLink], a.link-btn[routerLink]',
  standalone: true,
  host: { '[style.display]': 'allowed() ? null : "none"' },
})
export class AllowedLinkDirective {
  private readonly auth = inject(AuthService);
  readonly routerLink = input<string | readonly unknown[] | null | undefined>();
  readonly allowed = computed(() => {
    const url = linkToUrl(this.routerLink());
    return !url || this.auth.canVisit(url);
  });
}
