import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompanyInfo } from '../../../core/models/domain.models';
import { CompanyService } from '../../../core/services/company.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CompanyLetterheadComponent } from '../../../shared/company-letterhead/company-letterhead.component';
import { readLogo } from '../../../shared/company-letterhead/logo-image';
import { PHONE_PATTERN, TAX_CODE_PATTERN, WEBSITE_PATTERN } from './company.rules';
import { errorText } from '../../../core/api/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatDay } from '../../../shared/period';

const clean = (s: string) => s.trim();

// Thiết lập › Thông tin công ty: the legal block printed at the top of every printout.
// Edit → live preview (same letterhead component the printouts use) → explicit Lưu.
@Component({
  selector: 'app-company-info',
  standalone: true,
  imports: [ReactiveFormsModule, NavIconComponent, CompanyLetterheadComponent],
  templateUrl: './company-info.component.html',
  styleUrl: './company-info.component.scss',
})
export class CompanyInfoComponent {
  private readonly fb = inject(FormBuilder);
  private readonly svc = inject(CompanyService);

  readonly today = new Date();
  readonly notice = signal('');
  /** A save the server refused (or that could not reach it). */
  readonly failure = signal('');
  readonly logo = signal<string | undefined>(undefined);
  readonly logoError = signal('');

  private readonly saved = signal<CompanyInfo>(this.svc.info());

  // ---------- xuất quá số tồn ----------
  readonly canPolicy = inject(AuthService).can('company.update');
  readonly allowNegative = computed(() => this.svc.info().allowNegativeStock ?? true);
  readonly policyBusy = signal(false);

  async setStockPolicy(allow: boolean): Promise<void> {
    this.policyBusy.set(true);
    this.failure.set('');
    try {
      await this.svc.setStockPolicy(allow);
    } catch (e) {
      this.failure.set(errorText(e));
      return;
    } finally {
      this.policyBusy.set(false);
    }
    this.notice.set(allow ? 'Đã cho phép xuất quá số tồn kho.' : 'Từ nay phiếu xuất làm tồn kho âm sẽ bị từ chối (trừ người có quyền "Xuất vượt tồn kho").');
  }

  // ---------- khoá sổ kỳ kế toán ----------
  readonly canLock = inject(AuthService).can('period.lock');
  readonly lockDate = computed(() => this.svc.info().lockDate?.slice(0, 10) ?? null);
  readonly lockDraft = signal(this.svc.info().lockDate?.slice(0, 10) ?? '');
  readonly lockBusy = signal(false);
  readonly day = formatDay;

  async saveLock(clear = false): Promise<void> {
    const next = clear ? null : this.lockDraft() || null;
    this.lockBusy.set(true);
    this.failure.set('');
    try {
      await this.svc.setLockDate(next);
    } catch (e) {
      this.failure.set(errorText(e));
      return;
    } finally {
      this.lockBusy.set(false);
    }
    this.lockDraft.set(next ?? '');
    this.notice.set(next ? `Đã khoá sổ đến ngày ${formatDay(next)}.` : 'Đã bỏ khoá sổ.');
  }

  constructor() {
    this.logo.set(this.saved().logo);
  }

  readonly form = this.fb.nonNullable.group({
    name: [this.saved().name, [Validators.required, Validators.maxLength(200)]],
    address: [this.saved().address ?? '', Validators.maxLength(300)],
    taxCode: [this.saved().taxCode ?? '', Validators.pattern(TAX_CODE_PATTERN)],
    phone: [this.saved().phone ?? '', Validators.pattern(PHONE_PATTERN)],
    email: [this.saved().email ?? '', Validators.email],
    website: [this.saved().website ?? '', Validators.pattern(WEBSITE_PATTERN)],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** What the preview shows: the draft as typed, trimmed. A blank name falls back so the preview never collapses. */
  readonly draft = computed<CompanyInfo>(() => {
    const v = this.value();
    return {
      name: clean(v.name ?? '') || 'Tên công ty',
      address: clean(v.address ?? '') || undefined,
      taxCode: clean(v.taxCode ?? '') || undefined,
      phone: clean(v.phone ?? '') || undefined,
      email: clean(v.email ?? '') || undefined,
      website: clean(v.website ?? '') || undefined,
      logo: this.logo(),
    };
  });

  /** True when the form differs from what is saved. */
  readonly dirty = computed(() => {
    const d = this.draft();
    const s = this.saved();
    const blank = clean(this.value().name ?? '') === '';
    return blank || d.name !== s.name || d.address !== (s.address || undefined) || d.taxCode !== (s.taxCode || undefined)
      || d.phone !== (s.phone || undefined) || d.email !== (s.email || undefined) || d.website !== (s.website || undefined)
      || d.logo !== (s.logo || undefined);
  });

  async pickLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // picking the same file again must still fire
    if (!file) return;
    const r = await readLogo(file);
    if ('error' in r) {
      this.logoError.set(r.error);
      return;
    }
    this.logoError.set('');
    this.logo.set(r.url);
  }

  removeLogo(): void {
    this.logo.set(undefined);
    this.logoError.set('');
  }

  showError(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      document.querySelector<HTMLElement>('.ng-invalid:not(form)')?.focus();
      return;
    }
    const d = this.draft();
    this.failure.set('');
    try {
      await this.svc.save(d);
    } catch (e) {
      this.failure.set(errorText(e));
      return;
    }
    this.saved.set(d);
    this.logoError.set('');
    this.form.reset({ name: d.name, address: d.address ?? '', taxCode: d.taxCode ?? '', phone: d.phone ?? '', email: d.email ?? '', website: d.website ?? '' });
    this.notice.set('Đã lưu thông tin công ty. Các bản in sẽ dùng thông tin mới.');
  }

  revert(): void {
    const s = this.saved();
    this.form.reset({ name: s.name, address: s.address ?? '', taxCode: s.taxCode ?? '', phone: s.phone ?? '', email: s.email ?? '', website: s.website ?? '' });
    this.logo.set(s.logo);
    this.logoError.set('');
    this.notice.set('');
  }
}
