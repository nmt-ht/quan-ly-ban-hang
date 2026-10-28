import { Component, DestroyRef, ElementRef, afterRenderEffect, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NavIconComponent, NavIconName } from '../../layout/nav-icon/nav-icon.component';
import { FEATURED_REPORTS, REPORT_GROUPS, REPORTS, ReportGroup, groupOf, reportBySlug, reportIcon } from './report.registry';
import { TextPart, highlight, matchesAll, searchWords } from './report-search';
import { RevenueReportComponent } from './revenue/revenue-report.component';
import { TableReportComponent } from './table-report/table-report.component';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';
import { AuthService } from '../../core/services/auth.service';
import { ReportDef } from './report.types';

const RECENT_KEY = 'nt.reportsRecent';

function loadRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** One report row on the hub, with the search hits marked in its name and summary. */
interface HubItem {
  def: ReportDef;
  icon: NavIconName;
  label: TextPart[];
  summary: TextPart[];
}

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
  private readonly router = inject(Router);
  /** Only the reports this role may open (GROUP permission, as the server checks). */
  private readonly mine = REPORTS.filter((r: ReportDef) => this.auth.can(groupOf(r.group).permission));

  readonly total = this.mine.length;
  readonly ready = this.mine.filter((r) => r.kind !== 'soon').length;
  readonly groupCount = new Set(this.mine.map((r) => r.group)).size;

  private readonly name = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('name'))), { initialValue: null });
  readonly days = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => Number(q.get('ngay')) || null)), { initialValue: null });
  /** ?sp=<mặt hàng> opens Thẻ kho on that item (link from the product page). */
  readonly item = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('sp'))), { initialValue: null });
  readonly query = signal('');
  private readonly words = computed(() => searchWords(this.query()));
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');

  /** The open report, or null for the hub (also for an unknown ?name=). */
  readonly active = computed(() => {
    const r = reportBySlug(this.name());
    return r && this.mine.includes(r) ? r : null;
  });
  readonly activeGroup = computed(() => (this.active() ? groupOf(this.active()!.group) : null));

  /** Hub content: groups with the reports that match the search box (ready first, not-built last); empty groups go. */
  readonly sections = computed(() => {
    const words = this.words();
    return REPORT_GROUPS.map((g: ReportGroup) => {
      // Reports whose name matches come before those found only in the summary ("kho" also hits "không").
      const byName = (r: ReportDef) => (words.length && !matchesAll(words, r.label) ? 1 : 0);
      const hits = this.mine
        .filter((r) => r.group === g.key && matchesAll(words, r.label, r.summary))
        .sort((a, b) => byName(a) - byName(b));
      const items: HubItem[] = [...hits.filter((r) => r.kind !== 'soon'), ...hits.filter((r) => r.kind === 'soon')].map((def) => ({
        def,
        icon: reportIcon(def),
        label: highlight(def.label, words),
        summary: highlight(def.summary, words),
      }));
      return { group: g, items };
    }).filter((s) => s.items.length);
  });
  readonly hits = computed(() => this.sections().reduce((n, s) => n + s.items.length, 0));

  /** "Hay dùng": the owner's everyday reports as cards, those this role may open. */
  readonly featured = this.mine
    .filter((r) => FEATURED_REPORTS.includes(r.slug) && r.kind !== 'soon')
    .sort((a, b) => FEATURED_REPORTS.indexOf(a.slug) - FEATURED_REPORTS.indexOf(b.slug))
    .map((r) => ({ def: r, icon: reportIcon(r), group: groupOf(r.group) }));

  /** Reports opened last in this browser (newest first, at most four), so the usual ones are one click away. */
  private readonly recentSlugs = signal<string[]>(loadRecent());
  readonly recent = computed(() =>
    this.recentSlugs().map((s) => reportBySlug(s)).filter((r): r is ReportDef => !!r && r.kind !== 'soon' && this.mine.includes(r)).slice(0, 4),
  );
  readonly groupLabel = (r: ReportDef) => groupOf(r.group).label;

  /** Tabs under an open report: the reports of its group, ready ones first. */
  readonly siblings = computed(() => {
    const r = this.active();
    if (!r) return [];
    const items = this.mine.filter((x) => x.group === r.group);
    return [...items.filter((x) => x.kind !== 'soon'), ...items.filter((x) => x.kind === 'soon')];
  });

  /** Enter in the search box opens the first hit; Esc clears the box. */
  onSearchKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      const first = this.sections()[0]?.items[0];
      if (first && this.query().trim()) this.router.navigate(['/bao-cao'], { queryParams: { name: first.def.slug } });
    } else if (e.key === 'Escape' && this.query()) {
      e.stopPropagation();
      this.query.set('');
    }
  }

  clearSearch(): void {
    this.query.set('');
    this.searchBox()?.nativeElement.focus();
  }

  constructor() {
    effect(() => {
      const r = this.active();
      if (!r || r.kind === 'soon') return;
      const next = [r.slug, ...untracked(this.recentSlugs).filter((s) => s !== r.slug)].slice(0, 8);
      this.recentSlugs.set(next);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch { /* storage blocked: the list just is not remembered */ }
    });

    // On the hub "/" goes to the report search, not the app-wide palette: listen in the capture phase on window,
    // which runs before the palette's document listener, and stop the key there.
    const onSlash = (e: KeyboardEvent) => {
      const box = this.searchBox()?.nativeElement;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
      if (e.key !== '/' || typing || e.ctrlKey || e.metaKey || e.altKey || !box || this.active() || t?.closest('dialog[open]')) return;
      e.preventDefault();
      e.stopPropagation();
      box.focus();
      box.select();
    };
    window.addEventListener('keydown', onSlash, true);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('keydown', onSlash, true));

    // On a phone the tab row scrolls sideways: bring the open report's tab into view.
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    afterRenderEffect(() => {
      if (!this.active()) return;
      host.querySelector('.rc-tab.is-active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
  }
}
