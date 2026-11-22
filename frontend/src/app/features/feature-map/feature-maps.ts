import { NavIconName } from '../../layout/nav-icon/nav-icon.component';

// Sơ đồ của từng phân hệ chính: mỗi màn hình là một ô, mỗi mũi tên là "chứng từ / dữ liệu này đi sang màn kia".
// Ô tự đặt theo (stage = cột từ trái sang phải, lane = hàng). `own: false` = màn của phân hệ khác, vẽ nét đứt: cho thấy
// phân hệ này nối với phần còn lại của hệ thống ở đâu. Đường dẫn trùng với menu, nên quyền xem lấy từ cùng một bảng.

export interface MapNode {
  id: string;
  label: string;
  /** Một dòng: màn hình này dùng để làm gì. */
  hint: string;
  path: string;
  icon: NavIconName;
  stage: number;
  lane: number;
  /** Màn của phân hệ khác (nét đứt). */
  own?: boolean;
}

export interface MapEdge {
  from: string;
  to: string;
  /** Ngắn: việc gì xảy ra ở bước này ("Lập đơn"), có thể bỏ trống. */
  label?: string;
}

export interface FeatureMap {
  key: string;
  title: string;
  lead: string;
  nodes: MapNode[];
  edges: MapEdge[];
  /** Tên các cột, để người đọc biết đang ở bước nào. */
  stages: string[];
}

const n = (id: string, label: string, hint: string, path: string, icon: NavIconName, stage: number, lane: number, own = true): MapNode =>
  ({ id, label, hint, path, icon, stage, lane, own });

