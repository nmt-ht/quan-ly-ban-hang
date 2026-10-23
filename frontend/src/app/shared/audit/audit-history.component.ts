import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuditLogEntry, AuditLogService } from '../../core/services/audit-log.service';
import { DataStore } from '../../core/services/data-store.service';
import { errorText } from '../../core/api/api.service';
import { actionVerb, codeLink, entityLink, ENTITY_LABEL, formatAuditValue, listDelta } from './audit-labels';
import { formatDateTime } from '../format.util';

/**
 * Tab / mục "Lịch sử" of one record: who did what and when, oldest first, with the fields an edit
 * changed. Lines of other records that name this one (a chuyến chốt giao naming the đơn) show too,
 * marked with the record they belong to.
 */
@Component({
  selector: 'app-audit-history',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (loading()) {
      <p class="ah-state">Đang tải lịch sử…</p>
    } @else if (error()) {
      <p class="ah-state text-danger" role="alert">{{ error() }}</p>
    } @else if (!entries().length) {
      <p class="ah-state">Chưa có thao tác nào được ghi lại cho {{ label() }} này.</p>
    } @else {
      <ol class="ah-list" [attr.aria-label]="'Lịch sử ' + label()">
        @for (e of entries(); track e.id) {
          @let v = verb(e.action);
          <li class="ah-item">
            <div class="ah-when">
              <time class="num" [attr.datetime]="e.at">{{ when(e.at) }}</time>
              <span class="ah-who">{{ e.userName }}</span>
            </div>
            <div class="ah-what">
              <p class="ah-summary">
                <span class="badge" [class.badge-success]="v.tone === 'ok'" [class.badge-danger]="v.tone === 'bad'"
                  [class.badge-warning]="v.tone === 'warn'" [class.badge-muted]="v.tone === 'plain'">{{ v.label }}</span>
                {{ e.summary }}
              </p>
              @if (isOther(e)) {
                <p class="ah-meta">Ghi ở {{ entityName(e.entityType) }}
                  @if (link(e); as l) { <a class="code-link" [routerLink]="l">{{ e.entityCode }}</a> } @else { {{ e.entityCode }} }
                </p>
              }
              @if (e.changes?.length) {
                <dl class="ah-changes">
                  @for (c of e.changes; track c.field) {
                    <div>
                      <dt>{{ c.label }}</dt>
                      @if (delta(c.from, c.to); as d) {
                        <dd>
                          @for (x of d.added; track x) { <span class="ah-add">+ {{ x }}</span> }
                          @for (x of d.removed; track x) { <span class="ah-del">− {{ x }}</span> }
                        </dd>
                      } @else {
                        <dd><span class="ah-from">{{ fmt(c.from) }}</span> → <span class="ah-to">{{ fmt(c.to) }}</span></dd>
                      }
                    </div>
                  }
                </dl>
              }
              @if (relatedOthers(e).length) {
                <p class="ah-meta">Chứng từ kèm:
                  @for (r of relatedOthers(e); track r) {
                    @if (codeRoute(r); as l) { <a class="code-link" [routerLink]="l">{{ r }}</a> } @else { <span class="mono">{{ r }}</span> }
                  }
                </p>
              }
            </div>
          </li>
        }
      </ol>
    }
  `,
  styles: [`
    :host { display: block; }
    .ah-state { color: var(--color-muted); margin: 0; padding: var(--space-xs) 0; font-size: var(--text-sm); }
    .ah-list { list-style: none; margin: 0; padding: 0; display: grid; }
    .ah-item { display: grid; grid-template-columns: minmax(9.5rem, 11rem) 1fr; gap: var(--space-xs);
      padding: var(--space-xs) 0; border-bottom: var(--rule-hair) solid var(--color-rule); }
    .ah-item:last-child { border-bottom: 0; padding-bottom: 0; }
    .ah-item:first-child { padding-top: var(--space-2xs); }
    .ah-when { display: grid; align-content: start; gap: 2px; font-size: var(--text-xs); color: var(--color-muted); }
    .ah-who { color: var(--color-ink); font-weight: 600; overflow-wrap: anywhere; }
    .ah-what { min-width: 0; display: grid; gap: 6px; }
    .ah-summary { margin: 0; overflow-wrap: anywhere; }
    .ah-summary .badge { margin-right: 6px; }
    .ah-meta { margin: 0; font-size: var(--text-xs); color: var(--color-muted); display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; }
    .ah-changes { margin: 0; display: grid; gap: 4px; font-size: var(--text-xs);
      border-left: 2px solid var(--color-rule); padding-left: var(--space-xs); }
    .ah-changes > div { display: grid; grid-template-columns: minmax(7rem, 10rem) 1fr; gap: 8px; }
    .ah-changes dt { color: var(--color-muted); }
    .ah-changes dd { margin: 0; min-width: 0; overflow-wrap: anywhere; display: grid; gap: 2px; }
    .ah-changes dd:has(.ah-from) { display: block; }
    .ah-from { color: var(--color-muted); text-decoration: line-through; }
    .ah-to { color: var(--color-ink); font-weight: 600; }
    .ah-add { color: var(--color-success); }
    .ah-del { color: var(--color-danger); }
    @media (max-width: 640px) {
      .ah-item { grid-template-columns: 1fr; gap: 4px; }
      .ah-when { grid-auto-flow: column; justify-content: start; gap: 8px; }
      .ah-changes > div { grid-template-columns: 1fr; gap: 0; }
    }
  `],
})
export class AuditHistoryComponent {
  readonly entityType = input.required<string>();
  readonly entityId = input.required<string>();
  /** Mã of the record, so lines of other records that name it show too. */
  readonly code = input<string | undefined>(undefined);

  private readonly svc = inject(AuditLogService);
  private readonly data = inject(DataStore);

  readonly entries = signal<AuditLogEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  private seq = 0;

  constructor() {
    effect(() => void this.load(this.entityType(), this.entityId(), this.code()));
  }

  /** Read again, e.g. after the page saved a change. */
  reload(): void {
    void this.load(this.entityType(), this.entityId(), this.code());
  }

  private async load(type: string, id: string, code: string | undefined): Promise<void> {
    const seq = ++this.seq;
    this.loading.set(true);
    this.error.set('');
    try {
      const rows = await this.svc.history(type, id, code);
      if (seq === this.seq) this.entries.set(rows);
    } catch (e) {
      if (seq === this.seq) this.error.set(errorText(e));
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }

  readonly label = () => (ENTITY_LABEL[this.entityType()] ?? 'bản ghi').toLowerCase();
  readonly verb = actionVerb;
  readonly fmt = formatAuditValue;
  readonly delta = listDelta;
  readonly when = formatDateTime;
  readonly entityName = (t: string) => (ENTITY_LABEL[t] ?? t).toLowerCase();
  readonly link = entityLink;

  isOther(e: AuditLogEntry): boolean {
    return e.entityType !== this.entityType() || e.entityId !== this.entityId();
  }

  /** Related codes other than this record's own. */
  relatedOthers(e: AuditLogEntry): string[] {
    return (e.related ?? []).filter((r) => r !== this.code());
  }

  codeRoute(code: string): unknown[] | null {
    return codeLink(this.data, code);
  }
}
