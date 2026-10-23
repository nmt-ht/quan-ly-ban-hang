import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ALL_PERMISSION_CODES } from '../../../core/data/permission-catalog';
import { PermissionModule, Role } from '../../../core/models/domain.models';
import { DataStore } from '../../../core/services/data-store.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { foldVi } from '../../../shared/format.util';
import { AREAS, AccessLevel, hasViewLevel, initialsOf, levelOf, sameSet, setLevel, togglePermission } from './role.rules';
import { RoleService } from './role.service';
import { errorText } from '../../../core/api/api.service';

const LEVEL_LABEL: Record<AccessLevel, string> = { none: 'Không có quyền', view: 'Chỉ xem', full: 'Đầy đủ', custom: 'Tuỳ chỉnh' };

// Thiết lập › Chức vụ & phân quyền: master-detail. Pick a chức vụ on the left; on the right see who
// holds it and what it may do, area by area (tabs). Each group has a one-click level — Không · Chỉ xem ·
// Đầy đủ — and opens up to single permissions for fine tuning. Changes are a draft until "Lưu phân quyền".
// Chức vụ hệ thống (CEO) is read-only. Technical permission codes are never shown — labels only.
@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  imports: [FormsModule, RouterLink, NavIconComponent],
  templateUrl: './roles-permissions.component.html',
  styleUrls: [
    '../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
    '../../delivery-trips/trip-header-dialog/trip-header-dialog.component.scss',
    './roles-permissions.component.scss',
  ],
})
export class RolesPermissionsComponent {
  readonly data = inject(DataStore);
  private readonly svc = inject(RoleService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly total = ALL_PERMISSION_CODES.length;
  readonly levelLabel = LEVEL_LABEL;
  readonly initials = initialsOf;
  readonly hasViewLevel = hasViewLevel;

  readonly selectedId = signal(this.data.roles()[0]?.id ?? '');
  readonly role = computed(() => this.data.roles().find((r) => r.id === this.selectedId()));
  readonly draft = signal<Set<string>>(new Set());
  readonly query = signal('');
  readonly notice = signal('');
  /** A save the server refused (or that could not reach it). */
  readonly failure = signal('');
  readonly pendingId = signal<string | null>(null);
  readonly tab = signal(AREAS[0].key);
  readonly open = signal<ReadonlySet<string>>(new Set());

  // ---------- who holds what ----------
  readonly memberCount = computed(() => {
    const m = new Map<string, number>();
    for (const u of this.data.users()) m.set(u.roleId, (m.get(u.roleId) ?? 0) + 1);
    return m;
  });
  readonly members = computed(() => this.data.users().filter((u) => u.roleId === this.selectedId()));
  readonly shownMembers = computed(() => this.members().slice(0, 5));

  // ---------- draft vs saved ----------
  readonly locked = computed(() => !!this.role()?.isSystem);
  readonly saved = computed(() => new Set(this.role()?.permissions ?? []));
  readonly dirty = computed(() => !this.locked() && !sameSet(this.draft(), this.saved()));
  readonly diff = computed(() => {
    const d = this.draft();
    const s = this.saved();
    return { added: [...d].filter((c) => !s.has(c)).length, removed: [...s].filter((c) => !d.has(c)).length };
  });
  readonly percent = computed(() => Math.round((this.draft().size / this.total) * 100));

  /** Changes whenever the *saved* permissions or the selected role change — not on a mere rename. */
  private readonly savedKey = computed(() => `${this.selectedId()}:${(this.role()?.permissions ?? []).join(',')}`);

  constructor() {
    effect(() => {
      this.savedKey();
      untracked(() => this.draft.set(new Set(this.role()?.permissions ?? [])));
    });
  }

  // ---------- areas, groups, levels ----------
  /** Every group as a row with its current level; `items` are the permissions that match the search. */
  private readonly allRows = computed(() => {
    const q = foldVi(this.query().trim());
    const d = this.draft();
    const rows = new Map<string, { m: PermissionModule; items: PermissionModule['permissions']; on: number; total: number; level: AccessLevel }>();
    for (const m of this.data.permissionModules()) {
      const items = q && !foldVi(m.label).includes(q) ? m.permissions.filter((p) => foldVi(p.label).includes(q)) : m.permissions;
      rows.set(m.key, { m, items, on: m.permissions.filter((p) => d.has(p.code)).length, total: m.permissions.length, level: levelOf(m, d) });
    }
    return rows;
  });

  readonly areas = computed(() =>
    AREAS.map((a) => {
      const rows = a.modules.map((k) => this.allRows().get(k)).filter((r): r is NonNullable<typeof r> => !!r);
      return { ...a, on: rows.reduce((s, r) => s + r.on, 0), total: rows.reduce((s, r) => s + r.total, 0) };
    }),
  );

  readonly searching = computed(() => this.query().trim() !== '');

  /** Normal view: groups of the selected tab. Searching: every matching group, across all tabs, under its area. */
  readonly view = computed(() => {
    const searching = this.searching();
    return AREAS.filter((a) => searching || a.key === this.tab())
      .map((a) => ({
        key: a.key,
        label: a.label,
        rows: a.modules.map((k) => this.allRows().get(k)).filter((r): r is NonNullable<typeof r> => !!r && (!searching || r.items.length > 0)),
      }))
      .filter((g) => g.rows.length > 0);
  });

  readonly groupsWithAccess = computed(() => [...this.allRows().values()].filter((r) => r.on > 0).length);
  readonly groupCount = computed(() => this.allRows().size);

  isOpen(key: string): boolean {
    return this.searching() || this.open().has(key);
  }

  toggleOpen(key: string): void {
    const next = new Set(this.open());
    next.has(key) ? next.delete(key) : next.add(key);
    this.open.set(next);
  }

  has(code: string): boolean {
    return this.draft().has(code);
  }

  applyLevel(m: PermissionModule, level: 'none' | 'view' | 'full'): void {
    if (this.locked()) return;
    this.draft.set(setLevel(this.draft(), m, level));
  }

  toggle(m: PermissionModule, code: string, on: boolean): void {
    if (this.locked()) return;
    this.draft.set(togglePermission(this.draft(), m, code, on));
  }

  setAll(on: boolean): void {
    if (this.locked()) return;
    this.draft.set(on ? new Set(ALL_PERMISSION_CODES) : new Set());
  }

  /** Start the draft from another chức vụ's permissions (still needs "Lưu phân quyền"). */
  copyFromRole(id: string): void {
    if (this.locked() || !id) return;
    const from = this.data.roles().find((r) => r.id === id);
    if (!from) return;
    this.draft.set(new Set(from.permissions));
    this.notice.set(`Đã lấy quyền của ${from.name} làm bản nháp — kiểm tra rồi bấm Lưu phân quyền.`);
  }

  // ---------- switching role with unsaved changes ----------
  select(r: Role): void {
    if (r.id === this.selectedId()) return;
    if (this.dirty()) {
      this.pendingId.set(r.id);
      return;
    }
    this.go(r.id);
  }

  private go(id: string): void {
    this.selectedId.set(id);
    this.query.set('');
    this.notice.set('');
    this.pendingId.set(null);
    this.open.set(new Set());
  }

  resolveSwitch(discard: boolean): void {
    const id = this.pendingId();
    if (discard && id) this.go(id);
    else this.pendingId.set(null);
  }

  // ---------- save / revert ----------
  async save(): Promise<void> {
    const r = this.role();
    if (!r || !this.dirty()) return;
    const { added, removed } = this.diff();
    this.failure.set('');
    try {
      await this.svc.setPermissions(r.id, this.draft());
    } catch (e) {
      this.failure.set(errorText(e));
      return;
    }
    this.notice.set(`Đã lưu phân quyền cho ${r.name}: thêm ${added}, bỏ ${removed} quyền.`);
  }

  revert(): void {
    this.draft.set(new Set(this.saved()));
  }

  // ---------- chức vụ dialog ----------
  readonly dlgMode = signal<'create' | 'edit'>('create');
  readonly name = signal('');
  readonly description = signal('');
  readonly copyFrom = signal('');
  readonly error = signal('');

  openCreate(): void {
    this.dlgMode.set('create');
    this.name.set('');
    this.description.set('');
    this.copyFrom.set('');
    this.error.set('');
    this.show();
  }

  openEdit(): void {
    const r = this.role();
    if (!r || r.isSystem) return;
    this.dlgMode.set('edit');
    this.name.set(r.name);
    this.description.set(r.description);
    this.error.set('');
    this.show();
  }

  private show(): void {
    this.dialog().nativeElement.showModal();
    setTimeout(() => document.getElementById('rp-name')?.focus());
  }

  closeDialog(): void {
    this.dialog().nativeElement.close();
  }

  async saveRole(): Promise<void> {
    try {
      const draft = { name: this.name(), description: this.description() };
      if (this.dlgMode() === 'edit') {
        const r = this.role()!;
        await this.svc.update(r.id, draft);
        this.notice.set(`Đã lưu chức vụ "${draft.name.trim()}".`);
      } else {
        const from = this.data.roles().find((x) => x.id === this.copyFrom());
        const created = await this.svc.create(draft, this.copyFrom() || undefined);
        this.go(created.id);
        this.notice.set(from ? `Đã thêm chức vụ "${created.name}" với quyền sao chép từ ${from.name}.` : `Đã thêm chức vụ "${created.name}". Chọn quyền cho chức vụ này.`);
      }
      this.error.set('');
      this.closeDialog();
    } catch (e) {
      this.error.set(errorText(e));
    }
  }

  async toggleActive(): Promise<void> {
    const r = this.role();
    if (!r || r.isSystem) return;
    const on = !r.isActive;
    try {
      await this.svc.setActive(r.id, on);
      const holders = this.members().length;
      this.notice.set(
        on
          ? `Đã dùng lại chức vụ "${r.name}".`
          : `Đã ngừng dùng "${r.name}". Chức vụ này không còn hiện khi thêm người dùng mới${holders ? `; ${holders} người đang giữ vẫn giữ nguyên quyền` : ''}.`,
      );
    } catch (e) {
      this.failure.set(errorText(e));
    }
  }
}