export const FEATURE_MAPS: FeatureMap[] = [
  {
    key: 'ban-hang',
    title: 'Bán hàng',
    lead: 'Từ khách hàng và giá bán, qua báo giá hoặc hợp đồng, đến chứng từ bán, giao hàng, hoá đơn và thu tiền.',
    stages: ['Chuẩn bị', 'Chào bán', 'Chốt đơn và sản xuất', 'Giao hàng', 'Hoá đơn và công nợ', 'Thu tiền'],
    nodes: [
      n('kh', 'Khách hàng', 'Hồ sơ, hạn mức nợ, địa chỉ giao', '/khach-hang', 'customers', 0, 0),
      n('gia', 'Chính sách giá', 'Bảng giá theo loại khách', '/bang-gia', 'tag', 0, 1),
      n('km', 'Chương trình khuyến mại', 'Giảm giá theo dòng hoặc cả đơn', '/khuyen-mai', 'percent', 0, 2),
      n('bg', 'Báo giá', 'Gửi giá cho khách, hết hạn tự báo', '/bao-gia', 'voucher', 1, 0),
      n('hd', 'Hợp đồng bán', 'Giá trị ký, theo dõi đã thực hiện', '/hop-dong/ban', 'voucher', 1, 1),
      n('dh', 'Chứng từ bán hàng', 'Đơn bán: hàng, giá, thuế, chiết khấu', '/don-hang', 'receipt', 2, 0),
      n('sx', 'Lệnh sản xuất', 'Sinh ra khi đơn có thành phẩm cần làm', '/san-xuat', 'factory', 2, 1, false),
      n('ck', 'Chuyến giao hàng', 'Gom đơn, xuất kho, tài xế, chốt giao', '/giao-hang', 'truck', 3, 0),
      n('xe', 'Danh mục xe', 'Xe của công ty, chi phí chuyến', '/xe', 'car', 3, 1),
      n('hdb', 'Hoá đơn bán ra', 'Ghi nhận số hoá đơn từ cổng', '/hoa-don-ban', 'receipt', 4, 0),
      n('cn', 'Công nợ phải thu', 'Khách còn nợ bao nhiêu, theo đợt giao', '/cong-no/khach-hang', 'ledger-in', 4, 1),
      n('nn', 'Nhắc nợ', 'Gửi nhắc, kèm mã VietQR', '/cong-no/nhac-no', 'bell', 4, 2),
      n('thu', 'Thu, chi tiền', 'Phiếu thu, đối trừ công nợ', '/thu-chi', 'cash', 5, 1, false),
    ],
    edges: [
      { from: 'kh', to: 'bg' }, { from: 'kh', to: 'hd' }, { from: 'gia', to: 'bg' }, { from: 'km', to: 'bg' },
      { from: 'bg', to: 'dh', label: 'Lập đơn' }, { from: 'hd', to: 'dh', label: 'Theo HĐ' },
      { from: 'dh', to: 'sx', label: 'Thành phẩm' }, { from: 'dh', to: 'ck' }, { from: 'sx', to: 'ck' }, { from: 'xe', to: 'ck' },
      { from: 'ck', to: 'hdb' }, { from: 'ck', to: 'cn', label: 'Đã giao' }, { from: 'cn', to: 'nn' }, { from: 'cn', to: 'thu', label: 'Thu' },
    ],
  },
  {
    key: 'mua-hang',
    title: 'Mua hàng',
    lead: 'Từ nhà cung cấp và hợp đồng mua, qua đơn mua, nhận hàng vào kho, đến hoá đơn và trả tiền.',
    stages: ['Chuẩn bị', 'Đặt hàng', 'Nhận hàng', 'Hoá đơn và công nợ', 'Trả tiền'],
    nodes: [
      n('ncc', 'Nhà cung cấp', 'Hồ sơ, hạn trả, mặt hàng cung cấp', '/nha-cung-cap', 'supplier', 0, 0),
      n('hdm', 'Hợp đồng mua', 'Giá trị ký, theo dõi đã đặt', '/hop-dong/mua', 'voucher', 1, 0),
      n('dm', 'Đơn mua hàng', 'Nháp, duyệt gửi NCC, nhận từng đợt', '/mua-hang', 'cart', 1, 1),
      n('nk', 'Nhập, xuất kho', 'Phiếu nhập sinh ra khi nhận hàng', '/kho/phieu', 'arrows-inout', 2, 1, false),
      n('tk', 'Tồn kho', 'Tồn và giá vốn bình quân', '/kho/ton-kho', 'stock', 3, 0, false),
      n('hdd', 'Hoá đơn mua dịch vụ', 'Điện, vận chuyển, dịch vụ có hoá đơn', '/hoa-don-mua', 'receipt', 3, 1),
      n('cnp', 'Công nợ phải trả', 'Còn nợ NCC, hạn trả', '/cong-no/nha-cung-cap', 'ledger-out', 3, 2),
      n('chi', 'Thu, chi tiền', 'Phiếu chi, đối trừ công nợ', '/thu-chi', 'cash', 4, 2, false),
    ],
    edges: [
      { from: 'ncc', to: 'hdm' }, { from: 'ncc', to: 'dm' }, { from: 'hdm', to: 'dm', label: 'Thực hiện' },
      { from: 'dm', to: 'nk', label: 'Nhận' }, { from: 'nk', to: 'tk' }, { from: 'nk', to: 'cnp', label: 'Ghi nợ' },
      { from: 'hdd', to: 'cnp' }, { from: 'cnp', to: 'chi', label: 'Trả' },
    ],
  },
  {
    key: 'kho',
    title: 'Kho',
    lead: 'Hàng hoá và tồn kho, các phiếu nhập xuất, và lệnh sản xuất biến vật tư thành thành phẩm.',
    stages: ['Danh mục', 'Nguồn nhập xuất', 'Phiếu kho', 'Kết quả'],
    nodes: [
      n('vt', 'Vật tư hàng hoá', 'Danh mục, giá, định mức', '/hang-hoa', 'product', 0, 0),
      n('dm', 'Đơn mua hàng', 'Nhận hàng sinh phiếu nhập', '/mua-hang', 'cart', 1, 0, false),
      n('dh', 'Chứng từ bán hàng', 'Giao hàng sinh phiếu xuất', '/don-hang', 'receipt', 1, 1, false),
      n('sx', 'Lệnh sản xuất', 'Xuất vật tư, nhập thành phẩm', '/san-xuat', 'factory', 1, 2),
      n('ph', 'Nhập, xuất kho', 'Nhập, xuất, chuyển, kiểm kê, huỷ', '/kho/phieu', 'arrows-inout', 2, 1),
      n('tk', 'Tồn kho', 'Tồn theo kho, cảnh báo dưới tối thiểu', '/kho/ton-kho', 'stock', 3, 1),
    ],
    edges: [
      { from: 'vt', to: 'sx', label: 'Định mức' },
      { from: 'dm', to: 'ph', label: 'Nhập' }, { from: 'dh', to: 'ph', label: 'Xuất' }, { from: 'sx', to: 'ph', label: 'Xuất, nhập' },
      { from: 'ph', to: 'tk' },
    ],
  },
  {
    key: 'quy',
    title: 'Quỹ và ngân hàng',
    lead: 'Mọi khoản thu chi, chuyển tiền giữa các quỹ, kiểm quỹ và đối chiếu sao kê ngân hàng.',
    stages: ['Công nợ', 'Phiếu', 'Kiểm soát'],
    nodes: [
      n('cnt', 'Công nợ phải thu', 'Khách trả tiền', '/cong-no/khach-hang', 'ledger-in', 0, 0, false),
      n('cnp', 'Công nợ phải trả', 'Trả tiền nhà cung cấp', '/cong-no/nha-cung-cap', 'ledger-out', 0, 1, false),
      n('tuoi', 'Phân tích tuổi nợ', 'Khoản nợ quá hạn theo tuổi', '/cong-no/tuoi-no', 'hourglass', 0, 2),
      n('tc', 'Thu, chi tiền', 'Phiếu thu, phiếu chi, số dư các quỹ', '/thu-chi', 'cash', 1, 0),
      n('ct', 'Chuyển tiền nội bộ', 'Giữa quỹ tiền mặt và ngân hàng', '/thu-chi/chuyen-tien', 'arrows-inout', 1, 2),
      n('kk', 'Kiểm kê quỹ', 'Đếm tiền thực tế, xử lý chênh lệch', '/thu-chi/kiem-ke-quy', 'table', 2, 0),
      n('dc', 'Đối chiếu ngân hàng', 'Khớp sao kê với phiếu thu chi', '/thu-chi/doi-chieu-ngan-hang', 'ledger-in', 2, 2),
      n('sq', 'Sổ chi tiết tài khoản', 'Sổ quỹ và sổ tiền gửi', '/ke-toan/so-chi-tiet', 'table', 2, 1, false),
    ],
    edges: [
      { from: 'cnt', to: 'tc', label: 'Thu' }, { from: 'cnp', to: 'tc', label: 'Chi' }, { from: 'tuoi', to: 'tc' },
      { from: 'tc', to: 'kk' }, { from: 'tc', to: 'dc', label: 'Khớp' }, { from: 'ct', to: 'dc' }, { from: 'tc', to: 'sq', label: 'Ghi sổ' },
    ],
  },
  {
    key: 'ke-toan',
    title: 'Kế toán',
    lead: 'Chứng từ ở các phân hệ tự sinh bút toán vào sổ cái; từ sổ cái ra sổ sách, báo cáo và thuế.',
    stages: ['Nguồn chứng từ', 'Sổ cái', 'Sổ sách', 'Báo cáo', 'Thuế và cuối kỳ'],
    nodes: [
      n('ban', 'Bán hàng', 'Doanh thu, giá vốn, thuế đầu ra', '/don-hang', 'receipt', 0, 0, false),
      n('mua', 'Mua hàng', 'Hàng nhập, thuế đầu vào', '/mua-hang', 'cart', 0, 1, false),
      n('quy', 'Thu, chi tiền', 'Tiền mặt, ngân hàng, công nợ', '/thu-chi', 'cash', 0, 2, false),
      n('luong', 'Bảng lương', 'Lương, bảo hiểm, thuế TNCN', '/ke-toan/luong', 'money-out', 0, 3),
      n('tay', 'Nhập bút toán', 'Bút toán tay, số dư đầu kỳ', '/ke-toan/but-toan', 'pencil', 0, 4),
      n('nk', 'Sổ nhật ký chung', 'Mọi bút toán theo ngày', '/ke-toan/so-nhat-ky', 'table', 1, 1),
      n('ct', 'Sổ chi tiết tài khoản', 'Từng tài khoản, số dư luỹ kế', '/ke-toan/so-chi-tiet', 'table', 2, 2),
      n('cn', 'Tổng hợp công nợ', 'Phải thu, phải trả theo đối tượng', '/ke-toan/tong-hop-cong-no', 'ledger-in', 2, 1),
      n('cd', 'Bảng cân đối phát sinh', 'Dư đầu kỳ, phát sinh, dư cuối kỳ', '/ke-toan/can-doi-phat-sinh', 'report', 2, 0),
      n('bs', 'Bảng cân đối kế toán', 'Tài sản và nguồn vốn', '/ke-toan/can-doi-ke-toan', 'table', 3, 0),
      n('kq', 'Kết quả kinh doanh', 'Doanh thu, chi phí, lợi nhuận', '/ke-toan/ket-qua-kinh-doanh', 'trending-up', 3, 1),
      n('lc', 'Lưu chuyển tiền tệ', 'Dòng tiền theo hoạt động', '/ke-toan/luu-chuyen-tien-te', 'trending-up', 3, 2),
      n('gtgt', 'Thuế GTGT', 'Bảng kê, khấu trừ, bù trừ', '/ke-toan/thue-gtgt', 'percent', 3, 3),
      n('tndn', 'Thuế TNDN', 'Tạm tính quý, quyết toán năm', '/ke-toan/thue-tndn', 'percent', 4, 3),
      n('kc', 'Kết chuyển cuối kỳ', 'Kết chuyển lãi lỗ, đóng sổ năm', '/ke-toan/ket-chuyen', 'lock', 4, 1),
    ],
    edges: [
      { from: 'ban', to: 'nk', label: 'Tự ghi' }, { from: 'mua', to: 'nk' }, { from: 'quy', to: 'nk' }, { from: 'luong', to: 'nk' }, { from: 'tay', to: 'nk' },
      { from: 'nk', to: 'ct' }, { from: 'nk', to: 'cn' }, { from: 'nk', to: 'cd' },
      { from: 'cd', to: 'bs' }, { from: 'cd', to: 'kq' }, { from: 'ct', to: 'lc' }, { from: 'ct', to: 'gtgt' }, { from: 'kq', to: 'tndn' },
      { from: 'kq', to: 'kc', label: 'Cuối kỳ' }, { from: 'tndn', to: 'kc' },
    ],
  },
];

