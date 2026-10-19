import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ReportItem {
  key: string;
  label: string;
}
interface ReportGroup {
  label: string;
  items: ReportItem[];
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.component.html',
})
export class ReportsComponent {
  readonly groups: ReportGroup[] = [
    { label: 'Bán hàng', items: [
      { key: 'doanh-thu', label: 'Doanh thu' },
      { key: 'chiet-khau', label: 'Chiết khấu đã cấp' },
      { key: 'khach-ngung-mua', label: 'Khách ngừng mua' },
    ]},
    { label: 'Lợi nhuận', items: [
      { key: 'lai-gop', label: 'Lãi gộp' },
      { key: 'ban-duoi-gia-von', label: 'Hàng bán dưới giá vốn' },
    ]},
    { label: 'Kho', items: [
      { key: 'nhap-xuat-ton', label: 'Nhập xuất tồn' },
      { key: 'hang-khong-phat-sinh', label: 'Hàng không phát sinh lâu ngày' },
      { key: 'ton-kho-hien-tai', label: 'Tồn kho hiện tại' },
      { key: 'duoi-ton-toi-thieu', label: 'Hàng dưới tồn tối thiểu' },
      { key: 'the-kho', label: 'Thẻ kho' },
      { key: 'vong-quay-ton-kho', label: 'Vòng quay tồn kho' },
    ]},
    { label: 'Mua hàng', items: [
      { key: 'nhap-hang', label: 'Nhập hàng' },
      { key: 'gia-mua-bien-dong', label: 'Giá mua biến động' },
    ]},
    { label: 'Sản xuất', items: [
      { key: 'san-xuat', label: 'Sản xuất' },
    ]},
    { label: 'Giao hàng', items: [
      { key: 'giao-hang', label: 'Giao hàng' },
      { key: 'chi-phi-xe', label: 'Chi phí xe' },
      { key: 'hieu-qua-tai-xe', label: 'Hiệu quả theo tài xế' },
    ]},
    { label: 'Công nợ', items: [
      { key: 'so-du-cong-no', label: 'Số dư công nợ' },
      { key: 'tuoi-no', label: 'Tuổi nợ' },
    ]},
    { label: 'Dòng tiền', items: [
      { key: 'so-quy', label: 'Sổ quỹ' },
      { key: 'thu-chi', label: 'Thu chi' },
    ]},
  ];

  readonly active = signal<ReportItem>(this.groups[0].items[0]);

  select(item: ReportItem): void {
    this.active.set(item);
  }
}
