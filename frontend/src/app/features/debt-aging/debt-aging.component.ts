import { Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { DebtRow, DebtService } from '../../core/services/debt.service';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { foldVi, formatVnd } from '../../shared/format.util';
import { formatDay, isoDay } from '../../shared/period';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { AGING_COLUMNS } from '../debts/aging';
import { PrintDocumentComponent } from '../../shared/print/print-document.component';

type Side = 'PHAI_TRA' | 'PHAI_THU';
type Bucket = (typeof AGING_COLUMNS)[number]['key'];
type View = 'doi-tac' | 'chung-tu';
type Sort = 'overdue' | 'total' | 'oldest' | 'name';

interface DocRow {
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  ref: string;
  link?: unknown[];
  date?: string; // ngày phát sinh
  dueDate: string;
  overdueDays: number;
  amount: number;
  bucket: Bucket;
}

const SIDE = {
  PHAI_TRA: {
    title: 'Công nợ phải trả chia theo số ngày quá hạn', partner: 'Nhà cung cấp', search: 'Tìm nhà cung cấp…',
    ledger: '/cong-no/nha-cung-cap', from: 'ngày nhập kho', emptyHint: 'Mọi khoản phải trả đã được đối trừ hết.',
  },
  PHAI_THU: {
    title: 'Công nợ phải thu chia theo số ngày quá hạn', partner: 'Khách hàng', search: 'Tìm khách hàng…',
    ledger: '/cong-no/khach-hang', from: 'ngày khách nhận hàng', emptyHint: 'Mọi khoản phải thu đã được đối trừ hết.',
  },
} as const;

export function bucketOf(days: number): Bucket {
  if (days <= 0) return 'notDue';
  if (days <= 30) return 'overdue1to30';
  if (days <= 60) return 'overdue31to60';
  if (days <= 90) return 'overdue61to90';
  return 'overdueOver90';
}

// /cong-no/tuoi-no — phân tích tuổi nợ (báo cáo hiện trạng, tính đến hôm nay). ?loai=phai-thu mở phía phải thu.
@Component({
  selector: 'app-debt-aging',
  standalone: true,
  imports: [NgClass, RouterLink, NavIconComponent, PrintDocumentComponent],
  templateUrl: './debt-aging.component.html',
  styleUrl: './debt-aging.component.scss',
})
export class DebtAgingComponent {
  private readonly debt = inject(DebtService);
  private readonly data = inject(MockDataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly side = signal<Side>(this.route.snapshot.queryParamMap.get('loai') === 'phai-thu' ? 'PHAI_THU' : 'PHAI_TRA');
  readonly view = signal<View>('doi-tac');
  readonly query = signal('');
  readonly overdueOnly = signal(false);
  readonly bucket = signal<Bucket | null>(null);
  readonly sort = signal<Sort>('overdue');
  readonly exporting = signal(false);

  readonly buckets = AGING_COLUMNS;
  readonly money = formatVnd;
  readonly day = formatDay;
  readonly today = isoDay(new Date());
  readonly t = computed(() => SIDE[this.side()]);

  setSide(s: Side): void {
    this.side.set(s);
    this.bucket.set(null);
    this.router.navigate([], { relativeTo: this.route, queryParams: { loai: s === 'PHAI_THU' ? 'phai-thu' : null }, replaceUrl: true });
  }

  toggleBucket(b: Bucket): void {
    this.bucket.set(this.bucket() === b ? null : b);
  }

  private readonly source = computed<DebtRow[]>(() => (this.side() === 'PHAI_TRA' ? this.debt.payables() : this.debt.receivables()));

  /** Every open debt item as a row, with its source document link and date. */
  private readonly allDocs = computed<DocRow[]>(() =>
    this.source().flatMap((r) => {
      const entries = new Map(r.entries.filter((e) => e.kind === 'PHAT_SINH').map((e) => [e.ref, e]));
      return r.items.map((i) => ({
        partnerId: r.partnerId, partnerCode: r.code, partnerName: r.name, ref: i.ref, link: entries.get(i.ref)?.link,
        date: entries.get(i.ref)?.date, dueDate: i.dueDate, overdueDays: i.overdueDays, amount: i.amount, bucket: bucketOf(i.overdueDays),
      }));
    }),
  );

  private matchesText(code: string, name: string): boolean {
    const q = foldVi(this.query().trim());
    return !q || foldVi(`${code} ${name}`).includes(q);
  }

  /** Documents after search / quá hạn (not the bucket click): feeds the cards. */
  private readonly baseDocs = computed(() =>
    this.allDocs().filter((d) => this.matchesText(d.partnerCode, d.partnerName) && (!this.overdueOnly() || d.overdueDays > 0)),
  );

  readonly docs = computed(() => {
    const b = this.bucket();
    const rows = this.baseDocs().filter((d) => !b || d.bucket === b);
    const s = this.sort();
    return rows.sort((a, c) =>
      s === 'total' ? c.amount - a.amount
        : s === 'name' ? a.partnerName.localeCompare(c.partnerName, 'vi') || a.dueDate.localeCompare(c.dueDate)
          : c.overdueDays - a.overdueDays || c.amount - a.amount,
    );
  });

  readonly cards = computed(() => {
    const docs = this.baseDocs();
    const total = docs.reduce((s, d) => s + d.amount, 0);
    return {
      total,
      partners: new Set(docs.map((d) => d.partnerId)).size,
      buckets: this.buckets.map((b) => {
        const inB = docs.filter((d) => d.bucket === b.key);
        const amount = inB.reduce((s, d) => s + d.amount, 0);
        return { ...b, amount, count: inB.length, pct: total ? Math.round((amount / total) * 1000) / 10 : 0 };
      }),
    };
  });

  /** Theo đối tác: one row per partner, buckets from the visible documents. */
  readonly partners = computed(() => {
    const map = new Map<string, { partnerId: string; code: string; name: string; credit: string; aging: Record<Bucket, number>; total: number; maxDays: number; nextDue?: string; count: number }>();
    const credit = new Map(this.source().map((r) => [r.partnerId, r.creditLabel]));
    for (const d of this.docs()) {
      const p = map.get(d.partnerId) ?? {
        partnerId: d.partnerId, code: d.partnerCode, name: d.partnerName, credit: credit.get(d.partnerId) ?? '',
        aging: { notDue: 0, overdue1to30: 0, overdue31to60: 0, overdue61to90: 0, overdueOver90: 0 }, total: 0, maxDays: 0, count: 0,
      };
      p.aging[d.bucket] += d.amount;
      p.total += d.amount;
      p.count++;
      p.maxDays = Math.max(p.maxDays, d.overdueDays);
      if (d.overdueDays <= 0 && (!p.nextDue || d.dueDate < p.nextDue)) p.nextDue = d.dueDate;
      map.set(d.partnerId, p);
    }
    const s = this.sort();
    return [...map.values()].sort((a, b) =>
      s === 'total' ? b.total - a.total
        : s === 'name' ? a.name.localeCompare(b.name, 'vi')
          : s === 'oldest' ? b.maxDays - a.maxDays
            : (b.total - b.aging.notDue) - (a.total - a.aging.notDue) || b.maxDays - a.maxDays,
    );
  });

  readonly footer = computed(() => {
    const f = { notDue: 0, overdue1to30: 0, overdue31to60: 0, overdue61to90: 0, overdueOver90: 0, total: 0 } as Record<Bucket | 'total', number>;
    for (const d of this.docs()) {
      f[d.bucket] += d.amount;
      f.total += d.amount;
    }
    return f;
  });

  readonly bucketLabel = computed(() => this.buckets.find((b) => b.key === this.bucket())?.label);

  ageLabel(days: number): string {
    if (days > 0) return `Quá ${days} ngày`;
    if (days === 0) return 'Đến hạn hôm nay';
    return `Còn ${-days} ngày`;
  }

  bucketName(b: Bucket): string {
    return this.buckets.find((x) => x.key === b)?.label ?? '';
  }

  severity(b: Bucket): string {
    return b === 'notDue' ? '' : b === 'overdue1to30' ? 'sev-1' : b === 'overdue31to60' ? 'sev-2' : 'sev-3';
  }

  print(): void {
    window.print();
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    const side = this.side() === 'PHAI_TRA' ? 'phải trả' : 'phải thu';
    try {
      await downloadWorkbook(exportFileName(`Tuổi nợ ${side}`), [
        {
          name: 'Theo đối tác',
          columns: [
            { header: 'Mã', width: 13 }, { header: this.t().partner, width: 34 }, { header: 'Được nợ', width: 10 },
            ...this.buckets.map((b) => ({ header: b.label, width: 15, numFmt: '#,##0' })),
            { header: 'Tổng còn nợ', width: 16, numFmt: '#,##0' }, { header: 'Quá hạn lâu nhất (ngày)', width: 14 },
          ],
          rows: this.partners().map((p) => [
            p.code, p.name, p.credit, ...this.buckets.map((b) => p.aging[b.key]), p.total, Math.max(0, p.maxDays),
          ]),
        },
        {
          name: 'Theo chứng từ',
          columns: [
            { header: 'Mã', width: 13 }, { header: this.t().partner, width: 34 }, { header: 'Chứng từ', width: 14 },
            { header: 'Ngày phát sinh', width: 13 }, { header: 'Hạn thanh toán', width: 13 }, { header: 'Số ngày quá hạn', width: 14 },
            { header: 'Còn nợ', width: 16, numFmt: '#,##0' }, { header: 'Nhóm tuổi nợ', width: 18 },
          ],
          rows: this.docs().map((d) => [
            d.partnerCode, d.partnerName, d.ref, d.date ? formatDay(d.date) : '', formatDay(d.dueDate), Math.max(0, d.overdueDays), d.amount,
            this.bucketName(d.bucket),
          ]),
        },
      ]);
    } finally {
      this.exporting.set(false);
    }
  }

  readonly company = computed(() => this.data.companyInfo());
}
