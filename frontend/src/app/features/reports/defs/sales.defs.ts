import { ReportDef } from '../report.types';

// What each report is called and how it reads; the server computes it (backend modules/reports/defs).

// ---------------------------------------------------------------- Chiết khấu đã cấp
const discount: ReportDef = {
  slug: 'chiet-khau',
  label: 'Chiết khấu đã cấp',
  group: 'sell',
  summary: 'Tổng chiết khấu đã cho khách theo kỳ: ai được nhiều nhất, mặt hàng nào bị chiết khấu nhiều.',
  kind: 'period',
  groups: [
    { value: 'customer', label: 'Theo khách hàng' },
    { value: 'product', label: 'Theo mặt hàng' },
    { value: 'rep', label: 'Theo nhân viên bán hàng' },
    { value: 'order', label: 'Theo đơn hàng' },
  ],
  searchHint: 'Tìm khách, mặt hàng, nhân viên, số đơn…',
  notes: [
    'Chiết khấu = chiết khấu dòng + phần chiết khấu cả đơn đã phân bổ về từng dòng theo tỷ lệ giá trị, tính trên phần khách thực nhận.',
    'Chỉ tính đơn đã giao trong kỳ (ngày ghi nhận = ngày giao); đơn huỷ không tính. Tỷ lệ = chiết khấu ÷ tiền hàng.',
  ],
};

// ---------------------------------------------------------------- Khách ngừng mua
const lostCustomers: ReportDef = {
  slug: 'khach-ngung-mua',
  label: 'Khách ngừng mua',
  group: 'sell',
  summary: 'Khách từng nhận hàng trước kỳ nhưng trong kỳ không nhận hàng lần nào — cần chăm sóc lại.',
  kind: 'period',
  searchHint: 'Tìm tên khách, mã, số điện thoại…',
  notes: [
    'Khách ngừng mua = từng nhận hàng TRƯỚC ngày bắt đầu kỳ nhưng trong kỳ không nhận hàng lần nào (đơn chưa giao không tính).',
    'Khách đã ngừng theo dõi không hiện. Xếp theo doanh thu cũ giảm dần. "Số ngày" tính từ lần mua cuối tới cuối kỳ.',
  ],
};

// ---------------------------------------------------------------- Lãi gộp
const grossProfit: ReportDef = {
  slug: 'loi-nhuan',
  label: 'Lãi gộp',
  group: 'profit',
  summary: 'Doanh thu thuần trừ giá vốn hàng bán, theo mặt hàng, khách hàng hoặc nhóm hàng.',
  kind: 'period',
  groups: [
    { value: 'product', label: 'Theo mặt hàng' },
    { value: 'customer', label: 'Theo khách hàng' },
    { value: 'category', label: 'Theo nhóm hàng' },
  ],
  searchHint: 'Tìm mặt hàng, khách, nhóm hàng…',
  notes: [
    'Lãi gộp = doanh thu thuần (chưa thuế, đã trừ chiết khấu) − giá vốn hàng bán. Giá vốn là bình quân gia quyền di động, CHỐT trên phiếu xuất lúc giao — nhập hàng giá khác về sau không làm đổi lãi của đơn đã giao. Hàng trả lại tính ngược đúng giá đã xuất.',
    'Đơn giao trước khi có giá vốn chốt (dữ liệu cũ) dùng giá vốn bình quân hiện tại. Dịch vụ = 0. Cột "Dòng giá vốn 0" đếm dòng chưa có giá vốn — lãi gộp của những dòng đó bị thổi lên.',
  ],
};

// ---------------------------------------------------------------- Hàng bán dưới giá vốn
const belowCost: ReportDef = {
  slug: 'ban-duoi-gia-von',
  label: 'Hàng bán dưới giá vốn',
  group: 'profit',
  summary: 'Những dòng bán có giá thực nhận thấp hơn giá vốn — đang lỗ trên từng đơn vị.',
  kind: 'period',
  searchHint: 'Tìm mặt hàng, khách, số đơn…',
  notes: [
    'Giá bán thực = doanh thu thuần của dòng ÷ số lượng thực nhận (ĐVT chính); đã trừ chiết khấu dòng và phần chiết khấu cả đơn, nên bán đúng giá vốn rồi chiết khấu thêm bị tính là lỗ.',
    'Giá vốn chốt trên phiếu xuất (xem Lãi gộp). Chỉ dòng có giá vốn > 0. Xếp theo mức lỗ giảm dần.',
  ],
};

export const SALES_DEFS: ReportDef[] = [discount, lostCustomers, grossProfit, belowCost];

