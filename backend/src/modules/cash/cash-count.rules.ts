// Kiểm kê quỹ — xử lý chênh lệch (thừa / thiếu quỹ) bằng một phiếu thu hoặc chi. Phần không cần cơ sở dữ liệu.

/** CHO_XU_LY: chờ tìm nguyên nhân (thiếu: Nợ 1381; thừa: Có 3381). TINH_VAO_KET_QUA: tính ngay vào chi phí khác (Nợ 811) / thu nhập khác (Có 711). */
export const COUNT_RESOLUTIONS = ['CHO_XU_LY', 'TINH_VAO_KET_QUA'] as const;
export type CountResolution = (typeof COUNT_RESOLUTIONS)[number];

export interface ResolutionPlan {
  kind: 'THU' | 'CHI';
  /** Tên loại thu chi hệ thống (seed + migration p9). */
  category: string;
  /** TK đối ứng của phiếu (TK tiền là bên còn lại). */
  account: string;
  label: string;
}

const PLANS: Record<'THIEU' | 'THUA', Record<CountResolution, ResolutionPlan>> = {
  THIEU: {
    CHO_XU_LY: { kind: 'CHI', category: 'Thiếu quỹ chờ xử lý', account: '1381', label: 'Thiếu quỹ chờ xử lý (Nợ 1381 / Có tiền)' },
    TINH_VAO_KET_QUA: { kind: 'CHI', category: 'Thiếu quỹ tính vào chi phí khác', account: '811', label: 'Tính vào chi phí khác (Nợ 811 / Có tiền)' },
  },
  THUA: {
    CHO_XU_LY: { kind: 'THU', category: 'Thừa quỹ chờ giải quyết', account: '3381', label: 'Thừa quỹ chờ giải quyết (Nợ tiền / Có 3381)' },
    TINH_VAO_KET_QUA: { kind: 'THU', category: 'Thừa quỹ tính vào thu nhập khác', account: '711', label: 'Tính vào thu nhập khác (Nợ tiền / Có 711)' },
  },
};

/** Tên các loại thu chi hệ thống của phiếu xử lý chênh lệch kiểm kê (lập / huỷ qua biên bản kiểm kê, không lập tay). */
export const COUNT_CATEGORY_NAMES: ReadonlySet<string> = new Set(
  Object.values(PLANS).flatMap((p) => Object.values(p).map((x) => x.category)),
);

/** Cách xử lý chênh lệch `difference` (thực tế − sổ sách): thiếu thì chi, thừa thì thu; bằng 0 không có gì để xử lý. */
export function resolutionPlan(difference: number, option: CountResolution): ResolutionPlan | null {
  if (!difference) return null;
  return PLANS[difference < 0 ? 'THIEU' : 'THUA'][option];
}

/** Các cách xử lý chọn được cho một chênh lệch (để giao diện hiện đúng lựa chọn). */
export const resolutionOptions = (difference: number): { option: CountResolution; label: string }[] =>
  difference ? COUNT_RESOLUTIONS.map((option) => ({ option, label: resolutionPlan(difference, option)!.label })) : [];
