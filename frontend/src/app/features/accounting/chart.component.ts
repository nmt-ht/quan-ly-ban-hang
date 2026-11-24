/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountingService, AccountInput } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { Account, AccountKind } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ConfirmService, DialogField } from '../../shared/confirm/confirm.service';
import { foldVi } from '../../shared/format.util';
import { ToastService } from '../../core/services/toast.service';

const KIND: Record<string, string> = {
  TAI_SAN: 'Tài sản', NO_PHAI_TRA: 'Nợ phải trả', VON_CSH: 'Vốn CSH', DOANH_THU: 'Doanh thu', CHI_PHI: 'Chi phí', KQKD: 'Xác định KQKD',
};
/** Thứ tự loại tài khoản như bảng cân đối / bảng hệ thống TK TT133. */
const KIND_ORDER = ['TAI_SAN', 'NO_PHAI_TRA', 'VON_CSH', 'DOANH_THU', 'CHI_PHI', 'KQKD'] as const;

/** /ke-toan/tai-khoan — hệ thống tài khoản (TT133). */
@Component({
  selector: 'app-accounting-chart',
  standalone: true,
  imports: [RouterLink, NavIconComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Hệ thống tài khoản</h1>
        <p class="subtitle">{{ accounts().length }} tài khoản theo Thông tư 133. Bấm "Sổ cái" để xem phát sinh của tài khoản.</p>
      </div>
      @if (canManage) {
        <div class="toolbar">
          <button type="button" class="btn btn-primary" (click)="add()"><app-nav-icon name="plus" />Thêm tài khoản</button>
        </div>
      }
    </div>

    <div class="filters-bar">
      <input type="search" class="filter-search" placeholder="Tìm số hiệu, tên tài khoản…" aria-label="Tìm tài khoản" [value]="search()" (input)="search.set($any($event.target).value)" />
      <select aria-label="Loại tài khoản" [value]="kindFilter()" (change)="kindFilter.set($any($event.target).value)">
        <option value="">Mọi loại</option>
        @for (k of kinds; track k[0]) { <option [value]="k[0]">{{ k[1] }}</option> }
      </select>
    </div>

    <div class="rp-surface rp-grid coa" [class.coa-manage]="canManage">
      <table class="book-table">
        <colgroup><col class="c-code" /><col /><col class="c-kind" /><col class="c-side" /><col class="c-act" /></colgroup>
        <thead><tr>
          <th scope="col">Số hiệu</th><th scope="col">Tên tài khoản</th><th scope="col">Loại</th><th scope="col">Dư thường</th><th scope="col"><span class="visually-hidden">Thao tác</span></th>
        </tr></thead>
        <tbody>
          @for (g of groups(); track g.kind) {
            <tr class="coa-group"><td colspan="5">{{ g.label }} <span class="coa-group-count num">{{ g.rows.length }}</span></td></tr>
            @for (a of g.rows; track a.code) {
              <tr [class.book-head]="!a.isDetail" [class.is-detail]="a.isDetail" [class.is-off]="!a.isActive">
                <td class="code">{{ a.code }}</td>
                <td class="coa-name">{{ a.name }}@if (!a.isActive) { <span class="coa-off">Ngừng dùng</span> }</td>
                <td class="coa-muted">{{ kind(a.kind) }}</td>
                <td class="coa-muted">{{ a.normalSide === 'NO' ? 'Nợ' : 'Có' }}</td>
                <td class="r coa-acts">
                  @if (a.isDetail) { <a class="btn row-act-btn" [routerLink]="['/ke-toan/so-cai', a.code]">Sổ cái</a> }
                  @if (canManage) {
                    <button type="button" class="btn row-act-btn" (click)="edit(a)">Sửa</button>
                    <button type="button" class="btn row-act-btn" (click)="toggleActive(a)">{{ a.isActive ? 'Ngừng' : 'Dùng lại' }}</button>
                    @if (!a.isSystem) { <button type="button" class="btn btn-danger-ghost row-act-btn" (click)="remove(a)">Xoá</button> }
                  }
                </td>
              </tr>
            }
          } @empty {
            <tr><td class="book-none" colspan="5">{{ accounts().length ? 'Không có tài khoản nào khớp bộ lọc.' : 'Chưa có tài khoản.' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    /* One readable block: the name, its kind and the row buttons sit a thumb apart instead of across a 1600px row. */
    .coa { max-width: 56rem; }
    .coa.coa-manage { max-width: 74rem; }
    .coa table { table-layout: fixed; }
    .coa .c-code { width: 5.5rem; }
    .coa .c-kind { width: 9rem; }
    .coa .c-side { width: 5rem; }
    .coa .c-act { width: 6.5rem; }
    .coa.coa-manage .c-act { width: 19rem; }
    .coa td { padding-block: var(--space-2xs); }
    .coa-name { overflow-wrap: anywhere; }
    .coa tr.is-detail .coa-name { padding-left: var(--space-md); }
    .coa-acts { display: flex; flex-wrap: wrap; gap: var(--space-3xs); justify-content: flex-end; }
    /* Ngừng dùng: viền gạch đứt + chữ mờ như ngôn ngữ "tắt" của hệ thống (design.md), không dùng opacity. */
    .coa tr.is-off .coa-name, .coa tr.is-off .coa-muted, .coa tr.is-off .code { color: var(--color-muted); }
    .coa tr.is-off .code { border-left: 2px dashed var(--color-rule-strong); padding-left: var(--space-2xs); }
    .coa-off { margin-left: var(--space-2xs); padding: 0 var(--space-2xs); border: var(--rule-hair) dashed var(--color-rule-strong); border-radius: 999px; font-size: var(--text-2xs); color: var(--color-muted); white-space: nowrap; }
    .coa-muted { color: var(--color-muted); }
    .coa tr.book-head .coa-muted { color: var(--color-ink-2); font-weight: 500; }
    .coa tr.book-head td { border-top: var(--rule-hair) solid var(--color-rule-strong); }
    /* Dải tiêu đề loại tài khoản: nền giấy nhạt, chữ đậm, trên cùng mỗi nhóm. */
    .coa tr.coa-group td { padding-top: var(--space-xs); background: var(--color-paper-2); color: var(--color-ink); font-weight: 600; border-top: var(--rule-hair) solid var(--color-rule-strong); }
    .coa tr.coa-group .coa-group-count { margin-left: var(--space-2xs); color: var(--color-muted); font-weight: 400; }
  `,
})
export class AccountingChartComponent {
  protected readonly toast = inject(ToastService);
  private readonly svc = inject(AccountingService);
  private readonly dialogs = inject(ConfirmService);
  readonly canManage = inject(AuthService).can('accounting.manage_account');
  readonly accounts = signal<Account[]>([]);
  readonly search = signal('');
  readonly kindFilter = signal('');
  readonly kinds = Object.entries(KIND);
  kind(k: string) { return KIND[k] ?? k; }

  readonly visible = computed(() => {
    const q = foldVi(this.search().trim());
    return this.accounts().filter((a) => (!this.kindFilter() || a.kind === this.kindFilter()) && (!q || foldVi(`${a.code} ${a.name}`).includes(q)));
  });

  /** Tài khoản khớp bộ lọc, gom theo loại và giữ thứ tự số hiệu; loại không có dòng nào thì bỏ. */
  readonly groups = computed(() => {
    const vis = this.visible();
    return KIND_ORDER.map((k) => ({ kind: k, label: KIND[k], rows: vis.filter((a) => a.kind === k) })).filter((g) => g.rows.length);
  });

  constructor() { this.load(); }

  private load() {
    this.svc.accounts().then((a) => this.accounts.set(a)).catch((e) => this.toast.error(errorText(e)));
  }

  /** Các tài khoản tổng hợp (không chi tiết) làm lựa chọn "TK cha". */
  private parentOptions(selfCode?: string) {
    return [
      { value: '', label: '(Không có)' },
      ...this.accounts().filter((a) => !a.isDetail && a.code !== selfCode).map((a) => ({ value: a.code, label: `${a.code} — ${a.name}` })),
    ];
  }

  private structuralFields(a?: Account): DialogField[] {
    return [
      { key: 'name', label: 'Tên tài khoản', required: true, maxLength: 200, value: a?.name },
      { key: 'kind', label: 'Loại', type: 'select', options: this.kinds.map(([v, l]) => ({ value: v, label: l })), value: a?.kind ?? 'TAI_SAN' },
      { key: 'normalSide', label: 'Dư thường', type: 'select', options: [{ value: 'NO', label: 'Nợ' }, { value: 'CO', label: 'Có' }], value: a?.normalSide ?? 'NO' },
      { key: 'parentCode', label: 'Tài khoản cha', type: 'select', options: this.parentOptions(a?.code), value: a?.parentCode ?? '' },
      { key: 'isDetail', label: 'Cấp tài khoản', type: 'select', options: [{ value: 'true', label: 'Chi tiết (ghi được bút toán)' }, { value: 'false', label: 'Tổng hợp (chỉ gộp)' }], value: a ? String(a.isDetail) : 'true' },
    ];
  }

  private toInput(v: Record<string, string>, code?: string): AccountInput {
    return {
      code,
      name: v['name'],
      kind: v['kind'] as AccountKind,
      normalSide: v['normalSide'] === 'CO' ? 'CO' : 'NO',
      parentCode: v['parentCode'] || undefined,
      isDetail: v['isDetail'] !== 'false',
    };
  }

  async add() {
    const ok = await this.dialogs.form({
      title: 'Thêm tài khoản',
      message: 'Thêm một tài khoản chi tiết hoặc tổng hợp ngoài bộ chuẩn TT133.',
      confirmLabel: 'Lưu', tone: 'primary',
      fields: [{ key: 'code', label: 'Số hiệu', required: true, placeholder: '3–6 chữ số', hint: 'Ví dụ 1111, 33311', maxLength: 6 }, ...this.structuralFields()],
      run: (v) => this.svc.createAccount(this.toInput(v, v['code'].trim())),
    });
    if (ok) { this.toast.success(`Đã thêm tài khoản ${ok['code'].trim()}.`); this.load(); }
  }

  async edit(a: Account) {
    const fields = a.isSystem
      ? [{ key: 'name', label: 'Tên tài khoản', required: true, maxLength: 200, value: a.name, hint: 'Tài khoản chuẩn (TT133) chỉ sửa được tên.' } as DialogField]
      : this.structuralFields(a);
    const ok = await this.dialogs.form({
      title: `Sửa tài khoản ${a.code}`,
      confirmLabel: 'Lưu', tone: 'primary',
      fields,
      run: (v) => this.svc.updateAccount(a.code, a.isSystem ? { name: v['name'], kind: a.kind, normalSide: a.normalSide, parentCode: a.parentCode ?? undefined, isDetail: a.isDetail } : this.toInput(v)),
    });
    if (ok) { this.toast.success(`Đã sửa tài khoản ${a.code}.`); this.load(); }
  }

  async toggleActive(a: Account) {
    const off = a.isActive;
    const ok = await this.dialogs.ask({
      title: `${off ? 'Ngừng dùng' : 'Dùng lại'} tài khoản ${a.code}?`,
      message: off ? 'Tài khoản vẫn còn trong sổ sách, chỉ không hiện ở các ô chọn tài khoản khi lập chứng từ.' : 'Tài khoản hiện lại ở các ô chọn khi lập chứng từ.',
      confirmLabel: off ? 'Ngừng dùng' : 'Dùng lại', cancelLabel: 'Không', tone: off ? 'danger' : 'primary',
    });
    if (!ok) return;
    try { await this.svc.setAccountActive(a.code, !off); this.toast.success(`Đã ${off ? 'ngừng dùng' : 'dùng lại'} ${a.code}.`); this.load(); }
    catch (e) { this.toast.error(errorText(e)); }
  }

  async remove(a: Account) {
    const ok = await this.dialogs.ask({
      title: `Xoá tài khoản ${a.code}?`,
      message: `Xoá hẳn "${a.name}". Chỉ xoá được tài khoản chưa phát sinh bút toán, chưa có số dư đầu kỳ và không có tài khoản con.`,
      confirmLabel: 'Xoá', cancelLabel: 'Không xoá', tone: 'danger',
    });
    if (!ok) return;
    try { await this.svc.deleteAccount(a.code); this.toast.success(`Đã xoá tài khoản ${a.code}.`); this.load(); }
    catch (e) { this.toast.error(errorText(e)); }
  }
}
