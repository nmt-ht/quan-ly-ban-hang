import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { RevenueReportComponent } from './revenue/revenue-report.component';

interface ReportItem {
  slug: string; // ?name= — slugs as on production (docs/crawl/02-bao-cao.md), not derived from the label
  label: string;
  ready?: boolean;
}
interface ReportGroup {
  label: string;
  items: ReportItem[];
}

const DEFAULT_SLUG = 'ban-hang';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [RouterLink, RevenueReportComponent],
  templateUrl: './reports.component.html',
})
export class ReportsComponent {
  readonly groups: ReportGroup[] = [
    { label: 'Bán hàng', items: [
      { slug: 'ban-hang', label: 'Doanh thu', ready: true },
      { slug: 'chiet-khau', label: 'Chiết khấu đã cấp' },
      { slug: 'khach-ngung-mua', label: 'Khách ngừng mua' },
    ]},
    { label: 'Lợi nhuận', items: [
      { slug: 'loi-nhuan', label: 'Lãi gộp' },
      { slug: 'ban-duoi-gia-von', label: 'Hàng bán dưới giá vốn' },
    ]},
    { label: 'Kho', items: [
      { slug: 'nhap-xuat-ton', label: 'Nhập xuất tồn' },
      { slug: 'hang-nam-im', label: 'Hàng không phát sinh lâu ngày' },
      { slug: 'ton-kho', label: 'Tồn kho hiện tại' },
      { slug: 'duoi-ton-toi-thieu', label: 'Hàng dưới tồn tối thiểu' },
      { slug: 'the-kho', label: 'Thẻ kho' },
      { slug: 'vong-quay-ton-kho', label: 'Vòng quay tồn kho' },
    ]},
    { label: 'Mua hàng', items: [
      { slug: 'mua-hang', label: 'Nhập hàng' },
      { slug: 'gia-mua', label: 'Giá mua biến động' },
    ]},
    { label: 'Sản xuất', items: [
      { slug: 'san-xuat', label: 'Sản xuất' },
    ]},
    { label: 'Giao hàng', items: [
      { slug: 'giao-hang', label: 'Giao hàng' },
      { slug: 'chi-phi-xe', label: 'Chi phí xe' },
      { slug: 'tai-xe', label: 'Hiệu quả theo tài xế' },
    ]},
    { label: 'Công nợ', items: [
      { slug: 'cong-no', label: 'Số dư công nợ' },
      { slug: 'tuoi-no', label: 'Tuổi nợ' },
    ]},
    { label: 'Dòng tiền', items: [
      { slug: 'so-quy', label: 'Sổ quỹ' },
      { slug: 'thu-chi', label: 'Thu chi' },
    ]},
  ];

  private readonly router = inject(Router);
  private readonly items = this.groups.flatMap((g) => g.items);
  private readonly name = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('name'))), { initialValue: null });

  readonly active = computed(() => this.items.find((i) => i.slug === this.name()) ?? this.items.find((i) => i.slug === DEFAULT_SLUG)!);

  open(slug: string): void {
    this.router.navigate(['/bao-cao'], { queryParams: { name: slug } });
  }
}
