import { NavIconName } from '../../layout/nav-icon/nav-icon.component';
import { OPS_DEFS } from './defs/ops.defs';
import { SALES_DEFS } from './defs/sales.defs';
import { STOCK_DEFS } from './defs/stock.defs';
import { ReportDef, ReportGroupKey } from './report.types';

export interface ReportGroup {
  key: ReportGroupKey;
  label: string;
  description: string;
  icon: NavIconName;
}

// 8 nhóm / 21 báo cáo, theo thứ tự của hệ thống tham chiếu (docs/crawl/02-bao-cao.md).
export const REPORT_GROUPS: ReportGroup[] = [
  { key: 'sell', label: 'Bán hàng', description: 'Doanh thu, chiết khấu và khách hàng', icon: 'receipt' },
  { key: 'profit', label: 'Lợi nhuận', description: 'Lãi gộp và hàng bán lỗ', icon: 'report' },
  { key: 'stock', label: 'Kho', description: 'Tồn kho, nhập xuất tồn, hàng cần nhập', icon: 'stock' },
  { key: 'buy', label: 'Mua hàng', description: 'Nhập hàng theo nhà cung cấp', icon: 'cart' },
  { key: 'make', label: 'Sản xuất', description: 'Sản lượng và giá thành thành phẩm', icon: 'factory' },
  { key: 'deliver', label: 'Giao hàng', description: 'Chi phí xe và hiệu quả giao hàng', icon: 'truck' },
  { key: 'debt', label: 'Công nợ', description: 'Số dư và tuổi nợ phải thu, phải trả', icon: 'money-in' },
  { key: 'cash', label: 'Dòng tiền', description: 'Sổ quỹ và thu chi', icon: 'cash' },
];

const byslug = (defs: ReportDef[], slug: string) => {
  const d = defs.find((x) => x.slug === slug);
  if (!d) throw new Error('report def missing: ' + slug);
  return d;
};

const soon = (slug: string, label: string, group: ReportGroupKey, summary: string): ReportDef => ({ slug, label, group, summary, kind: 'soon' });

export const REPORTS: ReportDef[] = [
  // ---- Bán hàng
  { slug: 'ban-hang', label: 'Doanh thu', group: 'sell', summary: 'Doanh thu theo thời gian, khách hàng, mặt hàng, nhóm hàng hoặc nhân viên; so với kỳ trước.', kind: 'custom' },
  byslug(SALES_DEFS, 'chiet-khau'),
  byslug(SALES_DEFS, 'khach-ngung-mua'),
  // ---- Lợi nhuận
  byslug(SALES_DEFS, 'loi-nhuan'),
  byslug(SALES_DEFS, 'ban-duoi-gia-von'),
  // ---- Kho
  byslug(STOCK_DEFS, 'nhap-xuat-ton'),
  soon('hang-nam-im', 'Hàng không phát sinh lâu ngày', 'stock', 'Mặt hàng còn tồn nhưng không có chứng từ kho trong nhiều ngày.'),
  byslug(STOCK_DEFS, 'ton-kho'),
  byslug(STOCK_DEFS, 'duoi-ton-toi-thieu'),
  soon('the-kho', 'Thẻ kho', 'stock', 'Sổ chi tiết nhập xuất của một mặt hàng theo từng chứng từ.'),
  soon('vong-quay-ton-kho', 'Vòng quay tồn kho', 'stock', 'Số ngày tồn so với lượng bán bình quân mỗi ngày.'),
  // ---- Mua hàng
  byslug(OPS_DEFS, 'mua-hang'),
  soon('gia-mua', 'Giá mua biến động', 'buy', 'Đơn giá mua đã quy về ĐVT chính qua các lần nhập, xếp theo biên độ.'),
  // ---- Sản xuất
  byslug(OPS_DEFS, 'san-xuat'),
  // ---- Giao hàng
  soon('giao-hang', 'Giao hàng', 'deliver', 'Tỷ lệ giao thành công của các đơn đã chốt giao.'),
  byslug(OPS_DEFS, 'chi-phi-xe'),
  soon('tai-xe', 'Hiệu quả theo tài xế', 'deliver', 'Tỷ lệ khách lấy đủ và giá trị hàng mang về theo từng tài xế.'),
  // ---- Công nợ
  {
    slug: 'cong-no', label: 'Số dư công nợ', group: 'debt', kind: 'link',
    summary: 'Số dư phải thu và phải trả trên toàn bộ lịch sử, theo từng đối tác.',
    notes: ['Số dư tính trên TOÀN BỘ lịch sử, không phụ thuộc khoảng ngày — đây là số hai bên cần chốt. Đối tác đã tất toán không hiện.'],
    links: [
      { label: 'Công nợ phải thu khách hàng', path: '/cong-no/khach-hang' },
      { label: 'Công nợ phải trả nhà cung cấp', path: '/cong-no/nha-cung-cap' },
    ],
  },
  {
    slug: 'tuoi-no', label: 'Tuổi nợ', group: 'debt', kind: 'link',
    summary: 'Khoản nợ còn lại theo độ trễ so với hạn thanh toán: chưa đến hạn, quá hạn 1–30, 31–60, 61–90, trên 90 ngày.',
    notes: ['Chỉ tính khoản TĂNG NỢ còn chưa trả hết; tiền trả trước không trừ vào đây. Khoản chưa khai hạn xếp vào Chưa đến hạn.'],
    links: [
      { label: 'Tuổi nợ phải thu khách hàng', path: '/cong-no/tuoi-no', query: { loai: 'phai-thu' } },
      { label: 'Tuổi nợ phải trả nhà cung cấp', path: '/cong-no/tuoi-no' },
    ],
  },
  // ---- Dòng tiền
  byslug(OPS_DEFS, 'so-quy'),
  byslug(OPS_DEFS, 'thu-chi'),
];

export function reportBySlug(slug: string | null): ReportDef | undefined {
  return REPORTS.find((r) => r.slug === slug);
}

export function groupOf(key: ReportGroupKey): ReportGroup {
  return REPORT_GROUPS.find((g) => g.key === key)!;
}

export const DEFAULT_REPORT = 'ban-hang';
