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
    'Giá trị tồn = tồn dương × giá vốn bình quân (xem Lãi gộp); tồn âm không làm giá trị âm. Hàng đã lên xe chưa chốt giao đã trừ khỏi tồn kho.',
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
    'Tiền cần bù = số thiếu × giá vốn bình quân hiện tại (không phải giá chào của nhà cung cấp). Xếp theo tiền cần bù giảm dần.',
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

// ---------------------------------------------------------------- Hàng không phát sinh lâu ngày
const idle: ReportDef = {
  slug: 'hang-nam-im',
  label: 'Hàng không phát sinh lâu ngày',
  group: 'stock',
  summary: 'Mặt hàng còn tồn nhưng không có chứng từ kho trong nhiều ngày — vốn đang nằm im.',
  kind: 'snapshot',
  groups: [
    { value: '60', label: 'Nằm im từ 60 ngày' },
    { value: '90', label: 'Nằm im từ 90 ngày' },
    { value: '180', label: 'Nằm im từ 180 ngày' },
    { value: '365', label: 'Nằm im từ 1 năm' },
  ],
  searchHint: 'Tìm mã hoặc tên mặt hàng…',
  notes: [
    'Chỉ mặt hàng còn tồn dương (không gồm dịch vụ). Số ngày nằm im tính từ chứng từ kho gần nhất (nhập, xuất hoặc kiểm kê) đến hôm nay; chuyển kho không tính là phát sinh. Mặt hàng chưa từng có chứng từ đứng đầu danh sách.',
    'Giá trị tồn = tồn × giá vốn bình quân (xem Lãi gộp).',
  ],
};

// ---------------------------------------------------------------- Thẻ kho
const stockCard: ReportDef = {
  slug: 'the-kho',
  label: 'Thẻ kho',
  group: 'stock',
  summary: 'Sổ chi tiết nhập xuất của một mặt hàng theo từng chứng từ, kèm tồn sau mỗi lần.',
  kind: 'period',
  pick: 'product',
  searchHint: 'Tìm số phiếu, kho hoặc diễn giải…',
  notes: [
    'Cộng tất cả các kho, quy về ĐVT chính. Chuyển kho giữa các kho không đổi tổng tồn nên không hiện; kiểm kê thừa ghi vào Nhập, thiếu ghi vào Xuất. Phiếu đã huỷ không tính.',
    'Tồn đầu kỳ được suy ra từ tồn hiện tại và các chứng từ; cột Tồn là tồn sau mỗi chứng từ.',
  ],
};

// ---------------------------------------------------------------- Vòng quay tồn kho
const turnover: ReportDef = {
  slug: 'vong-quay-ton-kho',
  label: 'Vòng quay tồn kho',
  group: 'stock',
  summary: 'Số ngày tồn so với lượng xuất bình quân mỗi ngày, và số vòng quay trong kỳ.',
  kind: 'period',
  searchHint: 'Tìm mã hoặc tên mặt hàng…',
  notes: [
    'Xuất trong kỳ = mọi phiếu xuất kho: giao cho khách và xuất vật tư cho sản xuất. Xuất / ngày = xuất trong kỳ ÷ số ngày của kỳ.',
    'Số ngày tồn = tồn cuối kỳ ÷ xuất / ngày — tồn còn đủ dùng bao nhiêu ngày với nhịp hiện tại; mặt hàng không xuất hiện "—". Vòng quay = xuất trong kỳ ÷ tồn bình quân (đầu kỳ và cuối kỳ).',
    'Số ngày tồn toàn kho = giá trị tồn ÷ giá trị xuất bình quân mỗi ngày (theo giá vốn bình quân). Xếp mặt hàng quay chậm nhất lên đầu.',
  ],
};

export const STOCK_DEFS: ReportDef[] = [stockNow, belowMin, movement, idle, stockCard, turnover];
