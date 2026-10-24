import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { TagColor, TagColors } from '../models/domain.models';
import { DataStore } from './data-store.service';
import { AuthService } from './auth.service';
import { ApiService, errorText } from '../api/api.service';
import {
  DELIVERY_TRIP_STATUS_LABEL, PRODUCT_TYPE_LABEL, PRODUCTION_ORDER_STATUS_LABEL, PURCHASE_ORDER_STATUS_LABEL,
  QUOTATION_STATUS_LABEL, SALES_ORDER_STATUS_LABEL,
} from '../../shared/status-labels';

export type { TagColor } from '../models/domain.models';

export interface TagItem {
  key: string;
  label: string;
  default: TagColor;
}

export interface TagGroup {
  id: string;
  label: string;
  hint: string;
  items: TagItem[];
}

function items<K extends string>(labels: Record<K, string>, defaults: Record<K, TagColor>): TagItem[] {
  return (Object.keys(labels) as K[]).map((key) => ({ key, label: labels[key], default: defaults[key] }));
}

export const TAG_GROUPS: TagGroup[] = [
  {
    id: 'product-type',
    label: 'Tính chất hàng hoá',
    hint: 'Badge tính chất ở danh mục hàng hoá, thẻ lưới, trang chi tiết và bộ lọc.',
    items: items(PRODUCT_TYPE_LABEL, { VAT_TU: 250, THANH_PHAM: 50, DICH_VU: 330 }),
  },
  {
    id: 'business-status',
    label: 'Trạng thái kinh doanh',
    hint: 'Cột Trạng thái của danh mục hàng hoá.',
    items: items({ ACTIVE: 'Đang kinh doanh', INACTIVE: 'Ngừng kinh doanh' }, { ACTIVE: 150, INACTIVE: 'neutral' }),
  },
  {
    id: 'customer-type',
    label: 'Loại khách hàng',
    hint: 'Badge Loại ở danh sách và trang chi tiết khách hàng.',
    items: items({ LE: 'Lẻ', SI: 'Sỉ', DROPSHIP: 'Dropship' }, { LE: 'neutral', SI: 200, DROPSHIP: 300 }),
  },
  {
    id: 'customer-status',
    label: 'Trạng thái khách hàng',
    hint: 'Cột Trạng thái của danh sách và trang chi tiết khách hàng.',
    items: items({ ACTIVE: 'Đang theo dõi', INACTIVE: 'Ngừng theo dõi' }, { ACTIVE: 150, INACTIVE: 'neutral' }),
  },
  {
    id: 'warehouse-voucher',
    label: 'Loại phiếu kho',
    hint: 'Cột Loại của Phiếu kho.',
    items: items(
      { NHAP: 'Nhập kho', XUAT: 'Xuất kho', CHUYEN: 'Chuyển kho', KIEM_KE: 'Kiểm kê', TRA_VE: 'Nhập trả về' },
      { NHAP: 150, XUAT: 25, CHUYEN: 240, KIEM_KE: 285, TRA_VE: 65 },
    ),
  },
  {
    id: 'user-status',
    label: 'Trạng thái người dùng',
    hint: 'Cột Trạng thái của Thiết lập › Người dùng.',
    items: items({ ACTIVE: 'Đang hoạt động', DISABLED: 'Đã khoá' }, { ACTIVE: 150, DISABLED: 'neutral' }),
  },
  {
    id: 'vehicle-status',
    label: 'Tình trạng xe',
    hint: 'Cột Tình trạng của Danh mục xe.',
    items: items({ DANG_DUNG: 'Đang dùng', BAO_TRI: 'Bảo trì', NGUNG_DUNG: 'Ngừng dùng' }, { DANG_DUNG: 150, BAO_TRI: 65, NGUNG_DUNG: 'neutral' }),
  },
  {
    id: 'supplier-status',
    label: 'Trạng thái nhà cung cấp',
    hint: 'Cột Trạng thái của danh sách và trang chi tiết nhà cung cấp.',
    items: items({ ACTIVE: 'Còn hợp tác', INACTIVE: 'Ngừng hợp tác' }, { ACTIVE: 150, INACTIVE: 'neutral' }),
  },
  {
    id: 'sales-order',
    label: 'Trạng thái đơn hàng bán',
    hint: 'Cột Trạng thái của Đơn hàng bán.',
    items: items(SALES_ORDER_STATUS_LABEL, {
      CHO_SAN_XUAT: 65, DANG_SAN_XUAT: 285, CHO_GIAO_HANG: 200, DANG_GIAO: 240,
      HOAN_THANH: 150, GIAO_MOT_PHAN: 95, TRA_TOAN_BO: 25, HUY: 'neutral',
    }),
  },
  {
    id: 'quotation',
    label: 'Trạng thái báo giá',
    hint: 'Cột Trạng thái của Báo giá.',
    items: items(QUOTATION_STATUS_LABEL, { MOI: 240, HET_HAN: 65, DA_CHOT: 150, HUY: 'neutral' }),
  },
  {
    id: 'purchase-order',
    label: 'Trạng thái đơn nhập hàng',
    hint: 'Cột Trạng thái của Đơn nhập hàng.',
    items: items(PURCHASE_ORDER_STATUS_LABEL, {
      NHAP: 'neutral', DA_GUI_NCC: 240, NHAN_MOT_PHAN: 65, DA_NHAN_DU: 200, HOAN_TAT: 150, HUY: 25,
    }),
  },
  {
    id: 'production-order',
    label: 'Trạng thái lệnh sản xuất',
    hint: 'Cột Trạng thái của Lệnh sản xuất.',
    items: items(PRODUCTION_ORDER_STATUS_LABEL, { NHAP: 'neutral', DANG_SAN_XUAT: 285, HOAN_TAT: 150, HUY: 25 }),
  },
  {
    id: 'delivery-trip',
    label: 'Trạng thái chuyến giao hàng',
    hint: 'Cột Trạng thái của Chuyến giao hàng.',
    items: items(DELIVERY_TRIP_STATUS_LABEL, { GOM_DON: 65, DA_XUAT_KHO: 240, XE_VE_KHO: 200, HOAN_TAT: 150, HUY: 'neutral' }),
  },
];

