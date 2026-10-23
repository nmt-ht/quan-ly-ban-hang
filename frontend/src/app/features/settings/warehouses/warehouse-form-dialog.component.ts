import { Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Warehouse } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { errorText } from '../../../core/api/api.service';
import { KeeperCandidate, WarehouseService } from './warehouse.service';

const PHONE = /^[0-9+().\s-]{8,15}$/;

/** Thêm / Sửa kho — one dialog for the Kho list and a kho's own page. Emits the saved kho and whether it is new. */
@Component({
  selector: 'app-warehouse-form-dialog',
  standalone: true,
  imports: [FormsModule, NavIconComponent],
  styleUrls: [
    '../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
    '../../delivery-trips/trip-header-dialog/trip-header-dialog.component.scss',
  ],
  template: `
    <dialog #dialog class="rg-dialog th-dialog" aria-labelledby="whf-title">
      <header class="rg-head">
        <div>
          <h2 id="whf-title">{{ editing() ? 'Sửa kho' : 'Thêm kho' }}</h2>
          @if (editing()?.code; as c) { <p class="subtitle num">{{ c }}</p> } @else { <p class="subtitle">Mã kho được cấp tự động khi lưu.</p> }
        </div>
        <button type="button" class="icon-action" aria-label="Đóng" (click)="close()"><app-nav-icon name="x" /></button>
      </header>
      <div class="rg-body th-body">
        <label class="field th-note">
          <span>Tên kho <span class="required-mark">*</span></span>
          <input id="whf-name" type="text" maxlength="100" placeholder="VD: Kho vật tư, Kho thành phẩm, Kho chi nhánh 2" [ngModel]="name()" (ngModelChange)="name.set($event)"
            [attr.aria-invalid]="attempted() && nameIssue() ? 'true' : null" />
          @if (duplicate(); as d) { <span class="hint text-danger">Đã có kho "{{ d.name }}".</span> }
        </label>

        <label class="field">
          <span>Thủ kho</span>
          <select [ngModel]="managerId()" (ngModelChange)="managerId.set($event)">
            <option value="">— Chưa giao —</option>
            @for (u of managers(); track u.id) { <option [value]="u.id">{{ u.name }} — {{ u.roleName }}</option> }
          </select>
          <span class="hint">
            @if (managersLoading()) { Đang tải danh sách… }
            @else if (!managers().length) { Chưa có ai đủ điều kiện — giao quyền lập phiếu kho hoặc kiểm kê cho một chức vụ ở Thiết lập › Chức vụ. }
            @else { Chỉ hiện người có chức vụ được lập phiếu kho hoặc kiểm kê. }
          </span>
        </label>

        <label class="field">
          <span>Điện thoại kho</span>
          <input type="tel" maxlength="30" placeholder="VD: 0912 345 678" [ngModel]="phone()" (ngModelChange)="phone.set($event)"
            [attr.aria-invalid]="attempted() && phoneIssue() ? 'true' : null" />
          @if (attempted() && phoneIssue()) { <span class="hint text-danger">{{ phoneIssue() }}</span> }
        </label>

        <label class="field th-note">
          <span>Địa chỉ</span>
          <textarea rows="2" maxlength="300" placeholder="Số nhà, đường, phường / xã, tỉnh / thành" [ngModel]="address()" (ngModelChange)="address.set($event)"></textarea>
        </label>

        <label class="field th-note">
          <span>Ghi chú</span>
          <textarea rows="2" maxlength="1000" placeholder="Giờ nhận hàng, lối xe vào, sức chứa…" [ngModel]="note()" (ngModelChange)="note.set($event)"></textarea>
        </label>

        @if (editing()) {
          <label class="check-line th-note">
            <input type="checkbox" [ngModel]="isActive()" (ngModelChange)="isActive.set($event)" /> Đang dùng
            <span class="hint">Bỏ chọn để ngừng dùng: kho không còn được chọn khi lập chứng từ mới; tồn và phiếu cũ vẫn giữ.</span>
          </label>
        }
      </div>
      <footer class="rg-foot">
        <p class="rg-summary" [class.text-danger]="!!failure() || (attempted() && !!issue())" role="status">{{ failure() || (attempted() ? issue() : '') }}</p>
        <div class="toolbar">
          <button type="button" class="btn" (click)="close()">Huỷ</button>
          <button type="button" class="btn btn-primary" [disabled]="!name().trim() || saving()" (click)="save()">{{ saving() ? 'Đang lưu…' : 'Lưu' }}</button>
        </div>
      </footer>
    </dialog>
  `,
})
export class WarehouseFormDialogComponent {
  private readonly svc = inject(WarehouseService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  readonly saved = output<{ warehouse: Warehouse; created: boolean }>();

  readonly editing = signal<Warehouse | null>(null);
  readonly name = signal('');
  readonly managerId = signal('');
  readonly phone = signal('');
  readonly address = signal('');
  readonly note = signal('');
  readonly isActive = signal(true);
  readonly attempted = signal(false);
  readonly saving = signal(false);
  readonly failure = signal('');

  /** People who may be thủ kho (from the server), plus the current one if they no longer qualify — kept, flagged. */
  private readonly candidates = signal<KeeperCandidate[]>([]);
  readonly managersLoading = signal(false);
  readonly managers = computed<KeeperCandidate[]>(() => {
    const list = this.candidates();
    const w = this.editing();
    if (w?.managerId && !list.some((u) => u.id === w.managerId)) {
      return [{ id: w.managerId, name: w.managerName ?? w.managerId, roleName: 'không còn quyền kho' }, ...list];
    }
    return list;
  });

  readonly duplicate = computed(() => this.svc.duplicateName(this.name(), this.editing()?.id ?? null));
  readonly nameIssue = computed(() => {
    const n = this.name().trim();
    if (!n) return 'Nhập tên kho';
    if (this.duplicate()) return `Đã có kho "${this.duplicate()!.name}"`;
    return '';
  });
  readonly phoneIssue = computed(() => (this.phone().trim() && !PHONE.test(this.phone().trim()) ? 'Số điện thoại 8–15 chữ số' : ''));
  readonly issue = computed(() => this.nameIssue() || this.phoneIssue());

  open(w?: Warehouse): void {
    this.editing.set(w ?? null);
    this.name.set(w?.name ?? '');
    this.managerId.set(w?.managerId ?? '');
    this.phone.set(w?.phone ?? '');
    this.address.set(w?.address ?? '');
    this.note.set(w?.note ?? '');
    this.isActive.set(w?.isActive !== false);
    this.attempted.set(false);
    this.failure.set('');
    void this.loadCandidates();
    this.dialog().nativeElement.showModal();
    setTimeout(() => document.getElementById('whf-name')?.focus());
  }

  private async loadCandidates(): Promise<void> {
    this.managersLoading.set(true);
    try {
      this.candidates.set(await this.svc.managerCandidates());
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.managersLoading.set(false);
    }
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  async save(): Promise<void> {
    this.attempted.set(true);
    if (this.issue()) return;
    const w = this.editing();
    const draft = {
      name: this.name(), managerId: this.managerId(), phone: this.phone(), address: this.address(), note: this.note(),
      isActive: w ? this.isActive() : true,
    };
    this.saving.set(true);
    try {
      const out = w ? await this.svc.update(w.id, draft) : await this.svc.create(draft);
      this.close();
      this.saved.emit({ warehouse: out, created: !w });
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }
}
