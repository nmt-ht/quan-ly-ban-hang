import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { foldVi } from '../../shared/format.util';
import { REPORT_GROUPS, REPORTS, ReportGroup, groupOf, reportBySlug } from './report.registry';
import { RevenueReportComponent } from './revenue/revenue-report.component';
import { TableReportComponent } from './table-report/table-report.component';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';
import { AuthService } from '../../core/services/auth.service';
import { ReportDef } from './report.types';

// /bao-cao is the hub (every report, by group). /bao-cao?name=<slug> is one report inside a frame with
// the same list beside it. Slugs are production's (docs/crawl/02-bao-cao.md), so old links keep working.
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [RouterLink, AllowedLinkDirective, NavIconComponent, RevenueReportComponent, TableReportComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  private readonly auth = inject(AuthService);
  /** Only the reports this role may open (GROUP permission, as the server checks). */
  private readonly mine = REPORTS.filter((r: ReportDef) => this.auth.can(groupOf(r.group).permission));

  readonly groups = REPORT_GROUPS;
  readonly total = this.mine.length;
  readonly ready = this.mine.filter((r) => r.kind !== 'soon').length;

  private readonly router = inject(Router);
  private readonly name = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('name'))), { initialValue: null });
  readonly days = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => Number(q.get('ngay')) || null)), { initialValue: null });
  readonly query = signal('');

  /** The open report, or null for the hub (also for an unknown ?name=). */
  readonly active = computed(() => {
    const r = reportBySlug(this.name());
    return r && this.mine.includes(r) ? r : null;
  });
  readonly activeGroup = computed(() => (this.active() ? groupOf(this.active()!.group) : null));

  /** Hub content: groups with the reports that match the search box. */
  readonly sections = computed(() => {
    const q = foldVi(this.query().trim());
    return REPORT_GROUPS.map((g: ReportGroup) => ({
      group: g,
      items: this.mine.filter((r) => r.group === g.key && (!q || foldVi(r.label + ' ' + r.summary).includes(q))),
    })).filter((s) => s.items.length);
  });

  /** The list beside an open report is never filtered. */
  readonly frameSections = REPORT_GROUPS.map((g) => ({ group: g, items: this.mine.filter((r) => r.group === g.key) })).filter((s) => s.items.length);

  open(slug: string): void {
    this.router.navigate(['/bao-cao'], { queryParams: slug ? { name: slug } : {} });
  }
}