// Swatches offered first; any other hue is reachable with the slider.
export const TAG_PRESETS: { color: TagColor; name: string }[] = [
  { color: 'neutral', name: 'Xám' },
  { color: 25, name: 'Đỏ' },
  { color: 50, name: 'Cam đất' },
  { color: 70, name: 'Hổ phách' },
  { color: 100, name: 'Vàng ô liu' },
  { color: 150, name: 'Xanh lá' },
  { color: 185, name: 'Xanh ngọc' },
  { color: 215, name: 'Xanh biển' },
  { color: 250, name: 'Xanh lam' },
  { color: 285, name: 'Chàm' },
  { color: 310, name: 'Tím' },
  { color: 340, name: 'Hồng' },
];

/** Wait this long after the last change (a dragged slider fires on every step) before saving. */
const SAVE_DELAY_MS = 400;

// Company display colours for tags: one set per company (GET / PUT /company/display-colors), loaded
// with the danh mục. Everyone sees them; changing them needs company.update. A change shows at once
// and is saved shortly after; if the save fails the colours go back to what the server has.
@Injectable({ providedIn: 'root' })
export class DisplayColorsService {
  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly overrides = this.data.tagColors;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private saves = Promise.resolve();
  private changeSeq = 0;

  readonly groups = TAG_GROUPS;
  readonly canEdit = computed(() => this.auth.can('company.update'));
  readonly saving = signal(false);
  readonly error = signal('');

  readonly changedCount = computed(() => Object.keys(this.overrides()).length);

  constructor() {
    const style = document.createElement('style');
    style.id = 'nt-tag-colors';
    document.head.appendChild(style);
    effect(() => (style.textContent = this.css()));
  }

  colorOf(groupId: string, key: string): TagColor {
    const o = this.overrides()[`${groupId}:${key}`];
    if (o !== undefined) return o;
    return this.groups.find((g) => g.id === groupId)?.items.find((i) => i.key === key)?.default ?? 'neutral';
  }

  isDefault(groupId: string, key: string): boolean {
    return this.overrides()[`${groupId}:${key}`] === undefined;
  }

  set(groupId: string, key: string, color: TagColor): void {
    const item = this.groups.find((g) => g.id === groupId)?.items.find((i) => i.key === key);
    this.change((o) => {
      const next = { ...o };
      if (item && item.default === color) delete next[`${groupId}:${key}`];
      else next[`${groupId}:${key}`] = color;
      return next;
    });
  }

  resetGroup(groupId: string): void {
    this.change((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith(`${groupId}:`))));
  }

  resetAll(): void {
    this.change(() => ({}));
  }

  private change(fn: (o: TagColors) => TagColors): void {
    if (!this.canEdit()) return;
    this.overrides.update(fn);
    this.error.set('');
    this.saving.set(true);
    clearTimeout(this.saveTimer);
    const seq = ++this.changeSeq;
    this.saveTimer = setTimeout(() => (this.saves = this.saves.then(() => this.save(seq))), SAVE_DELAY_MS);
  }

  /** Saves run one after another, each sending the colours as they are by then. */
  private async save(seq: number): Promise<void> {
    try {
      await this.api.put<TagColors>('/company/display-colors', { colors: this.overrides() });
    } catch (e) {
      if (seq !== this.changeSeq) return; // a newer change saves again
      this.error.set(errorText(e));
      try {
        this.overrides.set(await this.api.get<TagColors>('/company/display-colors'));
      } catch {
        /* keep what is shown; the error says the change was not saved */
      }
    } finally {
      if (seq === this.changeSeq) this.saving.set(false);
    }
  }

  private css(): string {
    const rules: string[] = [];
    for (const g of this.groups) {
      for (const i of g.items) {
        const c = this.colorOf(g.id, i.key);
        rules.push(
          // Xám = the paper's warm hue at ~10 % chroma, so it matches the app's tinted greys.
          c === 'neutral'
            ? `.tag-${g.id}-${i.key}{--tag-h:100;--tag-c:0.1}`
            : `.tag-${g.id}-${i.key}{--tag-h:${Math.round(c)};--tag-c:1}`,
        );
      }
    }
    return rules.join('\n');
  }
}
