import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuditLogEntry, AuditLogService, AuditQuery } from '../../../core/services/audit-log.service';
import { DataStore } from '../../../core/services/data-store.service';
import { errorText } from '../../../core/api/api.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { NO_PERIOD, PeriodFilterComponent, PeriodValue } from '../../../shared/period-filter/period-filter.component';
import { downloadWorkbook, exportFileName } from '../../../shared/excel.util';
import { actionVerb, codeLink, ENTITY_LABEL, entityLink, formatAuditValue, listDelta } from '../../../shared/audit/audit-labels';

const PAGE = 100;
const SEARCH_DELAY_MS = 300;

/** Thao tác filter: a prefix of the action code. */
const ACTIONS: { value: string; label: string }[] = [
  { value: 'auth.', label: 'Đăng nhập (mọi lần)' },
  { value: 'auth.login_failed', label: 'Đăng nhập thất bại' },
  { value: 'user.', label: 'Tài khoản người dùng' },
  { value: 'role.', label: 'Chức vụ & phân quyền' },
  { value: 'product.update_price', label: 'Đổi giá bán' },
  { value: 'api.unaudited', label: 'Thao tác chưa có mô tả' },
];

// Thiết lập › Nhật ký hoạt động: every line the server wrote, newest first, read 100 at a time.
@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [RouterLink, NavIconComponent, PeriodFilterComponent],
  templateUrl: './activity-log.component.html',
  styleUrl: './activity-log.component.scss',
})
export class ActivityLogComponent {
  private readonly svc = inject(AuditLogService);
  readonly data = inject(DataStore);

  readonly search = signal('');
  readonly userId = signal('');
  readonly entityType = signal('');
  readonly action = signal('');
  readonly period = signal<PeriodValue>(NO_PERIOD);

  readonly rows = signal<AuditLogEntry[]>([]);
  readonly nextCursor = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly exporting = signal(false);
  /** Lines whose changed fields are shown. */
  readonly open = signal<ReadonlySet<string>>(new Set());

  readonly actions = ACTIONS;
  readonly entityTypes = Object.entries(ENTITY_LABEL).filter(([k]) => k !== 'Api').sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  readonly users = computed(() => [...this.data.users()].sort((a, b) => a.name.localeCompare(b.name, 'vi')));

  readonly filtered = computed(() => !!(this.search() || this.userId() || this.entityType() || this.action() || this.period().range.from || this.period().range.to));

  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Any filter change reads the first page again; typing waits a moment before asking.
    effect(() => {
      const query = this.query();
      clearTimeout(this.timer);
      this.timer = setTimeout(() => untracked(() => void this.load(query, false)), SEARCH_DELAY_MS);
    });
  }

  private query(): AuditQuery {
    const r = this.period().range;
    return {
      q: this.search().trim(), userId: this.userId(), entityType: this.entityType(), action: this.action(),
      from: r.from, to: r.to, limit: PAGE,
    };
  }

  private async load(query: AuditQuery, more: boolean): Promise<void> {
    const seq = ++this.seq;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.svc.list({ ...query, before: more ? this.nextCursor() : null });
      if (seq !== this.seq) return;
      this.rows.set(more ? [...this.rows(), ...page.items] : page.items);
      this.nextCursor.set(page.nextCursor);
    } catch (e) {
      if (seq === this.seq) this.error.set(errorText(e));
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }

  loadMore(): void {
    void this.load(this.query(), true);
  }

  clearAll(): void {
    this.search.set('');
    this.userId.set('');
    this.entityType.set('');
    this.action.set('');
    this.period.set(NO_PERIOD);
  }

  toggle(id: string): void {
    const next = new Set(this.open());
    if (!next.delete(id)) next.add(id);
    this.open.set(next);
  }

  /** A click anywhere on the row opens it — except on a link or the ⌄ button, which do their own thing. */
  onRow(e: MouseEvent, id: string): void {
    if ((e.target as HTMLElement).closest('a, button')) return;
    if (window.getSelection()?.toString()) return; // selecting text to copy is not a click
    this.toggle(id);
  }

  /** Date and time to the second in giờ Việt Nam, plus "x phút trước" for the last day. */
  stamp(iso: string): { date: string; time: string; ago: string } {
    const [date, time] = fullStamp(iso).split(' ');
    return { date, time, ago: ago(iso) };
  }

  tone(t: string): string {
    return t === 'ok' ? 'badge-success' : t === 'bad' ? 'badge-danger' : t === 'warn' ? 'badge-warning' : 'badge-muted';
  }

  readonly verb = actionVerb;
  readonly fmt = formatAuditValue;
  readonly delta = listDelta;
  readonly link = entityLink;
  readonly entityName = (t: string) => ENTITY_LABEL[t] ?? t;
  codeRoute(code: string): unknown[] | null {
    return codeLink(this.data, code);
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      await downloadWorkbook(exportFileName('Nhật ký hoạt động'), [{
        name: 'Nhật ký',
        columns: [
          { header: 'Thời điểm (GMT+7)', width: 20 }, { header: 'Người thực hiện', width: 22 }, { header: 'Thao tác', width: 14 },
          { header: 'Đối tượng', width: 18 }, { header: 'Mã', width: 14 }, { header: 'Nội dung', width: 70 },
          { header: 'Thay đổi', width: 60 }, { header: 'Chứng từ kèm', width: 24 }, { header: 'IP', width: 16 },
        ],
        rows: this.rows().map((r) => [
          fullStamp(r.at), r.userName, actionVerb(r.action).label, this.entityName(r.entityType), r.entityCode ?? '', r.summary,
          (r.changes ?? []).map((c) => `${c.label}: ${formatAuditValue(c.from)} → ${formatAuditValue(c.to)}`).join('\n'),
          (r.related ?? []).join(', '), r.ip ?? '',
        ]),
      }]);
    } finally {
      this.exporting.set(false);
    }
  }
}

// The log is read in giờ Việt Nam whatever the viewer's computer is set to (the server's day filters use +07:00 too).
const VN_STAMP = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** '23/10/2026 09:55:45' in giờ Việt Nam. */
function fullStamp(iso: string): string {
  const p = Object.fromEntries(VN_STAMP.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p['day']}/${p['month']}/${p['year']} ${p['hour']}:${p['minute']}:${p['second']}`;
}

/** 'vừa xong' · '12 phút trước' · '5 giờ trước' within a day; '' after that (the date says it). */
function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 0) return '';
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return '';
}
