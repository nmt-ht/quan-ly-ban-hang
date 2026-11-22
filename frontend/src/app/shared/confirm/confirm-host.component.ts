import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorText } from '../../core/api/api.service';
import { DateInputDirective } from '../date-input/date-input.directive';
import { ConfirmService } from './confirm.service';

/**
 * Draws ConfirmService's pending dialog: a question, or a question with a small form. Esc or a click on the backdrop answers "no"
 * (unless the work is running). Enter in a one-line field submits.
 */
@Component({
  selector: 'app-confirm-host',
  standalone: true,
  imports: [FormsModule, DateInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg class="cf-dialog" aria-labelledby="cf-title" aria-describedby="cf-msg" role="alertdialog"
      (cancel)="$event.preventDefault(); close()" (click)="onBackdrop($event)">
      @if (svc.current(); as c) {
        <form class="cf-form" (ngSubmit)="submit()" novalidate>
          <div class="cf-body">
            <h2 id="cf-title">{{ c.title }}</h2>
            @if (c.message) { <p id="cf-msg">{{ c.message }}</p> }
            @for (f of c.fields ?? []; track f.key) {
              <div class="cf-field">
                <label [for]="'cf-' + f.key">{{ f.label }} @if (f.required) { <span class="required-mark">*</span> }</label>
                @switch (f.type ?? 'text') {
                  @case ('textarea') {
                    <textarea [id]="'cf-' + f.key" name="{{ f.key }}" rows="3" [attr.maxlength]="f.maxLength ?? null" [placeholder]="f.placeholder ?? ''"
                      [ngModel]="values()[f.key]" (ngModelChange)="set(f.key, $event)" [attr.aria-invalid]="invalid(f.key) ? 'true' : null"></textarea>
                  }
                  @case ('date') {
                    <input [id]="'cf-' + f.key" name="{{ f.key }}" appDate [min]="f.min ?? ''" [max]="f.max ?? ''"
                      [ngModel]="values()[f.key]" (ngModelChange)="set(f.key, $event)" [attr.aria-invalid]="invalid(f.key) ? 'true' : null" />
                  }
                  @case ('select') {
                    <select [id]="'cf-' + f.key" name="{{ f.key }}" [ngModel]="values()[f.key]" (ngModelChange)="set(f.key, $event)" [attr.aria-invalid]="invalid(f.key) ? 'true' : null">
                      @for (o of f.options ?? []; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
                    </select>
                  }
                  @case ('number') {
                    <input [id]="'cf-' + f.key" name="{{ f.key }}" type="number" min="0" step="any" inputmode="decimal"
                      [ngModel]="values()[f.key]" (ngModelChange)="set(f.key, '' + ($event ?? ''))" [attr.aria-invalid]="invalid(f.key) ? 'true' : null" />
                  }
                  @default {
                    <input [id]="'cf-' + f.key" name="{{ f.key }}" type="text" autocomplete="off" [attr.maxlength]="f.maxLength ?? null" [placeholder]="f.placeholder ?? ''"
                      [ngModel]="values()[f.key]" (ngModelChange)="set(f.key, $event)" [attr.aria-invalid]="invalid(f.key) ? 'true' : null" />
                  }
                }
                @if (invalid(f.key)) { <span class="cf-error" role="alert">{{ f.label }} không được để trống.</span> }
                @else if (f.hint) { <span class="cf-hint">{{ f.hint }}</span> }
              </div>
            }
            @if (error()) { <p class="cf-fail" role="alert">{{ error() }}</p> }
          </div>
          <footer class="cf-foot">
            <button type="button" class="btn" [disabled]="busy()" [attr.autofocus]="c.tone === 'danger' && !c.fields?.length ? '' : null" (click)="close()">{{ c.cancelLabel || 'Không' }}</button>
            <button type="submit" class="btn" [class.btn-danger]="c.tone === 'danger'" [class.btn-primary]="c.tone !== 'danger'" [disabled]="busy()"
              [attr.autofocus]="c.tone === 'danger' && !c.fields?.length ? null : ''">{{ busy() ? 'Đang xử lý…' : (c.confirmLabel || 'Đồng ý') }}</button>
          </footer>
        </form>
      }
    </dialog>
  `,
  styles: `
    .cf-dialog {
      width: min(30rem, calc(100vw - 2 * var(--space-sm)));
      max-height: calc(100dvh - 2 * var(--space-sm));
      padding: 0;
      border: var(--rule-hair) solid var(--color-rule);
      border-radius: var(--radius-card);
      background: var(--color-surface);
      color: var(--color-ink);
      box-shadow: 0 16px 48px var(--color-shadow);
    }
    .cf-dialog::backdrop { background: var(--color-shadow); }
    .cf-body { padding: var(--space-md) var(--space-md) var(--space-sm); }
    .cf-body h2 { margin: 0; font-size: var(--text-md); font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
    .cf-body p { margin: var(--space-2xs) 0 0; color: var(--color-ink-2); font-size: var(--text-sm); line-height: 1.5; overflow-wrap: anywhere; }
    .cf-field { display: flex; flex-direction: column; gap: var(--space-3xs); margin-top: var(--space-sm); }
    .cf-field label { font-size: var(--text-sm); font-weight: 500; }
    .cf-field input, .cf-field select, .cf-field textarea {
      width: 100%;
      min-height: var(--control-h);
      padding: var(--space-3xs) var(--space-xs);
      border: var(--rule-hair) solid var(--color-rule-strong);
      border-radius: var(--radius-control);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
      font-size: var(--text-sm);
    }
    .cf-field textarea { resize: vertical; }
    .cf-field [aria-invalid='true'] { border-color: var(--color-danger); }
    .cf-hint { color: var(--color-muted); font-size: var(--text-xs); }
    .cf-error { color: var(--color-danger); font-size: var(--text-xs); }
    .cf-body p.cf-fail { margin-top: var(--space-sm); padding: var(--space-2xs) var(--space-xs); border-radius: var(--radius-control); background: var(--color-danger-tint); color: var(--color-danger); }
    .cf-foot { display: flex; justify-content: flex-end; gap: var(--space-2xs); padding: var(--space-xs) var(--space-md) var(--space-sm); }
  `,
})
export class ConfirmHostComponent {
  protected readonly svc = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly values = signal<Record<string, string>>({});
  readonly attempted = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      const c = this.svc.current();
      if (c) {
        untracked(() => {
          this.values.set(Object.fromEntries((c.fields ?? []).map((f) => [f.key, f.value ?? (f.type === 'select' ? f.options?.[0]?.value ?? '' : '')])));
          this.attempted.set(false);
          this.busy.set(false);
          this.error.set('');
        });
        if (!el.open) el.showModal();
        // Focus: the first field of a form, else the safe button of a question.
        queueMicrotask(() => (el.querySelector<HTMLElement>('input, textarea, select') ?? el.querySelector<HTMLElement>('[autofocus]'))?.focus());
      } else if (el.open) {
        el.close();
      }
    });
  }

  set(key: string, value: string): void {
    this.values.update((v) => ({ ...v, [key]: value ?? '' }));
  }

  invalid(key: string): boolean {
    const f = this.svc.current()?.fields?.find((x) => x.key === key);
    return !!f?.required && this.attempted() && !(this.values()[key] ?? '').trim();
  }

  async submit(): Promise<void> {
    const c = this.svc.current();
    if (!c || this.busy()) return;
    const fields = c.fields ?? [];
    this.attempted.set(true);
    const missing = fields.find((f) => f.required && !(this.values()[f.key] ?? '').trim());
    if (missing) {
      this.dlg().nativeElement.querySelector<HTMLElement>(`#cf-${missing.key}`)?.focus();
      return;
    }
    const out = Object.fromEntries(fields.map((f) => [f.key, (this.values()[f.key] ?? '').trim()]));
    if (c.run) {
      this.busy.set(true);
      this.error.set('');
      try {
        await c.run(out);
      } catch (e) {
        this.error.set(errorText(e));
        this.busy.set(false);
        return;
      }
    }
    this.svc.answer(fields.length ? out : true);
  }

  close(): void {
    if (!this.busy()) this.svc.answer(null);
  }

  onBackdrop(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.close();
  }
}