export const featureMapOf = (key: string | null | undefined): FeatureMap | undefined => FEATURE_MAPS.find((m) => m.key === key);

// ---------- layout: pure, so it is testable without a browser ----------

export const NODE_W = 176;
/** Six columns or more (Bán hàng): slightly narrower boxes and gaps, so the drawing needs little shrinking to fit a screen. */
export const NODE_W_WIDE = 160;
export const NODE_H = 74;
export const COL_GAP = 58;
export const COL_GAP_WIDE = 58;
export const ROW_GAP = 36;
const PAD = 16;
const HEAD = 30;
/** A map with few columns is spread to about this width (its gaps grow, up to MAX_GAP) instead of being stretched later: the drawing is never shown larger than 1:1. */
const TARGET_W = 1100;
const MAX_GAP = 150;

export interface Placed extends MapNode { x: number; y: number }
export interface Routed extends MapEdge { d: string; lx: number; ly: number; lw: number }

export interface MapLayout {
  nodeW: number;
  width: number;
  height: number;
  nodes: Placed[];
  edges: Routed[];
  stageX: { x: number; label: string }[];
}

/** Width of an arrow's label chip: about 7px a letter at 12.5px, plus padding. */
export const labelWidth = (text: string): number => Math.round(text.length * 7 + 14);

