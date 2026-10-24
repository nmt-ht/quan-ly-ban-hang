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

// ---------------------------------------------------------------- Giá mua biến động
const priceDrift: ReportDef = {
  slug: 'gia-mua',
  label: 'Giá mua biến động',
  group: 'buy',
  summary: 'Đơn giá mua quy về ĐVT chính qua các lần nhập: lần đầu, gần nhất, thấp, cao — xếp theo biên độ.',
  kind: 'period',
  groups: [
    { value: 'product', label: 'Theo mặt hàng' },
    { value: 'line', label: 'Từng lần nhập' },
  ],
  searchHint: 'Tìm mặt hàng, nhà cung cấp hoặc số phiếu…',
  defaultPeriod: 'thisYear',
  notes: [
    'Mỗi dòng của PHIẾU NHẬP KHO lập từ đơn nhập là một lần mua (cùng nguồn với báo cáo Nhập hàng), theo ngày nhập. Đơn giá chưa thuế GTGT, quy về ĐVT chính; phiếu chưa ghi đơn giá lấy giá của đơn nhập. Phiếu đã huỷ không tính.',
    'Biên độ = (cao nhất − thấp nhất) ÷ thấp nhất. Thay đổi = (giá gần nhất − giá lần đầu) ÷ giá lần đầu, trong kỳ đang xem. Bình quân tính theo số lượng nhập. Tăng giá tô đỏ, giảm giá tô xanh.',
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
    'Chi phí vật tư = giá vốn đã chốt trên phiếu xuất vật tư của lệnh; lệnh cũ chưa có giá chốt thì ước tính = định mức × số lượng lệnh × giá vốn hiện tại. Hao hụt % = (số lệnh − thực nhập) ÷ số lệnh.',
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

// ---------------------------------------------------------------- Giao hàng (chốt giao)
const delivery: ReportDef = {
  slug: 'giao-hang',
  label: 'Giao hàng',
  group: 'deliver',
  summary: 'Tỷ lệ giao thành công của các đơn đã chốt giao.',
  kind: 'period',
  groups: [
    { value: 'trip', label: 'Theo chuyến' },
    { value: 'customer', label: 'Theo khách hàng' },
  ],
  searchHint: 'Tìm chuyến, tài xế hoặc khách hàng…',
  notes: [
    'Chỉ tính đơn đã CHỐT GIAO trên chuyến (khách đã xác nhận số nhận). Đơn chưa chốt hiện ở cột "Chưa chốt" và không tính vào tỷ lệ. Chuyến đã huỷ không tính; tính theo ngày của chuyến.',
    'Giao đủ = mọi dòng khách nhận đủ số xếp lên xe; Giao một phần = nhận ít hơn; Khách không nhận = nhận 0. Giá trị theo giá bán sau chiết khấu, gồm thuế GTGT.',
    'Tỷ lệ giao thành công = giá trị khách nhận ÷ giá trị xuất của các đơn đã chốt. Phần chênh là hàng mang về kho.',
  ],
};

// ---------------------------------------------------------------- Hiệu quả theo tài xế
const driver: ReportDef = {
  slug: 'tai-xe',
  label: 'Hiệu quả theo tài xế',
  group: 'deliver',
  summary: 'Tỷ lệ khách lấy đủ và giá trị hàng mang về theo từng tài xế.',
  kind: 'period',
  searchHint: 'Tìm tài xế…',
  notes: [
    'Cùng nguồn với báo cáo Giao hàng: chỉ đơn đã chốt giao, chuyến đã huỷ không tính. Tài xế gộp theo tên ghi trên chuyến.',
    'Tỷ lệ lấy đủ = số đơn khách nhận đủ ÷ số đơn đã chốt. Hàng mang về = giá trị xuất − giá trị khách nhận (tô đỏ khi tăng); sắp xếp từ nhiều đến ít.',
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

export const OPS_DEFS: ReportDef[] = [purchase, priceDrift, production, delivery, vehicleCost, driver, cashflow, cashbook];
