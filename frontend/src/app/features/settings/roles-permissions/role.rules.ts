import { PermissionModule } from '../../../core/models/domain.models';

/** The "Xem …" permission of a group, if it has one: every other permission in the group needs it. */
export function viewCodeOf(module: PermissionModule): string | undefined {
  return module.permissions.find((p) => p.code.endsWith('.view'))?.code;
}

/** Tick / untick one permission, keeping "Xem" consistent: ticking anything ticks Xem; unticking Xem clears the group. */
export function togglePermission(granted: ReadonlySet<string>, module: PermissionModule, code: string, on: boolean): Set<string> {
  const next = new Set(granted);
  const view = viewCodeOf(module);
  if (on) {
    next.add(code);
    if (view) next.add(view);
  } else if (code === view) {
    for (const p of module.permissions) next.delete(p.code);
  } else {
    next.delete(code);
  }
  return next;
}

export function setModule(granted: ReadonlySet<string>, module: PermissionModule, on: boolean): Set<string> {
  const next = new Set(granted);
  for (const p of module.permissions) (on ? next.add(p.code) : next.delete(p.code));
  return next;
}

export const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/** Another role already uses this name (diacritic- and case-insensitive)? */
export function roleNameTaken(names: { id: string; name: string }[], id: string | null, name: string, fold: (s: string) => string): boolean {
  const n = fold(name.trim());
  return names.some((r) => r.id !== id && fold(r.name.trim()) === n);
}

// ---------- areas (tabs) and per-group access level ----------

/** Business areas the permission groups are sorted into, so 25 groups read as 7 tabs. */
export const AREAS: { key: string; label: string; modules: string[] }[] = [
  { key: 'sell', label: 'Bán hàng', modules: ['customer', 'order', 'quote', 'trip', 'vehicle'] },
  { key: 'buy', label: 'Mua hàng', modules: ['supplier', 'purchase'] },
  { key: 'stock', label: 'Hàng hoá & kho', modules: ['product', 'price', 'bom', 'category', 'warehouse', 'stock', 'stock_voucher', 'stocktake'] },
  { key: 'make', label: 'Sản xuất', modules: ['production'] },
  { key: 'money', label: 'Tiền & công nợ', modules: ['debt', 'voucher'] },
  { key: 'report', label: 'Báo cáo', modules: ['dashboard', 'report'] },
  { key: 'admin', label: 'Hệ thống', modules: ['user', 'position', 'company', 'tag', 'audit'] },
];

export type AccessLevel = 'none' | 'view' | 'full' | 'custom';

/** Does the group have a "view only" level (a Xem permission plus at least one more)? */
export function hasViewLevel(module: PermissionModule): boolean {
  return !!viewCodeOf(module) && module.permissions.length > 1;
}

export function levelOf(module: PermissionModule, granted: ReadonlySet<string>): AccessLevel {
  const on = module.permissions.filter((p) => granted.has(p.code)).length;
  if (on === 0) return 'none';
  if (on === module.permissions.length) return 'full';
  const view = viewCodeOf(module);
  if (view && hasViewLevel(module) && on === 1 && granted.has(view)) return 'view';
  return 'custom';
}

/** Jump a whole group to Không / Chỉ xem / Đầy đủ. */
export function setLevel(granted: ReadonlySet<string>, module: PermissionModule, level: 'none' | 'view' | 'full'): Set<string> {
  const next = new Set(granted);
  for (const p of module.permissions) next.delete(p.code);
  if (level === 'full') for (const p of module.permissions) next.add(p.code);
  if (level === 'view') {
    const view = viewCodeOf(module);
    if (view) next.add(view);
  }
  return next;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}
