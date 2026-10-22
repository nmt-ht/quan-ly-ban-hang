import { ReportDef } from '../report.types';

// What each report is called and how it reads; the server computes it (backend modules/reports/defs).

// ---------------------------------------------------------------- Tồn kho hiện tại
const stockNow: ReportDef = {
  slug: 'ton-kho',
  label: 'Tồn kho hiện tại',
  group: 'stock',
  summary: 'Tồn và giá trị tồn tại thời điểm xem, theo mặt hàng hoặc theo kho.',
  kind: 'snapshot',
  groups: [
    { value: 'product', label: 'Theo mặt hàng' },
    { value: 'warehouse', label: 'Theo kho' },
  ],
  searchHint: 'Tìm mã, tên mặt hàng hoặc kho…',
  notes: [
    'Báo cáo hiện trạng: tính tại thời điểm xem, không lọc theo ngày. Chỉ vật tư và thành phẩm (dịch vụ không có tồn); tồn âm giữ nguyên, không làm tròn về 0.',
    'Giá trị tồn = tồn dương × giá vốn ước tính (xem Lãi gộp); tồn âm không làm giá trị âm. Hàng đã lên xe chưa chốt giao đã trừ khỏi tồn kho.',
  ],
};

// ---------------------------------------------------------------- Hàng dưới tồn tối thiểu
const belowMin: ReportDef = {
  slug: 'duoi-ton-toi-thieu',
  label: 'Hàng dưới tồn tối thiểu',
  group: 'stock',
  summary: 'Mặt hàng tồn thấp hơn mức tối thiểu đã đặt — cần nhập thêm, kèm số tiền ước tính để bù.',
  kind: 'snapshot',
  searchHint: 'Tìm mã hoặc tên mặt hàng…',
  notes: [
    'Chỉ mặt hàng còn kinh doanh, không phải dịch vụ và có tồn tối thiểu > 0; so sánh tổng tồn các kho với mức tối thiểu.',
    'Tiền cần bù = số thiếu × giá vốn ước tính hiện tại (không phải giá chào của nhà cung cấp). Xếp theo tiền cần bù giảm dần.',
  ],
};

// ---------------------------------------------------------------- Nhập xuất tồn
const movement: ReportDef = {
  slug: 'nhap-xuat-ton',
  label: 'Nhập xuất tồn',
  group: 'stock',
  summary: 'Tồn đầu kỳ, nhập, xuất và tồn cuối kỳ của từng mặt hàng (ĐVT chính).',
  kind: 'period',
  searchHint: 'Tìm mã hoặc tên mặt hàng…',
  notes: [
    'Cộng dồn từ chứng từ kho, quy về ĐVT chính. Chuyển kho giữa các kho không đổi tổng tồn nên không hiện; kiểm kê thừa tính vào Nhập, thiếu tính vào Xuất.',
    'Tồn cuối kỳ = tồn đầu + nhập − xuất. Tồn đầu và cuối được suy ra từ tồn hiện tại và các biến động; phiếu đã huỷ không tính.',
  ],
};

export const STOCK_DEFS: ReportDef[] = [stockNow, belowMin, movement];
