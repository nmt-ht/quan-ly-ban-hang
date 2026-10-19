import { Injectable, computed, effect, signal } from '@angular/core';
import {
  DELIVERY_TRIP_STATUS_LABEL, PRODUCT_TYPE_LABEL, PRODUCTION_ORDER_STATUS_LABEL, PURCHASE_ORDER_STATUS_LABEL,
  SALES_ORDER_STATUS_LABEL,
} from '../../shared/status-labels';

// A tag colour is a hue (0–360) or 'neutral' (grey). Lightness and chroma are fixed by the
// design tokens (--tag-*), so every choice stays readable in light and dark mode.
export type TagColor = number | 'neutral';

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
    id: 'sales-order',
    label: 'Trạng thái đơn hàng bán',
    hint: 'Cột Trạng thái của Đơn hàng bán.',
    items: items(SALES_ORDER_STATUS_LABEL, {
      CHO_SAN_XUAT: 65, DANG_SAN_XUAT: 285, CHO_GIAO_HANG: 200, DANG_GIAO: 240,
      HOAN_THANH: 150, GIAO_MOT_PHAN: 95, TRA_TOAN_BO: 25, HUY: 'neutral',
    }),
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

const STORAGE_KEY = 'nt.tagColors.v1';

type Overrides = Record<string, TagColor>; // `${groupId}:${key}` -> colour

function load(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
}

// Company display colours for tags. Until the backend has a settings endpoint the choice is
// kept in this browser (localStorage); the API is shaped so swapping the storage is local.
@Injectable({ providedIn: 'root' })
export class DisplayColorsService {
  private readonly overrides = signal<Overrides>(load());
  readonly groups = TAG_GROUPS;

  readonly changedCount = computed(() => Object.keys(this.overrides()).length);

  constructor() {
    const style = document.createElement('style');
    style.id = 'nt-tag-colors';
    document.head.appendChild(style);
    effect(() => {
      style.textContent = this.css();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.overrides()));
      } catch {
        /* storage blocked: colours still apply for this session */
      }
    });
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
    this.overrides.update((o) => {
      const next = { ...o };
      if (item && item.default === color) delete next[`${groupId}:${key}`];
      else next[`${groupId}:${key}`] = color;
      return next;
    });
  }

  resetGroup(groupId: string): void {
    this.overrides.update((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith(`${groupId}:`))));
  }

  resetAll(): void {
    this.overrides.set({});
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