/** Boxes by (stage, lane), and a smooth curve from the right side of each source to the left side of its target. */
export function layoutOf(map: FeatureMap): MapLayout {
  const lanes = Math.max(...map.nodes.map((x) => x.lane)) + 1;
  const cols = map.stages.length;
  const nodeW = cols >= 6 ? NODE_W_WIDE : NODE_W;
  const minGap = cols >= 6 ? COL_GAP_WIDE : COL_GAP;
  const gap = cols > 1 ? Math.min(MAX_GAP, Math.max(minGap, Math.round((TARGET_W - 2 * PAD - cols * nodeW) / (cols - 1)))) : minGap;
  const nodes = map.nodes.map((x): Placed => ({ ...x, x: PAD + x.stage * (nodeW + gap), y: PAD + HEAD + x.lane * (NODE_H + ROW_GAP) }));
  const byId = new Map(nodes.map((x) => [x.id, x]));
  const edges = map.edges.flatMap((e): Routed[] => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) return [];
    if (a.stage === b.stage) {
      const down = b.y > a.y;
      const cx = a.x + nodeW / 2;
      const y1 = down ? a.y + NODE_H : a.y;
      const y2 = down ? b.y : b.y + NODE_H;
      return [{ ...e, d: `M ${cx} ${y1} L ${cx} ${y2}`, lx: cx, ly: (y1 + y2) / 2, lw: labelWidth(e.label ?? '') }];
    }
    const x1 = a.x + nodeW;
    const y1 = a.y + NODE_H / 2;
    const x2 = b.x;
    const y2 = b.y + NODE_H / 2;
    const k = Math.max(24, (x2 - x1) / 2);
    return [{ ...e, d: `M ${x1} ${y1} C ${x1 + k} ${y1}, ${x2 - k} ${y2}, ${x2} ${y2}`, lx: (x1 + x2) / 2, ly: (y1 + y2) / 2, lw: labelWidth(e.label ?? '') }];
  });
  return {
    nodeW,
    width: PAD * 2 + cols * nodeW + (cols - 1) * gap,
    height: PAD * 2 + HEAD + lanes * NODE_H + (lanes - 1) * ROW_GAP,
    nodes,
    edges,
    stageX: map.stages.map((label, i) => ({ x: PAD + i * (nodeW + gap), label })),
  };
}
