import { ReportDef } from '../report.types';

// What each report is called and how it reads; the server computes it (backend modules/reports/defs).

// ---------------------------------------------------------------- Nhập hàng
const purchase: ReportDef = {
  slug: 'mua-hang',
  label: 'Nhập hàng',
  group: 'buy',
  summary: 'Giá trị hàng đã nhập kho theo nhà cung cấp hoặc theo mặt hàng.',
  kind: 'period',
  groups: [
    { value: 'supplier', label: 'Theo nhà cung cấp' },
    { value: 'product', label: 'Theo mặt hàng' },
  ],
  searchHint: 'Tìm nhà cung cấp hoặc mặt hàng…',
  notes: [
    'Tính trên PHIẾU NHẬP KHO lập từ đơn nhập — đúng thời điểm hàng về và công nợ phát sinh, không phải lúc đặt đơn. Phiếu đã huỷ không tính.',
    'Giá trị = số lượng × đơn giá trên phiếu (chưa thuế GTGT); phiếu chưa ghi đơn giá lấy giá của đơn nhập. Số lượng quy về ĐVT chính.',
  ],
};

// ---------------------------------------------------------------- Sản xuất
const production: ReportDef = {
  slug: 'san-xuat',
  label: 'Sản xuất',
  group: 'make',
  summary: 'Sản lượng và giá thành thành phẩm của các lệnh đã hoàn tất trong kỳ.',
  kind: 'period',
  searchHint: 'Tìm thành phẩm…',
  notes: [
    'Chỉ tính lệnh đã HOÀN TẤT (theo ngày hoàn tất). Giá thành đơn vị chia cho SỐ THỰC NHẬP KHO nên hàng hỏng làm tăng giá thành.',
    'Chi phí vật tư = định mức đã chụp lúc lập lệnh × số lượng lệnh × giá vốn vật tư HIỆN TẠI (ước tính). Hao hụt % = (số lệnh − thực nhập) ÷ số lệnh.',
  ],
};

// ---------------------------------------------------------------- Chi phí xe
const vehicleCost: ReportDef = {
  slug: 'chi-phi-xe',
  label: 'Chi phí xe',
  group: 'deliver',
  summary: 'Tiền dầu, cầu đường và chi phí khác của các chuyến giao hàng, theo xe hoặc tài xế.',
  kind: 'period',
  groups: [
    { value: 'vehicle', label: 'Theo xe' },
    { value: 'driver', label: 'Theo tài xế' },
  ],
  searchHint: 'Tìm biển số hoặc tài xế…',
  notes: [
    'Chi phí do người điều vận ghi ở từng chuyến — KHÔNG phải sổ quỹ; tiền thật ra khỏi quỹ nằm ở phiếu chi. Chuyến đã huỷ không tính.',
    'Xe thuê ngoài gộp theo biển số ghi trên chuyến. Tính theo ngày của chuyến.',
  ],
};

// ---------------------------------------------------------------- Thu chi
const cashflow: ReportDef = {
  slug: 'thu-chi',
  label: 'Thu chi',
  group: 'cash',
  summary: 'Tiền thu và tiền chi theo loại thu chi, tài khoản hoặc đối tác.',
  kind: 'period',
  groups: [
    { value: 'category', label: 'Theo loại thu chi' },
    { value: 'account', label: 'Theo tài khoản tiền' },
    { value: 'partner', label: 'Theo đối tác' },
  ],
  searchHint: 'Tìm loại, tài khoản, đối tác…',
  notes: ['Phiếu đã huỷ không tính. Ròng = thu − chi; số âm nghĩa là dòng đó chi nhiều hơn thu.'],
};

// ---------------------------------------------------------------- Sổ quỹ
const cashbook: ReportDef = {
  slug: 'so-quy',
  label: 'Sổ quỹ',
  group: 'cash',
  summary: 'Tồn quỹ đầu kỳ, thu, chi và tồn quỹ cuối kỳ của từng tài khoản tiền.',
  kind: 'period',
  notes: [
    'Tồn đầu kỳ = số dư đầu kỳ khai báo + thu − chi của các phiếu trước ngày bắt đầu; tồn cuối kỳ = tồn đầu + thu − chi trong kỳ. Phiếu đã huỷ không tính.',
    'Dòng tổng cộng gộp mọi tài khoản. Số dư hiện tại của từng tài khoản xem ở Thu chi › Tài khoản tiền.',
  ],
};

export const OPS_DEFS: ReportDef[] = [purchase, production, vehicleCost, cashflow, cashbook];
